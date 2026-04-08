/**
 * Üretilen kodu editör gibi gösterir: satır numaraları, monospace, diff ise + yeşil / - kırmızı.
 * Geçmiş ve RunConsole'da PATCH / ham çıktı için kullanılır.
 */

import React, { useRef, useEffect } from "react";

export type CodeEditorViewMode = "diff" | "plain";

interface CodeEditorViewProps {
  content: string;
  mode?: CodeEditorViewMode;
  maxHeight?: string;
  className?: string;
  /** Başlık (örn. "Üretilen kod (PATCH)") */
  title?: string;
}

export function CodeEditorView({
  content,
  mode = "diff",
  maxHeight = "28rem",
  className = "",
  title
}: CodeEditorViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = content ? content.split(/\r?\n/) : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [content]);

  return (
    <div className={`rounded-lg border border-slate-600 bg-slate-900 overflow-hidden ${className}`}>
      {title && (
        <div className="border-b border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-300">
          {title}
        </div>
      )}
      <div
        ref={scrollRef}
        className="overflow-auto font-mono text-sm leading-relaxed"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <tbody>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const isDiff = mode === "diff";
              const isPlus = isDiff && line.startsWith("+") && !line.startsWith("+++");
              const isMinus = isDiff && line.startsWith("-") && !line.startsWith("---");
              return (
                <tr key={i} className="hover:bg-slate-800/50">
                  <td
                    className="w-10 select-none border-r border-slate-700 bg-slate-800/60 px-2 py-0.5 text-right text-slate-500 align-top"
                    style={{ minWidth: 40 }}
                  >
                    {lineNum}
                  </td>
                  <td
                    className={`break-all px-3 py-0.5 align-top ${
                      isPlus
                        ? "bg-emerald-950/40 text-emerald-200"
                        : isMinus
                        ? "bg-red-950/30 text-red-200"
                        : "text-slate-300"
                    }`}
                  >
                    {line || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lines.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">(içerik yok)</div>
        )}
      </div>
    </div>
  );
}
