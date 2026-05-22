import Link from "next/link";

export const metadata = { title: "Privacy Policy | InstaPulse Analytics" };

export default function PrivacyPage() {
  const appName = "InstaPulse Analytics";
  const contactEmail = process.env.SUPPORT_EMAIL || "privacy@instapulse.example.com";
  const lastUpdated = "2025-05-16";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

      <h2>1. About This Policy</h2>
      <p>
        {appName} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an Instagram analytics tool that connects to the
        official Meta Instagram Graph API. This Privacy Policy explains what data we collect, how we
        use it, and your rights over that data.
      </p>

      <h2>2. Data We Collect</h2>
      <h3>2.1 Account Data</h3>
      <p>
        When you register, we collect your email address and a hashed password. We never store
        plain-text passwords.
      </p>
      <h3>2.2 Instagram Data via Meta Graph API</h3>
      <p>
        When you connect an Instagram Business or Creator account, we access data through the
        official Meta Graph API using permissions you explicitly grant, including:
      </p>
      <ul>
        <li>Public profile information (username, biography, follower count)</li>
        <li>Media posts (images, videos, captions, engagement metrics)</li>
        <li>Insights (reach, impressions, saves — own accounts only)</li>
        <li>Linked Facebook Pages</li>
      </ul>
      <p>
        We do <strong>not</strong> scrape Instagram, use browser automation, or access any data
        beyond what Meta&apos;s official API permits.
      </p>
      <h3>2.3 Access Tokens</h3>
      <p>
        Instagram access tokens are encrypted using AES-256 before storage and are never exposed
        to the browser or to client-side code.
      </p>
      <h3>2.4 Usage Data</h3>
      <p>
        We log API calls made to Meta&apos;s Graph API (endpoint, HTTP status, response time, rate
        limit info) for monitoring and debugging. These logs are scoped to your workspace.
      </p>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>To provide Instagram analytics features within your workspace</li>
        <li>To sync Instagram account data on your behalf</li>
        <li>To generate reports you request</li>
        <li>To monitor API rate limits and service health</li>
      </ul>
      <p>We do not sell your data to third parties.</p>

      <h2>4. Data Retention</h2>
      <p>
        We retain your data while your account is active. You may request deletion at any time
        using the{" "}
        <Link href="/data-deletion" className="underline">
          Data Deletion
        </Link>{" "}
        page or by emailing {contactEmail}.
      </p>

      <h2>5. Third-Party Services</h2>
      <p>
        {appName} uses the Meta Graph API. Your use of this service is also governed by{" "}
        <a
          href="https://www.facebook.com/privacy/policy/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Meta&apos;s Privacy Policy
        </a>
        .
      </p>

      <h2>6. Security</h2>
      <p>
        We encrypt all access tokens and secrets at rest. All API calls are server-side only. We
        implement session-based authentication with secure JWT tokens.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        You have the right to access, correct, export, or delete your data. To exercise these
        rights, contact us at {contactEmail} or use our{" "}
        <Link href="/data-deletion" className="underline">
          Data Deletion
        </Link>{" "}
        page.
      </p>

      <h2>8. Contact</h2>
      <p>
        For privacy questions, email{" "}
        <a href={`mailto:${contactEmail}`} className="underline">
          {contactEmail}
        </a>
        .
      </p>

      <div className="mt-8 pt-4 border-t text-sm text-muted-foreground">
        <Link href="/" className="underline">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
