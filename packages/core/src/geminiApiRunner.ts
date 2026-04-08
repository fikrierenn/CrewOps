// GeminiApiRunner
// Gemini API'yi dogrudan HTTP ile cagiran runner.
// CLI gerektirmez — sadece GEMINI_API_KEY ortam degiskeni gerekir.
// SSL proxy/antivirus sorunlarini asmak icin https.request kullanir (rejectUnauthorized destegi).

import type { ClaudeRunOptions, ClaudeRunResult, RunStreamCallback } from "./claudeCodeRunner";
import { ClaudeCodeRunner } from "./claudeCodeRunner";
import * as https from "https";
import * as fs from "fs";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ortam degiskeni tanimli degil");
  return key;
}

/** Model mapping: CrewOps model isimleri -> Gemini model isimleri */
function resolveModel(raw: string): string {
  const map: Record<string, string> = {
    // CrewOps varsayilan isimleri
    "claude-code-simple": "gemini-2.5-flash",
    "claude-code-medium": "gemini-2.5-flash",
    "claude-code-advanced": "gemini-2.5-pro",
    // Eski model isimleri -> guncel karsiliklari
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-3.0-flash": "gemini-3-flash-preview",
    "gemini-3.0-pro": "gemini-3-pro-preview",
    // Gemini prefix'li isimler
    "inherit": DEFAULT_MODEL,
  };
  // "gemini:" prefix'ini kir
  const cleaned = raw.startsWith("gemini:") ? raw.slice(7) : raw;
  return map[cleaned] ?? map[raw] ?? (cleaned || DEFAULT_MODEL);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
}

/** HTTPS POST yapan yardimci — kurumsal proxy/antivirus SSL sorunlarini asar */
function httpsPost(url: string, body: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      // Kurumsal ortamlarda self-signed certificate sorununu asmak icin
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0" ? true : false
    };

    // Eger NODE_TLS_REJECT_UNAUTHORIZED ayarlanmamissa ve ortam kurumsal ise
    // fallback olarak false deneyelim
    if (process.env.GEMINI_SKIP_SSL === "1") {
      options.rejectUnauthorized = false;
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 500,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });

    req.on("error", (err) => {
      // SSL hatasi ise otomatik olarak rejectUnauthorized=false ile tekrar dene
      if (
        !options.rejectUnauthorized === false &&
        (err.message.includes("self-signed") ||
         err.message.includes("certificate") ||
         err.message.includes("UNABLE_TO_VERIFY"))
      ) {
        console.warn("[GeminiAPI] SSL hatasi tespit edildi, rejectUnauthorized=false ile tekrar deneniyor...");
        const retryOptions = { ...options, rejectUnauthorized: false };
        const retryReq = https.request(retryOptions, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 500,
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
        });
        retryReq.on("error", reject);
        retryReq.write(body);
        retryReq.end();
        return;
      }
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

export class GeminiApiRunner {
  static async run(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
    return this.runWithStream(options, () => {});
  }

  static async runWithStream(
    options: ClaudeRunOptions,
    onChunk: RunStreamCallback
  ): Promise<ClaudeRunResult> {
    const apiKey = getApiKey();
    const rawModel =
      options.roleConfig.defaultModelPolicy[options.complexity] ??
      options.roleConfig.defaultModelPolicy.simple;
    const model = resolveModel(rawModel);

    // Prompt'u Claude runner ile ayni sekilde olustur
    const { promptPath } = ClaudeCodeRunner.prepareRun(options);
    const prompt = fs.readFileSync(promptPath, "utf8");

    // Temp dosyayi temizle
    try { fs.unlinkSync(promptPath); } catch {}

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.3
      }
    });

    console.log(`[GeminiAPI] Model: ${model}, Prompt uzunlugu: ${prompt.length} karakter`);

    try {
      let response = await httpsPost(url, requestBody);

      // 429 (quota) veya 404 (model yok) → flash'a fallback dene
      if ((response.statusCode === 429 || response.statusCode === 404) && model !== DEFAULT_MODEL) {
        console.warn(`[GeminiAPI] ${model} basarisiz (${response.statusCode}), ${DEFAULT_MODEL}'a fallback yapiliyor...`);
        const fallbackUrl = `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;
        response = await httpsPost(fallbackUrl, requestBody);
      }

      if (response.statusCode !== 200) {
        const errMsg = `Gemini API HTTP ${response.statusCode}: ${response.body.slice(0, 500)}`;
        console.error(`[GeminiAPI] ${errMsg}`);
        onChunk("stderr", errMsg);
        return {
          exitCode: 1,
          stdout: "",
          stderr: errMsg,
          command: `gemini-api ${model}`
        };
      }

      const data: GeminiResponse = JSON.parse(response.body);

      if (data.error) {
        const errMsg = `Gemini API hatasi: ${data.error.message ?? "Bilinmeyen hata"} (${data.error.code ?? response.statusCode})`;
        console.error(`[GeminiAPI] ${errMsg}`);
        onChunk("stderr", errMsg);
        return {
          exitCode: 1,
          stdout: "",
          stderr: errMsg,
          command: `gemini-api ${model}`
        };
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      if (!text) {
        const finishReason = data.candidates?.[0]?.finishReason ?? "UNKNOWN";
        console.warn(`[GeminiAPI] Bos yanit. finishReason: ${finishReason}, candidates: ${JSON.stringify(data.candidates?.length)}`);
      } else {
        console.log(`[GeminiAPI] Yanit alindi: ${text.length} karakter`);
      }

      onChunk("stdout", text);

      return {
        exitCode: 0,
        stdout: text,
        stderr: "",
        command: `gemini-api ${model}`
      };
    } catch (err: any) {
      const cause = err?.cause ? ` [cause: ${err.cause?.message ?? String(err.cause)}]` : "";
      const code = err?.code ? ` [code: ${err.code}]` : "";
      const errMsg = `Gemini API baglanti hatasi: ${err?.message ?? String(err)}${cause}${code}`;
      console.error(`[GeminiAPI] ${errMsg}`);
      onChunk("stderr", errMsg);
      return {
        exitCode: 1,
        stdout: "",
        stderr: errMsg,
        command: `gemini-api ${model}`
      };
    }
  }
}
