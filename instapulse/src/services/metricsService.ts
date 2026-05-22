import { db } from "@/lib/db";
import { safeDiv, calcEngagementRate } from "@/lib/utils";
import { subDays } from "date-fns";

export async function getWorkspaceSummary(workspaceId: string, days = 30) {
  const since = subDays(new Date(), days);

  const [accounts, media] = await Promise.all([
    db.trackedAccount.findMany({
      where: { workspaceId, isActive: true },
    }),
    db.mediaItem.findMany({
      where: { workspaceId, timestamp: { gte: since } },
      include: { trackedAccount: true },
    }),
  ]);

  const ownAccounts = accounts.filter((a) => a.accountType === "own");
  const competitorAccounts = accounts.filter((a) => a.accountType === "competitor");
  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followersCount || 0), 0);
  const totalLikes = media.reduce((sum, m) => sum + (m.likeCount || 0), 0);
  const totalComments = media.reduce((sum, m) => sum + (m.commentsCount || 0), 0);
  const totalViews = media.reduce((sum, m) => sum + (m.viewsCount || 0), 0);

  const avgEngagementRate =
    media.length > 0
      ? media.reduce((sum, m) => sum + (m.engagementRate || 0), 0) / media.length
      : 0;

  const topPost = media
    .sort((a, b) => (b.engagementRate || 0) - (a.engagementRate || 0))
    .at(0);

  const accountEngagement = new Map<string, number>();
  for (const m of media) {
    const cur = accountEngagement.get(m.trackedAccountId) || 0;
    accountEngagement.set(m.trackedAccountId, cur + (m.likeCount || 0) + (m.commentsCount || 0));
  }

  const topAccount = [...accountEngagement.entries()].sort((a, b) => b[1] - a[1]).at(0);
  const topAccountRecord = topAccount
    ? accounts.find((a) => a.id === topAccount[0])
    : null;

  return {
    totalAccounts: accounts.length,
    ownAccountsCount: ownAccounts.length,
    competitorAccountsCount: competitorAccounts.length,
    totalFollowers,
    totalMediaFetched: media.length,
    totalLikes,
    totalComments,
    totalViews,
    avgEngagementRate,
    topPost: topPost
      ? {
          id: topPost.id,
          caption: topPost.caption,
          permalink: topPost.permalink,
          engagementRate: topPost.engagementRate,
          account: topPost.trackedAccount?.username,
          mediaType: topPost.mediaType,
          thumbnail: topPost.thumbnailUrl,
        }
      : null,
    topAccount: topAccountRecord
      ? {
          id: topAccountRecord.id,
          username: topAccountRecord.username,
          displayName: topAccountRecord.displayName,
          accountType: topAccountRecord.accountType,
          engagement: topAccount![1],
        }
      : null,
  };
}

export async function getFollowerTrends(workspaceId: string, days = 30) {
  const since = subDays(new Date(), days);

  const snapshots = await db.accountSnapshot.findMany({
    where: { workspaceId, snapshotDate: { gte: since } },
    include: { trackedAccount: true },
    orderBy: { snapshotDate: "asc" },
  });

  const byDate = new Map<string, Record<string, number>>();

  for (const snap of snapshots) {
    const dateStr = snap.snapshotDate.toISOString().split("T")[0];
    if (!byDate.has(dateStr)) byDate.set(dateStr, {});
    const entry = byDate.get(dateStr)!;
    entry[snap.trackedAccount.username] = snap.followersCount || 0;
  }

  return [...byDate.entries()].map(([date, accounts]) => ({ date, ...accounts }));
}

export async function getEngagementTrends(workspaceId: string, days = 30) {
  const since = subDays(new Date(), days);

  const media = await db.mediaItem.findMany({
    where: { workspaceId, timestamp: { gte: since } },
    include: { trackedAccount: true },
    orderBy: { timestamp: "asc" },
  });

  const byDate = new Map<string, { likes: number; comments: number; posts: number }>();

  for (const item of media) {
    const dateStr = item.timestamp.toISOString().split("T")[0];
    if (!byDate.has(dateStr)) byDate.set(dateStr, { likes: 0, comments: 0, posts: 0 });
    const entry = byDate.get(dateStr)!;
    entry.likes += item.likeCount || 0;
    entry.comments += item.commentsCount || 0;
    entry.posts++;
  }

  return [...byDate.entries()].map(([date, v]) => ({
    date,
    likes: v.likes,
    comments: v.comments,
    posts: v.posts,
    engagement: v.likes + v.comments,
  }));
}

export async function getTopAccountsByEngagement(workspaceId: string, days = 30, limit = 10) {
  const since = subDays(new Date(), days);

  const accounts = await db.trackedAccount.findMany({
    where: { workspaceId, isActive: true },
    include: {
      mediaItems: {
        where: { timestamp: { gte: since } },
      },
    },
  });

  return accounts
    .map((account) => {
      const totalLikes = account.mediaItems.reduce((s, m) => s + (m.likeCount || 0), 0);
      const totalComments = account.mediaItems.reduce((s, m) => s + (m.commentsCount || 0), 0);
      const engagement = totalLikes + totalComments;
      const postCount = account.mediaItems.length;
      const engRate = calcEngagementRate(totalLikes, totalComments, account.followersCount);

      return {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        accountType: account.accountType,
        followers: account.followersCount,
        engagement,
        postCount,
        engagementRate: engRate,
        profilePicture: account.profilePictureUrl,
      };
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit);
}

export async function getMarketShare(workspaceId: string, days = 30) {
  const since = subDays(new Date(), days);

  const accounts = await db.trackedAccount.findMany({
    where: { workspaceId, isActive: true },
    include: {
      mediaItems: {
        where: { timestamp: { gte: since } },
      },
    },
  });

  const totals = accounts.reduce(
    (acc, a) => {
      const eng = a.mediaItems.reduce(
        (s, m) => s + (m.likeCount || 0) + (m.commentsCount || 0),
        0
      );
      return { engagement: acc.engagement + eng, posts: acc.posts + a.mediaItems.length };
    },
    { engagement: 0, posts: 0 }
  );

  return accounts.map((account) => {
    const eng = account.mediaItems.reduce(
      (s, m) => s + (m.likeCount || 0) + (m.commentsCount || 0),
      0
    );
    const posts = account.mediaItems.length;
    return {
      username: account.username,
      accountType: account.accountType,
      engagement: eng,
      posts,
      engagementShare: safeDiv(eng, totals.engagement) * 100,
      postShare: safeDiv(posts, totals.posts) * 100,
    };
  });
}
