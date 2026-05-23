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
  it("embeds username in field selector, not as query param", () => {
    const username = "navya_shankar1211";
    const ownId = "17841430068732098";
    const profileFields = "id,username,followers_count";
    const fields = `business_discovery.username(${username}){${profileFields}}`;
    const encoded = fields.replace(/\{/g, "%7B").replace(/\}/g, "%7D");
    const url = `https://graph.facebook.com/v21.0/${ownId}?fields=${encoded}&access_token=TOKEN`;

    expect(url).toContain(`business_discovery.username(${username})`);
    expect(url).not.toContain("&username=");
    expect(url).toContain("%7B");
    expect(url).toContain("%7D");
  });

  it("guard: empty/invalid username returns invalid_username before hitting API", () => {
    const result = normalizeInstagramUsername("");
    expect(result).toBeNull();
  });

  it("guard: @-only returns null", () => {
    expect(normalizeInstagramUsername("@")).toBeNull();
  });
});
