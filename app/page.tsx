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
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans text-zinc-800">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-200">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white flex items-center space-x-3">
          <Clock className="w-6 h-6 text-blue-300" />
          <h1 className="text-2xl font-bold tracking-tight">
            vii<span className="text-blue-300">.sh</span>
          </h1>
          <span className="font-medium ml-2 border-l border-blue-400 pl-4 text-blue-50">
            Time Calculator
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="flex items-start space-x-2 text-sm text-blue-800 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
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
                className="block text-sm font-medium text-zinc-700"
              >
                Your calculations:
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all select-none border ${
                    copied
                      ? "border-zinc-400 text-zinc-700 bg-zinc-100"
                      : "border-zinc-200 text-zinc-500 bg-white"
                  }`}
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
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all select-none disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-200 text-zinc-500 bg-white"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
          <div className="flex justify-center mt-6">
            <div className="bg-zinc-50 rounded-xl p-8 border border-zinc-200 flex flex-col items-center justify-center transition-all w-80 shadow-sm">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 text-center">
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
