import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  fetchProjects,
  fetchTasks,
  fetchOrchestrationStatus,
  startOrchestration,
  pauseOrchestration,
  resumeOrchestration,
  fetchEnrichedTask,
  fetchRuns
} from "../api";
import type { Project, Task, OrchestrationStatus, OrchestrationEvent, EnrichedTask, Run } from "../api";
import { TaskDagGraph } from "../components/TaskDagGraph";
import { GeneratedFilesViewer } from "../components/GeneratedFilesViewer";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-slate-700 text-slate-300",
  running: "bg-indigo-700 text-indigo-200",
  paused: "bg-amber-800 text-amber-200",
  completed: "bg-emerald-700 text-emerald-200",
  failed: "bg-red-800 text-red-200"
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-700 text-slate-300",
  running: "bg-indigo-700 text-indigo-200",
  completed: "bg-emerald-700 text-emerald-200",
  failed: "bg-red-800 text-red-200",
  blocked: "bg-amber-800 text-amber-200"
};

type ViewMode = "list" | "dag";

export function Orchestration() {
  const location = useLocation();
  const stateProjectId = (location.state as any)?.projectId as number | undefined;
  const autoStarted = (location.state as any)?.autoStarted as boolean | undefined;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(stateProjectId ?? null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orchStatus, setOrchStatus] = useState<OrchestrationStatus | null>(null);
  const [events, setEvents] = useState<OrchestrationEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Yeni state'ler
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [enrichedTask, setEnrichedTask] = useState<EnrichedTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [viewingRunId, setViewingRunId] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    fetchProjects()
      .then((list) => {
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          const dev = list.find((p) => p.phase === "gelistirme" || p.phase === "review");
          setSelectedProjectId(dev?.id ?? list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Status polling
  useEffect(() => {
    if (!selectedProjectId) return;

    const refresh = () => {
      fetchOrchestrationStatus(selectedProjectId)
        .then((s) => {
          setOrchStatus(s);
          setEvents(s.recentEvents || []);
        })
        .catch(() => {});
      fetchTasks(selectedProjectId).then(setTasks).catch(() => {});
      fetchRuns(selectedProjectId, 100).then(setRuns).catch(() => {});
    };

    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [selectedProjectId]);

  // SSE baglan
  const connectSSE = () => {
    if (!selectedProjectId) return;
    eventSourceRef.current?.close();

    const es = new EventSource(`/api/orchestration/stream?projectId=${selectedProjectId}`);
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as OrchestrationEvent;
        setEvents((prev) => [...prev, ev]);
        fetchTasks(selectedProjectId).then(setTasks).catch(() => {});
        fetchOrchestrationStatus(selectedProjectId).then(setOrchStatus).catch(() => {});
      } catch {}
    };
    es.onerror = () => {
      es.close();
    };
    eventSourceRef.current = es;
  };

  // AutoStart ile geldiyse SSE'ye otomatik baglan
  useEffect(() => {
    if (autoStarted && selectedProjectId) {
      connectSSE();
    }
  }, [autoStarted, selectedProjectId]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Task detay yukle
  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setViewingRunId(null);
    fetchEnrichedTask(taskId)
      .then(setEnrichedTask)
      .catch(() => setEnrichedTask(null));
  };

  // Task'a ait son run'i bul
  const getLastRunForTask = (taskId: number): Run | undefined => {
    return [...runs].reverse().find((r) => r.taskId === taskId);
  };

  const handleStart = async () => {
    if (!selectedProjectId) return;
    setActionLoading(true);
    setError(null);
    try {
      await startOrchestration(selectedProjectId);
      connectSSE();
      fetchOrchestrationStatus(selectedProjectId).then(setOrchStatus).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!selectedProjectId) return;
    setActionLoading(true);
    try {
      await pauseOrchestration(selectedProjectId);
      fetchOrchestrationStatus(selectedProjectId).then(setOrchStatus).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!selectedProjectId) return;
    setActionLoading(true);
    try {
      await resumeOrchestration(selectedProjectId);
      fetchOrchestrationStatus(selectedProjectId).then(setOrchStatus).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const status = orchStatus?.status ?? "idle";
  const isDelivered = events.some((e) => e.type === "delivery_complete");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Orkestrasyon</h2>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="" disabled>Proje sec...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>#{p.id} {p.name}</option>
            ))}
          </select>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.idle}`}>
            {status.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-2">
          {status === "idle" && (
            <button
              onClick={handleStart}
              disabled={actionLoading || tasks.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {actionLoading ? "Baslatiliyor..." : "Baslat"}
            </button>
          )}
          {(status === "failed" || status === "completed") && (
            <button
              onClick={handleStart}
              disabled={actionLoading || tasks.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {actionLoading ? "Baslatiliyor..." : "Tekrar Baslat"}
            </button>
          )}
          {status === "running" && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Duraklat
            </button>
          )}
          {status === "paused" && (
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Devam Et
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Hata durumunda ne yapilir */}
      {status === "failed" && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-5">
          <h4 className="mb-2 font-semibold text-amber-200">Orkestrasyon durdu – ne yapabilirsiniz?</h4>
          <p className="mb-3 text-sm text-amber-200/90">
            Üstteki <strong>Tekrar Baslat</strong> butonuyla orkestrasyonu yeniden baslatabilirsiniz (bekleyen görevlerden devam eder). Alternatifler:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-200/90">
            <li>
              <strong>Geçmiş</strong> sayfasına gidin, başarısız görevin run'ını bulun, <strong>Kod / Patch göster</strong> ile ham çıktıyı inceleyin. &quot;Parse edilemedi&quot; genelde LLM çıktısının SUMMARY/PATCH formatına uymadığı anlamına gelir.
            </li>
            <li>
              <strong>Görevler</strong> sayfasında başarısız görev için <strong>Yeniden dene</strong> butonuna basın; görev tekrar <em>pending</em> olur, ardından buradan <strong>Tekrar Baslat</strong> ile yeniden çalıştırın.
            </li>
            <li>
              Görev açıklamasını daha net yazıp (çıktıda SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY beklediğimizi belirterek) tekrar deneyin.
            </li>
          </ul>
        </div>
      )}

      {/* Delivery banner */}
      {isDelivered && (
        <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 p-4">
          <p className="font-medium text-emerald-200">Teslim raporu hazir!</p>
          <p className="text-sm text-emerald-400">DELIVERY.md dosyasi memory/ klasorunde olusturuldu.</p>
        </div>
      )}

      {/* Task summary */}
      {orchStatus?.taskSummary && (
        <div className="grid grid-cols-5 gap-3">
          {(["total", "pending", "running", "completed", "failed"] as const).map((key) => (
            <div key={key} className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3 text-center">
              <div className="text-2xl font-bold text-slate-200">{orchStatus.taskSummary[key]}</div>
              <div className="text-xs text-slate-500">{key === "total" ? "Toplam" : key === "pending" ? "Bekleyen" : key === "running" ? "Calisan" : key === "completed" ? "Tamamlanan" : "Basarisiz"}</div>
            </div>
          ))}
        </div>
      )}

      {/* View mode toggle + Task list / DAG */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Gorevler</h3>
          {tasks.length > 0 && (
            <div className="flex rounded-lg border border-slate-600 text-xs">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 ${viewMode === "list" ? "bg-slate-600 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
              >
                Liste
              </button>
              <button
                onClick={() => setViewMode("dag")}
                className={`px-3 py-1 ${viewMode === "dag" ? "bg-slate-600 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
              >
                Graf
              </button>
            </div>
          )}
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">Henuz gorev yok. Plani onaylayarak gorevleri olusturun.</p>
        ) : viewMode === "dag" ? (
          <TaskDagGraph tasks={tasks} onTaskClick={handleTaskClick} />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const lastRun = getLastRunForTask(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-900/50 px-4 py-2 cursor-pointer hover:bg-slate-800/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">#{task.id}</span>
                    <span className="text-sm text-slate-200">{task.title}</span>
                    <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-xs text-purple-300">{task.roleId}</span>
                    {task.dependencyIds.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        deps: {task.dependencyIds.join(",")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status === "completed" && lastRun && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewingRunId(lastRun.id); }}
                        className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600"
                      >
                        Kod Gor
                      </button>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.pending}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task detail modal (enriched) */}
      {selectedTaskId && enrichedTask && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">
              Gorev #{enrichedTask.task.id} Detay
            </h3>
            <button
              onClick={() => { setSelectedTaskId(null); setEnrichedTask(null); }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Kapat
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Sol: gorev bilgisi */}
            <div className="space-y-2">
              <div>
                <span className="text-slate-500">Baslik: </span>
                <span className="text-slate-200">{enrichedTask.task.title}</span>
              </div>
              <div>
                <span className="text-slate-500">Rol: </span>
                <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-xs text-purple-300">
                  {enrichedTask.task.roleId}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Karmasiklik: </span>
                <span className="text-slate-300">{enrichedTask.task.complexity}</span>
              </div>
              <div>
                <span className="text-slate-500">Durum: </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${TASK_STATUS_COLORS[enrichedTask.task.status]}`}>
                  {enrichedTask.task.status}
                </span>
              </div>
            </div>

            {/* Sag: agent routing + run bilgisi */}
            <div className="space-y-2">
              {enrichedTask.routeResult.bestMatch && !enrichedTask.routeResult.fallbackToBuiltIn ? (
                <>
                  <div>
                    <span className="text-slate-500">Agent: </span>
                    <span className="text-indigo-300">{enrichedTask.routeResult.bestMatch.agentName}</span>
                    <span className="ml-1 text-xs text-slate-500">({enrichedTask.routeResult.bestMatch.plugin})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Skor: </span>
                    <span className="text-slate-300">{Math.round(enrichedTask.routeResult.bestMatch.score * 100)}%</span>
                  </div>
                  {enrichedTask.routeResult.matchedSkills.length > 0 && (
                    <div>
                      <span className="text-slate-500">Skill'ler: </span>
                      <span className="text-slate-300">{enrichedTask.routeResult.matchedSkills.join(", ")}</span>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <span className="text-slate-500">Agent: </span>
                  <span className="text-xs text-slate-400">Built-in rol</span>
                </div>
              )}

              {enrichedTask.run && (
                <>
                  <div>
                    <span className="text-slate-500">Son Run: </span>
                    <span className="text-slate-300">#{enrichedTask.run.id} — {enrichedTask.run.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ozet: </span>
                    <span className="text-xs text-slate-400">{enrichedTask.run.summary}</span>
                  </div>
                  {enrichedTask.run.status === "success" && (
                    <button
                      onClick={() => setViewingRunId(enrichedTask.run!.id)}
                      className="rounded bg-indigo-700 px-3 py-1 text-xs text-white hover:bg-indigo-600"
                    >
                      Kod Gor
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generated files viewer */}
      {viewingRunId && (
        <GeneratedFilesViewer
          runId={viewingRunId}
          onClose={() => setViewingRunId(null)}
        />
      )}

      {/* Event timeline */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Event Timeline</h3>
        <p className="mb-3 text-xs text-slate-500">
          Tamamlanan her görevde üretilen kod (PATCH) projeye otomatik yazılır ve <code className="text-slate-400">npm install</code> çalıştırılır. &quot;patch_applied&quot; gördüğünüzde dosyalar repo klasöründe.
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Henuz event yok.</p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {events.map((ev, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-slate-700/30 py-1.5">
                <span className="shrink-0 text-[10px] text-slate-600">
                  {new Date(ev.timestamp).toLocaleTimeString("tr-TR")}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  ev.type.includes("complete") || ev.type.includes("applied")
                    ? "bg-emerald-900/50 text-emerald-400"
                    : ev.type.includes("fail") || ev.type.includes("error")
                    ? "bg-red-900/50 text-red-400"
                    : ev.type.includes("parallel")
                    ? "bg-violet-900/50 text-violet-400"
                    : ev.type.includes("start") || ev.type.includes("progress")
                    ? "bg-indigo-900/50 text-indigo-400"
                    : "bg-slate-700 text-slate-400"
                }`}>
                  {ev.type}
                </span>
                <span className="text-xs text-slate-400">{ev.message}</span>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
