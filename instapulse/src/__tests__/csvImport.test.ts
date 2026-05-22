import { validateCsvRows, parseCsvText } from "../services/csvImportService";

describe("validateCsvRows", () => {
  it("validates a correct row", () => {
    const { valid, errors } = validateCsvRows([
      { username: "mybrand", account_type: "own", fetch_limit: "50", notes: "main" },
    ]);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0].username).toBe("mybrand");
    expect(valid[0].account_type).toBe("own");
  });

  it("rejects missing username", () => {
    const { valid, errors } = validateCsvRows([
      { username: "", account_type: "competitor" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("username");
    expect(valid).toHaveLength(0);
  });

  it("rejects invalid account_type", () => {
    const { errors } = validateCsvRows([
      { username: "test", account_type: "unknown_type" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("account_type");
  });

  it("accepts all valid account types", () => {
    const types = ["own", "competitor", "influencer", "brand", "other"];
    for (const type of types) {
      const { valid, errors } = validateCsvRows([
        { username: "testuser", account_type: type, fetch_limit: "50" },
      ]);
      expect(errors).toHaveLength(0);
      expect(valid).toHaveLength(1);
    }
  });

  it("rejects fetch_limit out of range", () => {
    const { errors: err1 } = validateCsvRows([
      { username: "test", account_type: "own", fetch_limit: "0" },
    ]);
    expect(err1[0].field).toBe("fetch_limit");

    const { errors: err2 } = validateCsvRows([
      { username: "test", account_type: "own", fetch_limit: "501" },
    ]);
    expect(err2[0].field).toBe("fetch_limit");
  });

  it("rejects invalid Instagram username format", () => {
    const { errors } = validateCsvRows([
      { username: "invalid username with spaces!", account_type: "own" },
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("strips @ prefix from username", () => {
    const { valid } = validateCsvRows([
      { username: "@mybrand", account_type: "own", fetch_limit: "50" },
    ]);
    expect(valid[0].username).toBe("mybrand");
  });

  it("validates multiple rows, collects all errors", () => {
    const { valid, errors } = validateCsvRows([
      { username: "good_user", account_type: "own", fetch_limit: "50" },
      { username: "", account_type: "competitor" },
      { username: "another_good", account_type: "influencer", fetch_limit: "100" },
    ]);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(3); // row 2 (0-indexed) + 2 for header = row 3
  });
});

describe("parseCsvText", () => {
  it("parses valid CSV", () => {
    const csv = `username,account_type,fetch_limit,notes
mybrand,own,100,Main account
competitor1,competitor,50,`;

    const { rows, parseError } = parseCsvText(csv);
    expect(parseError).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].username).toBe("mybrand");
    expect(rows[1].account_type).toBe("competitor");
  });

  it("handles empty CSV", () => {
    const { rows } = parseCsvText("username,account_type\n");
    expect(rows).toHaveLength(0);
  });

  it("normalizes header names (trims whitespace)", () => {
    const csv = ` username , account_type , fetch_limit
testuser,own,50`;
    const { rows } = parseCsvText(csv);
    expect(rows[0].username).toBe("testuser");
  });
});
