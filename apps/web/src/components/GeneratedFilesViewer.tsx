import React, { useEffect, useState } from "react";
import { fetchRunFiles } from "../api";
import type { RunFile } from "../api";

interface Props {
  runId: number;
  onClose: () => void;
}

export function GeneratedFilesViewer({ runId, onClose }: Props) {
  const [files, setFiles] = useState<RunFile[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRunFiles(runId)
      .then((f) => {
        setFiles(f);
        setSelectedIdx(0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-6">
        <p className="text-sm text-slate-400">Dosyalar yukleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-4">
        <p className="text-sm text-red-300">Hata: {error}</p>
        <button onClick={onClose} className="mt-2 text-xs text-slate-400 hover:text-slate-200">Kapat</button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-400">Bu run icin dosya uretilmemis.</p>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">Kapat</button>
        </div>
      </div>
    );
  }

  const selected = files[selectedIdx];

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Uretilen Dosyalar</span>
          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
            {files.length} dosya
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Kapat
        </button>
      </div>

      <div className="flex" style={{ minHeight: 300 }}>
        {/* Dosya listesi (sol) */}
        <div className="w-56 shrink-0 border-r border-slate-700/60 overflow-y-auto">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`block w-full text-left px-3 py-2 text-xs border-b border-slate-700/30 transition ${
                i === selectedIdx
                  ? "bg-slate-700/50 text-slate-100"
                  : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {f.isNew && (
                  <span className="rounded bg-emerald-900/60 px-1 py-0.5 text-[9px] font-medium text-emerald-400">
                    NEW
                  </span>
                )}
                <span className="truncate">{f.path}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                <span className="text-emerald-500">+{f.addedLines}</span>{" "}
                <span className="text-red-400">-{f.removedLines}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Dosya icerigi (sag) */}
        <div className="flex-1 overflow-auto bg-slate-900/70 p-0">
          <div className="sticky top-0 z-10 border-b border-slate-700/40 bg-slate-800/90 px-4 py-1.5">
            <span className="text-xs font-mono text-slate-300">{selected.path}</span>
          </div>
          <pre className="p-4 text-xs leading-5 text-slate-300 font-mono whitespace-pre overflow-x-auto">
            {renderDiffContent(selected.content)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function renderDiffContent(content: string): React.ReactNode {
  // Basit diff gorsellestirme: satirlari renklendir
  const lines = content.split("\n");
  return lines.map((line, i) => {
    // Saf icerik (patch'ten cikarilmis), renklendirme yok
    return (
      <div key={i} className="min-h-[1.25rem]">
        <span className="mr-3 inline-block w-8 text-right text-slate-600 select-none">{i + 1}</span>
        {line}
      </div>
    );
  });
}
