// LLMRunner
// Saglayici bagimsiz tek giris noktasi:
// Oncelik sirasi:
// 1. GEMINI_API_KEY varsa → GeminiApiRunner (HTTP, CLI gerektirmez)
// 2. Model "gemini:" prefix'li → GeminiRunner (CLI)
// 3. Diger → ClaudeCodeRunner (CLI)

import {
  ClaudeCodeRunner,
  type ClaudeRunOptions,
  type ClaudeRunResult
} from "./claudeCodeRunner";
import { GeminiRunner, type GeminiRunOptions } from "./geminiRunner";
import { GeminiApiRunner } from "./geminiApiRunner";

function isGeminiModel(model: string): boolean {
  return model.startsWith("gemini:");
}

function extractGeminiModel(model: string): string {
  return model.startsWith("gemini:") ? model.slice("gemini:".length) : model;
}

function hasGeminiApiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function hasClaudeCli(): boolean {
  return !!process.env.CLAUDE_CLI_BIN || !!process.env.CLAUDE_CODE_BIN;
}

export class LLMRunner {
  static run(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
    return this.runWithStream(options, () => {});
  }

  static runWithStream(
    options: ClaudeRunOptions,
    onChunk: (source: "stdout" | "stderr", data: string) => void
  ): Promise<ClaudeRunResult> {
    const model =
      options.roleConfig.defaultModelPolicy[options.complexity] ??
      options.roleConfig.defaultModelPolicy.simple;

    // 1. GEMINI_API_KEY varsa her zaman Gemini API kullan (CLI gerektirmez)
    if (hasGeminiApiKey()) {
      return GeminiApiRunner.runWithStream(options, onChunk);
    }

    // 2. Model "gemini:" prefix'li ise Gemini CLI dene
    if (isGeminiModel(model)) {
      const geminiOptions: GeminiRunOptions = {
        ...options,
        modelOverride: extractGeminiModel(model)
      };
      return GeminiRunner.runWithStream(geminiOptions, onChunk);
    }

    // 3. Claude CLI
    return ClaudeCodeRunner.runWithStream(options, onChunk);
  }
}
