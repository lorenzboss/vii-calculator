"use client";

import { Check, Clock, Copy, Info, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

type Computed = { type: "TIME" | "SCALAR"; val: number; str?: string };

export default function App(): React.ReactElement {
  const [inputText, setInputText] = useState<string>("");
  const [lineResults, setLineResults] = useState<Array<string | null>>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [totalResult, setTotalResult] = useState<string>("00:00");

  // Stores computed values and format info for reference tooltips
  const [computedValues, setComputedValues] = useState<Array<Computed | null>>(
    [],
  );
  const [hasSeconds, setHasSeconds] = useState<boolean>(false);
  const [visibleErrors, setVisibleErrors] = useState<Record<number, string>>(
    {},
  );
  const [copied, setCopied] = useState<boolean>(false);

  // Load persisted input on first mount
  useEffect(() => {
    const saved = localStorage.getItem("vii-calc-input");
    if (saved !== null) setInputText(saved);
  }, []);

  // State for the custom tooltip
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    text: string;
    x: number;
    y: number;
  }>({ show: false, text: "", x: 0, y: 0 });

  // Refs for synchronised scrolling across all layers
  const bgRef = useRef<HTMLDivElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null); // Ref for the syntax-highlight overlay

  // Always up-to-date errors snapshot for async timer callbacks
  const errorsRef = useRef<Record<number, string>>({});
  // Per-line running debounce timers
  const errorTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );

  useEffect(() => {
    calculateTime(inputText);
  }, [inputText]);

  // Keep errorsRef in sync for async timer callbacks
  useEffect(() => {
    errorsRef.current = errors;
  }, [errors]);

  useEffect(() => {
    setVisibleErrors((prevVisible) => {
      const next = { ...prevVisible };

      // Lines that no longer have an error → hide immediately
      for (const key of Object.keys(prevVisible)) {
        const i = Number(key);
        if (!errors[i]) {
          clearTimeout(errorTimersRef.current[i]);
          delete errorTimersRef.current[i];
          delete next[i];
        } else if (errors[i] !== prevVisible[i]) {
          // Error message changed while already visible → update immediately
          next[i] = errors[i];
        }
      }

      // Lines that have a new error (not yet visible) → debounce, reset timer on every change
      for (const key of Object.keys(errors)) {
        const i = Number(key);
        if (!prevVisible[i]) {
          clearTimeout(errorTimersRef.current[i]);
          errorTimersRef.current[i] = setTimeout(() => {
            delete errorTimersRef.current[i];
            setVisibleErrors((ve) => {
              if (errorsRef.current[i]) {
                return { ...ve, [i]: errorsRef.current[i] };
              }
              return ve;
            });
          }, 1000);
        }
      }

      return next;
    });
  }, [errors]);

  // Clean up pending timers on unmount
  useEffect(() => {
    return () => {
      for (const id of Object.values(errorTimersRef.current)) clearTimeout(id);
    };
  }, []);

  const parseTimeStrToSeconds = (token: string): number => {
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
      throw new Error(`Invalid time '${token}': minutes must be 0–59`);
    if (seconds > 59)
      throw new Error(`Invalid time '${token}': seconds must be 0–59`);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const formatTime = (totalSeconds: number, forceSeconds = false): string => {
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
  };

  const evaluateLine = (
    line: string,
    tempComputedLines: Array<Computed | null>,
    globalHasSeconds: boolean,
  ): Computed | null => {
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

    // Forward-declared so parsePrimary can call it (safe: only invoked after full declaration)
    let parseExpr: () => Computed;

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
            throw new Error("Time \u00f7 Time is not allowed. Use a number.");
          } else {
            throw new Error("Number \u00f7 Time is not allowed");
          }
        }
      }
      return left;
    };

    parseExpr = (): Computed => {
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
    };

    const result = parseExpr();

    if (pos < tokens.length) {
      const rem = tokens[pos];
      throw new Error(`Unexpected token: '${(rem as { val: string }).val}'`);
    }

    return result;
  };

  const calculateTime = (text: string) => {
    const lines = text.split("\n");
    let overallTotalSeconds = 0;

    const tempComputedLines: Array<Computed | null> = [];
    const newErrors: Record<number, string> = {};
    const newLineResults: Array<string | null> = [];

    const globalHasSeconds = !!text.match(/\d{1,5}[:.]\d{2}[:.]\d{2}/);
    setHasSeconds(globalHasSeconds);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        tempComputedLines.push(null);
        newLineResults.push(null);
        continue;
      }

      try {
        const res = evaluateLine(line, tempComputedLines, globalHasSeconds);
        if (res) {
          tempComputedLines.push(res);
          let formattedRes =
            res.type === "TIME"
              ? formatTime(res.val, globalHasSeconds)
              : parseFloat(res.val.toFixed(2)).toString();

          if (res.type === "TIME") {
            overallTotalSeconds += res.val;
          }

          newLineResults.push(`= ${formattedRes}`);
        } else {
          tempComputedLines.push(null);
          newLineResults.push(null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        newErrors[i] = msg;
        tempComputedLines.push(null);
        newLineResults.push(null);
      }
    }

    setComputedValues(tempComputedLines); // Store for reference tooltips
    setLineResults(newLineResults);
    setErrors(newErrors);
    setTotalResult(formatTime(overallTotalSeconds, globalHasSeconds));
  };
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    localStorage.setItem("vii-calc-input", e.target.value);
  };

  const handleClear = () => {
    setInputText("");
    localStorage.removeItem("vii-calc-input");
  };

  const handleBlur = () => {
    // Flush all pending debounce timers immediately
    for (const key of Object.keys(errorTimersRef.current)) {
      clearTimeout(errorTimersRef.current[Number(key)]);
      delete errorTimersRef.current[Number(key)];
    }
    setVisibleErrors(errorsRef.current);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    // Only intercept if it looks like exported output (lines with "  = result" suffixes)
    if (!/\s{2,}=\s*\S/.test(pasted)) return;
    e.preventDefault();
    const cleaned = pasted
      .split("\n")
      .map((line) => line.replace(/\s{2,}=\s*\S.*$/, "").trimEnd())
      .join("\n");
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue =
      inputText.substring(0, start) + cleaned + inputText.substring(end);
    setInputText(newValue);
    localStorage.setItem("vii-calc-input", newValue);
    // Restore cursor to end of inserted text
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + cleaned.length;
    });
  };

  const handleCopy = () => {
    const linesArray = inputText.split("\n");
    // Expand #n references to their resolved formatted value
    const expandRefs = (line: string): string =>
      line.replace(/#\s*(\d+)/g, (original, n) => {
        const idx = parseInt(n, 10) - 1;
        const cv = computedValues[idx];
        if (!cv) return original;
        return cv.type === "TIME"
          ? formatTime(cv.val, hasSeconds)
          : parseFloat(cv.val.toFixed(2)).toString();
      });
    const expanded = linesArray.map(expandRefs);
    const maxLen = Math.max(...expanded.map((l) => l.length), 0);
    const text = expanded
      .map((line, i) => {
        const result = lineResults[i];
        if (line.trim() && result) {
          return `${line.padEnd(maxLen)}  ${result}`;
        }
        return line;
      })
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Synchronise scrolling across all layers
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget as HTMLElement;
    const top = target.scrollTop;
    const left = target.scrollLeft;
    if (outputRef.current) outputRef.current.scrollTop = top;
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = top;
    if (bgRef.current) bgRef.current.scrollTop = top;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = top;
      highlightRef.current.scrollLeft = left;
    }

    setTooltip((prev) => ({ ...prev, show: false }));
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === "SPAN") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const scrollTop = bgRef.current?.scrollTop || 0;
    const totalY = y + scrollTop;
    const lineIndex = Math.floor((totalY - 16) / 28);

    const linesCount = inputText.split("\n").length;
    if (lineIndex >= 0 && lineIndex < linesCount) {
      if (visibleErrors[lineIndex]) {
        setTooltip({
          show: true,
          text: visibleErrors[lineIndex],
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }
    }
    setTooltip((prev) =>
      prev.show ? { show: false, text: "", x: 0, y: 0 } : prev,
    );
  };

  const renderHighlightedLine = (line: string): React.ReactNode => {
    if (!line) return null;
    const regex =
      /(\d{1,5}[:.]\d{2}(?:[:.]\d{2})?|#\s*\d+|[+\-*/()]|\d+(?:[.,]\d+)?)/g;
    const parts = line.split(regex);

    return parts.map((part, j) => {
      if (!part) return null;

      // Time
      if (part.match(/^\d{1,5}[:.]\d{2}(?:[:.]\d{2})?$/)) {
        return (
          <span key={j} style={{ color: "#3a5a40", fontWeight: 500 }}>
            {part}
          </span>
        );
      }

      // Line reference (#1, #2, …)
      if (part.match(/^#\s*\d+$/)) {
        const refIdx = parseInt(part.replace("#", "").trim(), 10) - 1;
        const computed = computedValues[refIdx];
        let tooltipText = "Not yet calculated or invalid";

        if (computed) {
          if (computed.type === "TIME") {
            tooltipText = formatTime(computed.val, hasSeconds);
          } else if (computed.type === "SCALAR") {
            tooltipText = parseFloat(computed.val.toFixed(2)).toString();
          }
        }

        return (
          <span
            key={j}
            style={{
              color: "#588157",
              fontWeight: 500,
              borderBottom: "1px dashed #a3b18a",
              cursor: "help",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) =>
              setTooltip({
                show: true,
                text: tooltipText,
                x: e.clientX,
                y: e.clientY,
              })
            }
            onMouseMove={(e) =>
              setTooltip({
                show: true,
                text: tooltipText,
                x: e.clientX,
                y: e.clientY,
              })
            }
            onMouseLeave={() =>
              setTooltip({ show: false, text: "", x: 0, y: 0 })
            }
            onMouseDown={(e) => e.preventDefault()}
          >
            {part}
          </span>
        );
      }

      // Operator
      if (part.match(/^[+\-*/]$/)) {
        return (
          <span key={j} style={{ color: "#588157", fontWeight: 500 }}>
            {part}
          </span>
        );
      }

      // Parenthesis
      if (part === "(" || part === ")") {
        return (
          <span key={j} style={{ color: "#a3b18a", fontWeight: 500 }}>
            {part}
          </span>
        );
      }

      // Scalar number
      if (part.match(/^\d+(?:[.,]\d+)?$/)) {
        return (
          <span key={j} style={{ color: "#3a5a40", fontWeight: 500 }}>
            {part}
          </span>
        );
      }

      // Unrecognized character
      return (
        <span key={j} style={{ color: "#344e41" }}>
          {part}
        </span>
      );
    });
  };

  const linesArray = inputText.split("\n");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 font-sans"
      style={{ background: "#dad7cd", color: "#344e41" }}
    >
      <div
        className="w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden"
        style={{ background: "#ffffff", border: "1px solid #a3b18a" }}
      >
        {/* Header */}
        <div
          className="p-6 flex items-center space-x-3"
          style={{ background: "#344e41" }}
        >
          <Clock className="w-6 h-6" style={{ color: "#a3b18a" }} />
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#dad7cd" }}
          >
            vii<span style={{ color: "#a3b18a" }}>.sh</span>
          </h1>
          <span
            className="font-medium ml-2 pl-4"
            style={{ borderLeft: "1px solid #588157", color: "#dad7cd" }}
          >
            Time Calculator
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Info */}
          <div
            className="flex items-start space-x-2 text-sm p-3 rounded-lg"
            style={{
              background: "#dad7cd",
              border: "1px solid #a3b18a",
              color: "#344e41",
            }}
          >
            <Info
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: "#588157" }}
            />
            <p>
              Calculate using <strong>H.MM</strong> or <strong>HH.MM.SS</strong>
              . Allowed operators are <strong>+ - * /</strong>. Grouping with{" "}
              <strong>( )</strong> is supported. <br />
              Use <strong>#1</strong>, <strong>#2</strong>, etc. to reference
              previous lines.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="timeInput"
                className="block text-sm font-medium"
                style={{ color: "#3a5a40" }}
              >
                Your calculations:
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all select-none"
                  style={
                    copied
                      ? {
                          border: "1px solid #3a5a40",
                          color: "#3a5a40",
                          background: "#a3b18a33",
                        }
                      : {
                          border: "1px solid #a3b18a",
                          color: "#588157",
                          background: "#dad7cd",
                        }
                  }
                  title="Copy all lines with results"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handleClear}
                  disabled={inputText === ""}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all select-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    border: "1px solid #a3b18a",
                    color: "#588157",
                    background: "#dad7cd",
                  }}
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>
            <div
              className="editor-focus-ring relative w-full h-72 rounded-xl shadow-sm overflow-hidden flex transition-all"
              style={{
                background: "#ffffff",
                border: "1px solid #a3b18a",
                outline: "none",
              }}
              onMouseMove={handleContainerMouseMove}
              onMouseLeave={() =>
                setTooltip((prev) =>
                  prev.show ? { show: false, text: "", x: 0, y: 0 } : prev,
                )
              }
            >
              {/* Layer 1: Error Background */}
              <div
                ref={bgRef}
                className="absolute top-0 bottom-0 left-12 right-0 pointer-events-none z-0 overflow-hidden"
                style={{ paddingTop: "1rem" }}
              >
                {linesArray.map((_, i) => (
                  <div
                    key={i}
                    className="h-7 w-full"
                    style={{
                      background: visibleErrors[i]
                        ? "rgba(188,71,73,0.07)"
                        : "transparent",
                    }}
                  />
                ))}
              </div>

              {/* Layer 2: Line Numbers */}
              <div
                ref={lineNumbersRef}
                className="w-12 h-full py-4 overflow-hidden select-none z-10 shrink-0"
                style={{
                  background: "#dad7cd",
                  borderRight: "1px solid #a3b18a",
                }}
              >
                {linesArray.map((_, i) => (
                  <div
                    key={i}
                    className="h-7 text-right pr-3 text-sm font-mono leading-7"
                    style={
                      visibleErrors[i]
                        ? { color: "#bc4749", fontWeight: 700 }
                        : { color: "#a3b18a" }
                    }
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Layer 3: Editor Field */}
              <div className="relative flex-1 h-full min-w-0">
                {/* 3.1: Syntax Highlighting */}
                <div
                  ref={highlightRef}
                  className="absolute inset-0 w-full h-full py-4 pl-4 pr-2 font-mono text-base leading-7 whitespace-pre overflow-hidden bg-transparent z-20 pointer-events-none"
                  aria-hidden="true"
                >
                  {linesArray.map((line, i) => (
                    <div key={i} className="h-7">
                      {renderHighlightedLine(line)}
                    </div>
                  ))}
                </div>

                {/* 3.2: Invisible Textarea */}
                <textarea
                  id="timeInput"
                  value={inputText}
                  onChange={handleTextChange}
                  onBlur={handleBlur}
                  onPaste={handlePaste}
                  onScroll={handleScroll}
                  placeholder={"12.15-08.00\n0.45*6\n#1+#2\n12.34.56/2"}
                  className="absolute inset-0 w-full h-full py-4 pl-4 pr-2 resize-none outline-none font-mono text-base leading-7 whitespace-pre overflow-auto bg-transparent text-transparent z-10 editor-focus-ring"
                  style={{
                    caretColor: "#344e41",
                  }}
                  spellCheck="false"
                />
              </div>

              {/* Outputs per line */}
              <div
                ref={outputRef}
                className="min-w-30 max-w-[40%] px-4 py-4 h-full overflow-hidden font-mono text-sm leading-7 text-right pointer-events-none select-none z-10 shrink-0"
                style={{
                  background: "#dad7cd",
                  borderLeft: "1px solid #a3b18a",
                }}
              >
                {linesArray.map((_, i) => (
                  <div
                    key={i}
                    className="h-7 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ color: "#588157" }}
                    title={lineResults[i] ?? ""}
                  >
                    {lineResults[i] || ""}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grand Total */}
          <div className="flex justify-center mt-6">
            <div
              className="rounded-xl p-8 flex flex-col items-center justify-center transition-all w-80 shadow-sm"
              style={{ background: "#dad7cd", border: "1px solid #a3b18a" }}
            >
              <span
                className="text-xs font-bold uppercase tracking-widest mb-2 text-center"
                style={{ color: "#588157" }}
              >
                Total Result
              </span>
              <div
                className="text-5xl font-bold font-mono tracking-tight"
                style={{
                  color: totalResult.startsWith("-") ? "#bc4749" : "#344e41",
                }}
              >
                {totalResult}
              </div>
            </div>
          </div>
        </div>

        {/* Custom Tooltip */}
        {tooltip.show && (
          <div
            className="fixed z-50 text-sm font-medium px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transform -translate-y-full transition-opacity duration-150"
            style={{
              left: tooltip.x + 15,
              top: tooltip.y - 10,
              background: "#344e41",
              color: "#dad7cd",
              border: "1px solid #3a5a40",
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
