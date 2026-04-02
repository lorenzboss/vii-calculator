"use client";

import { Check, Clock, Copy, Info, Trash2 } from "lucide-react";
import React from "react";
import { Editor } from "./components/Editor";
import { useCalculator } from "./hooks/useCalculator";

export default function App(): React.ReactElement {
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 font-sans text-zinc-800">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center space-x-3 bg-blue-600 p-6 text-white">
          <Clock className="h-6 w-6 text-blue-300" />
          <h1 className="text-2xl font-bold tracking-tight">
            vii<span className="text-blue-300">.sh</span>
          </h1>
          <span className="ml-2 border-l border-blue-400 pl-4 font-medium text-blue-50">
            Time Calculator
          </span>
        </div>

        <div className="space-y-6 p-6">
          {/* Info */}
          <div className="flex items-start space-x-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p>
              Calculate using <strong>H.MM</strong> or <strong>HH.MM.SS</strong>
              . Allowed operators are <strong>+ - * /</strong>. Grouping with{" "}
              <strong>( )</strong> is supported. <br />
              Use <strong>#1</strong>, <strong>#2</strong>, etc. to reference
              previous lines.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="timeInput"
                className="block text-sm font-medium text-zinc-700"
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
            <Editor
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
          <div className="mt-6 flex justify-center">
            <div className="flex w-80 flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-8 shadow-sm transition-all">
              <span className="mb-2 text-center text-xs font-bold tracking-widest text-zinc-500 uppercase">
                Total Result
              </span>
              <div
                className={`text-5xl font-bold ${
                  totalResult.startsWith("-")
                    ? "text-rose-500"
                    : "text-zinc-800"
                } font-mono tracking-tight`}
              >
                {totalResult}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
