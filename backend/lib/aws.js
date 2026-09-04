import {
  EC2Client, RunInstancesCommand, DescribeInstancesCommand, TerminateInstancesCommand,
  StartInstancesCommand, StopInstancesCommand,
  AllocateAddressCommand, AssociateAddressCommand, ReleaseAddressCommand, DescribeAddressesCommand,
} from '@aws-sdk/client-ec2';

// ─── Region config ──────────────────────────────────────────────────────────
// AMI IDs per region (must be copied to each region)
const REGION_CONFIG = {
  // Fallback AMI ids = morphy-golden-v4 (2026-09-04: agent 0.5.0, provision.sh runs as root,
  // boot re-post service). Railway should still set AMI_* explicitly; keep in sync with INFRA.md.
  na: {
    awsRegion: 'us-east-1',
    amiId: process.env.AMI_US_EAST_1 || 'ami-0a9da362c5db5f5ce',
    securityGroup: process.env.SG_US_EAST_1 || 'sg-023fa7964b46feb25',
    label: 'North America (Virginia)',
  },
  eu: {
    awsRegion: 'eu-central-1',
    amiId: process.env.AMI_EU_CENTRAL_1 || 'ami-066e27abfe88d9adb',
    securityGroup: process.env.SG_EU_CENTRAL_1 || 'sg-0956278b8533089dc',
    label: 'Europe (Frankfurt)',
  },
  br: {
    awsRegion: 'sa-east-1',
    amiId: process.env.AMI_SA_EAST_1 || 'ami-008352febbee87da0',
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
  // Exact morphyagent version the box should install at first boot (AGENT_VERSION env).
  // Unset → provision.sh keeps the copy baked into the AMI instead of pulling npm "latest".
  agentVersion,
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
    ...(agentVersion ? { agentVersion } : {}),
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
      // Encrypted: the volume holds the customer's AI keys, OAuth tokens, wallet key and chats.
      // Uses the account's default EBS KMS key — no extra IAM needed.
      Ebs: { VolumeSize: planCfg.volumeSize, VolumeType: 'gp3', DeleteOnTermination: true, Encrypted: true },
    }],
    // IMDSv2 only, hop limit 1: user-data (relay token etc.) is readable by local processes
    // only, never through a forwarded/containerised hop.
    MetadataOptions: { HttpTokens: 'required', HttpPutResponseHopLimit: 1, HttpEndpoint: 'enabled' },
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
 * Stop an EC2 instance and wait until it is stopped (max ~2 min). Used for pause/suspend.
 */
export async function stopInstance(ec2InstanceId, region) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) throw new Error(`Unknown region: ${region}`);
  const ec2 = getClient(regionCfg.awsRegion);
  await ec2.send(new StopInstancesCommand({ InstanceIds: [ec2InstanceId] }));
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const info = await describeInstance(ec2InstanceId, region);
    if (info?.state === 'stopped') { console.log(`[aws] Stopped ${ec2InstanceId}`); return; }
  }
  console.warn(`[aws] ${ec2InstanceId} still not stopped after 2 min (continuing)`);
}

/**
 * Start a stopped EC2 instance and wait until it is running (max ~3 min).
 */
export async function startInstance(ec2InstanceId, region) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) throw new Error(`Unknown region: ${region}`);
  const ec2 = getClient(regionCfg.awsRegion);
  await ec2.send(new StartInstancesCommand({ InstanceIds: [ec2InstanceId] }));
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const info = await describeInstance(ec2InstanceId, region);
    if (info?.state === 'running') { console.log(`[aws] Started ${ec2InstanceId}`); return info; }
  }
  throw new Error(`Instance ${ec2InstanceId} did not reach running state after start`);
}

// ─── Elastic IPs ────────────────────────────────────────────────────────────
// One EIP per managed box so the public IP — and therefore the CF A-record — never
// changes across stop/start (relay restart, pause/resume, AWS retirement). Every
// function here is best-effort: if the IAM user lacks ec2:AllocateAddress /
// AssociateAddress / ReleaseAddress / DescribeAddresses the caller falls back to the
// ephemeral public IP and logs, exactly like before EIPs existed.

/**
 * Allocate an EIP and attach it to a running instance.
 * @returns {{ allocationId: string, publicIp: string } | null}
 */
export async function attachElasticIp(ec2InstanceId, region, tags = {}) {
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) return null;
  const ec2 = getClient(regionCfg.awsRegion);
  let allocationId = null;
  try {
    const alloc = await ec2.send(new AllocateAddressCommand({
      Domain: 'vpc',
      TagSpecifications: [{
        ResourceType: 'elastic-ip',
        Tags: [
          { Key: 'Name', Value: `bloby-${tags.instanceId || ec2InstanceId}` },
          ...(tags.instanceId ? [{ Key: 'bloby:instanceId', Value: tags.instanceId }] : []),
        ],
      }],
    }));
    allocationId = alloc.AllocationId;
    await ec2.send(new AssociateAddressCommand({ AllocationId: allocationId, InstanceId: ec2InstanceId }));
    console.log(`[aws] EIP ${alloc.PublicIp} (${allocationId}) → ${ec2InstanceId}`);
    return { allocationId, publicIp: alloc.PublicIp };
  } catch (err) {
    console.warn(`[aws] EIP attach failed for ${ec2InstanceId} (falling back to ephemeral IP): ${err.message}`);
    // Don't leak an allocated-but-unassociated address.
    if (allocationId) {
      await ec2.send(new ReleaseAddressCommand({ AllocationId: allocationId })).catch(() => {});
    }
    return null;
  }
}

/** Release an EIP (best-effort; tolerates already-released). */
export async function releaseElasticIp(allocationId, region) {
  if (!allocationId) return;
  const regionCfg = REGION_CONFIG[region];
  if (!regionCfg) return;
  const ec2 = getClient(regionCfg.awsRegion);
  try {
    // A terminated instance auto-disassociates; explicit disassociate is only needed for a
    // stopped one. ReleaseAddress on a still-associated address fails, so look it up first.
    const d = await ec2.send(new DescribeAddressesCommand({ AllocationIds: [allocationId] }));
    const addr = d.Addresses?.[0];
    if (!addr) return;
    await ec2.send(new ReleaseAddressCommand({ AllocationId: allocationId }));
    console.log(`[aws] Released EIP ${addr.PublicIp} (${allocationId})`);
  } catch (err) {
    if (!/InvalidAllocationID\.NotFound/.test(err.name || err.message)) {
      console.warn(`[aws] EIP release failed for ${allocationId}: ${err.message}`);
    }
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
