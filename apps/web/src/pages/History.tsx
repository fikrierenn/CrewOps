/**
 * Koşu geçmişi: run listesi, run detayında üretilen kod (PATCH) ve isteğe bağlı "Patch uygula".
 * Başarılı görevlerde PATCH otomatik projeye uygulanır ve npm/pnpm/yarn install çalıştırılır.
 * Bu sayfadan "Patch uygula" ile tekrar uygulayabilir veya sadece kodu inceleyebilirsiniz.
 */

import React, { useEffect, useState } from "react";
import {
  fetchProjects,
  fetchRuns,
  fetchRunDetail,
  applyRunPatch
} from "../api";
import type { Project, Run, RunDetailResponse } from "../api";
import { CodeEditorView } from "../components/CodeEditorView";

export function History() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((list) => {
        setProjects(list);
        if (list.length > 0 && selectedProjectId === null) setSelectedProjectId(list[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProjectId !== null) {
      fetchRuns(selectedProjectId, 30).then(setRuns).catch(console.error);
    } else {
      setRuns([]);
    }
    setDetailRunId(null);
    setDetail(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (detailRunId === null) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError(null);
    fetchRunDetail(detailRunId)
      .then(setDetail)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setDetail(null);
      })
      .finally(() => setDetailLoading(false));
  }, [detailRunId]);

  const handleApplyPatch = async (runId: number) => {
    setApplyLoading(true);
    setApplyMessage(null);
    setError(null);
    try {
      const result = await applyRunPatch(runId);
      setApplyMessage(
        result.filesAffected.length > 0
          ? `Patch tekrar uygulandı. Değişen dosyalar: ${result.filesAffected.join(", ")}. Bağımlılıklar zaten otomatik kurulmuş olabilir; gerekirse proje klasöründe npm install çalıştırın.`
          : "Patch uygulandı (değişen dosya yok)."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyLoading(false);
    }
  };

  const patchArtifact = detail?.artifacts.find((a) => a.kind === "patch");
  const parsedArtifact = detail?.artifacts.find((a) => a.kind === "parsed_output");
  let parsed: { summary?: string[]; filesChanged?: string[]; commandsToRun?: string[] } | null = null;
  if (parsedArtifact?.content) {
    try {
      parsed = JSON.parse(parsedArtifact.content);
    } catch (_) {}
  }
  const rawArtifact = detail?.artifacts.find((a) => a.kind === "raw_output");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Koşu geçmişi</h2>
        <p className="mb-4 text-sm text-slate-400">
          Görev bittiğinde üretilen kod (PATCH) <strong>otomatik</strong> proje klasörüne yazılır ve{" "}
          <code>npm install</code> (veya pnpm/yarn) çalıştırılır. Bu sayfada kodu inceleyebilir veya{" "}
          <strong>Patch uygula</strong> ile tekrar uygulayabilirsiniz. Aşağıdaki komut listesi, LLM’in önerdiği ek komutlar içindir; gerekirse siz çalıştırırsınız.
        </p>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-400">Proje</label>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
            className="w-full max-w-xs rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Seçin</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {applyMessage && (
          <div className="mb-4 rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
            {applyMessage}
          </div>
        )}

        <ul className="space-y-2">
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-600/50 bg-slate-800/80 px-4 py-3"
            >
              <span className="text-slate-200">
                <strong>Run #{r.id}</strong> – Görev #{r.taskId} – Rol: {r.roleId}{" "}
                <span
                  className={
                    r.status === "success"
                      ? "rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300"
                      : "rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-300"
                  }
                >
                  {r.status}
                </span>{" "}
                – {r.summary || "(özet yok)"}
              </span>
              <button
                type="button"
                onClick={() => setDetailRunId(detailRunId === r.id ? null : r.id)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
              >
                {detailRunId === r.id ? "Detayı kapat" : "Kod / Patch göster"}
              </button>
            </li>
          ))}
        </ul>
        {runs.length === 0 && selectedProjectId && (
          <p className="text-slate-500">Bu proje için henüz koşu yok.</p>
        )}
      </div>

      {/* Run detay: üretilen kod, patch, komutlar */}
      {detailRunId && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">
            Run #{detailRunId} – Üretilen çıktı
          </h3>
          {detailLoading && <p className="text-slate-400">Yükleniyor...</p>}
          {detail && !detailLoading && (
            <div className="space-y-4">
              {parsed?.summary && parsed.summary.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-300">Özet</h4>
                  <ul className="list-inside list-disc text-sm text-slate-400">
                    {parsed.summary.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed?.filesChanged && parsed.filesChanged.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-300">Değişen dosyalar</h4>
                  <p className="text-sm text-slate-400">{parsed.filesChanged.join(", ")}</p>
                </div>
              )}
              {patchArtifact && patchArtifact.content.trim() && (
                <div className="space-y-2">
                  <CodeEditorView
                    content={patchArtifact.content}
                    mode="diff"
                    maxHeight="28rem"
                    title="Üretilen kod (PATCH – diff)"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyPatch(detailRunId)}
                    disabled={applyLoading}
                    className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {applyLoading ? "Uygulanıyor…" : "Patch’i tekrar uygula"}
                  </button>
                </div>
              )}
              {!patchArtifact?.content?.trim() && (
                <p className="text-sm text-slate-500">Bu run için PATCH yok (boş veya parse edilemedi).</p>
              )}
              {parsed?.commandsToRun && parsed.commandsToRun.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-300">Önerilen ek komutlar</h4>
                  <p className="mb-2 text-xs text-slate-500">
                    npm install zaten otomatik çalıştırıldı. Aşağıdaki komutlar LLM’in önerdiği ek adımlardır; gerekirse proje klasöründe siz çalıştırın.
                  </p>
                  <CodeEditorView
                    content={parsed.commandsToRun.join("\n")}
                    mode="plain"
                    maxHeight="12rem"
                    title="Komutlar"
                  />
                </div>
              )}
              {rawArtifact && (
                <details className="rounded-lg border border-slate-600 bg-slate-900 overflow-hidden">
                  <summary className="cursor-pointer px-4 py-2 text-sm text-slate-400 hover:bg-slate-800/50">
                    Ham çıktıyı göster (editör görünümü)
                  </summary>
                  <CodeEditorView
                    content={rawArtifact.content}
                    mode="plain"
                    maxHeight="24rem"
                    className="rounded-none border-0"
                  />
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
