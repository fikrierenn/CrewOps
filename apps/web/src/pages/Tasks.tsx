/**
 * Görevler sayfası: liste, ekleme, seçilen görev için "Başla" butonu.
 * Başla'ya basılınca gömülü terminal (RunConsole) açılır ve canlı çıktı orada akar.
 */

import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  fetchProjects,
  fetchTasks,
  createTask,
  fetchRoleTemplates,
  startRun,
  resetTaskToPending
} from "../api";
import { RunConsole } from "../components/RunConsole";
import type { Project, Task } from "../api";

export function Tasks() {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    (location.state as { projectId?: number })?.projectId ?? null
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roles, setRoles] = useState<{ roleId: string; displayName: string }[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleId, setRoleId] = useState("");
  const [complexity, setComplexity] = useState<"simple" | "medium" | "complex">("simple");
  const [dependencyIdsStr, setDependencyIdsStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Gömülü terminal: Başla dediğinde açılır
  const [jobId, setJobId] = useState<string | null>(null);
  const [runningTaskTitle, setRunningTaskTitle] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [resettingTaskId, setResettingTaskId] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects().then((list) => {
      setProjects(list);
      if (list.length > 0 && selectedProjectId === null)
        setSelectedProjectId((location.state as { projectId?: number })?.projectId ?? list[0].id);
    }).catch(console.error);
    fetchRoleTemplates().then((list) => {
      setRoles(list.map((r) => ({ roleId: r.roleId, displayName: r.displayName })));
      if (list.length > 0 && !roleId) setRoleId(list[0].roleId);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProjectId !== null) {
      fetchTasks(selectedProjectId).then(setTasks).catch(console.error);
    } else {
      setTasks([]);
    }
  }, [selectedProjectId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedProjectId || !title.trim() || !description.trim() || !roleId) {
      setError("Proje, başlık, açıklama ve rol zorunludur.");
      return;
    }
    setLoading(true);
    try {
      const depIds = dependencyIdsStr
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
      await createTask({
        projectId: selectedProjectId,
        roleId,
        title: title.trim(),
        description: description.trim(),
        complexity,
        dependencyIds: depIds
      });
      setTitle("");
      setDescription("");
      fetchTasks(selectedProjectId).then(setTasks).catch(console.error);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (task: Task) => {
    setError(null);
    setMessage(null);
    try {
      const data = await startRun(task.id, true);
      if (data.openedTerminal) {
        setMessage(
          "Terminal penceresi açıldı. Claude Code orada çalışıyor; bittiğinde görev durumu güncellenecek."
        );
        setJobId(null);
        if (selectedProjectId) fetchTasks(selectedProjectId).then(setTasks).catch(console.error);
      } else if (data.jobId) {
        setJobId(data.jobId);
        setRunningTaskTitle(task.title);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const canRun = (task: Task): boolean => {
    if (task.status === "running" || task.status === "completed") return false;
    if (!task.dependencyIds || task.dependencyIds.length === 0) return true;
    const deps = tasks.filter((t) => task.dependencyIds.includes(t.id));
    return deps.every((t) => t.status === "completed");
  };

  const handleResetTask = async (task: Task) => {
    if (task.status !== "failed") return;
    setResettingTaskId(task.id);
    try {
      await resetTaskToPending(task.id);
      if (selectedProjectId) fetchTasks(selectedProjectId).then(setTasks).catch(console.error);
    } finally {
      setResettingTaskId(null);
    }
  };

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;
  const mutabakatTamamlandi = selectedProject?.phase === "mutabakat_tamamlandi";

  return (
    <div>
      {selectedProjectId && selectedProject && !mutabakatTamamlandi && (
        <div className="mb-4 rounded-xl border border-amber-700/60 bg-amber-950/30 p-4 text-amber-200">
          <p className="font-medium">Önce PM ile mutabakat tamamlayın</p>
          <p className="mt-1 text-sm text-amber-200/80">
            Bu projede görev ekleyip yazmaya başlamak için Projeler sayfasında &quot;PM ile mutabakat yap&quot; ile mutabakatı tamamlayın.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Görevler</h2>
        {message && (
          <p style={{ color: "#b5bd68", marginBottom: 12 }}>{message}</p>
        )}
        <div className="form-group">
          <label>Proje</label>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
          >
            <option value="">Seçin</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
          {tasks.map((t) => (
            <li
              key={t.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #2d2e36",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8
              }}
            >
              <span>
                <strong>#{t.id}</strong> ({t.roleId}) {t.title} –{" "}
                <span className={`badge ${t.status === "completed" ? "success" : t.status === "failed" ? "failed" : t.status === "running" ? "running" : "pending"}`}>
                  {t.status}
                </span>
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                {t.status === "failed" && (
                  <button
                    type="button"
                    onClick={() => handleResetTask(t)}
                    disabled={!!resettingTaskId}
                    className="rounded-lg border border-amber-600 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-900/40"
                  >
                    {resettingTaskId === t.id ? "Alınıyor…" : "Yeniden dene"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleStart(t)}
                  disabled={!mutabakatTamamlandi || !canRun(t)}
                  title={!mutabakatTamamlandi ? "Önce PM mutabakatı tamamlanmalı" : undefined}
                >
                  Başla
                </button>
              </span>
            </li>
          ))}
        </ul>
        {tasks.length === 0 && selectedProjectId && (
          <p style={{ color: "#9a9ba3" }}>Bu projede henüz görev yok.</p>
        )}
      </div>

      <div className="card">
        <h2>Yeni görev ekle</h2>
        {!mutabakatTamamlandi && selectedProjectId && (
          <p className="mb-3 text-sm text-slate-500">Mutabakat tamamlandıktan sonra görev ekleyebilirsiniz.</p>
        )}
        <form onSubmit={handleAddTask}>
          <div className="form-group">
            <label>Başlık</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Self test sandbox"
            />
          </div>
          <div className="form-group">
            <label>Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Görev detayı"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.displayName} ({r.roleId})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Karmaşıklık</label>
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as "simple" | "medium" | "complex")}
            >
              <option value="simple">simple</option>
              <option value="medium">medium</option>
              <option value="complex">complex</option>
            </select>
          </div>
          <div className="form-group">
            <label>Bağımlılık ID’leri (virgülle)</label>
            <input
              type="text"
              value={dependencyIdsStr}
              onChange={(e) => setDependencyIdsStr(e.target.value)}
              placeholder="Örn: 1, 2"
            />
          </div>
          {error && <p style={{ color: "#cc6666", marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={loading || !mutabakatTamamlandi} title={!mutabakatTamamlandi ? "Önce PM mutabakatı tamamlayın" : undefined}>
            {loading ? "Ekleniyor…" : "Ekle"}
          </button>
        </form>
      </div>

      {/* Gömülü terminal: Başla dediğinde burada canlı çıktı akar */}
      <RunConsole
        jobId={jobId}
        taskTitle={runningTaskTitle}
        onClose={() => {
          setJobId(null);
          setRunningTaskTitle("");
          if (selectedProjectId) fetchTasks(selectedProjectId).then(setTasks).catch(console.error);
        }}
      />
    </div>
  );
}
