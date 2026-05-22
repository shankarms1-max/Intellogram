import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { getWorkspaceSummary } from "@/services/metricsService";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { db } from "@/lib/db";
import {
  Users,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  BarChart3,
  TrendingUp,
  Star,
  Trophy,
} from "lucide-react";
import { formatPercent, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountTypeBadge } from "@/components/dashboard/AccountTypeBadge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const summary = await getWorkspaceSummary(workspace.id, 30);

  const recentJobs = await db.syncJob.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your Instagram analytics
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Accounts"
          value={summary.totalAccounts}
          icon={<Users className="h-4 w-4" />}
          description={`${summary.ownAccountsCount} own · ${summary.competitorAccountsCount} competitor`}
        />
        <MetricCard
          title="Total Followers"
          value={summary.totalFollowers}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="Media Fetched"
          value={summary.totalMediaFetched}
          icon={<ImageIcon className="h-4 w-4" />}
          description="Last 30 days"
        />
        <MetricCard
          title="Avg Engagement Rate"
          value={summary.avgEngagementRate}
          format="percent"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Likes"
          value={summary.totalLikes}
          icon={<Heart className="h-4 w-4" />}
          description="Last 30 days"
        />
        <MetricCard
          title="Total Comments"
          value={summary.totalComments}
          icon={<MessageCircle className="h-4 w-4" />}
          description="Last 30 days"
        />
        <MetricCard
          title="Own Accounts"
          value={summary.ownAccountsCount}
          icon={<Star className="h-4 w-4" />}
        />
        <MetricCard
          title="Competitors"
          value={summary.competitorAccountsCount}
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary.topPost && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Performing Post
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {summary.topPost.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={summary.topPost.thumbnail}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">@{summary.topPost.account}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {summary.topPost.caption?.slice(0, 80) || "No caption"}
                  </p>
                  <p className="text-sm font-bold mt-1">
                    {formatPercent(summary.topPost.engagementRate)} engagement
                  </p>
                </div>
              </div>
              {summary.topPost.permalink && (
                <a
                  href={summary.topPost.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:underline mt-2 block"
                >
                  View on Instagram →
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {summary.topAccount && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Performing Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-lg shrink-0">
                  {summary.topAccount.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">@{summary.topAccount.username}</p>
                  <AccountTypeBadge type={summary.topAccount.accountType as "own" | "competitor" | "influencer" | "brand" | "other"} />
                </div>
                <div className="ml-auto text-right shrink-0">
                  <p className="text-sm font-bold">{formatNumber(summary.topAccount.engagement)}</p>
                  <p className="text-xs text-muted-foreground">total engagement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {recentJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Sync Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentJobs.map((job: { id: string; jobType: string; status: string; createdAt: Date }) => (
                <div key={job.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{job.jobType}</span>
                  <span
                    className={`font-medium ${
                      job.status === "completed"
                        ? "text-emerald-600"
                        : job.status === "failed"
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    {job.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {job.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.totalAccounts === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Add your first account</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect Instagram or add accounts manually to start tracking.
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <Link href="/dashboard/connect">Connect Instagram</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/accounts">Add accounts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
