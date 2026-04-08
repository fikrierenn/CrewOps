/**
 * CrewOps REST API
 * Yönetim arayüzü (web) için CRUD ve çalıştırma stream (gömülü terminal) sunar.
 * Sunucu monorepo kökünden çalıştırılmalıdır (orchestrator.db, memory/, templates/ erişimi için).
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { EventEmitter } from "events";

import {
  listProjects,
  createProject,
  getProjectById,
  updateProject,
  listTasksByProject,
  createTask,
  getTaskById,
  updateTaskStatus,
  listRunsByProject,
  createRun,
  getRunById,
  updateRun,
  listArtifactsByRun,
  createRole,
  listRolesByProject,
  createChatMessage,
  listChatMessages,
  getPlanDraft,
  updatePlanDraftStatus,
  createOrchestrationEvent,
  listOrchestrationEvents,
  deleteOrchestrationEvents
} from "@db/index";
import {
  WorkflowEngine,
  MemoryEngine,
  RoleRegistry,
  OutputParser,
  ArtifactManager,
  CostEstimator,
  ClaudeCodeRunner,
  LLMRunner,
  listAgents,
  loadAgent,
  agentToRoleConfig,
  PmChatEngine,
  PmPlannerEngine,
  OrchestrationLoop,
  DeliveryEngine,
  SkillScanner,
  AgentRouter,
  PatchApplier,
  installDependencies
} from "@core/index";
import type { Project, Task, Run, OrchestrationEvent } from "@shared/index";

// Repo kökü: API sunucusu kökten çalıştırıldığında process.cwd() köktür
const rootDir = process.cwd();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Minimal ownership/varlik kontrolu middleware ----------
// projectId iceren tum isteklerde projenin varligini dogrular.
// Auth yok (yerel uygulama), ama yanlis/sahte projectId'leri engeller.
function validateProjectId(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  // projectId'yi body, query veya params'dan al
  const raw = req.body?.projectId ?? req.query?.projectId ?? req.params?.id;
  if (raw === undefined) return next();
  const pid = Number(raw);
  if (Number.isNaN(pid) || pid <= 0) {
    return res.status(400).json({ error: "Gecersiz projectId" });
  }
  const project = getProjectById(pid);
  if (!project) {
    return res.status(404).json({ error: `Proje bulunamadi: #${pid}` });
  }
  // req'e ekle (sonraki handler'lar icin)
  (req as any).validatedProject = project;
  next();
}

// PM chat, plan, orkestrasyon route'larina middleware uygula
app.use("/api/pm", validateProjectId);
app.use("/api/orchestration", validateProjectId);

// ---------- Job store: çalışan görevlerin stream olayları (gömülü terminal için) ----------
const jobEvents = new Map<
  string,
  { events: Array<{ type: string; data?: unknown }>; done?: boolean }
>();
const jobEmitter = new EventEmitter();
jobEmitter.setMaxListeners(100);

function emitJobEvent(jobId: string, event: { type: string; data?: unknown }) {
  let store = jobEvents.get(jobId);
  if (!store) {
    store = { events: [] };
    jobEvents.set(jobId, store);
  }
  store.events.push(event);
  if (event.type === "done") store.done = true;
  jobEmitter.emit(`job:${jobId}`, event);
}

function createJobId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Health / Debug ----------
app.get("/api/health", (_req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasClaudeCli = !!process.env.CLAUDE_CLI_BIN || !!process.env.CLAUDE_CODE_BIN;
  const geminiKeyPrefix = hasGeminiKey
    ? process.env.GEMINI_API_KEY!.slice(0, 10) + "..."
    : null;
  res.json({
    ok: true,
    llmProvider: hasGeminiKey ? "gemini-api" : hasClaudeCli ? "claude-cli" : "none",
    geminiApiKey: geminiKeyPrefix,
    claudeCli: hasClaudeCli,
    rootDir,
    cwd: process.cwd(),
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()) + "s"
  });
});

// ---------- Projeler ----------
app.get("/api/projects", (_req, res) => {
  try {
    const list = listProjects();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/projects", (req, res) => {
  try {
    const { name, repoPath, stack } = req.body;
    if (!name || !repoPath || !stack) {
      return res.status(400).json({ error: "name, repoPath, stack gerekli" });
    }
    const project = createProject({
      name: String(name).trim(),
      repoPath: String(repoPath).trim(),
      stack: String(stack).trim()
    });
    res.status(201).json(project);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.get("/api/projects/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz id" });
  const project = getProjectById(id);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });
  res.json(project);
});

app.patch("/api/projects/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz id" });
  try {
    const { phase, mutabakatOzeti, mutabakatTamamlandiAt } = req.body;
    const updated = updateProject(id, {
      ...(phase != null && { phase }),
      ...(mutabakatOzeti !== undefined && { mutabakatOzeti }),
      ...(mutabakatTamamlandiAt !== undefined && { mutabakatTamamlandiAt })
    });
    if (!updated) return res.status(404).json({ error: "Proje bulunamadı" });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

/** Mutabakat tamamla – PATCH desteklenmeyen proxy/ortamlarda POST ile çalışır */
app.post("/api/projects/:id/mutabakat-tamamla", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz id" });
  try {
    const { mutabakatOzeti } = req.body ?? {};
    const updated = updateProject(id, {
      phase: "mutabakat_tamamlandi",
      mutabakatOzeti: mutabakatOzeti !== undefined ? String(mutabakatOzeti).trim() || null : undefined,
      mutabakatTamamlandiAt: new Date().toISOString()
    });
    if (!updated) return res.status(404).json({ error: "Proje bulunamadı" });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Görevler ----------
app.get("/api/tasks", (req, res) => {
  const projectId = Number(req.query.projectId);
  if (Number.isNaN(projectId))
    return res.status(400).json({ error: "projectId gerekli" });
  try {
    const list = listTasksByProject(projectId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/tasks", (req, res) => {
  try {
    const { projectId, roleId, title, description, complexity, dependencyIds } =
      req.body;
    if (!projectId || !roleId || !title || !description) {
      return res
        .status(400)
        .json({ error: "projectId, roleId, title, description gerekli" });
    }
    const task = createTask({
      projectId: Number(projectId),
      roleId: String(roleId).trim(),
      title: String(title).trim(),
      description: String(description).trim(),
      complexity: (complexity as Task["complexity"]) || "simple",
      dependencyIds: Array.isArray(dependencyIds)
        ? dependencyIds.map((x: unknown) => Number(x)).filter((n: number) => !Number.isNaN(n))
        : []
    });
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.get("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz id" });
  const task = getTaskById(id);
  if (!task) return res.status(404).json({ error: "Görev bulunamadı" });
  res.json(task);
});

/** Zenginlestirilmis gorev detayi: agent routing + son run bilgileri */
app.get("/api/tasks/:id/enriched", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz id" });
  const task = getTaskById(id);
  if (!task) return res.status(404).json({ error: "Görev bulunamadı" });

  try {
    // Agent routing bilgisi
    const router = new AgentRouter(rootDir);
    const routeResult = router.route({
      taskDescription: task.description,
      roleId: task.roleId,
      taskTitle: task.title
    });

    // Son run bilgisi
    const allRuns = listRunsByProject(task.projectId, 500);
    const taskRuns = allRuns.filter((r) => r.taskId === task.id);
    const lastRun = taskRuns[taskRuns.length - 1] || null;

    res.json({
      task,
      routeResult: {
        bestMatch: routeResult.bestMatch || null,
        matchedSkills: routeResult.bestMatch?.matchedSkills || [],
        fallbackToBuiltIn: routeResult.fallbackToBuiltIn,
        alternatives: routeResult.alternatives || []
      },
      run: lastRun ? {
        id: lastRun.id,
        status: lastRun.status,
        parsedOk: lastRun.parsedOk,
        summary: lastRun.summary,
        createdAt: lastRun.createdAt
      } : null
    });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

/** Başarısız görevi yeniden denemek için pending'e alır */
app.patch("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz id" });
  const task = getTaskById(id);
  if (!task) return res.status(404).json({ error: "Görev bulunamadı" });
  const { status } = req.body || {};
  if (status === "pending" && task.status === "failed") {
    updateTaskStatus(id, "pending");
    return res.json(getTaskById(id));
  }
  return res.status(400).json({ error: "Sadece failed görev pending yapılabilir" });
});

// ---------- Roller ----------
app.get("/api/roles", (req, res) => {
  const projectId = Number(req.query.projectId);
  if (Number.isNaN(projectId))
    return res.status(400).json({ error: "projectId gerekli" });
  try {
    const list = listRolesByProject(projectId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/roles/import", (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: "projectId gerekli" });
    const project = getProjectById(Number(projectId));
    if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    const configs = roleRegistry.listRoleConfigs();
    for (const cfg of configs) {
      createRole({
        projectId: project.id,
        roleId: cfg.roleId,
        displayName: cfg.displayName,
        avatar: cfg.avatar,
        skills: cfg.skills,
        workStyle: cfg.workStyle,
        defaultModelPolicy: cfg.defaultModelPolicy,
        definitionOfDone: cfg.definitionOfDone,
        rawConfig: cfg
      });
    }
    res.json({ imported: configs.length });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Rol şablonları (templates/roles) ----------
app.get("/api/role-templates", (_req, res) => {
  try {
    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    res.json(roleRegistry.listRoleConfigs());
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Agent kataloğu (agents-main/plugins/*/agents) ----------
app.get("/api/agent-catalog", (_req, res) => {
  try {
    const agents = listAgents(rootDir);
    res.json(agents);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Koşular (geçmiş) ----------
app.get("/api/runs", (req, res) => {
  const projectId = Number(req.query.projectId);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  if (Number.isNaN(projectId))
    return res.status(400).json({ error: "projectId gerekli" });
  try {
    const list = listRunsByProject(projectId, limit);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

/** Run detayı + artifact'lar (ham çıktı, parsed, patch) – kod/patch görüntüleme ve uygulama için */
app.get("/api/runs/:id/detail", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz run id" });
  try {
    const run = getRunById(id);
    if (!run) return res.status(404).json({ error: "Run bulunamadı" });
    const artifacts = listArtifactsByRun(id);
    res.json({ run, artifacts });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

/** Run'in patch'inden dosya listesi cikarir (kod goruntuleme icin) */
app.get("/api/runs/:id/files", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz run id" });
  try {
    const run = getRunById(id);
    if (!run) return res.status(404).json({ error: "Run bulunamadı" });
    const artifacts = listArtifactsByRun(id);
    const patchArtifact = artifacts.find((a) => a.kind === "patch");
    if (!patchArtifact || !patchArtifact.content.trim()) {
      return res.json([]);
    }

    // Patch'i parse edip dosya bloklarina ayir
    const files = parsePatchToFiles(patchArtifact.content);
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

/** Run'ın PATCH'ini proje dizinine uygular (git apply). Dosyalar ancak bu çağrıdan sonra oluşur. */
app.post("/api/runs/:id/apply-patch", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Geçersiz run id" });
  try {
    const run = getRunById(id);
    if (!run) return res.status(404).json({ error: "Run bulunamadı" });
    const project = getProjectById(run.projectId);
    if (!project) return res.status(404).json({ error: "Proje bulunamadı" });
    const task = getTaskById(run.taskId);
    if (!task) return res.status(404).json({ error: "Görev bulunamadı" });
    const artifacts = listArtifactsByRun(id);
    const patchArtifact = artifacts.find((a) => a.kind === "patch");
    if (!patchArtifact || !patchArtifact.content.trim()) {
      return res.status(400).json({ error: "Bu run için patch yok veya boş." });
    }
    const result = await PatchApplier.apply({
      repoPath: project.repoPath,
      patchContent: patchArtifact.content,
      taskId: task.id,
      taskTitle: task.title,
      autoCommit: false
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Patch uygulanamadı" });
    }
    res.json({ ok: true, filesAffected: result.filesAffected });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Hafıza (memory/) ----------
app.get("/api/memory/status", (_req, res) => {
  try {
    const memoryEngine = new MemoryEngine(rootDir);
    const status = memoryEngine.validatePresence();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/memory/create-default", (_req, res) => {
  try {
    const memDir = path.join(rootDir, "memory");
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
    const nowPath = path.join(memDir, "NOW.md");
    const decPath = path.join(memDir, "DECISIONS.md");
    const archPath = path.join(memDir, "ARCH_SHORT.md");

    if (!fs.existsSync(nowPath)) {
      fs.writeFileSync(
        nowPath,
        [
          "LAST: henüz koşmuş bir görev yok",
          "NOW: orchestrator üzerinde çalışma",
          "NEXT: bir sonraki küçük adımı planla",
          "BLOCK: yok",
          "CONTRACT_CHANGE?: no",
          ""
        ].join("\n"),
        "utf8"
      );
    }
    if (!fs.existsSync(decPath)) {
      fs.writeFileSync(
        decPath,
        "# Önemli Kararlar (DECISIONS)\n\n- Varsayılan hafıza dosyaları oluşturuldu.\n",
        "utf8"
      );
    }
    if (!fs.existsSync(archPath)) {
      fs.writeFileSync(
        archPath,
        "# Kısa Mimari Özeti (ARCH_SHORT)\n\n- Mimari özet henüz doldurulmadı.\n",
        "utf8"
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Çalıştırma başlat: varsayılan olarak terminal penceresinde çalışır ----------
app.post("/api/run/start", async (req, res) => {
  const { taskId, runInTerminal = true } = req.body;
  const tid = Number(taskId);
  if (Number.isNaN(tid))
    return res.status(400).json({ error: "taskId gerekli" });

  const task = getTaskById(tid);
  if (!task) return res.status(404).json({ error: "Görev bulunamadı" });

  const project = getProjectById(task.projectId);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

  const memoryEngine = new MemoryEngine(rootDir);
  const memStatus = memoryEngine.validatePresence();
  if (!memStatus.ok) {
    return res
      .status(400)
      .json({ error: "Hafıza dosyaları eksik", missing: memStatus.missing });
  }

  const allTasks = listTasksByProject(project.id);
  const deps = allTasks.filter((t) => task.dependencyIds.includes(t.id));
  const depStatus = WorkflowEngine.canRunTask(task, deps);
  if (!depStatus.canRun) {
    return res
      .status(400)
      .json({ error: "Görev şu an çalıştırılamaz", reason: depStatus.reason });
  }

  const roleRegistry = new RoleRegistry(rootDir);
  try {
    roleRegistry.loadRolesFromTemplates();
  } catch (_) {}
  let roleConfig = roleRegistry.getRoleConfig(task.roleId);
  if (!roleConfig) {
    const catalogAgent = loadAgent(rootDir, task.roleId);
    if (catalogAgent) {
      roleConfig = agentToRoleConfig(task.roleId, catalogAgent);
    }
  }
  if (!roleConfig) {
    return res.status(400).json({ error: `Rol/Agent bulunamadı: ${task.roleId}` });
  }

  // Bu görev için seçilen model (sağlayıcıya göre Claude/Gemini)
  const selectedModel =
    roleConfig.defaultModelPolicy[task.complexity] ??
    roleConfig.defaultModelPolicy.simple;
  const isGemini = selectedModel.startsWith("gemini:");

  // Terminalde çalıştır: sadece Claude tarafında destekli (Gemini için SSE/gömülü konsol kullanıyoruz)
  if (runInTerminal && !isGemini) {
    const run = createRun({
      taskId: task.id,
      projectId: project.id,
      roleId: task.roleId,
      status: "running",
      exitCode: null,
      parsedOk: false,
      summary: "Terminalde çalışıyor"
    });
    updateTaskStatus(task.id, "running");

    const mem = memoryEngine.load();
    const outputContract = fs.readFileSync(
      path.join(rootDir, "templates", "output_contract.md"),
      "utf8"
    );
    const taskContract = fs.readFileSync(
      path.join(rootDir, "templates", "task_contract.md"),
      "utf8"
    );
    const description = `${task.title}\n\n${task.description}`;

    const { promptPath, model } = ClaudeCodeRunner.prepareRun({
      rootDir,
      projectRepoPath: project.repoPath,
      roleConfig,
      taskDescription: description,
      complexity: task.complexity,
      memory: mem,
      outputContractTemplate: outputContract,
      taskContractTemplate: taskContract
    });

    const apiUrl = process.env.CREWOPS_API_URL || "http://localhost:3999";
    const scriptPath = path.join(rootDir, "scripts", "run-in-terminal.js");
    const cliBin = process.env.CLAUDE_CLI_BIN || process.env.CLAUDE_CODE_BIN || "claude";
    const args = [
      "--runId=" + run.id,
      "--taskId=" + task.id,
      "--promptPath=" + (promptPath.includes(" ") ? JSON.stringify(promptPath) : promptPath),
      "--cwd=" + (project.repoPath.includes(" ") ? JSON.stringify(project.repoPath) : project.repoPath),
      "--model=" + model,
      "--apiUrl=" + apiUrl,
      "--cliBin=" + cliBin
    ];
    const cmdLine =
      "cd /d " + (rootDir.includes(" ") ? JSON.stringify(rootDir) : rootDir) + " && node \"" + scriptPath + "\" " + args.join(" ");

    try {
      if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", "CrewOps Run", "cmd", "/k", cmdLine], {
          cwd: rootDir,
          env: process.env,
          detached: true,
          stdio: "ignore"
        });
      } else {
        spawn("xterm", ["-e", "cd " + rootDir + " && node " + scriptPath + " " + args.join(" ")], {
          cwd: rootDir,
          env: process.env,
          detached: true,
          stdio: "ignore"
        });
      }
    } catch (err) {
      updateTaskStatus(task.id, "pending");
      updateRun(run.id, {
        status: "failed",
        exitCode: null,
        parsedOk: false,
        summary: "Terminal açılamadı: " + String((err as Error).message)
      });
      return res.status(500).json({
        error: "Terminal penceresi açılamadı",
        detail: String((err as Error).message)
      });
    }

    return res.status(201).json({ runId: run.id, openedTerminal: true });
  }

  // Eski akış: arka planda çalıştır, çıktı SSE ile gömülü terminale gider
  const jobId = createJobId();
  emitJobEvent(jobId, { type: "start", data: { taskId: task.id, title: task.title } });

  (async () => {
    const mem = memoryEngine.load();
    const outputContract = fs.readFileSync(
      path.join(rootDir, "templates", "output_contract.md"),
      "utf8"
    );
    const taskContract = fs.readFileSync(
      path.join(rootDir, "templates", "task_contract.md"),
      "utf8"
    );
    updateTaskStatus(task.id, "running");
    const description = `${task.title}\n\n${task.description}`;

    try {
      const runResult = await LLMRunner.runWithStream(
        {
          rootDir,
          projectRepoPath: project.repoPath,
          roleConfig,
          taskDescription: description,
          complexity: task.complexity,
          memory: mem,
          outputContractTemplate: outputContract,
          taskContractTemplate: taskContract
        },
        (source, data) => {
          emitJobEvent(jobId, { type: source, data });
        }
      );

      const parsed = OutputParser.parse(runResult.stdout);
      const parsedOk = parsed.ok;
      const summary = parsed.ok ? parsed.value.summary.join(" | ") : "Parse edilemedi";

      const run = createRun({
        taskId: task.id,
        projectId: project.id,
        roleId: task.roleId,
        status: runResult.exitCode === 0 && parsedOk ? "success" : "failed",
        exitCode: runResult.exitCode,
        parsedOk,
        summary
      });

      const artifactManager = new ArtifactManager(rootDir);
      artifactManager.persistArtifacts({
        run,
        rawOutput: runResult.stdout + "\n\n[STDERR]\n" + runResult.stderr,
        parsed: parsed.ok ? parsed.value : null
      });

      if (!parsed.ok) {
        artifactManager.persistArtifacts({
          run,
          rawOutput: "",
          parsed: {
            summary: [`Parser hatası: ${parsed.error}`],
            filesChanged: [],
            patch: "",
            next: [],
            risks: []
          }
        });
      }

      CostEstimator.recordCost(run, runResult.stdout);
      updateTaskStatus(task.id, run.status === "success" ? "completed" : "failed");

      if (run.status === "success" && parsed.ok) {
        memoryEngine.autoUpdateNowFromParsed({
          summary: parsed.value.summary,
          next: parsed.value.next
        });
        artifactManager.appendCompletedRun({
          projectRepoPath: project.repoPath,
          run,
          taskTitle: task.title,
          parsed: parsed.value
        });
        // Üretilen kodu projeye yaz: PATCH uygula, bağımlılıkları kur
        const patchContent = parsed.value.patch?.trim();
        if (patchContent) {
          try {
            const patchResult = await PatchApplier.apply({
              repoPath: project.repoPath,
              patchContent,
              taskId: task.id,
              taskTitle: task.title,
              autoCommit: false
            });
            if (patchResult.success) await installDependencies(project.repoPath);
          } catch (_) {}
        }
      }

      emitJobEvent(jobId, {
        type: "done",
        data: {
          runId: run.id,
          status: run.status,
          parsedOk,
          summary: run.summary,
          patch: parsed.ok ? parsed.value.patch : "",
          filesChanged: parsed.ok ? parsed.value.filesChanged : []
        }
      });
    } catch (err) {
      const run = createRun({
        taskId: task.id,
        projectId: project.id,
        roleId: task.roleId,
        status: "failed",
        exitCode: null,
        parsedOk: false,
        summary: String((err as Error).message)
      });
      updateTaskStatus(task.id, "failed");
      emitJobEvent(jobId, {
        type: "done",
        data: {
          runId: run.id,
          status: "failed",
          parsedOk: false,
          summary: run.summary,
          patch: "",
          filesChanged: [],
          error: String((err as Error).message)
        }
      });
    }
  })();

  res.status(201).json({ jobId });
});

// ---------- Terminalde çalışan görev bittiğinde wrapper script buraya POST eder ----------
app.post("/api/run/finished", (req, res) => {
  const { runId, exitCode, stdout, stderr } = req.body;
  const rid = Number(runId);
  if (Number.isNaN(rid)) {
    return res.status(400).json({ error: "runId gerekli" });
  }

  const run = getRunById(rid);
  if (!run) {
    return res.status(404).json({ error: "Run bulunamadı" });
  }
  if (run.status !== "running") {
    return res.status(400).json({ error: "Run zaten tamamlanmış" });
  }

  const parsed = OutputParser.parse(stdout || "");
  const parsedOk = parsed.ok;
  const summary = parsed.ok ? parsed.value.summary.join(" | ") : "Parse edilemedi";

  const status =
    exitCode === 0 && parsedOk ? "success" : "failed";

  updateRun(rid, {
    status,
    exitCode: exitCode != null ? Number(exitCode) : null,
    parsedOk,
    summary
  });

  const artifactManager = new ArtifactManager(rootDir);
  artifactManager.persistArtifacts({
    run: { ...run, id: rid, status, exitCode, parsedOk, summary },
    rawOutput: (stdout || "") + "\n\n[STDERR]\n" + (stderr || ""),
    parsed: parsed.ok ? parsed.value : null
  });

  if (!parsed.ok) {
    artifactManager.persistArtifacts({
      run: { ...run, id: rid, status, exitCode, parsedOk, summary },
      rawOutput: "",
      parsed: {
        summary: [`Parser hatası: ${parsed.error}`],
        filesChanged: [],
        patch: "",
        next: [],
        risks: []
      }
    });
  }

  CostEstimator.recordCost(
    { ...run, id: rid, status, exitCode, parsedOk, summary },
    stdout || ""
  );
  updateTaskStatus(run.taskId, status === "success" ? "completed" : "failed");

  const memoryEngine = new MemoryEngine(rootDir);
  if (status === "success" && parsed.ok) {
    memoryEngine.autoUpdateNowFromParsed({
      summary: parsed.value.summary,
      next: parsed.value.next
    });
    const project = getProjectById(run.projectId);
    const task = getTaskById(run.taskId);
    if (project && task) {
      artifactManager.appendCompletedRun({
        projectRepoPath: project.repoPath,
        run: { ...run, id: rid, status, exitCode, parsedOk, summary },
        taskTitle: task.title,
        parsed: parsed.value
      });

      // Başarılı görevde üretilen kodu projeye yaz: PATCH uygula, sonra bağımlılıkları kur
      const patchContent = parsed.value.patch?.trim();
      if (patchContent) {
        setImmediate(async () => {
          try {
            const patchResult = await PatchApplier.apply({
              repoPath: project.repoPath,
              patchContent,
              taskId: run.taskId,
              taskTitle: task.title,
              autoCommit: false
            });
            if (patchResult.success) {
              const installResult = await installDependencies(project.repoPath);
              if (!installResult.success && installResult.stderr) {
                console.warn("[CrewOps] Bağımlılık kurulumu uyarı:", installResult.stderr);
              }
            }
          } catch (err) {
            console.warn("[CrewOps] Otomatik patch/install hatası:", (err as Error).message);
          }
        });
      }
    }
  }

  res.json({ ok: true, runId: rid, status });
});

// ---------- Çalıştırma stream (SSE): gömülü terminal buradan canlı log alır ----------
app.get("/api/run/stream/:jobId", (req, res) => {
  const jobId = req.params.jobId;
  const store = jobEvents.get(jobId);
  if (!store) {
    return res.status(404).json({ error: "Job bulunamadı" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Önceden birikmiş olayları gönder
  for (const ev of store.events) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }
  if (store.done) {
    res.end();
    return;
  }

  const listener = (ev: { type: string; data?: unknown }) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
    if (ev.type === "done") {
      jobEmitter.removeListener(`job:${jobId}`, listener);
      res.end();
    }
  };
  jobEmitter.on(`job:${jobId}`, listener);

  req.on("close", () => {
    jobEmitter.removeListener(`job:${jobId}`, listener);
  });
});

// ---------- PM Chat ----------
app.post("/api/pm/chat", async (req, res) => {
  const { projectId, message } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid) || !message) {
    return res.status(400).json({ error: "projectId ve message gerekli" });
  }
  const project = getProjectById(pid);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

  try {
    // Kullanici mesajini kaydet
    createChatMessage({ projectId: pid, role: "user", content: String(message) });

    const chatHistory = listChatMessages(pid);

    const result = await PmChatEngine.chat({
      rootDir,
      project,
      chatHistory,
      userMessage: String(message)
    });

    // PM yanitini kaydet
    createChatMessage({ projectId: pid, role: "pm", content: result.pmReply });

    // Mutabakat hazirsa proje phase guncelle
    if (result.mutabakatReady) {
      updateProject(pid, {
        phase: "mutabakat_tamamlandi",
        mutabakatOzeti: result.mutabakatDocument || null,
        mutabakatTamamlandiAt: new Date().toISOString()
      });
    }

    res.json({
      pmReply: result.pmReply,
      mutabakatReady: result.mutabakatReady,
      mutabakatDocument: result.mutabakatDocument
    });
  } catch (e) {
    console.error("[PM Chat] Hata:", (e as Error).message);
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/pm/chat/stream", async (req, res) => {
  const { projectId, message } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid) || !message) {
    return res.status(400).json({ error: "projectId ve message gerekli" });
  }
  const project = getProjectById(pid);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    createChatMessage({ projectId: pid, role: "user", content: String(message) });
    const chatHistory = listChatMessages(pid);

    const result = await PmChatEngine.chatWithStream({
      rootDir,
      project,
      chatHistory,
      userMessage: String(message),
      onChunk: (data) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", data })}\n\n`);
      }
    });

    createChatMessage({ projectId: pid, role: "pm", content: result.pmReply });

    if (result.mutabakatReady) {
      updateProject(pid, {
        phase: "mutabakat_tamamlandi",
        mutabakatOzeti: result.mutabakatDocument || null,
        mutabakatTamamlandiAt: new Date().toISOString()
      });
    }

    res.write(`data: ${JSON.stringify({
      type: "done",
      pmReply: result.pmReply,
      mutabakatReady: result.mutabakatReady,
      mutabakatDocument: result.mutabakatDocument
    })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: "error", error: String((e as Error).message) })}\n\n`);
    res.end();
  }
});

app.get("/api/pm/chat/history", (req, res) => {
  const projectId = Number(req.query.projectId);
  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: "projectId gerekli" });
  }
  try {
    const messages = listChatMessages(projectId);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- PM Planlama ----------
app.post("/api/pm/plan/generate", async (req, res) => {
  const { projectId } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  const project = getProjectById(pid);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });
  if (project.phase !== "mutabakat_tamamlandi" && project.phase !== "planlama") {
    return res.status(400).json({ error: "Mutabakat tamamlanmadan plan uretilmez" });
  }

  try {
    updateProject(pid, { phase: "planlama" });
    const chatHistory = listChatMessages(pid);
    const mutabakatDoc = project.mutabakatOzeti || "";

    const plan = await PmPlannerEngine.generatePlan({
      rootDir,
      project,
      mutabakatDocument: mutabakatDoc,
      chatHistory
    });

    // Agent routing
    const router = new AgentRouter(rootDir);
    const routeResults = router.routePlan(
      plan.tasks.map((t) => ({ tempId: t.tempId, role: t.role, title: t.title }))
    );

    const tasksWithRouting = plan.tasks.map((t) => {
      const route = routeResults.get(t.tempId);
      return {
        ...t,
        routing: route ? {
          bestMatch: route.bestMatch,
          alternatives: route.alternatives,
          fallbackToBuiltIn: route.fallbackToBuiltIn
        } : null
      };
    });

    res.json({ plan: { ...plan, tasks: tasksWithRouting } });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/pm/plan/generate/stream", async (req, res) => {
  const { projectId } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  const project = getProjectById(pid);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    updateProject(pid, { phase: "planlama" });
    const chatHistory = listChatMessages(pid);
    const mutabakatDoc = project.mutabakatOzeti || "";

    const plan = await PmPlannerEngine.generatePlanWithStream({
      rootDir,
      project,
      mutabakatDocument: mutabakatDoc,
      chatHistory,
      onChunk: (data) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", data })}\n\n`);
      }
    });

    const router = new AgentRouter(rootDir);
    const routeResults = router.routePlan(
      plan.tasks.map((t) => ({ tempId: t.tempId, role: t.role, title: t.title }))
    );

    const tasksWithRouting = plan.tasks.map((t) => {
      const route = routeResults.get(t.tempId);
      return {
        ...t,
        routing: route ? {
          bestMatch: route.bestMatch,
          alternatives: route.alternatives,
          fallbackToBuiltIn: route.fallbackToBuiltIn
        } : null
      };
    });

    res.write(`data: ${JSON.stringify({ type: "done", plan: { ...plan, tasks: tasksWithRouting } })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: "error", error: String((e as Error).message) })}\n\n`);
    res.end();
  }
});

app.get("/api/pm/plan/draft", (req, res) => {
  const projectId = Number(req.query.projectId);
  if (Number.isNaN(projectId)) return res.status(400).json({ error: "projectId gerekli" });

  try {
    const draft = getPlanDraft(projectId);
    if (!draft) return res.status(404).json({ error: "Plan taslagi bulunamadi" });

    const parsedPlan = JSON.parse(draft.parsedJson);

    // Agent routing ekle
    const router = new AgentRouter(rootDir);
    const routeResults = router.routePlan(
      parsedPlan.tasks.map((t: any) => ({ tempId: t.tempId, role: t.role, title: t.title }))
    );

    const tasksWithRouting = parsedPlan.tasks.map((t: any) => {
      const route = routeResults.get(t.tempId);
      return {
        ...t,
        routing: route ? {
          bestMatch: route.bestMatch,
          alternatives: route.alternatives,
          fallbackToBuiltIn: route.fallbackToBuiltIn
        } : null
      };
    });

    res.json({ ...draft, parsedPlan: { ...parsedPlan, tasks: tasksWithRouting } });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/pm/plan/approve", async (req, res) => {
  const { projectId, autoStart } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  const project = getProjectById(pid);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

  const draft = getPlanDraft(pid);
  if (!draft || draft.status !== "draft") {
    return res.status(400).json({ error: "Onaylanacak plan taslagi yok" });
  }

  try {
    const plan = JSON.parse(draft.parsedJson);

    // Agent routing — best match'i roleId olarak kullan
    const router = new AgentRouter(rootDir);
    const routeResults = router.routePlan(
      plan.tasks.map((t: any) => ({ tempId: t.tempId, role: t.role, title: t.title }))
    );

    // Eslesen agent'i task roleId olarak ata
    for (const task of plan.tasks) {
      const route = routeResults.get(task.tempId);
      if (route && !route.fallbackToBuiltIn && route.bestMatch) {
        task.role = route.bestMatch.agentId;
      }
    }

    const result = await PmPlannerEngine.materializePlan(rootDir, project, plan);

    // AutoStart: plan onaylaninca orkestrasyonu otomatik baslat
    let orchestrationStarted = false;
    if (autoStart && !activeLoops.has(pid)) {
      deleteOrchestrationEvents(pid);
      const loop = new OrchestrationLoop(
        {
          rootDir,
          projectId: pid,
          autoApplyPatch: true,
          autoCommit: false,
          enableReview: true,
          autoStart: true
        },
        (event) => {
          persistAndEmitEvent(pid, event);
        }
      );
      activeLoops.set(pid, loop);
      orchestrationStarted = true;

      loop.start().then(async () => {
        const status = loop.getStatus();
        if (status === "completed") {
          try {
            const freshProject = getProjectById(pid);
            if (freshProject) {
              const tasks = listTasksByProject(pid);
              const runs = listRunsByProject(pid, 500);
              const report = await DeliveryEngine.generateReport(rootDir, freshProject, tasks, runs);
              await DeliveryEngine.deliver(rootDir, pid, report);
              const deliveryEvent: OrchestrationEvent = {
                type: "delivery_complete",
                message: "Teslim raporu olusturuldu",
                timestamp: new Date().toISOString()
              };
              persistAndEmitEvent(pid, deliveryEvent);
            }
          } catch {}
        }
        activeLoops.delete(pid);
      }).catch(() => {
        activeLoops.delete(pid);
      });
    }

    res.json({ ok: true, createdTaskIds: result.createdTaskIds, orchestrationStarted });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.post("/api/pm/plan/reject", (req, res) => {
  const { projectId } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  try {
    updatePlanDraftStatus(pid, "rejected");
    updateProject(pid, { phase: "mutabakat_tamamlandi" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Orkestrasyon ----------
const activeLoops = new Map<number, OrchestrationLoop>();
const orchestrationEmitter = new EventEmitter();
orchestrationEmitter.setMaxListeners(100);

/** Event'i hem DB'ye yaz hem SSE'ye emit et */
function persistAndEmitEvent(pid: number, event: OrchestrationEvent) {
  createOrchestrationEvent({
    projectId: pid,
    type: event.type,
    message: event.message,
    data: event.data
  });
  orchestrationEmitter.emit(`orch:${pid}`, event);
}

app.post("/api/orchestration/start", async (req, res) => {
  const { projectId } = req.body;
  const pid = Number(projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  const project = getProjectById(pid);
  if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

  if (activeLoops.has(pid)) {
    return res.status(400).json({ error: "Bu proje icin orkestrasyon zaten calisiyor" });
  }

  // Onceki eventleri temizle (yeni orkestrasyon baslatiyor)
  deleteOrchestrationEvents(pid);

  const loop = new OrchestrationLoop(
    {
      rootDir,
      projectId: pid,
      autoApplyPatch: true,
      autoCommit: false,
      enableReview: true
    },
    (event) => {
      persistAndEmitEvent(pid, event);
    }
  );

  activeLoops.set(pid, loop);
  res.json({ ok: true, status: "running" });

  // Orkestrasyon basla (arka planda)
  loop.start().then(async () => {
    const status = loop.getStatus();
    // Tamamlaninca delivery raporu uret
    if (status === "completed") {
      try {
        const tasks = listTasksByProject(pid);
        const runs = listRunsByProject(pid, 500);
        const report = await DeliveryEngine.generateReport(rootDir, project, tasks, runs);
        await DeliveryEngine.deliver(rootDir, pid, report);
        const deliveryEvent: OrchestrationEvent = {
          type: "delivery_complete",
          message: "Teslim raporu olusturuldu",
          timestamp: new Date().toISOString()
        };
        persistAndEmitEvent(pid, deliveryEvent);
      } catch {}
    }
    activeLoops.delete(pid);
  }).catch(() => {
    activeLoops.delete(pid);
  });
});

app.get("/api/orchestration/stream", (req, res) => {
  const pid = Number(req.query.projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  // Reconnect destegi: Last-Event-ID veya query param
  const lastEventId = Number(req.headers["last-event-id"] || req.query.lastEventId || 0);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // DB'den kacirilmis eventleri gonder (reconnect veya ilk baglanti)
  const dbEvents = listOrchestrationEvents(pid, lastEventId);
  for (const ev of dbEvents) {
    const payload = {
      type: ev.type,
      message: ev.message,
      data: ev.dataJson ? JSON.parse(ev.dataJson) : undefined,
      timestamp: ev.createdAt
    };
    res.write(`id: ${ev.id}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  // Orkestrasyon tamamlanmissa stream'i kapat
  const lastDbEvent = dbEvents[dbEvents.length - 1];
  if (lastDbEvent && (lastDbEvent.type === "orchestration_complete" || lastDbEvent.type === "orchestration_error" || lastDbEvent.type === "delivery_complete")) {
    res.end();
    return;
  }

  // Canli eventleri dinle
  const listener = (ev: OrchestrationEvent) => {
    // DB'ye yazdiktan sonra ID'yi alabilmek icin DB'den son event'i oku
    const recent = listOrchestrationEvents(pid, 0, 1000);
    const lastRow = recent[recent.length - 1];
    const eventId = lastRow?.id ?? Date.now();
    res.write(`id: ${eventId}\ndata: ${JSON.stringify(ev)}\n\n`);
    if (ev.type === "orchestration_complete" || ev.type === "orchestration_error" || ev.type === "delivery_complete") {
      orchestrationEmitter.removeListener(`orch:${pid}`, listener);
      res.end();
    }
  };
  orchestrationEmitter.on(`orch:${pid}`, listener);

  req.on("close", () => {
    orchestrationEmitter.removeListener(`orch:${pid}`, listener);
  });
});

app.post("/api/orchestration/pause", (req, res) => {
  const { projectId } = req.body;
  const pid = Number(projectId);
  const loop = activeLoops.get(pid);
  if (!loop) return res.status(404).json({ error: "Aktif orkestrasyon yok" });
  loop.pause();
  res.json({ ok: true, status: "paused" });
});

app.post("/api/orchestration/resume", async (req, res) => {
  const { projectId } = req.body;
  const pid = Number(projectId);
  const loop = activeLoops.get(pid);
  if (!loop) return res.status(404).json({ error: "Aktif orkestrasyon yok" });
  await loop.resume();
  res.json({ ok: true, status: "running" });
});

app.get("/api/orchestration/status", (req, res) => {
  const pid = Number(req.query.projectId);
  if (Number.isNaN(pid)) return res.status(400).json({ error: "projectId gerekli" });

  const loop = activeLoops.get(pid);
  const tasks = listTasksByProject(pid);

  // DB'den eventleri oku (refresh dayanikliligi)
  const dbEvents = listOrchestrationEvents(pid);
  const recentEvents = dbEvents.slice(-20).map((ev) => ({
    type: ev.type,
    message: ev.message,
    data: ev.dataJson ? JSON.parse(ev.dataJson) : undefined,
    timestamp: ev.createdAt
  }));

  // Durum: aktif loop varsa ondan, yoksa DB'den cikar
  let status: string = "idle";
  if (loop) {
    status = loop.getStatus();
  } else if (dbEvents.length > 0) {
    const lastEvent = dbEvents[dbEvents.length - 1];
    if (lastEvent.type === "orchestration_complete" || lastEvent.type === "delivery_complete") {
      status = "completed";
    } else if (lastEvent.type === "orchestration_error") {
      status = "failed";
    } else if (lastEvent.type === "orchestration_paused") {
      status = "paused";
    } else {
      // Eventler var ama loop yok — muhtemelen sunucu yeniden baslamis
      status = "completed";
    }
  }

  res.json({
    status,
    taskSummary: {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      running: tasks.filter((t) => t.status === "running").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length
    },
    recentEvents
  });
});

// ---------- Yardimci: Agent Router debug + Skill catalog ----------
app.get("/api/agent-router/match", (req, res) => {
  const { taskDescription, roleId, taskTitle } = req.query;
  if (!taskDescription || !roleId) {
    return res.status(400).json({ error: "taskDescription ve roleId gerekli" });
  }
  try {
    const router = new AgentRouter(rootDir);
    const result = router.route({
      taskDescription: String(taskDescription),
      roleId: String(roleId),
      taskTitle: String(taskTitle || "")
    });
    // Debug loglama dahil
    res.json({ ...result, _log: router.getLastLog() });
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

app.get("/api/skill-catalog", (_req, res) => {
  try {
    const scanner = new SkillScanner(rootDir);
    const skills = scanner.scan();
    res.json(skills);
  } catch (e) {
    res.status(500).json({ error: String((e as Error).message) });
  }
});

// ---------- Yardimci: Patch'ten dosya listesi cikar ----------
interface PatchFile {
  path: string;
  isNew: boolean;
  content: string;
  addedLines: number;
  removedLines: number;
}

function parsePatchToFiles(patchContent: string): PatchFile[] {
  const files: PatchFile[] = [];
  // diff --git a/path b/path veya --- a/path / +++ b/path formatini destekle
  const blocks = patchContent.split(/(?=^diff --git )/m);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // Dosya yolunu bul
    const gitMatch = block.match(/^diff --git a\/(.+?) b\/(.+)/m);
    const filePath = gitMatch ? gitMatch[2] : null;

    if (!filePath) {
      // Basit +++ formatini dene
      const plusMatch = block.match(/^\+\+\+ b?\/?(.*)/m);
      if (!plusMatch) continue;
      const simplePath = plusMatch[1];
      if (!simplePath || simplePath === "/dev/null") continue;

      const lines = block.split("\n");
      let added = 0, removed = 0;
      const contentLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          added++;
          contentLines.push(line.slice(1));
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          removed++;
        } else if (line.startsWith(" ")) {
          contentLines.push(line.slice(1));
        }
      }
      files.push({
        path: simplePath,
        isNew: removed === 0,
        content: contentLines.join("\n"),
        addedLines: added,
        removedLines: removed
      });
      continue;
    }

    // Yeni dosya mi?
    const isNew = block.includes("--- /dev/null") || block.includes("new file mode");

    const lines = block.split("\n");
    let added = 0, removed = 0;
    const contentLines: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith("@@")) { inHunk = true; continue; }
      if (!inHunk) continue;

      if (line.startsWith("+") && !line.startsWith("+++")) {
        added++;
        contentLines.push(line.slice(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        removed++;
      } else if (line.startsWith(" ")) {
        contentLines.push(line.slice(1));
      }
    }

    files.push({
      path: filePath,
      isNew,
      content: contentLines.join("\n"),
      addedLines: added,
      removedLines: removed
    });
  }

  return files;
}

// ---------- Sunucuyu başlat ----------
const PORT = Number(process.env.PORT) || 3999;
app.listen(PORT, () => {
  console.log(`CrewOps API http://localhost:${PORT}`);
  console.log("Yönetim arayüzü ve gömülü terminal için web uygulamasını bu adrese proxy ile bağlayın.");
});
