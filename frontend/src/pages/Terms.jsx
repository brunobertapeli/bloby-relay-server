import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { HiArrowLeft } from 'react-icons/hi2'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6">
        <motion.div
          className="max-w-3xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <HiArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-2">
            Terms of Use
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: April 7, 2026
          </p>

          <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Overview</h2>
              <p>
                By using Bloby ("the Service"), you agree to these terms. Bloby is an AI agent
                platform licensed under the Business Source License (BSL). The hosted version at bloby.bot
                is provided as-is. If you don't agree with these terms, please don't use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">The Software</h2>
              <p>
                Bloby is distributed under the <strong className="text-foreground">Business Source License (BSL)</strong>.
                You may use and modify the software for non-production purposes. Production use requires a
                valid commercial license unless the BSL terms have converted to a permissive license per the
                schedule defined in the license file. The hosted version we operate is subject to these
                additional terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Handle Reservations</h2>
              <p>
                Bloby handles (e.g. @yourname) are assigned on a <strong className="text-foreground">first-come, first-served</strong> basis.
                Once a handle is reserved and payment is confirmed, it belongs to your account. We do not
                guarantee the availability of any specific handle. Handle reservations are non-transferable
                unless explicitly agreed upon in writing. We reserve the right to reclaim handles that violate
                these terms or remain inactive for an extended period.
              </p>
            </section>

            {/* Agent Safety Warning */}
            <section>
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 sm:p-6">
                <h2 className="text-lg font-semibold font-display text-yellow-400 mb-3">
                  Important: AI Agent Risks & Safety
                </h2>
                <p className="mb-4">
                  Bloby gives your AI agent real capabilities: shell access, file system control, messaging,
                  and more. This is powerful but comes with real risks. <strong className="text-foreground">You
                  are fully responsible for everything your agent does.</strong> Please read this section carefully.
                </p>

                <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">Shell & File System Access</h3>
                <p className="mb-3">
                  Your agent can execute terminal commands and read/write files on the machine it runs on.
                  This means it can install software, modify system files, delete data, and interact with
                  any service accessible from that machine. A misconfigured or misbehaving agent could
                  cause data loss, expose sensitive information, or compromise your system.
                </p>
                <ul className="list-disc list-inside space-y-1.5 mb-4">
                  <li><strong className="text-foreground">Use a dedicated machine.</strong> We strongly recommend running Bloby on a separate computer, VM, or container — not your personal workstation. This isolates the blast radius if something goes wrong.</li>
                  <li><strong className="text-foreground">Limit file system scope.</strong> Bloby operates within its workspace directory. Do not place sensitive files (credentials, personal documents, financial data) in or near this directory.</li>
                  <li><strong className="text-foreground">Review agent actions.</strong> Monitor what your agent does, especially when first setting it up. Check logs regularly.</li>
                </ul>

                <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">Dedicated Identity for Your Agent</h3>
                <p className="mb-3">
                  Your agent may send messages via WhatsApp, Telegram, Discord, email, and other platforms.
                  To protect your personal accounts:
                </p>
                <ul className="list-disc list-inside space-y-1.5 mb-4">
                  <li><strong className="text-foreground">Give the agent its own email address.</strong> Create a separate email account for agent communications. Never use your personal or work email.</li>
                  <li><strong className="text-foreground">Give the agent its own phone number.</strong> Use a dedicated SIM or virtual number for WhatsApp and other phone-based services. If the agent sends something inappropriate, your personal number stays clean.</li>
                  <li><strong className="text-foreground">Use separate accounts everywhere.</strong> Any messaging platform, social media account, or service the agent accesses should be under a dedicated agent identity — not your personal one.</li>
                </ul>

                <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">API Key Management</h3>
                <p className="mb-3">
                  Your agent connects to third-party AI providers (Anthropic, OpenAI, etc.) using your API keys.
                  Poor key management can lead to unexpected bills or unauthorized usage.
                </p>
                <ul className="list-disc list-inside space-y-1.5 mb-4">
                  <li><strong className="text-foreground">Set spending limits.</strong> Every API key you provide to the agent should have hard spending caps configured at the provider level. Without limits, a runaway agent loop could rack up significant costs in minutes.</li>
                  <li><strong className="text-foreground">Rotate keys regularly.</strong> Replace your API keys on a regular schedule (monthly at minimum). If a key is ever exposed in logs or agent output, revoke and replace it immediately.</li>
                  <li><strong className="text-foreground">Use least-privilege keys.</strong> Create API keys with only the permissions your agent actually needs. Don't use admin-level or organization-wide keys.</li>
                  <li><strong className="text-foreground">Monitor usage.</strong> Check your AI provider dashboards regularly for unexpected spikes in usage or cost.</li>
                </ul>

                <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">Prompt Injection</h3>
                <p className="mb-3">
                  Prompt injection is a class of attack where malicious text — hidden in emails, websites,
                  documents, or messages — tricks your AI agent into executing unintended actions. Because
                  your agent has real system access, this is a serious risk.
                </p>
                <ul className="list-disc list-inside space-y-1.5 mb-4">
                  <li>A malicious email could contain hidden instructions that cause your agent to forward sensitive data, delete files, or run harmful commands.</li>
                  <li>A website your agent visits could embed invisible prompts in its content.</li>
                  <li>Documents or messages from other users could contain adversarial text designed to override your agent's instructions.</li>
                </ul>
                <p className="mb-3">
                  <strong className="text-foreground">Mitigations:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1.5 mb-4">
                  <li>Be cautious about what content your agent processes from untrusted sources.</li>
                  <li>Don't give your agent access to sensitive systems it doesn't need.</li>
                  <li>Review your agent's actions regularly, especially after it processes external content.</li>
                  <li>Use Bloby's portal password and 2FA to prevent unauthorized access to your agent.</li>
                </ul>

                <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">Network & Tunnel Exposure</h3>
                <p>
                  If you expose your Bloby instance via a tunnel (Cloudflare, etc.), anyone with the URL can
                  attempt to access it. <strong className="text-foreground">Always set a strong portal password
                  and enable two-factor authentication.</strong> Without these, your agent's full capabilities —
                  including shell access — are effectively public.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Your Responsibilities</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Follow all applicable laws when using the Service.</li>
                <li>Don't use the platform for spam, harassment, fraud, or anything harmful.</li>
                <li>Keep your account credentials and API keys secure.</li>
                <li>You are solely responsible for the actions your AI agent takes on your behalf, including messages it sends, files it modifies, and commands it executes.</li>
                <li>You are responsible for any costs incurred through third-party AI providers (Anthropic, OpenAI, etc.) that your agent connects to.</li>
                <li>You acknowledge you have read and understood the AI Agent Risks & Safety section above.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Hosting & Infrastructure</h2>
              <p>
                The hosted version of Bloby runs on Amazon Web Services (AWS) infrastructure.{' '}
                <strong className="text-foreground">
                  Amazon Web Services, AWS, and all related trademarks are the property of Amazon.com, Inc.
                  Bloby is not affiliated with, endorsed by, or sponsored by Amazon or AWS in any way.
                </strong>{' '}
                We simply use their cloud infrastructure to deliver the Service. Any issues with the hosted
                version of Bloby are our responsibility, not Amazon's.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Paid Services</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>All prices are in USD.</li>
                <li>We offer a 30-day refund policy, no questions asked.</li>
                <li>Purchases are for personal use unless otherwise stated.</li>
                <li>We may change pricing with reasonable notice.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Liability</h2>
              <p>
                Bloby is provided "as is" without warranties of any kind. We are not liable for costs from
                AI providers, actions taken by your agent (including messages sent, files modified, or commands
                executed), data loss, security breaches, prompt injection attacks, or downtime. Use the
                Service at your own risk. We strongly recommend following the safety guidelines above.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Changes to These Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of the Service after changes
                constitutes acceptance. We'll do our best to notify users of significant changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Contact</h2>
              <p>
                Questions? Reach out on our{' '}
                <a
                  href="https://discord.gg/QERDj3CBFj"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Discord
                </a>.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
