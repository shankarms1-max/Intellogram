import { db } from "@/lib/db";
import { subDays } from "date-fns";

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function randomDate(daysAgo: number) {
  return new Date(Date.now() - randomBetween(0, daysAgo) * 24 * 60 * 60 * 1000);
}

const DEMO_ACCOUNTS = [
  {
    username: "mybrand_official",
    displayName: "My Brand Official",
    accountType: "own" as const,
    followersCount: 45200,
    followsCount: 892,
    mediaCount: 312,
    fetchLimit: 100,
    status: "active" as const,
    biography: "Official account | Premium products | Est. 2019",
    website: "https://mybrand.example.com",
    notes: undefined,
  },
  {
    username: "mybrand_store",
    displayName: "My Brand Store",
    accountType: "own" as const,
    followersCount: 12800,
    followsCount: 234,
    mediaCount: 145,
    fetchLimit: 50,
    status: "active" as const,
    biography: "Shop our latest collections",
    website: undefined,
    notes: undefined,
  },
  {
    username: "mybrand_team",
    displayName: "My Brand Team",
    accountType: "own" as const,
    followersCount: 3400,
    followsCount: 510,
    mediaCount: 89,
    fetchLimit: 50,
    status: "active" as const,
    biography: "Behind the scenes at My Brand",
    website: undefined,
    notes: undefined,
  },
  {
    username: "competitor_alpha",
    displayName: "Competitor Alpha",
    accountType: "competitor" as const,
    followersCount: 128000,
    followsCount: 1200,
    mediaCount: 892,
    fetchLimit: 50,
    status: "active" as const,
    biography: undefined,
    website: undefined,
    notes: "Main competitor in the space",
  },
  {
    username: "competitor_beta",
    displayName: "Competitor Beta",
    accountType: "competitor" as const,
    followersCount: 67500,
    followsCount: 780,
    mediaCount: 521,
    fetchLimit: 50,
    status: "active" as const,
    biography: undefined,
    website: undefined,
    notes: "Growing fast",
  },
  {
    username: "competitor_gamma",
    displayName: "Competitor Gamma",
    accountType: "competitor" as const,
    followersCount: 31200,
    followsCount: 430,
    mediaCount: 287,
    fetchLimit: 50,
    status: "active" as const,
    biography: undefined,
    website: undefined,
    notes: undefined,
  },
  {
    username: "influencer_top",
    displayName: "Top Influencer",
    accountType: "influencer" as const,
    followersCount: 892000,
    followsCount: 450,
    mediaCount: 2340,
    fetchLimit: 30,
    status: "active" as const,
    biography: undefined,
    website: undefined,
    notes: "Potential collab partner",
  },
  {
    username: "influencer_micro",
    displayName: "Micro Influencer",
    accountType: "influencer" as const,
    followersCount: 28500,
    followsCount: 3200,
    mediaCount: 456,
    fetchLimit: 30,
    status: "active" as const,
    biography: undefined,
    website: undefined,
    notes: undefined,
  },
] as const;

const MEDIA_TYPES = ["IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"] as const;

const CAPTIONS = [
  "Excited to share our latest collection! Which piece is your favorite? #fashion #style #newcollection",
  "Behind the scenes of our photoshoot. Hard work pays off! #behindthescenes #team #brand",
  "Customer spotlight! Thank you for sharing your look! Tag us to be featured. #community",
  "Weekend vibes are real! What are you up to this weekend? Drop it in the comments! #weekend",
  "New drop alert! Limited quantities available. Link in bio to shop now. #newdrop #limited",
  "We partnered with amazing creators to bring you this collab. Swipe to see more!",
  "Five reasons why our product is different. Quality over everything. #quality",
  "Your daily reminder to invest in yourself. Quality over quantity always. #mindset",
  "Summer 2025 campaign is here. Feel the vibe. #summer2025 #campaign",
  "We reached 50K followers! Thank you for your support. Giveaway coming soon! #milestone",
  "Product review by real customers. We let the results speak. #review #testimonial",
  "How we source our materials sustainably. A short story about our values. #sustainability",
  "Flash sale ends in 24 hours! Use code SAVE20 for 20% off. Link in bio. #sale",
  "Team meeting vibes. Building the future together. #startup #team #culture",
  "New tutorial dropping tomorrow. Follow so you don't miss it! #tutorial #howto",
];

export async function seedDemoData(workspaceId: string): Promise<void> {
  const existing = await db.trackedAccount.count({ where: { workspaceId } });
  if (existing > 0) return;

  const trackedAccounts = [];

  for (const acc of DEMO_ACCOUNTS) {
    const ta = await db.trackedAccount.create({
      data: {
        workspaceId,
        username: acc.username,
        displayName: acc.displayName,
        accountType: acc.accountType,
        followersCount: acc.followersCount,
        followsCount: acc.followsCount,
        mediaCount: acc.mediaCount,
        fetchLimit: acc.fetchLimit,
        status: acc.status,
        biography: acc.biography ?? null,
        website: acc.website ?? null,
        notes: acc.notes ?? null,
        isActive: true,
        lastSyncedAt: new Date(),
        instagramUserId: `demo_${acc.username}`,
      },
    });
    trackedAccounts.push(ta);
  }

  // 30 days of follower snapshots
  for (const account of trackedAccounts) {
    const accData = DEMO_ACCOUNTS.find((a) => a.username === account.username)!;
    const baseFollowers = accData.followersCount;
    const growthPerDay = randomBetween(-50, 200);

    for (let day = 29; day >= 0; day--) {
      const snapshotDate = subDays(new Date(), day);
      snapshotDate.setHours(0, 0, 0, 0);
      const followersCount = Math.max(0, baseFollowers - growthPerDay * day + randomBetween(-100, 100));

      await db.accountSnapshot.upsert({
        where: {
          trackedAccountId_snapshotDate: {
            trackedAccountId: account.id,
            snapshotDate,
          },
        },
        update: { followersCount },
        create: {
          workspaceId,
          trackedAccountId: account.id,
          snapshotDate,
          followersCount,
          followsCount: accData.followsCount,
          mediaCount: accData.mediaCount,
          engagementRate: randomFloat(1.5, 8.5),
        },
      });
    }
  }

  // Media items per account
  for (const account of trackedAccounts) {
    const accData = DEMO_ACCOUNTS.find((a) => a.username === account.username)!;
    const numPosts = account.accountType === "own" ? 12 : account.accountType === "influencer" ? 8 : 5;

    for (let i = 0; i < numPosts; i++) {
      const mediaType = MEDIA_TYPES[randomBetween(0, MEDIA_TYPES.length - 1)];
      const caption = CAPTIONS[randomBetween(0, CAPTIONS.length - 1)];
      const likeCount = randomBetween(100, Math.floor(accData.followersCount * 0.15));
      const commentsCount = randomBetween(5, Math.max(6, Math.floor(likeCount * 0.1)));
      const isVideo = mediaType === "VIDEO" || mediaType === "REEL";
      const viewsCount = isVideo ? randomBetween(likeCount * 2, likeCount * 10) : null;
      const engagementRate =
        accData.followersCount > 0
          ? parseFloat((((likeCount + commentsCount) / accData.followersCount) * 100).toFixed(2))
          : 0;
      const hashtags = (caption.match(/#[\w]+/g) || []).map((h) => h.toLowerCase());

      await db.mediaItem.create({
        data: {
          workspaceId,
          trackedAccountId: account.id,
          instagramMediaId: `demo_${account.username}_${i}_${Math.random().toString(36).slice(2)}`,
          mediaType,
          caption,
          permalink: `https://www.instagram.com/p/demo${account.username}${i}/`,
          timestamp: randomDate(60),
          likeCount,
          commentsCount,
          viewsCount,
          playsCount: mediaType === "REEL" ? viewsCount : null,
          reach: account.accountType === "own" ? randomBetween(likeCount * 3, likeCount * 8) : null,
          impressions: account.accountType === "own" ? randomBetween(likeCount * 5, likeCount * 15) : null,
          saved: account.accountType === "own" ? randomBetween(10, Math.max(11, Math.floor(likeCount * 0.05))) : null,
          shares: account.accountType === "own" ? randomBetween(5, Math.max(6, Math.floor(likeCount * 0.03))) : null,
          engagementRate,
          hashtags,
          fetchedAt: new Date(),
        },
      });
    }
  }

  // Seed a sample completed sync job
  await db.syncJob.create({
    data: {
      workspaceId,
      jobType: "workspace_sync",
      status: "completed",
      startedAt: subDays(new Date(), 1),
      completedAt: subDays(new Date(), 1),
      metadata: { total: 3, succeeded: 3, failed: 0 },
    },
  });

  // Seed sample API logs
  const sampleEndpoints = [
    { endpoint: "https://graph.facebook.com/v21.0/me/accounts", method: "GET", statusCode: 200, success: true, durationMs: 312 },
    { endpoint: "https://graph.facebook.com/v21.0/17841400000000001/media", method: "GET", statusCode: 200, success: true, durationMs: 524 },
    { endpoint: "https://graph.facebook.com/v21.0/17841400000000002/media", method: "GET", statusCode: 200, success: true, durationMs: 489 },
    { endpoint: "https://graph.facebook.com/v21.0/media_123/insights", method: "GET", statusCode: 200, success: true, durationMs: 278 },
    { endpoint: "https://graph.facebook.com/v21.0/media_456/insights", method: "GET", statusCode: 400, success: false, durationMs: 145, errorMessage: "Insights not available for this media type" },
  ];

  for (const log of sampleEndpoints) {
    await db.apiLog.create({
      data: {
        workspaceId,
        endpoint: log.endpoint,
        method: log.method,
        statusCode: log.statusCode,
        success: log.success,
        durationMs: log.durationMs,
        errorMessage: log.errorMessage ?? null,
        createdAt: subDays(new Date(), randomBetween(0, 2)),
      },
    });
  }

  // Seed sample reports
  await db.report.createMany({
    data: [
      {
        workspaceId,
        reportType: "weekly_competitor",
        name: "Weekly Competitor Report",
        dateFrom: subDays(new Date(), 7),
        dateTo: new Date(),
        status: "completed",
      },
      {
        workspaceId,
        reportType: "monthly_performance",
        name: "Monthly Performance",
        dateFrom: subDays(new Date(), 30),
        dateTo: new Date(),
        status: "completed",
      },
    ],
  });
}
