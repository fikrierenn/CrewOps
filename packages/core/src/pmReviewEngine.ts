// PmReviewEngine
// Tamamlanan görev çıktılarını PM gözünden review eder.

import * as fs from "fs";
import * as path from "path";
import { LLMRunner } from "./llmRunner";
import { RoleRegistry } from "./roleRegistry";
import { MemoryEngine } from "./memoryEngine";
import type { Project, Task, ParsedOutput } from "@shared/index";

export interface ReviewResult {
  decision: 'approve' | 'revise' | 'escalate';
  reasoning: string;
  feedback?: string;
}

export class PmReviewEngine {
  static async review(input: {
    rootDir: string;
    project: Project;
    task: Task;
    runResult: ParsedOutput;
    mutabakatDocument: string;
  }): Promise<ReviewResult> {
    const { rootDir, project, task, runResult, mutabakatDocument } = input;

    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    const pmRole = roleRegistry.getRoleConfig("pm");
    if (!pmRole) throw new Error("PM rol tanımı bulunamadı");

    const reviewContract = fs.readFileSync(
      path.join(rootDir, "templates", "pm_review_contract.md"),
      "utf8"
    );

    const prompt = [
      `# PM Review Görevi`,
      ``,
      `## Proje`,
      `Ad: ${project.name}`,
      `Stack: ${project.stack}`,
      ``,
      `## Mutabakat Belgesi`,
      mutabakatDocument || "(Yok)",
      ``,
      `## Değerlendirilen Görev`,
      `Başlık: ${task.title}`,
      `Açıklama: ${task.description}`,
      `Rol: ${task.roleId}`,
      `Karmaşıklık: ${task.complexity}`,
      ``,
      `## Görev Çıktısı`,
      `### Özet`,
      runResult.summary.join("\n"),
      `### Değişen Dosyalar`,
      runResult.filesChanged.join("\n") || "(Yok)",
      `### Patch`,
      runResult.patch ? "```diff\n" + runResult.patch + "\n```" : "(Boş)",
      `### Riskler`,
      runResult.risks.join("\n") || "(Yok)",
      ``,
      `## Review Sözleşmesi`,
      reviewContract,
      ``,
      `## Talimat`,
      `Yukarıdaki review sözleşmesine uygun formatta çıktı üret.`,
      `Sadece DECISION, REASONING ve FEEDBACK satırlarını yaz.`,
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
      complexity: "simple",
      memory,
      outputContractTemplate: "",
      taskContractTemplate: ""
    });

    return parseReviewOutput(result.stdout);
  }
}

function parseReviewOutput(raw: string): ReviewResult {
  const lines = raw.split(/\r?\n/);

  let decision: ReviewResult["decision"] = "approve";
  let reasoning = "";
  let feedback: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DECISION:")) {
      const val = trimmed.replace("DECISION:", "").trim().toLowerCase();
      if (val === "revise" || val === "escalate" || val === "approve") {
        decision = val;
      }
    } else if (trimmed.startsWith("REASONING:")) {
      reasoning = trimmed.replace("REASONING:", "").trim();
    } else if (trimmed.startsWith("FEEDBACK:")) {
      feedback = trimmed.replace("FEEDBACK:", "").trim();
    }
  }

  return { decision, reasoning, feedback: feedback || undefined };
}
