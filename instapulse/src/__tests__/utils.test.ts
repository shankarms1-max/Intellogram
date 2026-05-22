import {
  calcEngagementRate,
  calcPostFrequency,
  calcMarketShare,
  extractHashtags,
  formatNumber,
  formatPercent,
  safeDiv,
  slugify,
} from "../lib/utils";

describe("calcEngagementRate", () => {
  it("calculates correctly", () => {
    expect(calcEngagementRate(100, 20, 1000)).toBeCloseTo(12.0);
  });

  it("returns null when followers is 0", () => {
    expect(calcEngagementRate(100, 20, 0)).toBeNull();
  });

  it("returns null when followers is null", () => {
    expect(calcEngagementRate(100, 20, null)).toBeNull();
  });

  it("handles null likes and comments", () => {
    expect(calcEngagementRate(null, null, 1000)).toBeCloseTo(0);
  });

  it("handles partial nulls", () => {
    expect(calcEngagementRate(100, null, 1000)).toBeCloseTo(10.0);
    expect(calcEngagementRate(null, 50, 1000)).toBeCloseTo(5.0);
  });
});

describe("safeDiv", () => {
  it("divides correctly", () => {
    expect(safeDiv(10, 2)).toBe(5);
  });

  it("returns 0 for division by zero", () => {
    expect(safeDiv(10, 0)).toBe(0);
  });

  it("returns 0 when denominator is falsy", () => {
    expect(safeDiv(10, 0)).toBe(0);
  });
});

describe("calcPostFrequency", () => {
  it("calculates posts per day", () => {
    expect(calcPostFrequency(30, 30)).toBe(1);
    expect(calcPostFrequency(14, 7)).toBe(2);
  });

  it("handles zero days safely", () => {
    expect(calcPostFrequency(10, 0)).toBe(0);
  });
});

describe("calcMarketShare", () => {
  it("calculates percentage correctly", () => {
    expect(calcMarketShare(250, 1000)).toBe(25);
  });

  it("returns 0 when total is 0", () => {
    expect(calcMarketShare(100, 0)).toBe(0);
  });
});

describe("extractHashtags", () => {
  it("extracts hashtags from caption", () => {
    const tags = extractHashtags("New drop! #fashion #style #newcollection");
    expect(tags).toEqual(["#fashion", "#style", "#newcollection"]);
  });

  it("lowercases hashtags", () => {
    const tags = extractHashtags("#Fashion #STYLE");
    expect(tags).toEqual(["#fashion", "#style"]);
  });

  it("returns empty array for null caption", () => {
    expect(extractHashtags(null)).toEqual([]);
    expect(extractHashtags(undefined)).toEqual([]);
    expect(extractHashtags("")).toEqual([]);
  });

  it("returns empty array when no hashtags", () => {
    expect(extractHashtags("No hashtags here")).toEqual([]);
  });
});

describe("formatNumber", () => {
  it("formats thousands with K", () => {
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(1000)).toBe("1.0K");
  });

  it("formats millions with M", () => {
    expect(formatNumber(1500000)).toBe("1.5M");
  });

  it("returns plain number for small values", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0)).toBe("0");
  });

  it("returns dash for null/undefined", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("formats percentage with 2 decimals", () => {
    expect(formatPercent(4.567)).toBe("4.57%");
  });

  it("returns dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("supports custom decimal places", () => {
    expect(formatPercent(3.14159, 1)).toBe("3.1%");
  });
});

describe("slugify", () => {
  it("converts to lowercase with hyphens", () => {
    expect(slugify("My Brand Name")).toBe("my-brand-name");
  });

  it("removes special characters", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  brand  ")).toBe("brand");
  });
});
