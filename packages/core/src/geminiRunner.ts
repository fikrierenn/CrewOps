// GeminiRunner
// Gemini CLI'yi kullanarak aynı sözleşmeyle (SUMMARY / PATCH vb.) çıktı üretir.
// Amaç: ClaudeCodeRunner ile aynı ClaudeRunOptions tipini kullanarak
// sağlayıcıyı sadece komut satırı seviyesinde değiştirmek.

import { spawn } from "child_process";
import * as fs from "fs";
import {
  ClaudeCodeRunner,
  type ClaudeRunOptions,
  type ClaudeRunResult
} from "./claudeCodeRunner";

// Gemini tarafında ek olarak modelOverride verebilelim (gemini:... ayrımı için)
export interface GeminiRunOptions extends ClaudeRunOptions {
  modelOverride?: string;
}

export class GeminiRunner {
  /**
   * Basit kullanım: stream olmadan çalıştır.
   */
  static run(options: GeminiRunOptions): Promise<ClaudeRunResult> {
    return this.runWithStream(options, () => {});
  }

  /**
   * ClaudeCodeRunner ile aynı imza: stdout/stderr chunk'larını ileterek çalıştır.
   * Burada Claude ile aynı prompt'u üretmek için ClaudeCodeRunner.prepareRun kullanıyoruz,
   * sadece CLI komutu değişiyor (claude yerine gemini).
   */
  static runWithStream(
    options: GeminiRunOptions,
    onChunk: (source: "stdout" | "stderr", data: string) => void
  ): Promise<ClaudeRunResult> {
    return new Promise((resolve) => {
      // Model ismi LLMRunner tarafından "gemini:..." prefix'i kırpılarak gönderilir.
      const model =
        options.modelOverride ??
        options.roleConfig.defaultModelPolicy[options.complexity] ??
        options.roleConfig.defaultModelPolicy.simple;

      // Aynı prompt kompozisyonunu kullanmak için önce Claude tarafıyla prompt dosyasını oluştur.
      const { promptPath } = ClaudeCodeRunner.prepareRun(options as ClaudeRunOptions);
      const prompt = fs.readFileSync(promptPath, "utf8");

      // Kullanılacak Gemini CLI ikili adı:
      // - Varsayılan: "gemini"
      // - İstenirse GEMINI_CLI_BIN ile override edilebilir (örn. özel path).
      const cliBin = process.env.GEMINI_CLI_BIN || "gemini";

      // Gemini CLI dokümanına göre: stdin'den prompt verilebilir.
      // Örn: echo "..." | gemini --model MODEL
      const args = ["--model", model];

      const child = spawn(cliBin, args, {
        cwd: options.projectRepoPath,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"]
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

      // Prompt'u stdin'e yaz ve kapat
      child.stdin.write(prompt);
      child.stdin.end();

      child.on("close", (code) => {
        resolve({
          exitCode: code,
          stdout,
          stderr,
          command: `${cliBin} ${args.join(" ")}`
        });
      });

      child.on("error", (err) => {
        const msg = "[Gemini CLI çalıştırma hatası] " + (err as any)?.message;
        resolve({
          exitCode: null,
          stdout,
          stderr: stderr + "\n" + msg,
          command: `${cliBin} ${args.join(" ")}`
        });
      });
    });
  }
}

