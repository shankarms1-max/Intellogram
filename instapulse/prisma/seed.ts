import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { subDays } from "date-fns";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

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
    accountType: "own",
    followersCount: 45200,
    followsCount: 892,
    mediaCount: 312,
    fetchLimit: 100,
    status: "active",
    biography: "Official account | Premium products | Est. 2019",
    website: "https://mybrand.example.com",
  },
  {
    username: "mybrand_store",
    displayName: "My Brand Store",
    accountType: "own",
    followersCount: 12800,
    followsCount: 234,
    mediaCount: 145,
    fetchLimit: 50,
    status: "active",
    biography: "Shop our latest collections",
  },
  {
    username: "mybrand_team",
    displayName: "My Brand Team",
    accountType: "own",
    followersCount: 3400,
    followsCount: 510,
    mediaCount: 89,
    fetchLimit: 50,
    status: "active",
    biography: "Behind the scenes at My Brand",
  },
  {
    username: "competitor_alpha",
    displayName: "Competitor Alpha",
    accountType: "competitor",
    followersCount: 128000,
    followsCount: 1200,
    mediaCount: 892,
    fetchLimit: 50,
    status: "active",
    notes: "Main competitor in the space",
  },
  {
    username: "competitor_beta",
    displayName: "Competitor Beta",
    accountType: "competitor",
    followersCount: 67500,
    followsCount: 780,
    mediaCount: 521,
    fetchLimit: 50,
    status: "active",
    notes: "Growing fast",
  },
  {
    username: "competitor_gamma",
    displayName: "Competitor Gamma",
    accountType: "competitor",
    followersCount: 31200,
    followsCount: 430,
    mediaCount: 287,
    fetchLimit: 50,
    status: "active",
  },
  {
    username: "influencer_top",
    displayName: "Top Influencer",
    accountType: "influencer",
    followersCount: 892000,
    followsCount: 450,
    mediaCount: 2340,
    fetchLimit: 30,
    status: "active",
    notes: "Potential collab partner",
  },
  {
    username: "influencer_micro",
    displayName: "Micro Influencer",
    accountType: "influencer",
    followersCount: 28500,
    followsCount: 3200,
    mediaCount: 456,
    fetchLimit: 30,
    status: "active",
  },
] as const;

const MEDIA_TYPES = ["IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"] as const;
const CAPTIONS = [
  "Excited to share our latest collection! Which piece is your favorite? #fashion #style #newcollection",
  "Behind the scenes of our photoshoot. Hard work pays off! #behindthescenes #team #brand",
  "Customer spotlight 🌟 Thank you @customer for sharing your look! Tag us to be featured.",
  "Weekend vibes are real 🌊 What are you up to this weekend? Drop it in the comments!",
  "New drop alert 🚨 Limited quantities available. Link in bio to shop now. #newdrop #limited",
  "We partnered with amazing creators to bring you this collab. Swipe to see more →",
  "Five reasons why our product is different. Thread 🧵",
  "Your daily reminder to invest in yourself. Quality over quantity always.",
  "Summer 2025 campaign is here. Shot by @photographer. Feel the vibe. #summer2025",
  "We reached 50K followers! Thank you for your support. Giveaway coming soon 🎉 #milestone",
  "Product review by real customers. We let the results speak. #review #testimonial",
  "How we source our materials sustainably. A short story about our values. #sustainability",
  "Flash sale ends in 24 hours ⏰ Use code SAVE20 for 20% off. Link in bio.",
  "Team meeting vibes. Building the future together. #startup #team",
  "New tutorial dropping tomorrow. Subscribe so you don&apos;t miss it! #tutorial",
];

async function seed() {
  console.log("🌱 Starting seed...");

  // Cleanup
  await prisma.mediaItem.deleteMany();
  await prisma.accountSnapshot.deleteMany();
  await prisma.trackedAccount.deleteMany();
  await prisma.instagramConnection.deleteMany();
  await prisma.syncJob.deleteMany();
  await prisma.apiLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("✓ Cleaned up existing data");

  // Create demo user
  const password = await bcrypt.hash("demo1234", 12);
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@instapulse.app",
      password,
    },
  });

  console.log(`✓ Created user: ${user.email}`);

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      slug: "demo-workspace",
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: "owner" },
      },
    },
  });

  console.log(`✓ Created workspace: ${workspace.name}`);

  // Create tracked accounts
  const trackedAccounts = [];
  for (const acc of DEMO_ACCOUNTS) {
    const ta = await prisma.trackedAccount.create({
      data: {
        workspaceId: workspace.id,
        username: acc.username,
        displayName: acc.displayName,
        accountType: acc.accountType as "own" | "competitor" | "influencer" | "brand" | "other",
        followersCount: acc.followersCount,
        followsCount: acc.followsCount,
        mediaCount: acc.mediaCount,
        fetchLimit: acc.fetchLimit,
        status: acc.status as "active" | "pending" | "failed" | "unavailable" | "disabled",
        biography: "biography" in acc ? acc.biography : undefined,
        website: "website" in acc ? acc.website : undefined,
        notes: "notes" in acc ? acc.notes : undefined,
        isActive: true,
        lastSyncedAt: new Date(),
        instagramUserId: `ig_${acc.username}_${Date.now()}`,
      },
    });
    trackedAccounts.push(ta);
  }

  console.log(`✓ Created ${trackedAccounts.length} tracked accounts`);

  // Create 30 days of snapshots for each account
  for (const account of trackedAccounts) {
    const accData = DEMO_ACCOUNTS.find((a) => a.username === account.username)!;
    const baseFollowers = accData.followersCount;
    const growthPerDay = randomBetween(-50, 200);

    for (let day = 29; day >= 0; day--) {
      const snapshotDate = subDays(new Date(), day);
      snapshotDate.setHours(0, 0, 0, 0);

      const followersCount = Math.max(0, baseFollowers - growthPerDay * day + randomBetween(-100, 100));

      await prisma.accountSnapshot.upsert({
        where: {
          trackedAccountId_snapshotDate: {
            trackedAccountId: account.id,
            snapshotDate,
          },
        },
        update: { followersCount },
        create: {
          workspaceId: workspace.id,
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

  console.log("✓ Created 30 days of account snapshots");

  // Create media items for each account (60 total)
  let mediaCount = 0;
  for (const account of trackedAccounts) {
    const accData = DEMO_ACCOUNTS.find((a) => a.username === account.username)!;
    const numPosts = account.accountType === "own" ? 12 : account.accountType === "influencer" ? 8 : 5;

    for (let i = 0; i < numPosts; i++) {
      const mediaType = MEDIA_TYPES[randomBetween(0, MEDIA_TYPES.length - 1)];
      const caption = CAPTIONS[randomBetween(0, CAPTIONS.length - 1)];
      const likeCount = randomBetween(100, Math.floor(accData.followersCount * 0.15));
      const commentsCount = randomBetween(5, Math.floor(likeCount * 0.1));
      const viewsCount = mediaType === "VIDEO" || mediaType === "REEL" ? randomBetween(likeCount * 2, likeCount * 10) : null;
      const engagementRate =
        accData.followersCount > 0
          ? parseFloat((((likeCount + commentsCount) / accData.followersCount) * 100).toFixed(2))
          : 0;

      const hashtags = (caption.match(/#[\w]+/g) || []).map((h: string) => h.toLowerCase());

      await prisma.mediaItem.create({
        data: {
          workspaceId: workspace.id,
          trackedAccountId: account.id,
          instagramMediaId: `media_${account.username}_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
          saved: account.accountType === "own" ? randomBetween(10, likeCount * 0.05) : null,
          engagementRate,
          hashtags,
          fetchedAt: new Date(),
        },
      });
      mediaCount++;
    }
  }

  console.log(`✓ Created ${mediaCount} media items`);

  // Create a sample sync job
  await prisma.syncJob.create({
    data: {
      workspaceId: workspace.id,
      jobType: "workspace_sync",
      status: "completed",
      startedAt: subDays(new Date(), 1),
      completedAt: subDays(new Date(), 1),
      metadata: {
        total: trackedAccounts.filter((a) => a.accountType === "own").length,
        succeeded: 3,
        failed: 0,
      },
    },
  });

  // Create sample reports
  await prisma.report.createMany({
    data: [
      {
        workspaceId: workspace.id,
        reportType: "weekly_competitor",
        name: "Weekly Competitor Report",
        dateFrom: subDays(new Date(), 7),
        dateTo: new Date(),
        status: "completed",
      },
      {
        workspaceId: workspace.id,
        reportType: "monthly_performance",
        name: "Monthly Performance - April",
        dateFrom: subDays(new Date(), 30),
        dateTo: new Date(),
        status: "completed",
      },
    ],
  });

  console.log("✓ Created sample sync jobs and reports");

  console.log("\n✅ Seed complete!");
  console.log("   Demo credentials:");
  console.log("   Email: demo@instapulse.app");
  console.log("   Password: demo1234");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
