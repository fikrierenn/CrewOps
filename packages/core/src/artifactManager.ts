// ArtifactManager
// Çalıştırma (run) çıktılarıyla ilgili tüm artefact dosyalarını ve DB kayıtlarını yönetir.
// Başarıyla biten görevlerin özeti proje klasöründe CREWOPS_COMPLETED.md dosyasına eklenir.

import * as fs from "fs";
import * as path from "path";
import { createArtifact } from "@db/index";
import type { Run, ParsedOutput } from "@shared/index";

const COMPLETED_LOG_FILENAME = "CREWOPS_COMPLETED.md";

export class ArtifactManager {
  constructor(private rootDir: string) {}

  /**
   * Başarıyla biten görevin özetini proje klasörüne CREWOPS_COMPLETED.md dosyasına ekler.
   * Böylece proje içinde hangi görevlerin ne zaman tamamlandığı dosyadan takip edilir.
   */
  appendCompletedRun(params: {
    projectRepoPath: string;
    run: Run;
    taskTitle: string;
    parsed: ParsedOutput | null;
  }): void {
    const { projectRepoPath, run, taskTitle, parsed } = params;
    if (run.status !== "success") return;

    const filePath = path.join(projectRepoPath, COMPLETED_LOG_FILENAME);
    const now = new Date().toISOString();
    const dateLabel = now.slice(0, 10);
    const summaryLines = parsed?.summary?.length ? parsed.summary.map((s) => `- ${s}`).join("\n") : "- (özet yok)";
    const filesLine = parsed?.filesChanged?.length
      ? `**Değişen dosyalar:** ${parsed.filesChanged.join(", ")}`
      : "";

    const block = [
      "",
      "---",
      `## ${dateLabel} – Run #${run.id} – Görev: ${taskTitle}`,
      "",
      `- **Run ID:** ${run.id} | **Task ID:** ${run.taskId} | **Rol:** ${run.roleId}`,
      `- **Özet:** ${run.summary || "(yok)"}`,
      "",
      "**Detay:**",
      summaryLines,
      filesLine ? `\n${filesLine}` : "",
      ""
    ].join("\n");

    try {
      if (fs.existsSync(filePath)) {
        fs.appendFileSync(filePath, block, "utf8");
      } else {
        const header = [
          "# CrewOps – Tamamlanan Görevler",
          "",
          "Bu dosya CrewOps tarafından otomatik güncellenir. Başarıyla biten her koşu aşağıya eklenir.",
          ""
        ].join("\n");
        fs.writeFileSync(filePath, header + block, "utf8");
      }
    } catch (_) {
      // Repo path yoksa veya yazma izni yoksa sessizce atla
    }
  }

  // Dosya sistemi altına log/raw/patch gibi artefact'ları yazar
  // ve aynı zamanda DB'ye kayıt açar.
  persistArtifacts(params: {
    run: Run;
    rawOutput: string;
    parsed: ParsedOutput | null;
    diffStat?: string;
  }) {
    const artifactsDir = path.join(
      this.rootDir,
      "artifacts",
      `project-${params.run.projectId}`,
      `task-${params.run.taskId}`,
      `run-${params.run.id}`
    );

    fs.mkdirSync(artifactsDir, { recursive: true });

    // Ham çıktı
    const rawPath = path.join(artifactsDir, "raw_output.txt");
    fs.writeFileSync(rawPath, params.rawOutput, "utf8");
    createArtifact({
      runId: params.run.id,
      kind: "raw_output",
      content: params.rawOutput
    });

    // Parse edilmiş çıktı
    if (params.parsed) {
      const parsedPath = path.join(artifactsDir, "parsed_output.json");
      fs.writeFileSync(parsedPath, JSON.stringify(params.parsed, null, 2), "utf8");
      createArtifact({
        runId: params.run.id,
        kind: "parsed_output",
        content: JSON.stringify(params.parsed)
      });

      // Patch
      if (params.parsed.patch && params.parsed.patch.trim().length > 0) {
        const patchPath = path.join(artifactsDir, "patch.diff");
        fs.writeFileSync(patchPath, params.parsed.patch, "utf8");
        createArtifact({
          runId: params.run.id,
          kind: "patch",
          content: params.parsed.patch
        });
      }
    }

    // Diff istatistiği
    if (params.diffStat) {
      const diffStatPath = path.join(artifactsDir, "diffstat.txt");
      fs.writeFileSync(diffStatPath, params.diffStat, "utf8");
      createArtifact({
        runId: params.run.id,
        kind: "diffstat",
        content: params.diffStat
      });
    }
  }
}

