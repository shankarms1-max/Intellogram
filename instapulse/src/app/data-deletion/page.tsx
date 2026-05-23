import Link from "next/link";

export const metadata = { title: "Data Deletion | Channel Radar" };

export default function DataDeletionPage() {
  const contactEmail = process.env.SUPPORT_EMAIL || "privacy@channelradar.app";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-slate">
      <h1>Data Deletion Request</h1>
      <p className="text-muted-foreground">
        Required by Meta for apps that use Instagram or Facebook Login.
      </p>

      <h2>How to Delete Your Data</h2>
      <p>You can remove your data from Channel Radar in two ways:</p>

      <h3>Option 1 — Delete Your Account</h3>
      <ol>
        <li>Sign in to your Channel Radar account</li>
        <li>
          Go to{" "}
          <Link href="/dashboard/settings" className="underline">
            Settings
          </Link>
        </li>
        <li>Scroll to the &quot;Danger Zone&quot; section and click <strong>Delete Account</strong></li>
        <li>All your workspaces, connected accounts, media data, and access tokens will be permanently deleted</li>
      </ol>

      <h3>Option 2 — Email Request</h3>
      <p>
        Send a deletion request to{" "}
        <a href={`mailto:${contactEmail}`} className="underline">
          {contactEmail}
        </a>{" "}
        with the subject line <strong>Data Deletion Request</strong> and include the email address
        associated with your account. We will process your request within 30 days and confirm by
        email.
      </p>

      <h2>What Gets Deleted</h2>
      <ul>
        <li>Your user account and credentials</li>
        <li>All workspace data (accounts, media, snapshots, reports)</li>
        <li>Instagram access tokens (encrypted at rest — deleted permanently)</li>
        <li>API call logs associated with your workspace</li>
        <li>All other data linked to your account</li>
      </ul>

      <h2>Revoking Instagram App Access</h2>
      <p>
        You can also revoke Channel Radar&apos;s access to your Instagram/Facebook data directly from
        Meta:
      </p>
      <ol>
        <li>
          Go to{" "}
          <a
            href="https://www.facebook.com/settings?tab=applications"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Facebook Settings → Apps and Websites
          </a>
        </li>
        <li>Find Channel Radar and click <strong>Remove</strong></li>
      </ol>
      <p>
        Revoking access in Meta settings invalidates the access token but does not delete your
        Channel Radar account or stored analytics data. Use Option 1 or 2 above for full deletion.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about data deletion, email{" "}
        <a href={`mailto:${contactEmail}`} className="underline">
          {contactEmail}
        </a>
        .
      </p>

      <div className="mt-8 pt-4 border-t text-sm text-muted-foreground">
        <Link href="/privacy" className="underline">
          ← Privacy Policy
        </Link>
        {" · "}
        <Link href="/" className="underline">
          Home
        </Link>
      </div>
    </div>
  );
}
