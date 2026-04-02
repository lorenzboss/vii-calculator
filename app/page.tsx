"use client";

import { Check, Clock, Copy, Info, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { Editor } from "./components/Editor";
import { useCalculator } from "./hooks/useCalculator";

export default function App(): React.ReactElement {
  const [showInfo, setShowInfo] = useState(false);
  const {
    inputText,
    lineResults,
    computedValues,
    hasSeconds,
    visibleErrors,
    copied,
    totalResult,
    handleTextChange,
    handleClear,
    handleBlur,
    handlePaste,
    handleCopy,
  } = useCalculator();

  return (
    <div className="flex h-dvh flex-col bg-white font-sans text-zinc-800 sm:items-center sm:justify-center sm:bg-zinc-50 sm:p-4">
      <div className="flex h-full flex-col sm:h-auto sm:w-full sm:max-w-4xl sm:overflow-hidden sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-xl">
        {/* Header */}
        <div className="relative flex shrink-0 items-center gap-2 bg-blue-600 p-3 text-white sm:gap-3 sm:p-6">
          <Clock className="h-5 w-5 text-blue-300 sm:h-6 sm:w-6" />
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            vii<span className="text-blue-300">.sh</span>
          </h1>
          <span className="ml-2 hidden border-l border-blue-400 pl-4 font-medium text-blue-50 sm:inline">
            Time Calculator
          </span>

          {/* Info button in header */}
          <button
            onClick={() => setShowInfo((s) => !s)}
            className={`ml-auto flex items-center justify-center rounded-full p-1.5 transition-colors select-none sm:p-2 ${
              showInfo
                ? "bg-white/20 text-white"
                : "animate-pulse text-blue-200 hover:animate-none hover:bg-white/10 hover:text-white"
            }`}
            title="Show syntax help"
          >
            <Info className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Dropdown info panel - overlays content below */}
          <div
            className={`absolute top-full right-3 z-50 w-72 origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-xl transition-all duration-200 sm:right-6 ${
              showInfo
                ? "scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0"
            }`}
          >
            <div className="p-4 text-sm leading-relaxed">
              <p className="mb-3 font-semibold text-zinc-700">How it works</p>
              <ul className="space-y-2 text-zinc-600">
                <li>
                  Enter times as <strong className="text-zinc-800">1.30</strong>
                  /<strong className="text-zinc-800">1:30</strong> (1h 30min) or{" "}
                  <strong className="text-zinc-800">1.30.45</strong>/
                  <strong className="text-zinc-800">1:30:45</strong> (with
                  seconds).
                </li>
                <li>
                  Use <strong className="text-zinc-800">+ − * /</strong> to add,
                  subtract, multiply or divide values.
                </li>
                <li>
                  Group calculations with{" "}
                  <strong className="text-zinc-800">( )</strong> to control
                  order of operations.
                </li>
                <li>
                  Reference any previous line with{" "}
                  <strong className="text-zinc-800">#1</strong>,{" "}
                  <strong className="text-zinc-800">#2</strong>, etc. to reuse
                  its result.
                </li>
                <li>
                  The <strong className="text-zinc-800">total</strong> at the
                  bottom sums up all time values across all lines.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Dimming backdrop - fades in/out, closes info on click */}
        <div
          className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
            showInfo ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setShowInfo(false)}
        />

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-6">
          {/* Toolbar */}
          <div className="flex shrink-0 items-center justify-between">
            <label
              htmlFor="timeInput"
              className="text-sm font-medium text-zinc-700"
            >
              Your calculations:
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all select-none ${
                  copied
                    ? "border-zinc-400 bg-zinc-100 text-zinc-700"
                    : "border-zinc-200 bg-white text-zinc-500"
                }`}
                title="Copy all lines with results"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleClear}
                disabled={inputText === ""}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 transition-all select-none disabled:cursor-not-allowed disabled:opacity-40"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          {/* Editor - fills all remaining space */}
          <div className="min-h-0 flex-1">
            <Editor
              className="h-full sm:h-72"
              inputText={inputText}
              lineResults={lineResults}
              visibleErrors={visibleErrors}
              computedValues={computedValues}
              hasSeconds={hasSeconds}
              onTextChange={handleTextChange}
              onBlur={handleBlur}
              onPaste={handlePaste}
            />
          </div>

          {/* Grand Total */}
          <div className="flex shrink-0 items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 sm:mx-auto sm:mt-2 sm:w-80 sm:flex-col sm:items-center sm:justify-center sm:p-8 sm:shadow-sm">
            <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase sm:mb-2">
              Total Result
            </span>
            <div
              className={`font-mono text-3xl font-bold tracking-tight sm:text-5xl ${
                totalResult.startsWith("-") ? "text-rose-500" : "text-zinc-800"
              }`}
            >
              {totalResult}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
