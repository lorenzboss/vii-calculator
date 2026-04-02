import React, { useEffect, useRef, useState } from "react";
import { type Computed, formatTime, runCalculation } from "../lib/calculator";

export function useCalculator() {
  const [inputText, setInputText] = useState<string>("");
  const [lineResults, setLineResults] = useState<Array<string | null>>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [totalResult, setTotalResult] = useState<string>("00:00");
  const [computedValues, setComputedValues] = useState<Array<Computed | null>>(
    [],
  );
  const [hasSeconds, setHasSeconds] = useState<boolean>(false);
  const [visibleErrors, setVisibleErrors] = useState<Record<number, string>>(
    {},
  );
  const [copied, setCopied] = useState<boolean>(false);

  // Always up-to-date errors snapshot for async timer callbacks
  const errorsRef = useRef<Record<number, string>>({});
  // Per-line running debounce timers
  const errorTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );

  // Load persisted input on first mount
  useEffect(() => {
    const saved = localStorage.getItem("vii-calc-input");
    if (saved !== null) setInputText(saved);
  }, []);

  useEffect(() => {
    const result = runCalculation(inputText);
    setHasSeconds(result.hasSeconds);
    setComputedValues(result.computedValues);
    setLineResults(result.lineResults);
    setErrors(result.errors);
    setTotalResult(result.totalResult);
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

  return {
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
  };
}
