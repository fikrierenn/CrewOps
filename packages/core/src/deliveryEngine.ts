// DeliveryEngine
// Proje tamamlama ve teslim raporu üretimi.

import * as fs from "fs";
import * as path from "path";
import { LLMRunner } from "./llmRunner";
import { RoleRegistry } from "./roleRegistry";
import { MemoryEngine } from "./memoryEngine";
import {
  getProjectById, listTasksByProject, listRunsByProject,
  getCostSummary, updateProject
} from "@db/index";
import type { Project, Task, Run, DeliveryReport } from "@shared/index";

export class DeliveryEngine {
  static async generateReport(
    rootDir: string,
    project: Project,
    tasks: Task[],
    runs: Run[]
  ): Promise<DeliveryReport> {
    const completedTasks = tasks
      .filter((t) => t.status === "completed")
      .map((t) => {
        const taskRuns = runs.filter((r) => r.taskId === t.id && r.status === "success");
        const lastRun = taskRuns[0];
        return {
          id: t.id,
          title: t.title,
          role: t.roleId,
          summary: lastRun?.summary || "Özet yok"
        };
      });

    const failedTasks = tasks.filter((t) => t.status === "failed");
    const knownIssues = failedTasks.map((t) => `Görev #${t.id} (${t.title}) başarısız oldu`);

    const costSummary = getCostSummary(project.id);

    // PM'den final değerlendirme al
    let projectSummary = `${project.name} projesi tamamlandı. ${completedTasks.length}/${tasks.length} görev başarıyla tamamlandı.`;

    try {
      const roleRegistry = new RoleRegistry(rootDir);
      roleRegistry.loadRolesFromTemplates();
      const pmRole = roleRegistry.getRoleConfig("pm");

      if (pmRole) {
        const prompt = [
          `# Proje Teslim Değerlendirmesi`,
          ``,
          `Proje: ${project.name}`,
          `Stack: ${project.stack}`,
          ``,
          `## Tamamlanan Görevler`,
          ...completedTasks.map((t) => `- ${t.title} (${t.role}): ${t.summary}`),
          ``,
          `## Başarısız Görevler`,
          failedTasks.length > 0
            ? failedTasks.map((t) => `- ${t.title}`).join("\n")
            : "(Yok)",
          ``,
          `## Talimat`,
          `Projenin genel durumunu 3-5 cümleyle özetle. Türkçe yaz.`,
        ].join("\n");

        const memoryEngine = new MemoryEngine(rootDir);
        let memory = { now: "", decisions: "", archShort: "" };
        try { if (memoryEngine.validatePresence().ok) memory = memoryEngine.load(); } catch {}

        const result = await LLMRunner.run({
          rootDir,
          projectRepoPath: project.repoPath,
          roleConfig: pmRole,
          taskDescription: prompt,
          complexity: "simple",
          memory,
          outputContractTemplate: "",
          taskContractTemplate: ""
        });

        if (result.stdout.trim()) {
          projectSummary = result.stdout.trim();
        }
      }
    } catch {}

    return {
      projectSummary,
      completedTasks,
      knownIssues,
      testInstructions: [
        "Projeyi klonlayın ve bağımlılıkları yükleyin",
        "Geliştirme sunucusunu başlatın",
        "Temel akışları test edin"
      ],
      totalCostUsd: costSummary.totalCostUsd,
      totalTokens: costSummary.totalTokens
    };
  }

  static async deliver(
    rootDir: string,
    projectId: number,
    report: DeliveryReport
  ): Promise<void> {
    // DELIVERY.md yaz
    const memDir = path.join(rootDir, "memory");
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

    const deliveryContent = [
      `# Teslim Raporu`,
      ``,
      `## Proje Özeti`,
      report.projectSummary,
      ``,
      `## Tamamlanan Görevler`,
      ...report.completedTasks.map((t) => `- **${t.title}** (${t.role}): ${t.summary}`),
      ``,
      `## Bilinen Sorunlar`,
      report.knownIssues.length > 0
        ? report.knownIssues.map((i) => `- ${i}`).join("\n")
        : "- Bilinen sorun yok",
      ``,
      `## Test Talimatları`,
      ...report.testInstructions.map((t, i) => `${i + 1}. ${t}`),
      ``,
      `## Maliyet Özeti`,
      `- Toplam token: ${report.totalTokens.toLocaleString()}`,
      `- Toplam maliyet: $${report.totalCostUsd.toFixed(4)}`,
    ].join("\n");

    fs.writeFileSync(path.join(memDir, "DELIVERY.md"), deliveryContent, "utf8");

    // Projeyi teslim fazına geçir
    updateProject(projectId, { phase: "teslim_edildi" });
  }
}
