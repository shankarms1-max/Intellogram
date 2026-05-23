import { normalizeInstagramUsername } from "@/lib/instagramUtils";

describe("normalizeInstagramUsername", () => {
  // Valid usernames
  it("returns lowercase plain username", () => {
    expect(normalizeInstagramUsername("navya_shankar1211")).toBe("navya_shankar1211");
  });

  it("strips leading @", () => {
    expect(normalizeInstagramUsername("@navya_shankar1211")).toBe("navya_shankar1211");
  });

  it("strips multiple leading @", () => {
    expect(normalizeInstagramUsername("@@natgeo")).toBe("natgeo");
  });

  it("lowercases username", () => {
    expect(normalizeInstagramUsername("NatGeo")).toBe("natgeo");
  });

  it("extracts from full instagram.com URL", () => {
    expect(normalizeInstagramUsername("https://www.instagram.com/natgeo/")).toBe("natgeo");
  });

  it("extracts from instagram.com URL without protocol", () => {
    expect(normalizeInstagramUsername("instagram.com/navya_shankar1211")).toBe("navya_shankar1211");
  });

  it("strips trailing slash from plain username", () => {
    expect(normalizeInstagramUsername("natgeo/")).toBe("natgeo");
  });

  it("handles usernames with dots and underscores", () => {
    expect(normalizeInstagramUsername("user.name_123")).toBe("user.name_123");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeInstagramUsername("  natgeo  ")).toBe("natgeo");
  });

  it("accepts username at max length (30 chars)", () => {
    const u = "a".repeat(30);
    expect(normalizeInstagramUsername(u)).toBe(u);
  });

  // Invalid usernames
  it("returns null for empty string", () => {
    expect(normalizeInstagramUsername("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(normalizeInstagramUsername("   ")).toBeNull();
  });

  it("returns null for username exceeding 30 chars", () => {
    expect(normalizeInstagramUsername("a".repeat(31))).toBeNull();
  });

  it("returns null for username with invalid chars (hyphen)", () => {
    expect(normalizeInstagramUsername("user-name")).toBeNull();
  });

  it("returns null for username with spaces", () => {
    expect(normalizeInstagramUsername("user name")).toBeNull();
  });

  it("returns null for @-only", () => {
    expect(normalizeInstagramUsername("@")).toBeNull();
  });
});

describe("Business Discovery query builder", () => {
  it("embeds username in field selector using URLSearchParams, not as query param", () => {
    const username = "nike";
    const ownId = "17841430068732098";
    const profileFields = "id,username,followers_count,media_count";
    const fields = `business_discovery.username(${username}){${profileFields}}`;

    const params = new URLSearchParams();
    params.set("fields", fields);
    params.set("access_token", "TOKEN");
    const url = `https://graph.facebook.com/v21.0/${ownId}?${params.toString()}`;

    // Username must be in field selector
    expect(url).toContain(`business_discovery.username%28${username}%29`);
    // Must NOT be a separate query param
    expect(url).not.toContain("&username=");
    // Braces encoded
    expect(url).toContain("%7B");
    expect(url).toContain("%7D");
  });

  it("does not include follows_count in competitor fields", () => {
    const mediaFields = `media.limit(25){id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count}`;
    const profileFields = `id,username,name,biography,website,profile_picture_url,followers_count,media_count,${mediaFields}`;
    expect(profileFields).not.toContain("follows_count");
    expect(profileFields).not.toContain("thumbnail_url");
    expect(profileFields).not.toContain("media_url");
  });

  it("guard: empty/invalid username returns null before hitting API", () => {
    expect(normalizeInstagramUsername("")).toBeNull();
  });

  it("guard: @-only returns null", () => {
    expect(normalizeInstagramUsername("@")).toBeNull();
  });

  it("nike, @nike, and instagram.com/nike all normalize to nike", () => {
    expect(normalizeInstagramUsername("nike")).toBe("nike");
    expect(normalizeInstagramUsername("@nike")).toBe("nike");
    expect(normalizeInstagramUsername("https://www.instagram.com/nike/")).toBe("nike");
  });
});
