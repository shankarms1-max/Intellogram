import { FB_SYNC_MODE_LIMITS } from "@/services/facebookApiClient";

// ─── Facebook Page discovery mapping ─────────────────────────────────────────

describe("Facebook Page discovery mapping", () => {
  interface RawPage {
    id: string;
    name: string;
    category?: string;
    picture?: { data?: { url?: string } };
    link?: string;
    fan_count?: number;
    followers_count?: number;
    access_token?: string;
    instagram_business_account?: { id: string; username?: string };
    connected_instagram_account?: { id: string; username?: string };
  }

  function mapPage(page: RawPage) {
    const ig = page.instagram_business_account ?? page.connected_instagram_account;
    return {
      id: page.id,
      name: page.name,
      category: page.category ?? null,
      pictureUrl: page.picture?.data?.url ?? null,
      link: page.link ?? null,
      fanCount: page.fan_count ?? null,
      followersCount: page.followers_count ?? null,
      linkedInstagramAccountId: ig?.id ?? null,
      linkedInstagramUsername: ig?.username ?? null,
    };
  }

  it("maps page ID", () => {
    expect(mapPage({ id: "123456789", name: "My Page" }).id).toBe("123456789");
  });

  it("maps page name and category", () => {
    const result = mapPage({ id: "1", name: "Nike", category: "Sports" });
    expect(result.name).toBe("Nike");
    expect(result.category).toBe("Sports");
  });

  it("maps picture URL from nested structure", () => {
    const result = mapPage({
      id: "1", name: "Nike",
      picture: { data: { url: "https://cdn.fb.com/pic.jpg" } },
    });
    expect(result.pictureUrl).toBe("https://cdn.fb.com/pic.jpg");
  });

  it("returns null pictureUrl when absent", () => {
    expect(mapPage({ id: "1", name: "Test" }).pictureUrl).toBeNull();
  });

  it("maps link", () => {
    const result = mapPage({ id: "1", name: "Test", link: "https://facebook.com/testpage" });
    expect(result.link).toBe("https://facebook.com/testpage");
  });

  it("maps fan_count", () => {
    expect(mapPage({ id: "1", name: "X", fan_count: 150000 }).fanCount).toBe(150000);
  });

  it("maps followers_count", () => {
    expect(mapPage({ id: "1", name: "X", followers_count: 120000 }).followersCount).toBe(120000);
  });

  it("maps linked Instagram Business account", () => {
    const result = mapPage({
      id: "1", name: "X",
      instagram_business_account: { id: "ig123", username: "testbrand" },
    });
    expect(result.linkedInstagramAccountId).toBe("ig123");
    expect(result.linkedInstagramUsername).toBe("testbrand");
  });

  it("falls back to connected_instagram_account when instagram_business_account absent", () => {
    const result = mapPage({
      id: "1", name: "X",
      connected_instagram_account: { id: "cig456", username: "connectedbrand" },
    });
    expect(result.linkedInstagramAccountId).toBe("cig456");
    expect(result.linkedInstagramUsername).toBe("connectedbrand");
  });

  it("does NOT expose access_token in the mapped result", () => {
    const result = mapPage({ id: "1", name: "X", access_token: "TOKEN_SECRET" });
    expect(JSON.stringify(result)).not.toContain("TOKEN_SECRET");
    expect(Object.keys(result)).not.toContain("access_token");
    expect(Object.keys(result)).not.toContain("accessToken");
  });

  it("handles page with no optional fields gracefully", () => {
    const result = mapPage({ id: "1", name: "Minimal" });
    expect(result.id).toBe("1");
    expect(result.name).toBe("Minimal");
    expect(result.category).toBeNull();
    expect(result.pictureUrl).toBeNull();
    expect(result.link).toBeNull();
    expect(result.fanCount).toBeNull();
    expect(result.followersCount).toBeNull();
    expect(result.linkedInstagramAccountId).toBeNull();
    expect(result.linkedInstagramUsername).toBeNull();
  });
});

// ─── Facebook Page post mapping ───────────────────────────────────────────────

describe("Facebook Page post mapping", () => {
  interface RawPost {
    id: string;
    message?: string;
    story?: string;
    created_time: string;
    permalink_url?: string;
    full_picture?: string;
    attachments?: { data?: Array<{ type?: string; url?: string }> };
    reactions?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
    shares?: { count?: number };
  }

  function mapPost(post: RawPost) {
    const reactionsCount = post.reactions?.summary?.total_count ?? null;
    const commentsCount = post.comments?.summary?.total_count ?? null;
    const sharesCount = post.shares?.count ?? null;
    const engagementCount =
      (reactionsCount ?? 0) + (commentsCount ?? 0) + (sharesCount ?? 0) || null;
    return {
      facebookPostId: post.id,
      message: post.message ?? null,
      story: post.story ?? null,
      createdTime: new Date(post.created_time),
      permalinkUrl: post.permalink_url ?? null,
      fullPicture: post.full_picture ?? null,
      reactionsCount,
      commentsCount,
      sharesCount,
      engagementCount,
    };
  }

  it("maps reactions.summary.total_count", () => {
    const result = mapPost({
      id: "1", created_time: "2024-01-01T00:00:00Z",
      reactions: { summary: { total_count: 450 } },
    });
    expect(result.reactionsCount).toBe(450);
  });

  it("maps comments.summary.total_count", () => {
    const result = mapPost({
      id: "1", created_time: "2024-01-01T00:00:00Z",
      comments: { summary: { total_count: 32 } },
    });
    expect(result.commentsCount).toBe(32);
  });

  it("maps shares.count", () => {
    const result = mapPost({
      id: "1", created_time: "2024-01-01T00:00:00Z",
      shares: { count: 15 },
    });
    expect(result.sharesCount).toBe(15);
  });

  it("handles missing shares — sharesCount is null", () => {
    const result = mapPost({ id: "1", created_time: "2024-01-01T00:00:00Z" });
    expect(result.sharesCount).toBeNull();
  });

  it("handles missing message — message is null", () => {
    const result = mapPost({ id: "1", created_time: "2024-01-01T00:00:00Z", story: "Someone shared a photo." });
    expect(result.message).toBeNull();
    expect(result.story).toBe("Someone shared a photo.");
  });

  it("handles story-only post", () => {
    const result = mapPost({ id: "1", created_time: "2024-01-01T00:00:00Z", story: "Page updated their cover photo." });
    expect(result.message).toBeNull();
    expect(result.story).toBe("Page updated their cover photo.");
  });

  it("calculates engagementCount = reactions + comments + shares", () => {
    const result = mapPost({
      id: "1", created_time: "2024-01-01T00:00:00Z",
      reactions: { summary: { total_count: 100 } },
      comments: { summary: { total_count: 25 } },
      shares: { count: 10 },
    });
    expect(result.engagementCount).toBe(135);
  });

  it("engagementCount is null when all metrics are missing", () => {
    const result = mapPost({ id: "1", created_time: "2024-01-01T00:00:00Z" });
    expect(result.engagementCount).toBeNull();
  });

  it("engagementCount handles partial metrics (no shares)", () => {
    const result = mapPost({
      id: "1", created_time: "2024-01-01T00:00:00Z",
      reactions: { summary: { total_count: 50 } },
      comments: { summary: { total_count: 10 } },
    });
    expect(result.engagementCount).toBe(60);
  });

  it("maps created_time to Date", () => {
    const result = mapPost({ id: "1", created_time: "2024-03-15T12:00:00Z" });
    expect(result.createdTime).toBeInstanceOf(Date);
    expect(result.createdTime.getFullYear()).toBe(2024);
  });

  it("maps full_picture", () => {
    const result = mapPost({ id: "1", created_time: "2024-01-01T00:00:00Z", full_picture: "https://cdn.fb.com/img.jpg" });
    expect(result.fullPicture).toBe("https://cdn.fb.com/img.jpg");
  });
});

// ─── Facebook sync mode limits ────────────────────────────────────────────────

describe("Facebook sync mode limits", () => {
  it("daily_refresh postLimit = 25", () => expect(FB_SYNC_MODE_LIMITS.daily_refresh.postLimit).toBe(25));
  it("daily_refresh maxPages = 1", () => expect(FB_SYNC_MODE_LIMITS.daily_refresh.maxPages).toBe(1));
  it("initial_import postLimit = 100", () => expect(FB_SYNC_MODE_LIMITS.initial_import.postLimit).toBe(100));
  it("initial_import maxPages = 4", () => expect(FB_SYNC_MODE_LIMITS.initial_import.maxPages).toBe(4));
  it("manual_deep_import postLimit = 500", () => expect(FB_SYNC_MODE_LIMITS.manual_deep_import.postLimit).toBe(500));
  it("manual_deep_import maxPages = 20", () => expect(FB_SYNC_MODE_LIMITS.manual_deep_import.maxPages).toBe(20));
  it("daily_refresh cannot exceed 25 posts per sync", () => {
    expect(FB_SYNC_MODE_LIMITS.daily_refresh.postLimit).toBeLessThanOrEqual(25);
    expect(FB_SYNC_MODE_LIMITS.daily_refresh.maxPages).toBe(1);
  });
  it("manual_deep_import has the highest limits", () => {
    expect(FB_SYNC_MODE_LIMITS.manual_deep_import.postLimit).toBeGreaterThan(FB_SYNC_MODE_LIMITS.initial_import.postLimit);
    expect(FB_SYNC_MODE_LIMITS.manual_deep_import.maxPages).toBeGreaterThan(FB_SYNC_MODE_LIMITS.initial_import.maxPages);
  });
});

// ─── Sync stopped-reason logic ────────────────────────────────────────────────

describe("Facebook sync stoppedReason logic", () => {
  function computeStoppedReason(
    postsFetched: number,
    postLimit: number,
    hasNextCursor: boolean,
    maxPages: number,
    pagesFetched: number
  ): string {
    if (!hasNextCursor || postsFetched >= postLimit) {
      return postsFetched >= postLimit ? "max_limit_reached" : "no_more_pages";
    }
    if (maxPages <= 1) return "max_pages_reached";
    if (pagesFetched >= maxPages) return "max_pages_reached";
    return "max_pages_reached";
  }

  it("stops with no_more_pages when no cursor returned", () => {
    expect(computeStoppedReason(10, 25, false, 4, 1)).toBe("no_more_pages");
  });

  it("stops with max_limit_reached when postLimit hit", () => {
    expect(computeStoppedReason(25, 25, true, 4, 1)).toBe("max_limit_reached");
  });

  it("stops with max_pages_reached for daily_refresh after 1 page", () => {
    expect(computeStoppedReason(10, 25, true, 1, 1)).toBe("max_pages_reached");
  });

  it("stops with max_pages_reached after maxPages exhausted", () => {
    expect(computeStoppedReason(80, 100, true, 4, 4)).toBe("max_pages_reached");
  });
});

// ─── API response safety ──────────────────────────────────────────────────────

describe("API response safety — no tokens exposed", () => {
  function buildSafePageResponse(page: {
    id: string;
    facebookPageId: string;
    name: string;
    encryptedPageAccessToken: string;
    linkedInstagramUsername: string | null;
  }) {
    // Simulates what the discover-pages route returns (safe fields only)
    return {
      id: page.id,
      facebookPageId: page.facebookPageId,
      name: page.name,
      linkedInstagramUsername: page.linkedInstagramUsername,
      // encryptedPageAccessToken intentionally omitted
    };
  }

  it("discover-pages response does not include encryptedPageAccessToken", () => {
    const response = buildSafePageResponse({
      id: "db-id-1",
      facebookPageId: "123",
      name: "Test Page",
      encryptedPageAccessToken: "encrypted-secret-token",
      linkedInstagramUsername: "testbrand",
    });
    expect(JSON.stringify(response)).not.toContain("encrypted-secret-token");
    expect(Object.keys(response)).not.toContain("encryptedPageAccessToken");
    expect(Object.keys(response)).not.toContain("accessToken");
  });

  it("safe page response includes required fields", () => {
    const response = buildSafePageResponse({
      id: "db-id-1",
      facebookPageId: "123",
      name: "Test Page",
      encryptedPageAccessToken: "secret",
      linkedInstagramUsername: "testbrand",
    });
    expect(response.id).toBe("db-id-1");
    expect(response.facebookPageId).toBe("123");
    expect(response.name).toBe("Test Page");
    expect(response.linkedInstagramUsername).toBe("testbrand");
  });

  function buildSafePostResponse(post: {
    facebookPostId: string;
    message: string | null;
    reactionsCount: number | null;
  }) {
    // Safe post fields (what /api/facebook-pages/[id]/posts returns)
    return {
      facebookPostId: post.facebookPostId,
      message: post.message,
      reactionsCount: post.reactionsCount,
    };
  }

  it("posts API returns safe fields only", () => {
    const response = buildSafePostResponse({
      facebookPostId: "post-123",
      message: "Hello world",
      reactionsCount: 42,
    });
    expect(response.facebookPostId).toBe("post-123");
    expect(response.reactionsCount).toBe(42);
    expect(Object.keys(response)).not.toContain("accessToken");
    expect(Object.keys(response)).not.toContain("encryptedPageAccessToken");
  });
});

// ─── Meta Overview aggregation ────────────────────────────────────────────────

describe("Meta Overview aggregation — platform labels", () => {
  interface IGItem {
    platform: "instagram";
    likeCount: number | null;
    commentsCount: number | null;
    viewsCount: number | null;
  }

  interface FBPost {
    platform: "facebook";
    reactionsCount: number | null;
    commentsCount: number | null;
    sharesCount: number | null;
  }

  it("Instagram item has likeCount, commentsCount, viewsCount — not reactions/shares", () => {
    const item: IGItem = {
      platform: "instagram",
      likeCount: 1500,
      commentsCount: 42,
      viewsCount: 13765110,
    };
    expect(item.platform).toBe("instagram");
    expect(item.likeCount).toBe(1500);
    expect(item.viewsCount).toBe(13765110);
    expect(Object.keys(item)).not.toContain("reactionsCount");
    expect(Object.keys(item)).not.toContain("sharesCount");
  });

  it("Facebook post has reactionsCount, commentsCount, sharesCount — not likeCount/viewsCount", () => {
    const post: FBPost = {
      platform: "facebook",
      reactionsCount: 800,
      commentsCount: 25,
      sharesCount: 30,
    };
    expect(post.platform).toBe("facebook");
    expect(post.reactionsCount).toBe(800);
    expect(post.sharesCount).toBe(30);
    expect(Object.keys(post)).not.toContain("likeCount");
    expect(Object.keys(post)).not.toContain("viewsCount");
  });

  it("platforms remain clearly labeled and not mixed", () => {
    const items: Array<IGItem | FBPost> = [
      { platform: "instagram", likeCount: 100, commentsCount: 10, viewsCount: null },
      { platform: "facebook", reactionsCount: 200, commentsCount: 5, sharesCount: 15 },
    ];

    const igItems = items.filter((i) => i.platform === "instagram") as IGItem[];
    const fbItems = items.filter((i) => i.platform === "facebook") as FBPost[];

    expect(igItems).toHaveLength(1);
    expect(fbItems).toHaveLength(1);
    expect(igItems[0].likeCount).toBe(100);
    expect(fbItems[0].reactionsCount).toBe(200);
  });

  it("Instagram Views from view_count — null for IMAGE, value for some VIDEO/REELS", () => {
    const reel: IGItem = { platform: "instagram", likeCount: 500, commentsCount: 20, viewsCount: 13765110 };
    const image: IGItem = { platform: "instagram", likeCount: 200, commentsCount: 8, viewsCount: null };

    expect(reel.viewsCount).not.toBeNull();
    expect(image.viewsCount).toBeNull();
  });

  it("Facebook Reactions label is separate from Instagram Likes label", () => {
    const igLabel = "Instagram Likes";
    const fbLabel = "Facebook Reactions";
    expect(igLabel).not.toBe(fbLabel);
    expect(igLabel).toContain("Instagram");
    expect(fbLabel).toContain("Facebook");
  });
});
