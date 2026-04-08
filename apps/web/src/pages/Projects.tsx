import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjects, createProject } from "../api";
import type { Project } from "../api";

const STACK_PRESETS = [
  "node+ink+sqlite",
  "node+express+postgres",
  "nextjs+typescript",
  "react+vite",
  "python+fastapi",
  "django+postgres"
] as const;

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [stack, setStack] = useState("");
  const [stackPreset, setStackPreset] = useState<string>("node+ink+sqlite");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = () =>
    fetchProjects()
      .then((list) => {
        setProjects(list);
        setApiError(null);
      })
      .catch((err) => {
        setApiError(err instanceof Error ? err.message : "API'ye bağlanılamadı.");
        setProjects([]);
      });

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const finalStack = stackPreset === "custom" ? stack.trim() : stackPreset;
    if (!name.trim() || !repoPath.trim() || !finalStack) {
      setError("Ad, repo yolu ve stack zorunludur. 'Diğer' seçtiyseniz özel stack yazın.");
      return;
    }
    setLoading(true);
    try {
      await createProject({
        name: name.trim(),
        repoPath: repoPath.trim(),
        stack: finalStack
      });
      setName("");
      setRepoPath("");
      setStack("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API uyarısı */}
      {apiError && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 p-4 text-red-200">
          <p className="font-semibold">API bağlantısı yok</p>
          <p className="mt-2 text-sm">
            {apiError} — Proje ekleyebilmek için önce API sunucusunu başlatın:{" "}
            <code className="rounded bg-red-900/50 px-1.5 py-0.5">npm run dev:api</code> (CrewOps klasöründe ayrı terminalde).
          </p>
        </div>
      )}

      {/* Proje listesi + PM mutabakat */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Projeler</h2>
        {projects.length === 0 && (
          <p className="text-slate-400">Henüz proje yok. Aşağıdan yeni proje ekleyin, sonra PM ile mutabakat yapıp yazmaya başlayın.</p>
        )}
        <ul className="space-y-4">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-slate-600/50 bg-slate-800/80 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-200">#{p.id} {p.name}</span>
                <span
                  className={
                    p.phase === "mutabakat_tamamlandi"
                      ? "rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
                      : "rounded-full bg-amber-900/50 px-2.5 py-0.5 text-xs font-medium text-amber-300"
                  }
                >
                  {p.phase === "mutabakat_tamamlandi" ? "Mutabakat tamamlandı" : "Mutabakat bekliyor"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{p.repoPath} · {p.stack}</p>

              {(p.phase === "mutabakat_bekliyor" || !p.phase) && (
                <div className="mt-4 rounded-lg border border-slate-600/50 bg-slate-900/50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-slate-300">Proje yöneticisi ile mutabakat</h3>
                  <p className="mb-3 text-xs text-slate-500">
                    PM ile sohbet ederek kapsam ve kabul kriterlerini netleştirin.
                  </p>
                  <Link
                    to="/pm-chat"
                    state={{ projectId: p.id }}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    PM ile sohbet başlat
                  </Link>
                </div>
              )}

              {p.phase === "mutabakat_tamamlandi" && (
                <div className="mt-3">
                  {p.mutabakatOzeti && (
                    <p className="mb-2 text-xs text-slate-500">Mutabakat: {p.mutabakatOzeti}</p>
                  )}
                  <Link
                    to="/plan"
                    state={{ projectId: p.id }}
                    className="inline-flex items-center rounded-lg bg-emerald-700/50 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-600/50"
                  >
                    Plan olustur
                  </Link>
                </div>
              )}

              {(p.phase === "gelistirme" || p.phase === "review") && (
                <div className="mt-3">
                  <Link
                    to="/orchestration"
                    state={{ projectId: p.id }}
                    className="inline-flex items-center rounded-lg bg-indigo-700/50 px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-indigo-600/50"
                  >
                    Orkestrasyona git
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Yeni proje ekle */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Yeni proje ekle</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Ad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: CrewOps MVP"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Repo yolu (mutlak)</label>
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="Örn: D:\Dev\CrewOps"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Teknoloji seti (stack)</label>
            <select
              value={stackPreset}
              onChange={(e) => setStackPreset(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {STACK_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="custom">Diğer (elle gir)</option>
            </select>
          </div>
          {stackPreset === "custom" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-400">Özel stack</label>
              <input
                type="text"
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="Örn: go+fiber+postgres"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Ekleniyor…" : "Proje ekle"}
          </button>
        </form>
      </div>
    </div>
  );
}
