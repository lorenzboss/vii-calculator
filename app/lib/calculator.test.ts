import { describe, expect, it } from "vitest";
import {
  evaluateLine,
  formatTime,
  parseTimeStrToSeconds,
  runCalculation,
} from "./calculator";

// ---------------------------------------------------------------------------
// parseTimeStrToSeconds
// ---------------------------------------------------------------------------
describe("parseTimeStrToSeconds", () => {
  it("parses HH:MM with colon", () => {
    expect(parseTimeStrToSeconds("01:30")).toBe(5400);
  });

  it("parses HH:MM:SS with colon", () => {
    expect(parseTimeStrToSeconds("01:30:30")).toBe(5430);
  });

  it("parses H.MM with dot separator", () => {
    expect(parseTimeStrToSeconds("1.30")).toBe(5400);
  });

  it("parses H.MM.SS with dot separator", () => {
    expect(parseTimeStrToSeconds("1.30.30")).toBe(5430);
  });

  it("handles zero time", () => {
    expect(parseTimeStrToSeconds("00:00")).toBe(0);
    expect(parseTimeStrToSeconds("0:00")).toBe(0);
    expect(parseTimeStrToSeconds("00:00:00")).toBe(0);
  });

  it("handles large hour values", () => {
    expect(parseTimeStrToSeconds("100:00")).toBe(360000);
  });

  it("handles hours only expressed as 0:00", () => {
    expect(parseTimeStrToSeconds("2:00")).toBe(7200);
  });

  it("throws when minutes > 59", () => {
    expect(() => parseTimeStrToSeconds("01:60")).toThrow(
      "minutes must be 0-59",
    );
  });

  it("throws when seconds > 59", () => {
    expect(() => parseTimeStrToSeconds("01:00:60")).toThrow(
      "seconds must be 0-59",
    );
  });

  it("treats minutes = 59 as valid", () => {
    expect(parseTimeStrToSeconds("00:59")).toBe(59 * 60);
  });

  it("treats seconds = 59 as valid", () => {
    expect(parseTimeStrToSeconds("00:00:59")).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
describe("formatTime", () => {
  it("formats whole hours as HH:MM", () => {
    expect(formatTime(3600)).toBe("01:00");
  });

  it("omits seconds when resSecs === 0 and forceSeconds is false", () => {
    expect(formatTime(7200)).toBe("02:00");
  });

  it("includes seconds when resSecs !== 0", () => {
    expect(formatTime(3661)).toBe("01:01:01");
  });

  it("includes seconds when forceSeconds = true even if 0", () => {
    expect(formatTime(3600, true)).toBe("01:00:00");
  });

  it("formats zero as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats negative time with leading minus", () => {
    expect(formatTime(-3600)).toBe("-01:00");
  });

  it("formats negative time with seconds", () => {
    expect(formatTime(-3661)).toBe("-01:01:01");
  });

  it("rounds fractional seconds", () => {
    // 3600.7 rounds to 3601 → 01:00:01
    expect(formatTime(3600.7)).toBe("01:00:01");
    // 3600.4 rounds to 3600 → 01:00
    expect(formatTime(3600.4)).toBe("01:00");
  });

  it("pads hours, minutes, and seconds to two digits", () => {
    expect(formatTime(61)).toBe("00:01:01");
  });

  it("handles large hour values", () => {
    expect(formatTime(360000)).toBe("100:00");
  });
});

// ---------------------------------------------------------------------------
// evaluateLine
// ---------------------------------------------------------------------------
describe("evaluateLine - basic values", () => {
  it("returns null for an empty line", () => {
    expect(evaluateLine("", [])).toBeNull();
    expect(evaluateLine("   ", [])).toBeNull();
  });

  it("returns a TIME for a bare time token", () => {
    expect(evaluateLine("1:00", [])).toEqual({ type: "TIME", val: 3600 });
  });

  it("returns a SCALAR for a bare number", () => {
    expect(evaluateLine("42", [])).toEqual({ type: "SCALAR", val: 42 });
  });

  it("supports comma as decimal separator in scalars", () => {
    expect(evaluateLine("1,5", [])).toEqual({ type: "SCALAR", val: 1.5 });
  });

  it("numeric tokens with a dot are parsed as time", () => {
    // "3.14" → 3 hours 14 min = 11640 s, NOT the scalar 3.14
    // Use a comma for decimal scalars instead.
    expect(evaluateLine("3.14", [])).toEqual({ type: "TIME", val: 11640 });
  });
});

describe("evaluateLine - addition and subtraction", () => {
  it("adds two times", () => {
    expect(evaluateLine("1:00 + 0:30", [])).toEqual({
      type: "TIME",
      val: 5400,
    });
  });

  it("subtracts two times", () => {
    expect(evaluateLine("2:00 - 0:30", [])).toEqual({
      type: "TIME",
      val: 5400,
    });
  });

  it("adds two scalars", () => {
    expect(evaluateLine("2 + 3", [])).toEqual({ type: "SCALAR", val: 5 });
  });

  it("subtracts two scalars", () => {
    expect(evaluateLine("10 - 4", [])).toEqual({ type: "SCALAR", val: 6 });
  });

  it("chains multiple additions", () => {
    expect(evaluateLine("1:00 + 0:30 + 0:15", [])).toEqual({
      type: "TIME",
      val: 6300,
    });
  });

  it("throws when adding time and scalar", () => {
    expect(() => evaluateLine("1:00 + 5", [])).toThrow(
      "Cannot add/subtract time and numbers",
    );
  });

  it("throws when subtracting scalar from time", () => {
    expect(() => evaluateLine("1:00 - 5", [])).toThrow(
      "Cannot add/subtract time and numbers",
    );
  });

  it("result can be negative when subtracting a larger time", () => {
    const res = evaluateLine("0:30 - 1:00", []);
    expect(res).toEqual({ type: "TIME", val: -1800 });
  });
});

describe("evaluateLine - multiplication and division", () => {
  it("multiplies time by scalar", () => {
    expect(evaluateLine("2:00 * 2", [])).toEqual({ type: "TIME", val: 14400 });
  });

  it("multiplies scalar by time", () => {
    expect(evaluateLine("2 * 2:00", [])).toEqual({ type: "TIME", val: 14400 });
  });

  it("multiplies scalar by scalar", () => {
    expect(evaluateLine("3 * 4", [])).toEqual({ type: "SCALAR", val: 12 });
  });

  it("divides time by scalar", () => {
    expect(evaluateLine("4:00 / 2", [])).toEqual({ type: "TIME", val: 7200 });
  });

  it("divides time by time (ratio)", () => {
    expect(evaluateLine("4:00 / 2:00", [])).toEqual({
      type: "SCALAR",
      val: 2,
    });
  });

  it("divides scalar by scalar", () => {
    expect(evaluateLine("10 / 4", [])).toEqual({ type: "SCALAR", val: 2.5 });
  });

  it("throws when multiplying time by time", () => {
    expect(() => evaluateLine("1:00 * 2:00", [])).toThrow(
      "Time × Time is not allowed",
    );
  });

  it("throws when dividing scalar by time", () => {
    expect(() => evaluateLine("5 / 1:00", [])).toThrow(
      "Number ÷ Time is not allowed",
    );
  });
});

describe("evaluateLine - operator precedence", () => {
  it("respects * before + (scalar)", () => {
    // 2 + 3 * 4 = 14, not 20
    expect(evaluateLine("2 + 3 * 4", [])).toEqual({ type: "SCALAR", val: 14 });
  });

  it("parentheses override precedence", () => {
    // (2 + 3) * 4 = 20
    expect(evaluateLine("(2 + 3) * 4", [])).toEqual({
      type: "SCALAR",
      val: 20,
    });
  });

  it("computes (time + time) * scalar", () => {
    // (1:00 + 0:30) * 2 = 10800
    expect(evaluateLine("(1:00 + 0:30) * 2", [])).toEqual({
      type: "TIME",
      val: 10800,
    });
  });
});

describe("evaluateLine - unary operators", () => {
  it("unary minus negates a scalar", () => {
    expect(evaluateLine("-5", [])).toEqual({ type: "SCALAR", val: -5 });
  });

  it("unary plus is a no-op on scalar", () => {
    expect(evaluateLine("+5", [])).toEqual({ type: "SCALAR", val: 5 });
  });

  it("unary minus negates a time", () => {
    expect(evaluateLine("-1:00", [])).toEqual({ type: "TIME", val: -3600 });
  });
});

describe("evaluateLine - line references", () => {
  it("resolves #1 to the first computed line", () => {
    const computed = [{ type: "TIME" as const, val: 3600 }];
    expect(evaluateLine("#1", computed)).toEqual({ type: "TIME", val: 3600 });
  });

  it("resolves #2 to the second computed line", () => {
    const computed = [
      { type: "SCALAR" as const, val: 10 },
      { type: "SCALAR" as const, val: 20 },
    ];
    expect(evaluateLine("#2 + #1", computed)).toEqual({
      type: "SCALAR",
      val: 30,
    });
  });

  it("throws for an out-of-range reference", () => {
    expect(() => evaluateLine("#5", [])).toThrow(
      "Reference #5 is empty or invalid",
    );
  });

  it("throws for a reference to a null (empty) computed line", () => {
    const computed = [null];
    expect(() => evaluateLine("#1", computed)).toThrow(
      "Reference #1 is empty or invalid",
    );
  });
});

describe("evaluateLine - error cases", () => {
  it("throws on unrecognized characters", () => {
    expect(() => evaluateLine("1:00 % 2", [])).toThrow(
      "Unrecognized characters",
    );
  });

  it("throws on missing closing parenthesis", () => {
    expect(() => evaluateLine("(1 + 2", [])).toThrow(
      "Missing closing parenthesis",
    );
  });

  it("throws on unexpected trailing token", () => {
    expect(() => evaluateLine("1 2", [])).toThrow("Unexpected token");
  });

  it("throws on invalid time minutes", () => {
    expect(() => evaluateLine("01:60", [])).toThrow("minutes must be 0-59");
  });

  it("throws on invalid time seconds", () => {
    expect(() => evaluateLine("01:00:60", [])).toThrow("seconds must be 0-59");
  });
});

// ---------------------------------------------------------------------------
// runCalculation
// ---------------------------------------------------------------------------
describe("runCalculation", () => {
  it("returns a single null entry for empty input", () => {
    const result = runCalculation("");
    // "".split("\n") → [""], so one empty line → [null]
    expect(result.lineResults).toEqual([null]);
    expect(result.computedValues).toEqual([null]);
    expect(result.errors).toEqual({});
    expect(result.totalResult).toBe("00:00");
    expect(result.hasSeconds).toBe(false);
  });

  it("processes a single time line", () => {
    const result = runCalculation("1:30");
    expect(result.lineResults).toEqual(["= 01:30"]);
    expect(result.computedValues).toEqual([{ type: "TIME", val: 5400 }]);
    expect(result.totalResult).toBe("01:30");
    expect(result.errors).toEqual({});
  });

  it("processes a single scalar line", () => {
    const result = runCalculation("42");
    expect(result.lineResults).toEqual(["= 42"]);
    expect(result.errors).toEqual({});
    // Scalars don't contribute to totalResult
    expect(result.totalResult).toBe("00:00");
  });

  it("sums all time lines for totalResult", () => {
    const result = runCalculation("1:00\n0:30");
    expect(result.totalResult).toBe("01:30");
  });

  it("skips empty lines without error", () => {
    const result = runCalculation("1:00\n\n0:30");
    expect(result.lineResults).toEqual(["= 01:00", null, "= 00:30"]);
    expect(result.computedValues).toEqual([
      { type: "TIME", val: 3600 },
      null,
      { type: "TIME", val: 1800 },
    ]);
  });

  it("resolves cross-line references (#n)", () => {
    const result = runCalculation("1:00\n#1 + 0:30");
    expect(result.lineResults[1]).toBe("= 01:30");
    expect(result.errors).toEqual({});
  });

  it("records errors on the correct line index", () => {
    const result = runCalculation("1:00\n1:00 % 2\n0:30");
    expect(result.errors[1]).toMatch("Unrecognized characters");
    expect(result.errors[0]).toBeUndefined();
    expect(result.errors[2]).toBeUndefined();
    // Erroneous line doesn't contribute to total
    expect(result.totalResult).toBe("01:30");
  });

  it("detects hasSeconds when a H:MM:SS token is present", () => {
    expect(runCalculation("1:00:30").hasSeconds).toBe(true);
  });

  it("hasSeconds is false when no seconds token is present", () => {
    expect(runCalculation("1:00").hasSeconds).toBe(false);
  });

  it("formats time lines with seconds when hasSeconds is true", () => {
    const result = runCalculation("1:00:00\n0:30");
    // Because hasSeconds=true, all times are formatted as HH:MM:SS
    expect(result.lineResults[0]).toBe("= 01:00:00");
    expect(result.lineResults[1]).toBe("= 00:30:00");
  });

  it("rounds scalar results to at most 2 decimal places", () => {
    const result = runCalculation("10 / 3");
    expect(result.lineResults[0]).toBe("= 3.33");
  });

  it("handles a reference to an errored (null) line", () => {
    const result = runCalculation("1:00 % 2\n#1");
    expect(result.errors[0]).toBeDefined();
    expect(result.errors[1]).toMatch("empty or invalid");
  });

  it("totalResult is negative when times sum to negative", () => {
    const result = runCalculation("0:30 - 1:00");
    expect(result.totalResult).toBe("-00:30");
  });

  it("does not add scalar results to the time total", () => {
    const result = runCalculation("1:00\n5");
    expect(result.totalResult).toBe("01:00");
  });
});
