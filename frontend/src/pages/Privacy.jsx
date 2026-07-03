import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { HiArrowLeft } from 'react-icons/hi2'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
}

export default function Privacy() {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: May 17, 2026
          </p>

          <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">The Short Version</h2>
              <p>
                Morphy runs on <strong className="text-foreground">your machine</strong>. Your conversations,
                data, and personal files stay local. We don't see them, store them, or have access to them.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">What We Collect</h2>

              <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">On morphyagent.com (the website)</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Basic, privacy-friendly analytics: page views and approximate country. No individual tracking.</li>
                <li>Your email address, only if you sign up or reserve a handle. We won't share it.</li>
              </ul>

              <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">In the Morphy app</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Nothing. The software runs on your own instance and collects zero data.</li>
                <li>Messages you send through third-party AI providers (Anthropic, OpenAI, etc.) are governed by those providers' privacy policies, not ours.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">What We Don't Do</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Sell or share your data with anyone.</li>
                <li>Track you across the web.</li>
                <li>Read your conversations or agent interactions.</li>
                <li>Store personal data on our servers beyond what's needed for your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Hosting Infrastructure</h2>
              <p>
                Our hosted services run on Amazon Web Services (AWS).{' '}
                <strong className="text-foreground">
                  AWS is a third-party infrastructure provider. Morphy is not affiliated with,
                  endorsed by, or sponsored by Amazon or AWS.
                </strong>{' '}
                Data processed through our hosted version is subject to standard cloud security practices.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Third-Party Services</h2>
              <p className="mb-3">
                Morphy can connect to external services like AI providers, messaging platforms, and
                productivity tools. Each has its own privacy policy. We recommend reviewing them before
                connecting your agent.
              </p>
              <p>
                When your agent sends messages via WhatsApp, Telegram, Discord, or email, those messages
                pass through those platforms' servers. When your agent uses AI providers (Anthropic, OpenAI,
                etc.), your prompts and conversations are processed by those providers. We have no control
                over how third parties handle that data.
              </p>
            </section>

            <section>
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 sm:p-6">
                <h2 className="text-lg font-semibold font-display text-yellow-400 mb-3">
                  Agent Privacy Considerations
                </h2>
                <p className="mb-4">
                  Because Morphy is a self-hosted AI agent with real system access, there are privacy
                  implications beyond a typical web service. Please be aware of the following:
                </p>

                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Your Agent Can Access Local Files</h3>
                <p className="mb-3">
                  Your agent has file system access on the machine it runs on. It can read files within its
                  workspace. Do not store sensitive personal documents, credentials, or private keys in or
                  near the agent's workspace directory.
                </p>

                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Prompt Injection & Data Exfiltration</h3>
                <p className="mb-3">
                  Malicious content in emails, websites, or messages your agent processes could trick it into
                  leaking private information: forwarding files, reading credentials, or sending data to
                  unintended recipients. This is an inherent risk of AI agents that process untrusted input.
                </p>

                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Protect Your Identity</h3>
                <p className="mb-3">
                  We strongly recommend giving your agent <strong className="text-foreground">its own email,
                  phone number, and accounts</strong>, separate from your personal ones. If the agent sends
                  something unexpected or is compromised, your personal identity stays protected.
                </p>

                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">API Keys & Credentials</h3>
                <p>
                  Any API keys you provide to the agent should have <strong className="text-foreground">spending
                  limits</strong> and be <strong className="text-foreground">rotated regularly</strong>. If a key
                  appears in agent logs or output, treat it as compromised and replace it immediately.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Alexa Skill (Morphy Agent)</h2>
              <p className="mb-3">
                The Morphy Agent Alexa skill lets you talk to your Morphy agent through any Echo device. When
                you use the skill, here is exactly what happens to your voice data:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-3">
                <li>
                  <strong className="text-foreground">Amazon transcribes your speech to text.</strong> The
                  audio recording itself stays with Amazon under their{' '}
                  <a
                    href="https://www.amazon.com/gp/help/customer/display.html?nodeId=GVP69FUJ48X9DK8V"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                  >
                    Alexa Privacy Policy
                  </a>
                  . We never receive the raw audio.
                </li>
                <li>
                  <strong className="text-foreground">Amazon sends us the text transcript</strong> along with
                  your anonymous Alexa user ID. Our relay forwards it directly to your own Morphy instance
                  (the tunnel running on your machine). The transcript is held in memory only for the
                  duration of the request. We do not store it in any database or log file.
                </li>
                <li>
                  <strong className="text-foreground">Your agent processes the request and replies</strong>{' '}
                  on your machine. The reply travels back through our relay to Alexa, which speaks it on
                  your device. Again, nothing about the conversation is retained on our servers.
                </li>
                <li>
                  <strong className="text-foreground">The only thing we persist</strong> is the link between
                  your anonymous Alexa user ID and your Morphy handle, plus a per-user shared secret used to
                  authenticate the relay-to-tunnel forward. This link exists so we know which Morphy to
                  forward your voice requests to. You can delete it at any time by disabling the skill in
                  the Alexa app or unlinking from your dashboard.
                </li>
              </ul>
              <p className="mb-3">
                <strong className="text-foreground">No third parties</strong> beyond Amazon (who you've
                already chosen to use by enabling the skill) ever see your voice data. We do not sell,
                share, or analyze it. Voice transcripts are never used to train AI models on our end.
              </p>
              <p>
                <strong className="text-foreground">Children:</strong> the skill is not directed to children
                under 13. We do not knowingly collect data from children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Your Rights</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Request access to any data we hold about you (it's just your email, if you signed up).</li>
                <li>Request deletion of your account and associated data at any time.</li>
                <li>Unsubscribe from any communications instantly.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Changes</h2>
              <p>
                We may update this policy as needed. Changes will be posted here with an updated date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold font-display text-foreground mb-3">Contact</h2>
              <p>
                Questions about your privacy? Reach out on{' '}
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
