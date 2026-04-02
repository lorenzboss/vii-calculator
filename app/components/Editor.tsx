"use client";

import React, { useRef, useState } from "react";
import { type Computed, formatTime } from "../lib/calculator";

interface EditorProps {
  inputText: string;
  lineResults: Array<string | null>;
  visibleErrors: Record<number, string>;
  computedValues: Array<Computed | null>;
  hasSeconds: boolean;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function Editor({
  inputText,
  lineResults,
  visibleErrors,
  computedValues,
  hasSeconds,
  onTextChange,
  onBlur,
  onPaste,
}: EditorProps) {
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
  const highlightRef = useRef<HTMLDivElement | null>(null);

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

      // Time value
      if (part.match(/^\d{1,5}[:.]\d{2}(?:[:.]\d{2})?$/)) {
        return (
          <span key={j} className="text-blue-600 font-medium">
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
          tooltipText =
            computed.type === "TIME"
              ? formatTime(computed.val, hasSeconds)
              : parseFloat(computed.val.toFixed(2)).toString();
        }

        return (
          <span
            key={j}
            className="text-zinc-600 font-medium border-b border-dashed border-zinc-400 cursor-help pointer-events-auto"
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
          <span key={j} className="text-zinc-500 font-medium">
            {part}
          </span>
        );
      }

      // Parenthesis
      if (part === "(" || part === ")") {
        return (
          <span key={j} className="text-zinc-400 font-medium">
            {part}
          </span>
        );
      }

      // Scalar number
      if (part.match(/^\d+(?:[.,]\d+)?$/)) {
        return (
          <span key={j} className="text-zinc-600 font-medium">
            {part}
          </span>
        );
      }

      // Unrecognized character
      return (
        <span key={j} className="text-zinc-900">
          {part}
        </span>
      );
    });
  };

  const linesArray = inputText.split("\n");

  return (
    <>
      <div
        className="relative w-full h-72 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex transition-all hover:border-zinc-300 focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100"
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
                  ? "rgb(255 241 242)"
                  : "transparent",
              }}
            />
          ))}
        </div>

        {/* Layer 2: Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="w-12 h-full py-4 overflow-hidden bg-zinc-50 border-r border-zinc-200 select-none z-10 shrink-0"
        >
          {linesArray.map((_, i) => (
            <div
              key={i}
              className={`h-7 text-right pr-3 text-sm font-mono leading-7 ${
                visibleErrors[i] ? "text-rose-500 font-bold" : "text-zinc-400"
              }`}
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
            onChange={onTextChange}
            onBlur={onBlur}
            onPaste={onPaste}
            onScroll={handleScroll}
            placeholder={"12.15-08.00\n0.45*6\n#1+#2\n12.34.56/2"}
            className="absolute inset-0 w-full h-full py-4 pl-4 pr-2 resize-none outline-none font-mono text-base leading-7 whitespace-pre overflow-auto bg-transparent text-transparent placeholder:text-zinc-400/60 caret-zinc-800 z-10"
            spellCheck="false"
          />
        </div>

        {/* Outputs per line */}
        <div
          ref={outputRef}
          className="min-w-30 max-w-[40%] px-4 py-4 h-full overflow-hidden font-mono text-sm leading-7 text-right bg-zinc-50 border-l border-zinc-200 pointer-events-none select-none z-10 shrink-0"
        >
          {linesArray.map((_, i) => (
            <div
              key={i}
              className="h-7 whitespace-nowrap overflow-hidden text-ellipsis text-zinc-500"
              title={lineResults[i] ?? ""}
            >
              {lineResults[i] || ""}
            </div>
          ))}
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
    </>
  );
}
