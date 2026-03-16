"use client";

import { AlertTriangle, Clock, Info } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

type Computed = { type: "TIME" | "SCALAR"; val: number; str?: string };

type Token =
  | { type: "TIME" | "SCALAR"; val: number; str?: string }
  | { type: "OP"; val: string; str?: string };

export default function App(): React.ReactElement {
  const [inputText, setInputText] = useState<string>("");
  const [lineResults, setLineResults] = useState<Array<string | null>>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [totalResult, setTotalResult] = useState<string>("00:00");

  // Tracking für Cursor und "abgeschlossene" Zeilen
  const [cursorLine, setCursorLine] = useState<number>(0);
  const [committedLines, setCommittedLines] = useState<Set<number>>(new Set());

  // NEU: Speichert die berechneten Werte und das Format für die Tooltips
  const [computedValues, setComputedValues] = useState<Array<Computed | null>>(
    [],
  );
  const [hasSeconds, setHasSeconds] = useState<boolean>(false);

  // NEU: State für das eigene Tooltip
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    text: string;
    x: number;
    y: number;
  }>({ show: false, text: "", x: 0, y: 0 });

  // Refs für synchrones Scrollen
  const bgRef = useRef<HTMLDivElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null); // NEU: Ref für das Syntax-Overlay

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateTime(inputText);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [inputText]);

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
    // Block unrecognized characters
    const leftover = line
      .replace(
        /(\d{1,5}[:.]\d{2}(?:[:.]\d{2})?)|(#\s*\d+)|([+\-*/])|(\d+(?:[.,]\d+)?)/g,
        "",
      )
      .trim();
    if (leftover.length > 0) {
      throw new Error(`Unrecognized characters: '${leftover}'`);
    }

    const regex =
      /(\d{1,5}[:.]\d{2}(?:[:.]\d{2})?)|(#\s*\d+)|([+\-*/])|(\d+(?:[.,]\d+)?)/g;
    let expr: Token[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match[1]) {
        expr.push({
          type: "TIME",
          val: parseTimeStrToSeconds(match[1]),
          str: match[1],
        });
      } else if (match[2]) {
        const idx = parseInt(match[2].replace("#", "").trim(), 10) - 1;
        if (
          idx < 0 ||
          idx >= tempComputedLines.length ||
          !tempComputedLines[idx]
        ) {
          throw new Error(`Reference ${match[2]} is empty or invalid`);
        }
        const refObj = tempComputedLines[idx];
        expr.push({ ...refObj });
      } else if (match[3]) {
        expr.push({ type: "OP", val: match[3], str: match[3] });
      } else if (match[4]) {
        expr.push({
          type: "SCALAR",
          val: parseFloat(match[4].replace(",", ".")),
          str: match[4],
        });
      }
    }

    if (expr.length === 0) return null;

    let unaryPass: Token[] = [];
    for (let i = 0; i < expr.length; i++) {
      let token = expr[i];
      if (token.type === "OP" && (token.val === "+" || token.val === "-")) {
        if (i === 0 || expr[i - 1].type === "OP") {
          let next = expr[i + 1];
          if (!next || next.type === "OP")
            throw new Error(`Syntax error after operator '${token.val}'`);
          next = { ...next };
          next.val = token.val === "-" ? -next.val : next.val;
          next.str = token.val + next.str;
          unaryPass.push(next);
          i++;
          continue;
        }
      }
      unaryPass.push(token);
    }
    expr = unaryPass;

    let mulDivPass: Token[] = [];
    for (let i = 0; i < expr.length; i++) {
      let token = expr[i];
      if (token.type === "OP" && (token.val === "*" || token.val === "/")) {
        let left = mulDivPass.pop();
        let right = expr[i + 1];
        if (!left || !right || right.type === "OP")
          throw new Error(`Incomplete calculation at '${token.val}'`);

        if (token.val === "*") {
          if (
            (left.type === "TIME" && right.type === "SCALAR") ||
            (left.type === "SCALAR" && right.type === "TIME")
          ) {
            mulDivPass.push({ type: "TIME", val: left.val * right.val });
          } else if (left.type === "SCALAR" && right.type === "SCALAR") {
            mulDivPass.push({ type: "SCALAR", val: left.val * right.val });
          } else {
            throw new Error("Time × Time is not allowed");
          }
        } else if (token.val === "/") {
          if (left.type === "TIME" && right.type === "SCALAR") {
            mulDivPass.push({ type: "TIME", val: left.val / right.val });
          } else if (left.type === "SCALAR" && right.type === "SCALAR") {
            mulDivPass.push({ type: "SCALAR", val: left.val / right.val });
          } else if (left.type === "TIME" && right.type === "TIME") {
            throw new Error("Time ÷ Time is not allowed. Use a number.");
          } else {
            throw new Error("Number ÷ Time is not allowed");
          }
        }
        i++;
      } else {
        mulDivPass.push(token);
      }
    }
    expr = mulDivPass;

    let res = expr[0];
    for (let i = 1; i < expr.length; i += 2) {
      let op = expr[i];
      let right = expr[i + 1];
      if (!right) throw new Error("Incomplete calculation at end of line");

      if (res.type !== right.type) {
        throw new Error("Cannot add/subtract time and numbers");
      }

      // both are TIME or both are SCALAR -> val is number
      if (res.type === "TIME" || res.type === "SCALAR") {
        const leftVal = res.val as number;
        const rightVal = right.val as number;
        if (op.val === "+") {
          res = { type: res.type, val: leftVal + rightVal };
        } else if (op.val === "-") {
          res = { type: res.type, val: leftVal - rightVal };
        } else {
          throw new Error(`Unexpected operator: '${op.val}'`);
        }
      } else {
        throw new Error("Unexpected operand types for add/subtract");
      }
    }

    if (res.type === "TIME" || res.type === "SCALAR") {
      return { ...res };
    }
    throw new Error("Unexpected result token");
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

          // Es wird nur noch das Resultat allein angezeigt
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

    setComputedValues(tempComputedLines); // Speichern für die Tooltips
    setLineResults(newLineResults);
    setErrors(newErrors);
    setTotalResult(formatTime(overallTotalSeconds, globalHasSeconds));
  };
  const updateCursorState = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const pos = element.selectionStart;
    const text = element.value;
    const lines = text.split("\n");

    const currentLineIndex = text.substring(0, pos).split("\n").length - 1;
    setCursorLine(currentLineIndex);

    setCommittedLines((prev) => {
      if (text.trim() === "") return new Set();
      let next = new Set(prev);
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        if (i !== currentLineIndex && !next.has(i)) {
          next.add(i);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    updateCursorState(e.target as HTMLTextAreaElement);
  };

  const handleInteraction = (e: React.SyntheticEvent<HTMLTextAreaElement>) =>
    updateCursorState(e.currentTarget as HTMLTextAreaElement);

  const handleBlur = () => {
    setCommittedLines((prev) => {
      const next = new Set(prev);
      next.add(cursorLine);
      return next;
    });
  };

  // Synchronisiert das Scrolling über alle Layer hinweg!
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

  const renderHighlightedLine = (line: string): React.ReactNode => {
    if (!line) return null;
    const regex =
      /(\d{1,5}[:.]\d{2}(?:[:.]\d{2})?|#\s*\d+|[+\-*/]|\d+(?:[.,]\d+)?)/g;
    const parts = line.split(regex);

    return parts.map((part, j) => {
      if (!part) return null;

      // Time (dunkleres Blau)
      if (part.match(/^\d{1,5}[:.]\d{2}(?:[:.]\d{2})?$/)) {
        return (
          <span key={j} className="text-blue-700 font-medium">
            {part}
          </span>
        );
      }

      // Reference (dunkleres Lila)
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
            className="text-purple-700 font-medium border-b border-dashed border-purple-400 cursor-help pointer-events-auto"
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

      // Operators (etwas dunkleres Grau)
      if (part.match(/^[+\-*/]$/)) {
        return (
          <span key={j} className="text-zinc-500 font-medium">
            {part}
          </span>
        );
      }

      // Scalar Numbers (dunkleres Smaragdgrün)
      if (part.match(/^\d+(?:[.,]\d+)?$/)) {
        return (
          <span key={j} className="text-emerald-700 font-medium">
            {part}
          </span>
        );
      }

      // Unrecognized (fast schwarz)
      return (
        <span key={j} className="text-zinc-900">
          {part}
        </span>
      );
    });
  };

  const linesArray = inputText.split("\n");
  const visibleErrors = Object.entries(errors).filter(([lineIdx]) =>
    committedLines.has(parseInt(lineIdx)),
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans text-zinc-800">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-200">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white flex items-center space-x-3">
          <Clock className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold tracking-tight">
            vii<span className="text-blue-400">.sh</span>
          </h1>
          <span className=" font-medium ml-2 border-l border-zinc-700 pl-4">
            Time Calculator
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="flex items-start space-x-2 text-sm text-blue-800 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <p>
              Calculate using <strong>HH:MM</strong>. Allowed operators are{" "}
              <strong>+ - * /</strong>. <br />
              Hover over <strong>#references</strong> (e.g., #1) to see their
              current value!
            </p>
          </div>

          <div>
            <label
              htmlFor="timeInput"
              className="block text-sm font-medium text-zinc-700 mb-2"
            >
              Your calculations:
            </label>
            <div className="relative w-full h-72 bg-white border border-zinc-300 rounded-xl shadow-inner overflow-hidden flex">
              {/* Layer 1: Error Background */}
              <div
                ref={bgRef}
                className="absolute top-0 bottom-0 left-12 right-0 pointer-events-none z-0 overflow-hidden"
                style={{ paddingTop: "1rem" }}
              >
                {linesArray.map((_, i) => {
                  const hasError = committedLines.has(i) && errors[i];
                  return (
                    <div
                      key={i}
                      className={`h-7 w-full ${hasError ? "bg-rose-50" : "bg-transparent"}`}
                    />
                  );
                })}
              </div>

              {/* Layer 2: Line Numbers */}
              <div
                ref={lineNumbersRef}
                className="w-12 h-full py-4 overflow-hidden bg-zinc-50 border-r border-zinc-200 select-none z-10 flex-shrink-0"
              >
                {linesArray.map((_, i) => {
                  const hasError = committedLines.has(i) && errors[i];
                  return (
                    <div
                      key={i}
                      className={`h-7 text-right pr-3 text-sm font-mono leading-7 ${hasError ? "text-rose-500 font-bold" : "text-zinc-400"}`}
                    >
                      {i + 1}
                    </div>
                  );
                })}
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
                  onKeyUp={handleInteraction}
                  onClick={handleInteraction}
                  onBlur={handleBlur}
                  onScroll={handleScroll}
                  placeholder={"Example:\n08:00\n01:30 * 2\n#1 + #2\n- 00:15"}
                  className="absolute inset-0 w-full h-full py-4 pl-4 pr-2 resize-none outline-none font-mono text-base leading-7 whitespace-pre overflow-auto bg-transparent text-transparent caret-zinc-800 z-10"
                  spellCheck="false"
                />
              </div>

              {/* Outputs & Error Messages per line */}
              <div
                ref={outputRef}
                className="w-[25%] min-w-[120px] h-full py-4 pr-4 pl-2 overflow-hidden font-mono text-sm leading-7 text-right bg-zinc-50 border-l border-zinc-200 pointer-events-none select-none z-10 flex-shrink-0"
              >
                {linesArray.map((_, i) => {
                  const showFeedback = committedLines.has(i);
                  const hasError = showFeedback && errors[i];

                  // Zeigt den Fehler nicht mehr an, nur leeren String bei Fehlern oder unbestätigten Zeilen
                  const displayContent =
                    showFeedback && !hasError ? lineResults[i] || "" : "";

                  return (
                    <div
                      key={i}
                      className="h-7 whitespace-nowrap overflow-hidden text-ellipsis text-zinc-500"
                      title={
                        showFeedback && !hasError ? (lineResults[i] ?? "") : ""
                      }
                    >
                      {displayContent}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Global Errors */}
          {visibleErrors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-sm animate-in fade-in">
              <div className="flex items-center space-x-2 font-bold mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Errors found:</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {visibleErrors.map(([lineIdx, msg]) => (
                  <li key={lineIdx}>
                    <span className="font-semibold">
                      Line {parseInt(lineIdx) + 1}:
                    </span>{" "}
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grand Total */}
          <div className="flex justify-center mt-2">
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex flex-col items-center justify-center transition-all w-64 shadow-lg">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 text-center">
                Total Result
              </span>
              <div
                className={`text-4xl font-bold ${totalResult.startsWith("-") ? "text-rose-400" : "text-white"} font-mono tracking-tight`}
              >
                {totalResult}
              </div>
            </div>
          </div>
        </div>

        {/* Custom Tooltip */}
        {tooltip.show && (
          <div
            className="fixed z-50 bg-zinc-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transform -translate-y-full transition-opacity duration-150 border border-zinc-700"
            style={{ left: tooltip.x + 15, top: tooltip.y - 10 }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
