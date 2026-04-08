// PmPlannerEngine
// Mutabakat sonrası otomatik plan üretimi ve materyalizasyonu.

import * as fs from "fs";
import * as path from "path";
import { LLMRunner } from "./llmRunner";
import { RoleRegistry } from "./roleRegistry";
import { MemoryEngine } from "./memoryEngine";
import { PlanningOutputParser } from "./planningOutputParser";
import { createTask, createPlanDraft, updatePlanDraftStatus, updateProject } from "@db/index";
import type { Project, ChatMessage, PlanningOutput } from "@shared/index";

export class PmPlannerEngine {
  static async generatePlan(input: {
    rootDir: string;
    project: Project;
    mutabakatDocument: string;
    chatHistory: ChatMessage[];
  }): Promise<PlanningOutput> {
    const { rootDir, project, mutabakatDocument, chatHistory } = input;

    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    const pmRole = roleRegistry.getRoleConfig("pm");
    if (!pmRole) throw new Error("PM rol tanımı bulunamadı");

    const planningContract = fs.readFileSync(
      path.join(rootDir, "templates", "pm_planning_contract.md"),
      "utf8"
    );

    const historyText = chatHistory
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    const prompt = [
      `# PM Planlama Görevi`,
      ``,
      `## Proje Bilgisi`,
      `Ad: ${project.name}`,
      `Stack: ${project.stack}`,
      `Repo: ${project.repoPath}`,
      ``,
      `## Mutabakat Belgesi`,
      mutabakatDocument,
      ``,
      `## Chat Geçmişi (Referans)`,
      historyText || "(Yok)",
      ``,
      `## Planlama Sözleşmesi`,
      planningContract,
      ``,
      `## Talimat`,
      `Yukarıdaki planlama sözleşmesine uygun formatta çıktı üret.`,
      `Bölüm başlıklarını (ARCH_SHORT:, DECISIONS:, NOW_UPDATE:, TASKS:) satır başında yaz.`,
    ].join("\n");

    const memoryEngine = new MemoryEngine(rootDir);
    let memory = { now: "", decisions: "", archShort: "" };
    try {
      if (memoryEngine.validatePresence().ok) memory = memoryEngine.load();
    } catch {}

    const result = await LLMRunner.run({
      rootDir,
      projectRepoPath: project.repoPath,
      roleConfig: pmRole,
      taskDescription: prompt,
      complexity: "complex",
      memory,
      outputContractTemplate: "",
      taskContractTemplate: ""
    });

    const parsed = PlanningOutputParser.parse(result.stdout);
    if (!parsed.ok) throw new Error(parsed.error);

    // Plan taslağını DB'ye kaydet
    createPlanDraft({
      projectId: project.id,
      rawOutput: result.stdout,
      parsedJson: JSON.stringify(parsed.value)
    });

    return parsed.value;
  }

  static async generatePlanWithStream(input: {
    rootDir: string;
    project: Project;
    mutabakatDocument: string;
    chatHistory: ChatMessage[];
    onChunk: (data: string) => void;
  }): Promise<PlanningOutput> {
    const { rootDir, project, mutabakatDocument, chatHistory, onChunk } = input;

    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    const pmRole = roleRegistry.getRoleConfig("pm");
    if (!pmRole) throw new Error("PM rol tanımı bulunamadı");

    const planningContract = fs.readFileSync(
      path.join(rootDir, "templates", "pm_planning_contract.md"),
      "utf8"
    );

    const historyText = chatHistory
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    const prompt = [
      `# PM Planlama Görevi`,
      ``,
      `## Proje Bilgisi`,
      `Ad: ${project.name}`,
      `Stack: ${project.stack}`,
      `Repo: ${project.repoPath}`,
      ``,
      `## Mutabakat Belgesi`,
      mutabakatDocument,
      ``,
      `## Chat Geçmişi (Referans)`,
      historyText || "(Yok)",
      ``,
      `## Planlama Sözleşmesi`,
      planningContract,
      ``,
      `## Talimat`,
      `Yukarıdaki planlama sözleşmesine uygun formatta çıktı üret.`,
      `Bölüm başlıklarını (ARCH_SHORT:, DECISIONS:, NOW_UPDATE:, TASKS:) satır başında yaz.`,
    ].join("\n");

    const memoryEngine = new MemoryEngine(rootDir);
    let memory = { now: "", decisions: "", archShort: "" };
    try {
      if (memoryEngine.validatePresence().ok) memory = memoryEngine.load();
    } catch {}

    const result = await LLMRunner.runWithStream(
      {
        rootDir,
        projectRepoPath: project.repoPath,
        roleConfig: pmRole,
        taskDescription: prompt,
        complexity: "complex",
        memory,
        outputContractTemplate: "",
        taskContractTemplate: ""
      },
      (source, data) => {
        if (source === "stdout") onChunk(data);
      }
    );

    const parsed = PlanningOutputParser.parse(result.stdout);
    if (!parsed.ok) throw new Error(parsed.error);

    createPlanDraft({
      projectId: project.id,
      rawOutput: result.stdout,
      parsedJson: JSON.stringify(parsed.value)
    });

    return parsed.value;
  }

  static async materializePlan(
    rootDir: string,
    project: Project,
    plan: PlanningOutput
  ): Promise<{ createdTaskIds: number[] }> {
    const memDir = path.join(rootDir, "memory");
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

    // Memory dosyalarını yaz
    if (plan.archShort) {
      fs.writeFileSync(path.join(memDir, "ARCH_SHORT.md"), plan.archShort, "utf8");
    }
    if (plan.decisions) {
      fs.writeFileSync(path.join(memDir, "DECISIONS.md"), plan.decisions, "utf8");
    }
    if (plan.nowUpdate) {
      fs.writeFileSync(path.join(memDir, "NOW.md"), plan.nowUpdate, "utf8");
    }

    // Geçici ID → gerçek DB ID haritası
    const idMap = new Map<string, number>();
    const createdTaskIds: number[] = [];

    for (const planned of plan.tasks) {
      // Bağımlılıkları çöz
      const depIds = planned.deps
        .map((d) => idMap.get(d))
        .filter((id): id is number => id !== undefined);

      const task = createTask({
        projectId: project.id,
        roleId: planned.role,
        title: planned.title,
        description: planned.title, // PM planında title = description
        complexity: planned.complexity,
        dependencyIds: depIds
      });

      idMap.set(planned.tempId, task.id);
      createdTaskIds.push(task.id);
    }

    // Plan taslağını onayla
    updatePlanDraftStatus(project.id, "approved");

    // Projeyi gelistirme fazına geçir
    updateProject(project.id, { phase: "gelistirme" });

    return { createdTaskIds };
  }
}
