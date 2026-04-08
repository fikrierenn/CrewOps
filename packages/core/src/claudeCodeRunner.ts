// ClaudeCodeRunner
// Claude Code CLI'yi child_process ile çalıştırır ve çıktıları toplar.

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import type { MemoryContent } from "./memoryEngine";
import type { RoleConfig } from "./roleRegistry";

export interface ClaudeRunOptions {
  rootDir: string;
  projectRepoPath: string;
  roleConfig: RoleConfig;
  taskDescription: string;
  complexity: "simple" | "medium" | "complex";
  memory: MemoryContent;
  outputContractTemplate: string;
  taskContractTemplate: string;
}

export interface ClaudeRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  command: string;
}

/** Çalışma sırasında her stdout/stderr parçası için çağrılır (gömülü terminal / canlı log için) */
export type RunStreamCallback = (source: "stdout" | "stderr", data: string) => void;

// Guarded Mode: Burada sadece Claude CLI'yi çalıştırıyoruz, patch uygulama yok.
export class ClaudeCodeRunner {
  /**
   * Prompt dosyasını oluşturur; terminalde çalıştırma için yol ve model döner.
   */
  static prepareRun(options: ClaudeRunOptions): { promptPath: string; model: string } {
    const model =
      options.roleConfig.defaultModelPolicy[options.complexity] ??
      options.roleConfig.defaultModelPolicy.simple;
    const tmpDir = path.join(options.rootDir, ".tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const promptPath = path.join(
      tmpDir,
      `claude_prompt_${Date.now()}_${Math.random().toString(16).slice(2)}.md`
    );
    fs.writeFileSync(promptPath, buildPrompt(options), "utf8");
    return { promptPath, model };
  }

  /**
   * Aynı run mantığı; ek olarak her stdout/stderr chunk'ı onChunk ile bildirir.
   * Web arayüzünde gömülü terminal çıktısı için kullanılır.
   */
  static runWithStream(
    options: ClaudeRunOptions,
    onChunk: RunStreamCallback
  ): Promise<ClaudeRunResult> {
    return new Promise((resolve) => {
      const model =
        options.roleConfig.defaultModelPolicy[options.complexity] ??
        options.roleConfig.defaultModelPolicy.simple;

      const tmpDir = path.join(options.rootDir, ".tmp");
      fs.mkdirSync(tmpDir, { recursive: true });
      const promptPath = path.join(
        tmpDir,
        `claude_prompt_${Date.now()}_${Math.random().toString(16).slice(2)}.md`
      );
      const composedPrompt = buildPrompt(options);
      fs.writeFileSync(promptPath, composedPrompt, "utf8");

      const cliBin =
        process.env.CLAUDE_CLI_BIN ||
        process.env.CLAUDE_CODE_BIN ||
        "claude";
      const args = [
        "run",
        "--model",
        model,
        "--file",
        promptPath,
        "--cwd",
        options.projectRepoPath
      ];

      const child = spawn(cliBin, args, {
        cwd: options.projectRepoPath,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        const s = chunk.toString();
        stdout += s;
        onChunk("stdout", s);
      });
      child.stderr.on("data", (chunk) => {
        const s = chunk.toString();
        stderr += s;
        onChunk("stderr", s);
      });

      child.on("close", (code) => {
        resolve({
          exitCode: code,
          stdout,
          stderr,
          command: `${cliBin} ${args.join(" ")}`
        });
      });

      child.on("error", (err) => {
        resolve({
          exitCode: null,
          stdout,
          stderr:
            stderr +
            "\n[Claude CLI çalıştırma hatası] " +
            (err as any)?.message,
          command: `${cliBin} ${args.join(" ")}`
        });
      });
    });
  }

  /** Claude için prompt oluşturup CLI'yi çalıştırır (TUI / senkron kullanım) */
  static run(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
    return this.runWithStream(options, () => {});
  }
}

// Prompt kompozisyonu
function buildPrompt(opts: ClaudeRunOptions): string {
  // Burada amaç: rol tanımı, görev, hafıza ve sözleşme şablonlarını tek bir metinde birleştirmek
  // ve özellikle SIKİ ÇIKTI SÖZLEŞMESİNİ vurgulamak.

  return [
    `# AI Team Orchestrator Görev Çalıştırma`,
    ``,
    `## Rol`,
    `ID: ${opts.roleConfig.roleId}`,
    `Ad: ${opts.roleConfig.displayName}`,
    `Avatar: ${opts.roleConfig.avatar}`,
    ``,
    `Yetenekler:`,
    ...opts.roleConfig.skills.map((s) => `- ${s}`),
    ``,
    `Çalışma Tarzı:`,
    opts.roleConfig.workStyle,
    ``,
    `Definition of Done:`,
    ...opts.roleConfig.definitionOfDone.map((d) => `- ${d}`),
    ``,
    `## Görev`,
    opts.taskDescription,
    ``,
    `## Zorunlu Hafıza`,
    `Aşağıdaki üç hafıza dosyası her koşumu için zorunlu girdidir:`,
    ``,
    `### NOW.md`,
    "```md",
    opts.memory.now.trim(),
    "```",
    ``,
    `### DECISIONS.md`,
    "```md",
    opts.memory.decisions.trim(),
    "```",
    ``,
    `### ARCH_SHORT.md`,
    "```md",
    opts.memory.archShort.trim(),
    "```",
    ``,
    `## Görev Sözleşmesi (Task Contract)`,
    opts.taskContractTemplate.trim(),
    ``,
    `## Çıktı Sözleşmesi (Output Contract) - MUTLAKA AYNEN UY`,
    opts.outputContractTemplate.trim(),
    ``,
    `- Çıktın kesinlikle yukarıdaki sözleşme ile BİREBİR uyumlu olmalı.`,
    `- Ek serbest metin, açıklama veya başka bölüm EKLEME.`,
    `- Özellikle PATCH bölümünde mutlaka "PATCH:" başlığı ve altında boş bile olsa \`\`\`diff\` kod bloğu bulunmalı.`,
    `- Bu kurallar, orchestrator içinde katı bir parser tarafından denetlenmektedir.`
  ].join("\n");
}

