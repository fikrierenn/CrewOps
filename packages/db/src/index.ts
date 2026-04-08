// SQLite erişim katmanı
// Bu dosya, üst katmanların kullanacağı basit repository fonksiyonlarını içerir.

import { createDb, OrchestratorDb } from "./schema";
import type {
  Project,
  Role,
  Task,
  Run,
  Artifact,
  CostLedgerEntry,
  ChatMessage,
  PlanDraft,
  TaskReview
} from "@shared/index";
import { nowIso } from "@shared/index";

// Tek bir global veritabanı örneği; küçük yerel CLI için yeterli
let dbInstance: OrchestratorDb | null = null;

// Veritabanını (gerekirse) başlatır ve tekil örneği döndürür
export const getDb = (): OrchestratorDb => {
  if (!dbInstance) {
    // Not: Varsayılan dosya yolu schema.ts içinden geliyor
    dbInstance = createDb();
  }
  return dbInstance;
};

// =========================
// Projeler
// =========================

export const createProject = (input: {
  name: string;
  repoPath: string;
  stack: string;
}): Project => {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO projects (name, repo_path, stack, created_at, phase, mutabakat_ozeti, mutabakat_tamamlandi_at)
     VALUES (@name, @repoPath, @stack, @createdAt, 'mutabakat_bekliyor', NULL, NULL)`
  );
  const createdAt = nowIso();
  const info = stmt.run({
    name: input.name,
    repoPath: input.repoPath,
    stack: input.stack,
    createdAt
  });
  return {
    id: Number(info.lastInsertRowid),
    name: input.name,
    repoPath: input.repoPath,
    stack: input.stack,
    createdAt,
    phase: "mutabakat_bekliyor",
    mutabakatOzeti: null,
    mutabakatTamamlandiAt: null
  };
};

export const listProjects = (): Project[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, repo_path as repoPath, stack, created_at as createdAt,
              phase, mutabakat_ozeti as mutabakatOzeti, mutabakat_tamamlandi_at as mutabakatTamamlandiAt
       FROM projects ORDER BY id DESC`
    )
    .all();
  return rows as Project[];
};

export const getProjectById = (id: number): Project | null => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, repo_path as repoPath, stack, created_at as createdAt,
              phase, mutabakat_ozeti as mutabakatOzeti, mutabakat_tamamlandi_at as mutabakatTamamlandiAt
       FROM projects WHERE id = ?`
    )
    .get(id);
  return (row as Project) || null;
};

export const updateProject = (
  id: number,
  input: { phase?: Project["phase"]; mutabakatOzeti?: string | null; mutabakatTamamlandiAt?: string | null }
): Project | null => {
  const db = getDb();
  const current = getProjectById(id);
  if (!current) return null;
  const phase = input.phase ?? current.phase;
  const mutabakatOzeti = input.mutabakatOzeti !== undefined ? input.mutabakatOzeti : current.mutabakatOzeti;
  const mutabakatTamamlandiAt =
    input.mutabakatTamamlandiAt !== undefined ? input.mutabakatTamamlandiAt : current.mutabakatTamamlandiAt;
  db.prepare(
    `UPDATE projects SET phase = ?, mutabakat_ozeti = ?, mutabakat_tamamlandi_at = ? WHERE id = ?`
  ).run(phase, mutabakatOzeti ?? null, mutabakatTamamlandiAt ?? null, id);
  return getProjectById(id);
};

// =========================
// Roller
// =========================

export const createRole = (input: Omit<Role, "id">): Role => {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO roles
      (project_id, role_id, display_name, avatar,
       skills_json, work_style, model_policy_json,
       definition_of_done_json, raw_config_json)
     VALUES
      (@projectId, @roleId, @displayName, @avatar,
       @skillsJson, @workStyle, @modelPolicyJson,
       @definitionOfDoneJson, @rawConfigJson)`
  );

  const info = stmt.run({
    projectId: input.projectId,
    roleId: input.roleId,
    displayName: input.displayName,
    avatar: input.avatar,
    skillsJson: JSON.stringify(input.skills),
    workStyle: input.workStyle,
    modelPolicyJson: JSON.stringify(input.defaultModelPolicy),
    definitionOfDoneJson: JSON.stringify(input.definitionOfDone),
    rawConfigJson: JSON.stringify(input.rawConfig ?? {})
  });

  return {
    ...input,
    id: Number(info.lastInsertRowid)
  };
};

export const listRolesByProject = (projectId: number): Role[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         id,
         project_id as projectId,
         role_id as roleId,
         display_name as displayName,
         avatar,
         skills_json as skillsJson,
         work_style as workStyle,
         model_policy_json as modelPolicyJson,
         definition_of_done_json as definitionOfDoneJson,
         raw_config_json as rawConfigJson
       FROM roles
       WHERE project_id = ?
       ORDER BY id ASC`
    )
    .all(projectId) as any[];

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    roleId: r.roleId,
    displayName: r.displayName,
    avatar: r.avatar,
    skills: JSON.parse(r.skillsJson),
    workStyle: r.workStyle,
    defaultModelPolicy: JSON.parse(r.modelPolicyJson),
    definitionOfDone: JSON.parse(r.definitionOfDoneJson),
    rawConfig: JSON.parse(r.rawConfigJson)
  })) as Role[];
};

// =========================
// Görevler
// =========================

export const createTask = (input: {
  projectId: number;
  roleId: string;
  title: string;
  description: string;
  complexity: Task["complexity"];
  dependencyIds?: number[];
}): Task => {
  const db = getDb();
  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO tasks
      (project_id, role_id, title, description,
       complexity, status, dependency_ids_json,
       created_at, updated_at)
     VALUES
      (@projectId, @roleId, @title, @description,
       @complexity, @status, @dependencyIdsJson,
       @createdAt, @updatedAt)`
  );

  const dependencyIds = input.dependencyIds ?? [];
  const info = stmt.run({
    projectId: input.projectId,
    roleId: input.roleId,
    title: input.title,
    description: input.description,
    complexity: input.complexity,
    status: "pending",
    dependencyIdsJson: JSON.stringify(dependencyIds),
    createdAt: now,
    updatedAt: now
  });

  return {
    id: Number(info.lastInsertRowid),
    projectId: input.projectId,
    roleId: input.roleId,
    title: input.title,
    description: input.description,
    complexity: input.complexity,
    status: "pending",
    dependencyIds,
    createdAt: now,
    updatedAt: now
  };
};

export const listTasksByProject = (projectId: number): Task[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         id,
         project_id as projectId,
         role_id as roleId,
         title,
         description,
         complexity,
         status,
         dependency_ids_json as dependencyIdsJson,
         created_at as createdAt,
         updated_at as updatedAt
       FROM tasks
       WHERE project_id = ?
       ORDER BY id DESC`
    )
    .all(projectId) as any[];

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    roleId: r.roleId,
    title: r.title,
    description: r.description,
    complexity: r.complexity,
    status: r.status,
    dependencyIds: JSON.parse(r.dependencyIdsJson),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  })) as Task[];
};

export const getTaskById = (id: number): Task | null => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         id,
         project_id as projectId,
         role_id as roleId,
         title,
         description,
         complexity,
         status,
         dependency_ids_json as dependencyIdsJson,
         created_at as createdAt,
         updated_at as updatedAt
       FROM tasks
       WHERE id = ?`
    )
    .get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    roleId: row.roleId,
    title: row.title,
    description: row.description,
    complexity: row.complexity,
    status: row.status,
    dependencyIds: JSON.parse(row.dependencyIdsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

export const updateTaskStatus = (id: number, status: Task["status"]): void => {
  const db = getDb();
  db.prepare(
    `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`
  ).run(status, nowIso(), id);
};

// =========================
// Çalıştırmalar (Runs)
// =========================

export const createRun = (input: {
  taskId: number;
  projectId: number;
  roleId: string;
  status: Run["status"];
  exitCode: number | null;
  parsedOk: boolean;
  summary: string;
}): Run => {
  const db = getDb();
  const createdAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO runs
      (task_id, project_id, role_id, status,
       exit_code, parsed_ok, summary, created_at)
     VALUES
      (@taskId, @projectId, @roleId, @status,
       @exitCode, @parsedOk, @summary, @createdAt)`
  );

  const info = stmt.run({
    taskId: input.taskId,
    projectId: input.projectId,
    roleId: input.roleId,
    status: input.status,
    exitCode: input.exitCode,
    parsedOk: input.parsedOk ? 1 : 0,
    summary: input.summary,
    createdAt
  });

  return {
    id: Number(info.lastInsertRowid),
    taskId: input.taskId,
    projectId: input.projectId,
    roleId: input.roleId,
    status: input.status,
    exitCode: input.exitCode,
    parsedOk: input.parsedOk,
    summary: input.summary,
    createdAt
  };
};

export const getRunById = (id: number): Run | null => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         id,
         task_id as taskId,
         project_id as projectId,
         role_id as roleId,
         status,
         exit_code as exitCode,
         parsed_ok as parsedOkInt,
         summary,
         created_at as createdAt
       FROM runs WHERE id = ?`
    )
    .get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.taskId,
    projectId: row.projectId,
    roleId: row.roleId,
    status: row.status,
    exitCode: row.exitCode,
    parsedOk: !!row.parsedOkInt,
    summary: row.summary,
    createdAt: row.createdAt
  };
};

export const updateRun = (
  id: number,
  updates: {
    status: Run["status"];
    exitCode: number | null;
    parsedOk: boolean;
    summary: string;
  }
): void => {
  const db = getDb();
  db.prepare(
    `UPDATE runs SET status = ?, exit_code = ?, parsed_ok = ?, summary = ? WHERE id = ?`
  ).run(
    updates.status,
    updates.exitCode,
    updates.parsedOk ? 1 : 0,
    updates.summary,
    id
  );
};

export const listRunsByProject = (projectId: number, limit = 20): Run[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         id,
         task_id as taskId,
         project_id as projectId,
         role_id as roleId,
         status,
         exit_code as exitCode,
         parsed_ok as parsedOkInt,
         summary,
         created_at as createdAt
       FROM runs
       WHERE project_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(projectId, limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    projectId: r.projectId,
    roleId: r.roleId,
    status: r.status,
    exitCode: r.exitCode,
    parsedOk: !!r.parsedOkInt,
    summary: r.summary,
    createdAt: r.createdAt
  })) as Run[];
};

// =========================
// Artifacts
// =========================

export const createArtifact = (input: Omit<Artifact, "id" | "createdAt">): Artifact => {
  const db = getDb();
  const createdAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO artifacts (run_id, kind, content, created_at)
     VALUES (@runId, @kind, @content, @createdAt)`
  );
  const info = stmt.run({
    runId: input.runId,
    kind: input.kind,
    content: input.content,
    createdAt
  });

  return {
    id: Number(info.lastInsertRowid),
    runId: input.runId,
    kind: input.kind,
    content: input.content,
    createdAt
  };
};

export const listArtifactsByRun = (runId: number): Artifact[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         id,
         run_id as runId,
         kind,
         content,
         created_at as createdAt
       FROM artifacts
       WHERE run_id = ?
       ORDER BY id ASC`
    )
    .all(runId);
  return rows as Artifact[];
};

// =========================
// Maliyet kaydı
// =========================

export const createCostEntry = (input: Omit<CostLedgerEntry, "id" | "createdAt">): CostLedgerEntry => {
  const db = getDb();
  const createdAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO cost_ledger
      (run_id, estimated_tokens, estimated_cost_usd, created_at)
     VALUES
      (@runId, @estimatedTokens, @estimatedCostUsd, @createdAt)`
  );
  const info = stmt.run({
    runId: input.runId,
    estimatedTokens: input.estimatedTokens,
    estimatedCostUsd: input.estimatedCostUsd,
    createdAt
  });

  return {
    id: Number(info.lastInsertRowid),
    runId: input.runId,
    estimatedTokens: input.estimatedTokens,
    estimatedCostUsd: input.estimatedCostUsd,
    createdAt
  };
};

// =========================
// Chat mesajları
// =========================

export const createChatMessage = (input: {
  projectId: number;
  role: ChatMessage["role"];
  content: string;
}): ChatMessage => {
  const db = getDb();
  const createdAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO chat_messages (project_id, role, content, created_at)
     VALUES (@projectId, @role, @content, @createdAt)`
  );
  const info = stmt.run({
    projectId: input.projectId,
    role: input.role,
    content: input.content,
    createdAt
  });
  return {
    id: Number(info.lastInsertRowid),
    projectId: input.projectId,
    role: input.role,
    content: input.content,
    createdAt
  };
};

export const listChatMessages = (projectId: number): ChatMessage[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, project_id as projectId, role, content, created_at as createdAt
       FROM chat_messages WHERE project_id = ? ORDER BY id ASC`
    )
    .all(projectId);
  return rows as ChatMessage[];
};

// =========================
// Plan taslakları
// =========================

export const createPlanDraft = (input: {
  projectId: number;
  rawOutput: string;
  parsedJson: string;
  status?: PlanDraft["status"];
}): PlanDraft => {
  const db = getDb();
  const createdAt = nowIso();
  // Mevcut taslağı sil (UNIQUE constraint)
  db.prepare(`DELETE FROM plan_drafts WHERE project_id = ?`).run(input.projectId);
  const stmt = db.prepare(
    `INSERT INTO plan_drafts (project_id, raw_output, parsed_json, status, created_at)
     VALUES (@projectId, @rawOutput, @parsedJson, @status, @createdAt)`
  );
  const info = stmt.run({
    projectId: input.projectId,
    rawOutput: input.rawOutput,
    parsedJson: input.parsedJson,
    status: input.status ?? "draft",
    createdAt
  });
  return {
    id: Number(info.lastInsertRowid),
    projectId: input.projectId,
    rawOutput: input.rawOutput,
    parsedJson: input.parsedJson,
    status: input.status ?? "draft",
    createdAt
  };
};

export const getPlanDraft = (projectId: number): PlanDraft | null => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, project_id as projectId, raw_output as rawOutput,
              parsed_json as parsedJson, status, created_at as createdAt
       FROM plan_drafts WHERE project_id = ?`
    )
    .get(projectId);
  return (row as PlanDraft) || null;
};

export const updatePlanDraftStatus = (projectId: number, status: PlanDraft["status"]): void => {
  const db = getDb();
  db.prepare(`UPDATE plan_drafts SET status = ? WHERE project_id = ?`).run(status, projectId);
};

// =========================
// Görev review'ları
// =========================

export const createTaskReview = (input: {
  taskId: number;
  runId: number;
  decision: TaskReview["decision"];
  reasoning: string;
  feedback?: string | null;
}): TaskReview => {
  const db = getDb();
  const createdAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO task_reviews (task_id, run_id, decision, reasoning, feedback, created_at)
     VALUES (@taskId, @runId, @decision, @reasoning, @feedback, @createdAt)`
  );
  const info = stmt.run({
    taskId: input.taskId,
    runId: input.runId,
    decision: input.decision,
    reasoning: input.reasoning,
    feedback: input.feedback ?? null,
    createdAt
  });
  return {
    id: Number(info.lastInsertRowid),
    taskId: input.taskId,
    runId: input.runId,
    decision: input.decision,
    reasoning: input.reasoning,
    feedback: input.feedback ?? null,
    createdAt
  };
};

export const listTaskReviews = (taskId: number): TaskReview[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, task_id as taskId, run_id as runId, decision, reasoning, feedback,
              created_at as createdAt
       FROM task_reviews WHERE task_id = ? ORDER BY id DESC`
    )
    .all(taskId);
  return rows as TaskReview[];
};

// =========================
// Maliyet toplamı (teslim raporu için)
// =========================

export const getCostSummary = (projectId: number): { totalTokens: number; totalCostUsd: number } => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cl.estimated_tokens), 0) as totalTokens,
              COALESCE(SUM(cl.estimated_cost_usd), 0) as totalCostUsd
       FROM cost_ledger cl
       JOIN runs r ON r.id = cl.run_id
       WHERE r.project_id = ?`
    )
    .get(projectId) as any;
  return { totalTokens: row.totalTokens, totalCostUsd: row.totalCostUsd };
};

// =========================
// Görev retry_count güncelle
// =========================

export const incrementTaskRetryCount = (taskId: number): void => {
  const db = getDb();
  db.prepare(`UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?`)
    .run(nowIso(), taskId);
};

// =========================
// Orchestration events
// =========================

export interface DbOrchestrationEvent {
  id: number;
  projectId: number;
  type: string;
  message: string;
  dataJson: string | null;
  createdAt: string;
}

export const createOrchestrationEvent = (input: {
  projectId: number;
  type: string;
  message: string;
  data?: any;
}): DbOrchestrationEvent => {
  const db = getDb();
  const createdAt = nowIso();
  const dataJson = input.data ? JSON.stringify(input.data) : null;
  const stmt = db.prepare(
    `INSERT INTO orchestration_events (project_id, type, message, data_json, created_at)
     VALUES (@projectId, @type, @message, @dataJson, @createdAt)`
  );
  const info = stmt.run({
    projectId: input.projectId,
    type: input.type,
    message: input.message,
    dataJson,
    createdAt
  });
  return {
    id: Number(info.lastInsertRowid),
    projectId: input.projectId,
    type: input.type,
    message: input.message,
    dataJson,
    createdAt
  };
};

export const listOrchestrationEvents = (
  projectId: number,
  afterId = 0,
  limit = 200
): DbOrchestrationEvent[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, project_id as projectId, type, message, data_json as dataJson, created_at as createdAt
       FROM orchestration_events
       WHERE project_id = ? AND id > ?
       ORDER BY id ASC
       LIMIT ?`
    )
    .all(projectId, afterId, limit);
  return rows as DbOrchestrationEvent[];
};

export const deleteOrchestrationEvents = (projectId: number): void => {
  const db = getDb();
  db.prepare(`DELETE FROM orchestration_events WHERE project_id = ?`).run(projectId);
};

