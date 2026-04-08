import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  fetchProjects, generatePlan, fetchPlanDraft, approvePlan, rejectPlan
} from "../api";
import type { Project, PlanData, PlannedTask } from "../api";

export function PlanReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateProjectId = (location.state as any)?.projectId as number | undefined;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(stateProjectId ?? null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((list) => {
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          // mutabakat_tamamlandi olan ilk projeyi sec
          const ready = list.find((p) => p.phase === "mutabakat_tamamlandi" || p.phase === "planlama" || p.phase === "gelistirme");
          if (ready) setSelectedProjectId(ready.id);
          else setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Mevcut plan taslagi varsa yukle
  useEffect(() => {
    if (!selectedProjectId) return;
    fetchPlanDraft(selectedProjectId)
      .then((draft) => {
        if (draft.parsedPlan) {
          setPlan(draft.parsedPlan);
          setDraftStatus(draft.status);
        }
      })
      .catch(() => {
        setPlan(null);
        setDraftStatus(null);
      });
  }, [selectedProjectId]);

  const handleGenerate = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const result = await generatePlan(selectedProjectId);
      setPlan(result.plan);
      setDraftStatus("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (autoStart = false) => {
    if (!selectedProjectId) return;
    setApproving(true);
    setError(null);
    try {
      const result = await approvePlan(selectedProjectId, autoStart);
      setDraftStatus("approved");
      navigate("/orchestration", {
        state: { projectId: selectedProjectId, autoStarted: result.orchestrationStarted }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProjectId) return;
    setError(null);
    try {
      await rejectPlan(selectedProjectId);
      setPlan(null);
      setDraftStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const canGenerate = selectedProject && (selectedProject.phase === "mutabakat_tamamlandi" || selectedProject.phase === "planlama");
  const isDraft = draftStatus === "draft";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Plan</h2>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="" disabled>Proje sec...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>#{p.id} {p.name} ({p.phase})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Plan uretiliyor..." : "Plan Uret"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Plan icerik */}
      {plan && (
        <div className="space-y-4">
          {/* ARCH_SHORT */}
          {plan.archShort && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">Mimari Ozet (ARCH_SHORT)</h3>
              <pre className="whitespace-pre-wrap text-sm text-slate-400">{plan.archShort}</pre>
            </div>
          )}

          {/* DECISIONS */}
          {plan.decisions && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">Kararlar (DECISIONS)</h3>
              <pre className="whitespace-pre-wrap text-sm text-slate-400">{plan.decisions}</pre>
            </div>
          )}

          {/* Tasks tablosu */}
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">
              Gorevler ({plan.tasks.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Baslik</th>
                    <th className="pb-2 pr-3">Rol</th>
                    <th className="pb-2 pr-3">Agent Eslesmesi</th>
                    <th className="pb-2 pr-3">Skor</th>
                    <th className="pb-2 pr-3">Karmasiklik</th>
                    <th className="pb-2">Bagimliliklar</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.tasks.map((task) => (
                    <TaskRow key={task.tempId} task={task} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Onay/Ret */}
          {isDraft && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleApprove(false)}
                disabled={approving}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {approving ? "Onaylaniyor..." : "Plani Onayla"}
              </button>
              <button
                onClick={() => handleApprove(true)}
                disabled={approving}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {approving ? "Onaylaniyor..." : "Onayla ve Baslat"}
              </button>
              <button
                onClick={handleReject}
                className="rounded-lg border border-slate-600 px-6 py-2.5 text-sm text-slate-300 hover:bg-slate-700"
              >
                Reddet
              </button>
            </div>
          )}

          {draftStatus === "approved" && (
            <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 p-3 text-sm text-emerald-300">
              Plan onaylandi. Gorevler olusturuldu.
            </div>
          )}
        </div>
      )}

      {!plan && !loading && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-8 text-center text-slate-500">
          {canGenerate
            ? "\"Plan Uret\" butonuna basarak mutabakattan otomatik plan olusturun."
            : "Plan uretmek icin oncelikle PM ile mutabakati tamamlayin."}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: PlannedTask }) {
  const routing = task.routing;
  const best = routing?.bestMatch;
  const fallback = routing?.fallbackToBuiltIn ?? true;
  const scorePercent = best ? Math.round(best.score * 100) : 0;

  return (
    <tr className="border-b border-slate-700/50">
      <td className="py-2 pr-3 text-slate-400">{task.tempId}</td>
      <td className="py-2 pr-3 text-slate-200">{task.title}</td>
      <td className="py-2 pr-3">
        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{task.role}</span>
      </td>
      <td className="py-2 pr-3">
        {best && !fallback ? (
          <div>
            <span className="text-indigo-300">{best.agentName}</span>
            <span className="ml-1 text-xs text-slate-500">({best.plugin})</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Built-in rol</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-slate-700">
            <div
              className={`h-1.5 rounded-full ${
                scorePercent > 40 ? "bg-emerald-500" : scorePercent > 20 ? "bg-amber-500" : "bg-slate-500"
              }`}
              style={{ width: `${Math.min(scorePercent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{scorePercent}%</span>
        </div>
      </td>
      <td className="py-2 pr-3">
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            task.complexity === "complex"
              ? "bg-red-900/50 text-red-300"
              : task.complexity === "medium"
              ? "bg-amber-900/50 text-amber-300"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {task.complexity}
        </span>
      </td>
      <td className="py-2 text-xs text-slate-500">
        {task.deps.length > 0 ? task.deps.join(", ") : "-"}
      </td>
    </tr>
  );
}
