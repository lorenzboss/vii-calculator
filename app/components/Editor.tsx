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
          <span key={j} className="font-medium text-blue-600">
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
            className="pointer-events-auto cursor-help border-b border-dashed border-zinc-400 font-medium text-zinc-600"
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
          <span key={j} className="font-medium text-zinc-500">
            {part}
          </span>
        );
      }

      // Parenthesis
      if (part === "(" || part === ")") {
        return (
          <span key={j} className="font-medium text-zinc-400">
            {part}
          </span>
        );
      }

      // Scalar number
      if (part.match(/^\d+(?:[.,]\d+)?$/)) {
        return (
          <span key={j} className="font-medium text-zinc-600">
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
        className="relative flex h-72 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100 hover:border-zinc-300"
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
          className="pointer-events-none absolute top-0 right-0 bottom-0 left-12 z-0 overflow-hidden"
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
          className="z-10 h-full w-12 shrink-0 overflow-hidden border-r border-zinc-200 bg-zinc-50 py-4 select-none"
        >
          {linesArray.map((_, i) => (
            <div
              key={i}
              className={`h-7 pr-3 text-right font-mono text-sm leading-7 ${
                visibleErrors[i] ? "font-bold text-rose-500" : "text-zinc-400"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Layer 3: Editor Field */}
        <div className="relative h-full min-w-0 flex-1">
          {/* 3.1: Syntax Highlighting */}
          <div
            ref={highlightRef}
            className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden bg-transparent py-4 pr-2 pl-4 font-mono text-base leading-7 whitespace-pre"
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
            className="absolute inset-0 z-10 h-full w-full resize-none overflow-auto bg-transparent py-4 pr-2 pl-4 font-mono text-base leading-7 whitespace-pre text-transparent caret-zinc-800 outline-none placeholder:text-zinc-400/60"
            spellCheck="false"
          />
        </div>

        {/* Outputs per line */}
        <div
          ref={outputRef}
          className="pointer-events-none z-10 h-full max-w-[40%] min-w-30 shrink-0 overflow-hidden border-l border-zinc-200 bg-zinc-50 px-4 py-4 text-right font-mono text-sm leading-7 select-none"
        >
          {linesArray.map((_, i) => (
            <div
              key={i}
              className="h-7 overflow-hidden text-ellipsis whitespace-nowrap text-zinc-500"
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
          className="pointer-events-none fixed z-50 -translate-y-full transform rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white shadow-xl transition-opacity duration-150"
          style={{ left: tooltip.x + 15, top: tooltip.y - 10 }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
