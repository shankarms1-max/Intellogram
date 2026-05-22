import Link from "next/link";

export const metadata = { title: "Terms of Service | InstaPulse Analytics" };

export default function TermsPage() {
  const appName = "InstaPulse Analytics";
  const contactEmail = process.env.SUPPORT_EMAIL || "legal@instapulse.example.com";
  const lastUpdated = "2025-05-16";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-slate">
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

      <h2>1. Acceptance</h2>
      <p>
        By using {appName} you agree to these Terms of Service. If you do not agree, do not use
        the service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        {appName} is an Instagram analytics platform that connects to the official Meta Instagram
        Graph API. It helps you track performance data for Instagram Business and Creator accounts
        you own or monitor.
      </p>

      <h2>3. Permitted Use</h2>
      <p>You may use {appName} only to:</p>
      <ul>
        <li>Analyse Instagram Business or Creator accounts you own or have authority to manage</li>
        <li>Monitor publicly available competitor data within Meta API limitations</li>
        <li>Generate reports from data fetched via the official Meta Graph API</li>
      </ul>

      <h2>4. Prohibited Use</h2>
      <p>You may not:</p>
      <ul>
        <li>Scrape Instagram or use unofficial APIs</li>
        <li>Access Instagram data for accounts you are not authorised to manage</li>
        <li>Resell or redistribute data obtained through this service</li>
        <li>Violate{" "}
          <a
            href="https://developers.facebook.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Meta&apos;s Platform Terms
          </a>
        </li>
        <li>Use the service for any unlawful purpose</li>
      </ul>

      <h2>5. Meta Platform Compliance</h2>
      <p>
        {appName} operates exclusively via the official Meta Instagram Graph API. All competitor
        monitoring is limited to data the API makes available for public Business/Creator accounts.
        Private metrics (reach, impressions, saves, stories, audience demographics) are not
        available for competitor accounts through the official API and are not provided by this
        service.
      </p>

      <h2>6. Access Tokens</h2>
      <p>
        You are responsible for maintaining the security of any Meta access tokens you provide.
        Tokens are encrypted at rest and are never exposed to other users. You may revoke tokens
        at any time through your{" "}
        <a
          href="https://www.facebook.com/settings?tab=applications"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Facebook App Settings
        </a>
        .
      </p>

      <h2>7. Data</h2>
      <p>
        You retain ownership of your data. We store Instagram analytics data on your behalf. See
        our{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        for details on data handling and deletion.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        The service is provided &quot;as is&quot;. We make no warranty that the service will be
        uninterrupted, accurate, or error-free. Instagram API availability and rate limits are
        controlled by Meta and may change without notice.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, we shall not be liable for any indirect, incidental,
        or consequential damages arising from your use of the service.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms from time to time. Continued use of the service after changes
        constitutes acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms? Email{" "}
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
