/**
 * Backend API çağrıları (proxy ile /api → localhost:3999)
 */

const API = "/api";

/** Proje aşaması: pipeline lifecycle */
export type ProjectPhase = "mutabakat_bekliyor" | "mutabakat_devam"
  | "mutabakat_tamamlandi" | "planlama" | "gelistirme" | "review" | "teslim_edildi";

export interface Project {
  id: number;
  name: string;
  repoPath: string;
  stack: string;
  createdAt: string;
  phase: ProjectPhase;
  mutabakatOzeti?: string | null;
  mutabakatTamamlandiAt?: string | null;
}

export interface Task {
  id: number;
  projectId: number;
  roleId: string;
  title: string;
  description: string;
  complexity: "simple" | "medium" | "complex";
  status: string;
  dependencyIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: number;
  taskId: number;
  projectId: number;
  roleId: string;
  status: string;
  exitCode: number | null;
  parsedOk: boolean;
  summary: string;
  createdAt: string;
}

/** API'den gelen rol şablonu; alanlar backend'deki RoleConfig ile uyumlu, opsiyonel alanlar güvenli render için */
export interface RoleTemplate {
  roleId: string;
  displayName: string;
  avatar: string;
  skills?: string[];
  workStyle?: string;
  definitionOfDone?: string[];
}

export interface MemoryStatus {
  ok: boolean;
  missing: string[];
}

/** API hata metnini çıkarır (JSON { error } veya ham metin) */
async function getErrorMessage(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    if (j && typeof j.error === "string") return j.error;
  } catch (_) {}
  return text || "Sunucu yanıt vermedi.";
}

export async function fetchProjects(): Promise<Project[]> {
  const r = await fetch(`${API}/projects`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function createProject(body: {
  name: string;
  repoPath: string;
  stack: string;
}): Promise<Project> {
  const r = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function updateProject(
  id: number,
  body: { phase?: ProjectPhase; mutabakatOzeti?: string | null; mutabakatTamamlandiAt?: string | null }
): Promise<Project> {
  const r = await fetch(`${API}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

/** Mutabakat tamamla – POST kullanır (PATCH desteklenmeyen ortamlarda çalışır) */
export async function completeMutabakat(
  projectId: number,
  mutabakatOzeti?: string | null
): Promise<Project> {
  const r = await fetch(`${API}/projects/${projectId}/mutabakat-tamamla`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mutabakatOzeti: mutabakatOzeti ?? "" })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function fetchTasks(projectId: number): Promise<Task[]> {
  const r = await fetch(`${API}/tasks?projectId=${projectId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createTask(body: {
  projectId: number;
  roleId: string;
  title: string;
  description: string;
  complexity?: string;
  dependencyIds?: number[];
}): Promise<Task> {
  const r = await fetch(`${API}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Başarısız görevi yeniden denemek için pending'e çeker */
export async function resetTaskToPending(taskId: number): Promise<Task> {
  const r = await fetch(`${API}/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "pending" })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function fetchRuns(projectId: number, limit = 20): Promise<Run[]> {
  const r = await fetch(`${API}/runs?projectId=${projectId}&limit=${limit}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Run detayı + artifact'lar (ham çıktı, patch vb.) – üretilen kodu görmek ve patch uygulamak için */
export interface RunArtifact {
  id: number;
  runId: number;
  kind: string;
  content: string;
  createdAt: string;
}

export interface RunDetailResponse {
  run: Run;
  artifacts: RunArtifact[];
}

export async function fetchRunDetail(runId: number): Promise<RunDetailResponse> {
  const r = await fetch(`${API}/runs/${runId}/detail`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

/** Run'ın PATCH'ini proje dizinine uygular; dosyalar ancak bu çağrıdan sonra oluşur. */
export async function applyRunPatch(runId: number): Promise<{ ok: boolean; filesAffected: string[] }> {
  const r = await fetch(`${API}/runs/${runId}/apply-patch`, { method: "POST" });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function fetchRoleTemplates(): Promise<RoleTemplate[]> {
  const r = await fetch(`${API}/role-templates`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function importRoles(projectId: number): Promise<{ imported: number }> {
  const r = await fetch(`${API}/roles/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchMemoryStatus(): Promise<MemoryStatus> {
  const r = await fetch(`${API}/memory/status`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createDefaultMemory(): Promise<{ ok: boolean }> {
  const r = await fetch(`${API}/memory/create-default`, { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Başla: varsayılan olarak terminal penceresinde çalışır */
export async function startRun(
  taskId: number,
  runInTerminal = true
): Promise<{ jobId?: string; runId?: number; openedTerminal?: boolean }> {
  const r = await fetch(`${API}/run/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, runInTerminal })
  });
  if (!r.ok) {
    const t = await r.text();
    let err: string;
    try {
      const j = JSON.parse(t);
      err = j.error || j.reason || j.detail || t;
    } catch {
      err = t;
    }
    throw new Error(err);
  }
  return r.json();
}

// =========================
// PM Chat
// =========================

export interface ChatMessage {
  id: number;
  projectId: number;
  role: "user" | "pm" | "system";
  content: string;
  createdAt: string;
}

export interface PmChatResponse {
  pmReply: string;
  mutabakatReady: boolean;
  mutabakatDocument?: string;
}

export async function sendPmChat(projectId: number, message: string): Promise<PmChatResponse> {
  const r = await fetch(`${API}/pm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function fetchChatHistory(projectId: number): Promise<ChatMessage[]> {
  const r = await fetch(`${API}/pm/chat/history?projectId=${projectId}`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

// =========================
// PM Planlama
// =========================

export interface AgentMatch {
  agentId: string;
  agentName: string;
  plugin: string;
  score: number;
  matchedSkills: string[];
}

export interface TaskRouting {
  bestMatch: AgentMatch | null;
  alternatives: AgentMatch[];
  fallbackToBuiltIn: boolean;
}

export interface PlannedTask {
  tempId: string;
  role: string;
  title: string;
  complexity: "simple" | "medium" | "complex";
  deps: string[];
  routing?: TaskRouting | null;
}

export interface PlanData {
  archShort: string;
  decisions: string;
  nowUpdate: string;
  tasks: PlannedTask[];
}

export interface PlanDraft {
  id: number;
  projectId: number;
  rawOutput: string;
  parsedJson: string;
  parsedPlan?: PlanData;
  status: "draft" | "approved" | "rejected";
  createdAt: string;
}

export async function generatePlan(projectId: number): Promise<{ plan: PlanData }> {
  const r = await fetch(`${API}/pm/plan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function fetchPlanDraft(projectId: number): Promise<PlanDraft> {
  const r = await fetch(`${API}/pm/plan/draft?projectId=${projectId}`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function approvePlan(
  projectId: number,
  autoStart = false
): Promise<{ ok: boolean; createdTaskIds: number[]; orchestrationStarted?: boolean }> {
  const r = await fetch(`${API}/pm/plan/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, autoStart })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function rejectPlan(projectId: number): Promise<{ ok: boolean }> {
  const r = await fetch(`${API}/pm/plan/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

// =========================
// Orkestrasyon
// =========================

export interface OrchestrationEvent {
  type: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface OrchestrationStatus {
  status: "idle" | "running" | "paused" | "completed" | "failed";
  taskSummary: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  recentEvents: OrchestrationEvent[];
}

export async function startOrchestration(projectId: number): Promise<{ ok: boolean }> {
  const r = await fetch(`${API}/orchestration/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function pauseOrchestration(projectId: number): Promise<{ ok: boolean }> {
  const r = await fetch(`${API}/orchestration/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function resumeOrchestration(projectId: number): Promise<{ ok: boolean }> {
  const r = await fetch(`${API}/orchestration/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

export async function fetchOrchestrationStatus(projectId: number): Promise<OrchestrationStatus> {
  const r = await fetch(`${API}/orchestration/status?projectId=${projectId}`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

// =========================
// Enriched Task (Agent Routing Bilgisi)
// =========================

export interface EnrichedTask {
  task: Task;
  routeResult: {
    bestMatch: AgentMatch | null;
    matchedSkills: string[];
    fallbackToBuiltIn: boolean;
    alternatives: AgentMatch[];
  };
  run: {
    id: number;
    status: string;
    parsedOk: boolean;
    summary: string;
    createdAt: string;
  } | null;
}

export async function fetchEnrichedTask(taskId: number): Promise<EnrichedTask> {
  const r = await fetch(`${API}/tasks/${taskId}/enriched`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}

// =========================
// Run Files (Uretilen Kod Goruntuleme)
// =========================

export interface RunFile {
  path: string;
  isNew: boolean;
  content: string;
  addedLines: number;
  removedLines: number;
}

export async function fetchRunFiles(runId: number): Promise<RunFile[]> {
  const r = await fetch(`${API}/runs/${runId}/files`);
  if (!r.ok) throw new Error(await getErrorMessage(r));
  return r.json();
}
