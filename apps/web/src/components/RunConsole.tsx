/**
 * Gömülü terminal: Başla dediğinde çalışan görevin canlı stdout/stderr çıktısını
 * SSE ile alıp terminal benzeri bir panelde gösterir. Bittiğinde üretilen kodu editör gibi gösterir.
 */

import React, { useEffect, useRef, useState } from "react";
import { CodeEditorView } from "./CodeEditorView";

export interface RunStreamEvent {
  type: string;
  data?: unknown;
}

export interface DoneData {
  runId?: number;
  status?: string;
  parsedOk?: boolean;
  summary?: string;
  patch?: string;
  filesChanged?: string[];
  error?: string;
}

interface RunConsoleProps {
  jobId: string | null;
  taskTitle?: string;
  onDone?: (data: DoneData) => void;
  onClose?: () => void;
}

export function RunConsole({
  jobId,
  taskTitle,
  onDone,
  onClose
}: RunConsoleProps) {
  const [lines, setLines] = useState<Array<{ type: string; text: string }>>([]);
  const [doneData, setDoneData] = useState<DoneData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) return;

    setLines([]);
    setDoneData(null);
    setError(null);

    const url = `/api/run/stream/${jobId}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const ev: RunStreamEvent = JSON.parse(e.data);
        if (ev.type === "stdout" && typeof ev.data === "string") {
          setLines((prev) => [...prev, { type: "stdout", text: ev.data }]);
        } else if (ev.type === "stderr" && typeof ev.data === "string") {
          setLines((prev) => [...prev, { type: "stderr", text: ev.data }]);
        } else if (ev.type === "done" && ev.data) {
          const d = ev.data as DoneData;
          setDoneData(d);
          onDone?.(d);
          es.close();
        }
      } catch (_) {}
    };

    es.onerror = () => {
      es.close();
      setError("Stream bağlantısı kesildi.");
    };

    return () => es.close();
  }, [jobId, onDone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!jobId) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>
          Çalışma konsolu
          {taskTitle ? ` – ${taskTitle}` : ""}
        </h3>
        {onClose && (
          <button type="button" onClick={onClose}>
            Kapat
          </button>
        )}
      </div>
      <div className="run-console">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "stderr" ? "line-stderr" : "line-stdout"
            }
          >
            {line.text}
          </div>
        ))}
        {doneData && (
          <>
            <div className="line-done">
              <strong>Bitti.</strong>{" "}
              {doneData.status === "success" ? "Başarılı." : "Başarısız."}
              {doneData.summary && ` ${doneData.summary}`}
              {doneData.error && ` Hata: ${doneData.error}`}
              {doneData.status === "success" && doneData.patch?.trim() && (
                <span className="block mt-2 text-emerald-400 text-sm">
                  Kod projeye yazıldı, bağımlılıklar kuruldu (npm/pnpm/yarn install).
                </span>
              )}
            </div>
            {doneData.patch && doneData.patch.trim() && (
              <div style={{ marginTop: 12 }}>
                <CodeEditorView
                  content={doneData.patch}
                  mode="diff"
                  maxHeight="24rem"
                  title="Üretilen kod (PATCH)"
                />
              </div>
            )}
          </>
        )}
        {error && (
          <div className="line-stderr">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
