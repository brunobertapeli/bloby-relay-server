import { EC2Client, RunInstancesCommand, DescribeInstancesCommand, TerminateInstancesCommand, StartInstancesCommand, StopInstancesCommand } from '@aws-sdk/client-ec2';

// ─── Region config ──────────────────────────────────────────────────────────
// AMI IDs per region (must be copied to each region)
const REGION_CONFIG = {
  na: {
    awsRegion: 'us-east-1',
    amiId: process.env.AMI_US_EAST_1 || 'ami-0cf7cc3ff1dc22b57',
    securityGroup: process.env.SG_US_EAST_1 || 'sg-023fa7964b46feb25',
    label: 'North America (Virginia)',
  },
  eu: {
    awsRegion: 'eu-central-1',
    amiId: process.env.AMI_EU_CENTRAL_1 || 'ami-0a609af0c4c6db866',
    securityGroup: process.env.SG_EU_CENTRAL_1 || 'sg-0956278b8533089dc',
    label: 'Europe (Frankfurt)',
  },
  br: {
    awsRegion: 'sa-east-1',
    amiId: process.env.AMI_SA_EAST_1 || 'ami-063fb1add732ae589',
    securityGroup: process.env.SG_SA_EAST_1 || 'sg-0ab1b5fa370b4e673',
    label: 'Brazil (São Paulo)',
  },
};

// ─── Plan config ────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  starter: { instanceType: 't4g.small', volumeSize: 20 },
  pro: { instanceType: 't4g.medium', volumeSize: 40 },
};

// Cache EC2 clients per region
const clients = {};
function getClient(awsRegion) {
  if (!clients[awsRegion]) {
    clients[awsRegion] = new EC2Client({ region: awsRegion });
  }
  return clients[awsRegion];
}

/**
 * Launch a new EC2 instance from the golden AMI.
 * @param {string} instanceId - Our internal instance ID (for callback)
 * @param {string} plan - 'starter' or 'pro'
 * @param {string} region - 'na', 'eu', or 'br'
 * @param {string} callbackUrl - URL the instance will POST status to
 * @returns {{ ec2InstanceId: string }}
 */
export async function launchInstance({
  instanceId, plan, region, callbackUrl,
  // Managed-mode identity passed to the box via user-data (all optional → legacy
  // tunnel AMIs that ignore them keep working unchanged):
  username, tier, relayToken, relayUrl, provisionToken, ai,
}) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) throw new Error(`Unknown region: ${region}`);
  if (!regionCfg.amiId) throw new Error(`No AMI configured for region: ${region}`);

  const planCfg = PLAN_CONFIG[plan];
  if (!planCfg) throw new Error(`Unknown plan: ${plan}`);

  const ec2 = getClient(regionCfg.awsRegion);

  const userData = Buffer.from(JSON.stringify({
    instanceId,
    callbackUrl,
    // provision.sh seeds these into the bot's config (tunnel OFF, pre-registered):
    ...(username ? { username } : {}),
    ...(tier ? { tier } : {}),
    ...(relayToken ? { relayToken } : {}),
    ...(relayUrl ? { relayUrl } : {}),
    ...(provisionToken ? { provisionToken } : {}),
    ...(ai ? { aiProvider: ai.provider, aiModel: ai.model, aiApiKey: ai.apiKey } : {}),
  })).toString('base64');

  const cmd = new RunInstancesCommand({
    ImageId: regionCfg.amiId,
    InstanceType: planCfg.instanceType,
    MinCount: 1,
    MaxCount: 1,
    SecurityGroupIds: [regionCfg.securityGroup],
    UserData: userData,
    BlockDeviceMappings: [{
      DeviceName: '/dev/xvda',
      Ebs: { VolumeSize: planCfg.volumeSize, VolumeType: 'gp3', DeleteOnTermination: true },
    }],
    TagSpecifications: [{
      ResourceType: 'instance',
      Tags: [
        { Key: 'Name', Value: `bloby-${instanceId}` },
        { Key: 'bloby:instanceId', Value: instanceId },
        { Key: 'bloby:plan', Value: plan },
        { Key: 'bloby:region', Value: region },
      ],
    }],
  });

  const result = await ec2.send(cmd);
  const ec2InstanceId = result.Instances[0].InstanceId;
  console.log(`[aws] Launched ${ec2InstanceId} (${planCfg.instanceType}) in ${regionCfg.awsRegion}`);
  return { ec2InstanceId };
}

/**
 * Get EC2 instance state.
 */
export async function describeInstance(ec2InstanceId, region) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) return null;

  const ec2 = getClient(regionCfg.awsRegion);
  const cmd = new DescribeInstancesCommand({ InstanceIds: [ec2InstanceId] });

  try {
    const result = await ec2.send(cmd);
    const inst = result.Reservations?.[0]?.Instances?.[0];
    return inst ? { state: inst.State.Name, publicIp: inst.PublicIpAddress } : null;
  } catch {
    return null;
  }
}

/**
 * Terminate an EC2 instance.
 */
export async function terminateInstance(ec2InstanceId, region) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) throw new Error(`Unknown region: ${region}`);

  const ec2 = getClient(regionCfg.awsRegion);
  await ec2.send(new TerminateInstancesCommand({ InstanceIds: [ec2InstanceId] }));
  console.log(`[aws] Terminated ${ec2InstanceId} in ${regionCfg.awsRegion}`);
}

/**
 * Restart (stop + start) an EC2 instance.
 * Waits until the instance is running again before resolving.
 */
export async function restartInstance(ec2InstanceId, region) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) throw new Error(`Unknown region: ${region}`);

  const ec2 = getClient(regionCfg.awsRegion);
  console.log(`[aws] Stopping ${ec2InstanceId}...`);
  await ec2.send(new StopInstancesCommand({ InstanceIds: [ec2InstanceId] }));

  // Poll until stopped (max 2 min)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const info = await describeInstance(ec2InstanceId, region);
    if (info?.state === 'stopped') break;
  }

  console.log(`[aws] Starting ${ec2InstanceId}...`);
  await ec2.send(new StartInstancesCommand({ InstanceIds: [ec2InstanceId] }));

  // Poll until running (max 3 min)
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const info = await describeInstance(ec2InstanceId, region);
    if (info?.state === 'running') {
      console.log(`[aws] ${ec2InstanceId} is running again`);
      return;
    }
  }

  throw new Error(`Instance ${ec2InstanceId} did not reach running state after restart`);
}

export { REGION_CONFIG, PLAN_CONFIG };
