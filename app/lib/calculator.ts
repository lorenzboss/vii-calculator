export type Computed = { type: "TIME" | "SCALAR"; val: number; str?: string };

export function parseTimeStrToSeconds(token: string): number {
  const separator = token.includes(".") ? "." : ":";
  const parts = token.split(separator).map(Number);
  let hours = 0,
    minutes = 0,
    seconds = 0;
  if (parts.length === 2) {
    [hours, minutes] = parts;
  } else if (parts.length === 3) {
    [hours, minutes, seconds] = parts;
  }
  if (minutes > 59)
    throw new Error(`Invalid time '${token}': minutes must be 0-59`);
  if (seconds > 59)
    throw new Error(`Invalid time '${token}': seconds must be 0-59`);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTime(totalSeconds: number, forceSeconds = false): string {
  totalSeconds = Math.round(totalSeconds);
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const resHours = Math.floor(absSeconds / 3600);
  const resMins = Math.floor((absSeconds % 3600) / 60);
  const resSecs = absSeconds % 60;

  const sign = isNegative ? "-" : "";
  const padHours = resHours.toString().padStart(2, "0");
  const padMins = resMins.toString().padStart(2, "0");
  const padSecs = resSecs.toString().padStart(2, "0");

  if (forceSeconds || resSecs !== 0) {
    return `${sign}${padHours}:${padMins}:${padSecs}`;
  }
  return `${sign}${padHours}:${padMins}`;
}

export function evaluateLine(
  line: string,
  tempComputedLines: Array<Computed | null>,
): Computed | null {
  // Block unrecognized characters (parentheses allowed)
  const leftover = line
    .replace(
      /(\d{1,5}[:.]\d{2}(?:[:.]\d{2})?)|(#\s*\d+)|([+\-*/()])|(\d+(?:[.,]\d+)?)|\s/g,
      "",
    )
    .trim();
  if (leftover.length > 0) {
    throw new Error(`Unrecognized characters: '${leftover}'`);
  }

  type PToken =
    | { type: "TIME" | "SCALAR"; val: number }
    | { type: "OP"; val: string }
    | { type: "PAREN"; val: "(" | ")" };

  const tokens: PToken[] = [];
  const tokenRegex =
    /(\d{1,5}[:.]\d{2}(?:[:.]\d{2})?)|(#\s*\d+)|([+\-*/()])|(\d+(?:[.,]\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match[1]) {
      tokens.push({ type: "TIME", val: parseTimeStrToSeconds(match[1]) });
    } else if (match[2]) {
      const idx = parseInt(match[2].replace("#", "").trim(), 10) - 1;
      if (
        idx < 0 ||
        idx >= tempComputedLines.length ||
        !tempComputedLines[idx]
      ) {
        throw new Error(`Reference ${match[2]} is empty or invalid`);
      }
      const ref = tempComputedLines[idx]!;
      tokens.push({ type: ref.type, val: ref.val });
    } else if (match[3]) {
      const ch = match[3];
      if (ch === "(" || ch === ")") {
        tokens.push({ type: "PAREN", val: ch });
      } else {
        tokens.push({ type: "OP", val: ch });
      }
    } else if (match[4]) {
      tokens.push({
        type: "SCALAR",
        val: parseFloat(match[4].replace(",", ".")),
      });
    }
  }

  if (tokens.length === 0) return null;

  // Recursive descent parser
  // Grammar (highest → lowest precedence):
  //   expr    = addSub
  //   addSub  = mulDiv (('+' | '-') mulDiv)*
  //   mulDiv  = unary  (('*' | '/') unary)*
  //   unary   = ('+' | '-') unary | primary
  //   primary = TIME | SCALAR | '(' expr ')'

  let pos = 0;
  const peek = (): PToken | undefined => tokens[pos];
  const consume = (): PToken => tokens[pos++];

  // Declared as a function so it is hoisted and parsePrimary can call it
  function parseExpr(): Computed {
    let left = parseMulDiv();
    while (pos < tokens.length) {
      const tok = peek();
      if (tok?.type !== "OP" || (tok.val !== "+" && tok.val !== "-")) break;
      consume();
      const right = parseMulDiv();
      if (left.type !== right.type)
        throw new Error("Cannot add/subtract time and numbers");
      left = {
        type: left.type,
        val: tok.val === "+" ? left.val + right.val : left.val - right.val,
      };
    }
    return left;
  }

  const parsePrimary = (): Computed => {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of expression");

    if (tok.type === "PAREN" && tok.val === "(") {
      consume();
      const result = parseExpr();
      const closing = peek();
      if (!closing || closing.type !== "PAREN" || closing.val !== ")") {
        throw new Error("Missing closing parenthesis ')'");
      }
      consume();
      return result;
    }

    if (tok.type === "TIME" || tok.type === "SCALAR") {
      consume();
      return { type: tok.type, val: tok.val };
    }

    throw new Error(`Unexpected token: '${(tok as { val: string }).val}'`);
  };

  const parseUnary = (): Computed => {
    const tok = peek();
    if (tok?.type === "OP" && (tok.val === "+" || tok.val === "-")) {
      consume();
      const operand = parsePrimary();
      return {
        type: operand.type,
        val: tok.val === "-" ? -operand.val : operand.val,
      };
    }
    return parsePrimary();
  };

  const parseMulDiv = (): Computed => {
    let left = parseUnary();
    while (pos < tokens.length) {
      const tok = peek();
      if (tok?.type !== "OP" || (tok.val !== "*" && tok.val !== "/")) break;
      consume();
      const right = parseUnary();
      if (tok.val === "*") {
        if (
          (left.type === "TIME" && right.type === "SCALAR") ||
          (left.type === "SCALAR" && right.type === "TIME")
        ) {
          left = { type: "TIME", val: left.val * right.val };
        } else if (left.type === "SCALAR" && right.type === "SCALAR") {
          left = { type: "SCALAR", val: left.val * right.val };
        } else {
          throw new Error("Time \u00d7 Time is not allowed");
        }
      } else {
        if (left.type === "TIME" && right.type === "SCALAR") {
          left = { type: "TIME", val: left.val / right.val };
        } else if (left.type === "SCALAR" && right.type === "SCALAR") {
          left = { type: "SCALAR", val: left.val / right.val };
        } else if (left.type === "TIME" && right.type === "TIME") {
          left = { type: "SCALAR", val: left.val / right.val };
        } else {
          throw new Error("Number \u00f7 Time is not allowed");
        }
      }
    }
    return left;
  };

  const result = parseExpr();

  if (pos < tokens.length) {
    const rem = tokens[pos];
    throw new Error(`Unexpected token: '${(rem as { val: string }).val}'`);
  }

  return result;
}

export type CalculationResult = {
  lineResults: Array<string | null>;
  computedValues: Array<Computed | null>;
  errors: Record<number, string>;
  totalResult: string;
  hasSeconds: boolean;
};

export function runCalculation(text: string): CalculationResult {
  const lines = text.split("\n");
  let overallTotalSeconds = 0;
  const tempComputedLines: Array<Computed | null> = [];
  const errors: Record<number, string> = {};
  const lineResults: Array<string | null> = [];
  const hasSeconds = !!text.match(/\d{1,5}[:.]\d{2}[:.]\d{2}/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      tempComputedLines.push(null);
      lineResults.push(null);
      continue;
    }

    try {
      const res = evaluateLine(line, tempComputedLines);
      if (res) {
        tempComputedLines.push(res);
        const formattedRes =
          res.type === "TIME"
            ? formatTime(res.val, hasSeconds)
            : parseFloat(res.val.toFixed(2)).toString();
        if (res.type === "TIME") {
          overallTotalSeconds += res.val;
        }
        lineResults.push(`= ${formattedRes}`);
      } else {
        tempComputedLines.push(null);
        lineResults.push(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors[i] = msg;
      tempComputedLines.push(null);
      lineResults.push(null);
    }
  }

  return {
    lineResults,
    computedValues: tempComputedLines,
    errors,
    totalResult: formatTime(overallTotalSeconds, hasSeconds),
    hasSeconds,
  };
}
