// Orchestrator TUI giriş noktası
// Bu dosya, Ink ile ekranlar arasında geçiş yapan temel kabuğu uygular.
// Tüm açıklamalar Türkçe tutulmuştur.

import React, { useEffect, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import {
  DashboardScreen,
  ProjectsScreen,
  TasksScreen,
  RunScreen,
  ReviewScreen,
  MemoryScreen,
  HistoryScreen,
  RolesScreen,
  type ScreenId
} from "./screens";
import {
  listProjects,
  createProject,
  listTasksByProject,
  createTask,
  getTaskById,
  listRunsByProject,
  createRun,
  updateTaskStatus,
  createRole
} from "@db/index";
import { WorkflowEngine } from "@core/workflowEngine";
import { MemoryEngine } from "@core/memoryEngine";
import { RoleRegistry, type RoleConfig } from "@core/roleRegistry";
import { OutputParser } from "@core/outputParser";
import { ArtifactManager } from "@core/artifactManager";
import { CostEstimator } from "@core/costEstimator";
import { LLMRunner } from "@core/llmRunner";
import * as fs from "fs";
import * as path from "path";

import type { Project, Task, Run } from "@shared/index";

// Uygulama durumu için basit tipler
type InputMode =
  | "normal"
  | "project-adding"
  | "project-selecting"
  | "task-adding"
  | "task-selecting";

const App: React.FC = () => {
  const { exit } = useApp();

  // Ekran ve seçim durumları
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [historyRuns, setHistoryRuns] = useState<Run[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);

  const [inputMode, setInputMode] = useState<InputMode>("normal");
  const [inputBuffer, setInputBuffer] = useState<string>("");

  // Not: TUI workspace içinde (apps/orchestrator) çalışır ama
  // şablonlar, hafıza ve artefact'lar monorepo kökünde tutulur.
  // Bu yüzden kök dizini __dirname'den yukarı çıkarak hesaplıyoruz.
  const rootDir = path.resolve(__dirname, "..", "..");
  const memoryEngine = new MemoryEngine(rootDir);
  const roleRegistry = new RoleRegistry(rootDir);
  const artifactManager = new ArtifactManager(rootDir);

  // Hafıza durumu
  const [memoryStatus, setMemoryStatus] = useState<{
    ok: boolean;
    missing: string[];
  }>({ ok: false, missing: [] });
  const [memoryContent, setMemoryContent] = useState<ReturnType<
    typeof memoryEngine.load
  > | null>(null);

  // Review ekranı için patch durumu
  const [reviewPatch, setReviewPatch] = useState<string>("");
  const [reviewFiles, setReviewFiles] = useState<string[]>([]);
  const [reviewApplyState, setReviewApplyState] = useState<
    "idle" | "applying" | "applied" | "error" | "rejected"
  >("idle");
  const [reviewErrorMessage, setReviewErrorMessage] = useState<string | undefined>();

  // İlk yükleme: projeleri ve hafızayı oku
  useEffect(() => {
    reloadProjects();
    reloadMemory();
    reloadRoles();
  }, []);

  // Seçili proje değişince görev ve history'yi yeniden yükle
  useEffect(() => {
    if (selectedProjectId !== null) {
      reloadTasks(selectedProjectId);
      reloadHistory(selectedProjectId);
    } else {
      setTasks([]);
      setHistoryRuns([]);
      setLastRun(null);
    }
  }, [selectedProjectId]);

  // Yardımcı: projeleri DB'den oku
  const reloadProjects = () => {
    const list = listProjects();
    setProjects(list);
    if (list.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(list[0].id);
    }
  };

  const reloadTasks = (projectId: number) => {
    const list = listTasksByProject(projectId);
    setTasks(list);
  };

  const reloadHistory = (projectId: number) => {
    const runs = listRunsByProject(projectId, 20);
    setHistoryRuns(runs);
    setLastRun(runs[0] ?? null);
  };

  const reloadRoles = () => {
    try {
      roleRegistry.loadRolesFromTemplates();
      setRoleConfigs(roleRegistry.listRoleConfigs());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Role templates load error:", err);
      setRoleConfigs([]);
    }
  };

  const reloadMemory = () => {
    const status = memoryEngine.validatePresence();
    setMemoryStatus(status);
    if (status.ok) {
      setMemoryContent(memoryEngine.load());
    } else {
      setMemoryContent(null);
    }
  };

  // Ana klavye girdisi işleyicisi
  useInput((input: string, key: any) => {
    // Çıkış kısayolu
    if (input === "q" && inputMode === "normal") {
      exit();
      return;
    }

    // Ekran kısayolları (sadece normal modda)
    if (inputMode === "normal") {
      if (input === "1") setScreen("dashboard");
      if (input === "2") setScreen("projects");
      if (input === "3") setScreen("roles");
      if (input === "4") setScreen("tasks");
      if (input === "5") setScreen("run");
      if (input === "6") setScreen("review");
      if (input === "7") setScreen("history");
      if (input === "8") setScreen("memory");
    }

    // Buffer tabanlı veri giriş modları
    if (
      inputMode === "project-adding" ||
      inputMode === "project-selecting" ||
      inputMode === "task-adding" ||
      inputMode === "task-selecting"
    ) {
      if (key.return) {
        handleSubmitBuffer();
        return;
      }
      if (key.backspace || key.delete) {
        setInputBuffer((prev) => prev.slice(0, -1));
        return;
      }
      if (key.escape) {
        setInputMode("normal");
        setInputBuffer("");
        return;
      }
      // Yazılabilir karakterleri buffera ekle
      if (input) {
        setInputBuffer((prev) => prev + input);
      }
      return;
    }

    // Normal modda ekran özel kısa yolları
    if (inputMode === "normal") {
      if (screen === "projects") {
        if (input === "a") {
          setInputMode("project-adding");
          setInputBuffer("");
        }
        if (input === "s") {
          setInputMode("project-selecting");
          setInputBuffer("");
        }
      } else if (screen === "tasks") {
        if (input === "a") {
          setInputMode("task-adding");
          setInputBuffer("");
        }
        if (input === "s") {
          setInputMode("task-selecting");
          setInputBuffer("");
        }
      } else if (screen === "roles") {
        if (input === "r") {
          reloadRoles();
        }
        if (input === "i" && selectedProjectId !== null) {
          const project = projects.find((p) => p.id === selectedProjectId);
          if (project) {
            for (const cfg of roleConfigs) {
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
          }
        }
      } else if (screen === "run") {
        if (input === "r") {
          void handleRunSelectedTask();
        }
      } else if (screen === "review") {
        if (input === "y") {
          void handleApplyPatch();
        }
        if (input === "n") {
          setReviewApplyState("rejected");
        }
      } else if (screen === "memory") {
        if (input === "c") {
          createDefaultMemoryFiles();
        }
      }
    }
  });

  // Buffer tamamlandığında çağrılır
  const handleSubmitBuffer = () => {
    if (inputMode === "project-adding") {
      const [name, repoPath, stack] = inputBuffer.split("|");
      if (name && repoPath && stack) {
        const proj = createProject({
          name: name.trim(),
          repoPath: repoPath.trim(),
          stack: stack.trim()
        });
        reloadProjects();
        setSelectedProjectId(proj.id);
      }
    } else if (inputMode === "project-selecting") {
      const id = Number(inputBuffer.trim());
      if (!Number.isNaN(id)) {
        const found = projects.find((p) => p.id === id);
        if (found) {
          setSelectedProjectId(found.id);
        }
      }
    } else if (inputMode === "task-adding" && selectedProjectId !== null) {
      const [title, description, roleId, complexity, depsCsv] = inputBuffer.split("|");
      if (title && description && roleId && complexity) {
        const dependencyIds: number[] =
          depsCsv && depsCsv.trim().length > 0
            ? depsCsv
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => !Number.isNaN(n))
            : [];
        const task = createTask({
          projectId: selectedProjectId,
          roleId: roleId.trim(),
          title: title.trim(),
          description: description.trim(),
          complexity: (complexity.trim() as Task["complexity"]) ?? "simple",
          dependencyIds
        });
        reloadTasks(selectedProjectId);
        setSelectedTaskId(task.id);
      }
    } else if (inputMode === "task-selecting") {
      const id = Number(inputBuffer.trim());
      if (!Number.isNaN(id)) {
        const found = tasks.find((t) => t.id === id);
        if (found) {
          setSelectedTaskId(found.id);
        }
      }
    }

    setInputMode("normal");
    setInputBuffer("");
  };

  // Default hafıza dosyalarını oluşturur (eğer eksikse)
  const createDefaultMemoryFiles = () => {
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
        "# Önemli Kararlar (DECISIONS)\n\n- Varsayılan hafıza dosyaları TUI üzerinden oluşturuldu.\n",
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
    reloadMemory();
  };

  // Seçili görevi LLMRunner ile çalıştırır (Claude veya Gemini, role defaultModelPolicy'ye göre)
  const handleRunSelectedTask = async () => {
    if (selectedProjectId === null || selectedTaskId === null) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;
    const task = getTaskById(selectedTaskId);
    if (!task) return;

    // Hafıza dosyaları yoksa, koşuyu bloke et
    const memStatus = memoryEngine.validatePresence();
    if (!memStatus.ok) {
      setScreen("memory");
      return;
    }
    const mem = memoryEngine.load();

    // Bağımlılık kontrolü
    const allTasks = listTasksByProject(project.id);
    const deps = allTasks.filter((t) => task.dependencyIds.includes(t.id));
    const depStatus = WorkflowEngine.canRunTask(task, deps);
    if (!depStatus.canRun) {
      setScreen("run");
      return;
    }

    // Rol konfigürasyonunu yükle
    const roleConfig = roleRegistry.getRoleConfig(task.roleId);
    if (!roleConfig) {
      // Rol bulunamazsa hatayı history'de görebilmek için kısa bir run kaydı açabiliriz
      const run = createRun({
        taskId: task.id,
        projectId: project.id,
        roleId: task.roleId,
        status: "failed",
        exitCode: null,
        parsedOk: false,
        summary: `Rol konfigürasyonu bulunamadı: ${task.roleId}`
      });
      artifactManager.persistArtifacts({
        run,
        rawOutput: "",
        parsed: null
      });
      reloadHistory(project.id);
      return;
    }

    // Sözleşme şablonlarını oku
    const outputContractPath = path.join(rootDir, "templates", "output_contract.md");
    const taskContractPath = path.join(rootDir, "templates", "task_contract.md");
    const outputContract = fs.readFileSync(outputContractPath, "utf8");
    const taskContract = fs.readFileSync(taskContractPath, "utf8");

    // Görev durumunu running'e çek
    updateTaskStatus(task.id, "running");
    reloadTasks(project.id);

    const description = `${task.title}\n\n${task.description}`;

    const runResult = await LLMRunner.run({
      rootDir,
      projectRepoPath: project.repoPath,
      roleConfig,
      taskDescription: description,
      complexity: task.complexity,
      memory: mem,
      outputContractTemplate: outputContract,
      taskContractTemplate: taskContract
    });

    // Çıktıyı parse et
    const parsed = OutputParser.parse(runResult.stdout);
    const parsedOk = parsed.ok;
    const summary = parsed.ok ? parsed.value.summary.join(" | ") : "Parse edilemedi";

    // Run kaydı oluştur
    const run = createRun({
      taskId: task.id,
      projectId: project.id,
      roleId: task.roleId,
      status: runResult.exitCode === 0 && parsedOk ? "success" : "failed",
      exitCode: runResult.exitCode,
      parsedOk,
      summary
    });

    // Artefact'ları sakla
    artifactManager.persistArtifacts({
      run,
      rawOutput: runResult.stdout + "\n\n[STDERR]\n" + runResult.stderr,
      parsed: parsed.ok ? parsed.value : null
    });

    // Parsing hatasını ayrıca artifact olarak ekle
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

    // Maliyet tahmini
    CostEstimator.recordCost(run, runResult.stdout);

    // Görev durumunu güncelle
    updateTaskStatus(
      task.id,
      run.status === "success" ? "completed" : "failed"
    );
    reloadTasks(project.id);
    reloadHistory(project.id);

    // Başarılı ve parse edilebilir bir run'dan sonra NOW.md dosyasını
    // otomatik güncelle. Böylece claude-code her rol koşusunda
    // güncel "şu an ne oluyor / sırada ne var" bilgisini hafızadan
    // almış olur; senin manuel dosya düzenlemene gerek kalmaz.
    if (run.status === "success" && parsed.ok) {
      memoryEngine.autoUpdateNowFromParsed({
        summary: parsed.value.summary,
        next: parsed.value.next
      });
      // TUI'de de güncel NOW içeriğini görmek için hafızayı tazele
      reloadMemory();
    }

    // Review ekranına patch'i hazırla
    if (parsed.ok) {
      setReviewPatch(parsed.value.patch);
      setReviewFiles(parsed.value.filesChanged);
      setReviewApplyState("idle");
      setReviewErrorMessage(undefined);
      setScreen("review");
    } else {
      setScreen("history");
    }
  };

  // Guarded Mode: patch'i git apply ile uygular
  const handleApplyPatch = async () => {
    if (!reviewPatch || reviewPatch.trim().length === 0) {
      setReviewApplyState("rejected");
      return;
    }
    const project =
      selectedProjectId !== null
        ? projects.find((p) => p.id === selectedProjectId)
        : null;
    if (!project) {
      setReviewApplyState("error");
      setReviewErrorMessage("Seçili proje yok, git apply yapılamadı.");
      return;
    }

    setReviewApplyState("applying");

    // Patch'i geçici bir dosyaya yazıp git apply ile uyguluyoruz
    const patchDir = path.join(rootDir, ".tmp");
    fs.mkdirSync(patchDir, { recursive: true });
    const patchPath = path.join(patchDir, `run_patch_${Date.now()}.diff`);
    fs.writeFileSync(patchPath, reviewPatch, "utf8");

    const { spawn } = await import("child_process");

    await new Promise<void>((resolve) => {
      const child = spawn("git", ["apply", patchPath], {
        cwd: project.repoPath,
        env: process.env
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => {
        if (code === 0) {
          setReviewApplyState("applied");
          setReviewErrorMessage(undefined);
        } else {
          setReviewApplyState("error");
          setReviewErrorMessage(
            `git apply hata kodu: ${code}. Detay: ${stderr || "bilinmiyor"}`
          );
        }
        resolve();
      });
      child.on("error", (err) => {
        setReviewApplyState("error");
        setReviewErrorMessage(`git apply çalıştırılamadı: ${(err as any)?.message}`);
        resolve();
      });
    });
  };

  const selectedProject =
    selectedProjectId !== null
      ? projects.find((p) => p.id === selectedProjectId) ?? null
      : null;
  const selectedTask =
    selectedTaskId !== null ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  // Bağımlılık durumu sadece Run ekranında hesaplanır
  let dependencyStatus: { canRun: boolean; reason?: string } | null = null;
  if (selectedTask) {
    const deps = tasks.filter((t) => selectedTask.dependencyIds.includes(t.id));
    dependencyStatus = WorkflowEngine.canRunTask(selectedTask, deps);
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text>
          AI Team Orchestrator - Ekranlar: [1]Dashboard [2]Projects [3]Roles [4]Tasks [5]Run [6]Review [7]History [8]Memory | Çıkış: q
        </Text>
      </Box>
      <Box marginTop={1}>
        {screen === "dashboard" && (
          <DashboardScreen
            project={selectedProject}
            lastRun={lastRun}
            memory={memoryContent}
            memoryStatus={memoryStatus}
          />
        )}
        {screen === "projects" && (
          <ProjectsScreen
            projects={projects}
            selectedProjectId={selectedProjectId}
            mode={inputMode === "project-adding" ? "adding" : "list"}
            inputBuffer={inputBuffer}
          />
        )}
        {screen === "roles" && (
          <RolesScreen roles={roleConfigs} project={selectedProject} />
        )}
        {screen === "tasks" && (
          <TasksScreen
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            inputMode={
              inputMode === "task-adding"
                ? "adding"
                : inputMode === "task-selecting"
                ? "selecting"
                : "idle"
            }
            inputBuffer={inputBuffer}
          />
        )}
        {screen === "run" && (
          <RunScreen
            selectedTask={selectedTask}
            dependencyStatus={dependencyStatus}
            lastRun={lastRun}
          />
        )}
        {screen === "review" && (
          <ReviewScreen
            patch={reviewPatch}
            filesChanged={reviewFiles}
            applyState={reviewApplyState}
            errorMessage={reviewErrorMessage}
          />
        )}
        {screen === "memory" && (
          <MemoryScreen memory={memoryContent} status={memoryStatus} />
        )}
        {screen === "history" && <HistoryScreen runs={historyRuns} />}
      </Box>
    </Box>
  );
};

// Ink uygulamasını başlat
render(<App />);

