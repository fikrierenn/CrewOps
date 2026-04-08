// OutputParser
// Claude Code çıktısını sıkı bir sözleşmeye göre parse eder.
// Beklenen format /templates/output_contract.md altında tanımlıdır.

import type { ParsedOutput } from "@shared/index";

// Çıktıyı SUMMARY / FILES_CHANGED / PATCH / NEXT / RISKS bölümlerine ayırır.
// Hata durumunda açıklayıcı bir mesaj döndürür.
export class OutputParser {
  static parse(raw: string): { ok: true; value: ParsedOutput } | { ok: false; error: string } {
    try {
      const sections = splitSections(raw);
      const summaryLines = normalizeBulletList(sections["SUMMARY"]);
      const filesChangedLines = normalizeBulletList(sections["FILES_CHANGED"]);
      const nextLines = normalizeBulletList(sections["NEXT"]);
      const risksLines = normalizeBulletList(sections["RISKS"]);

      const patchBlock = extractPatchBlock(sections["PATCH"], raw);
      const commandsToRun = normalizeBulletList(sections["COMMANDS_TO_RUN_MANUALLY"]).filter(Boolean);

      const parsed: ParsedOutput = {
        summary: summaryLines,
        filesChanged: filesChangedLines,
        patch: patchBlock,
        next: nextLines,
        risks: risksLines,
        commandsToRun
      };

      return { ok: true, value: parsed };
    } catch (err: any) {
      return {
        ok: false,
        error: `Çıktı sözleşmesine uyumsuzluk: ${err?.message ?? String(err)}`
      };
    }
  }
}

// Yardımcı: ham metni başlıklara göre parçalar (COMMANDS_TO_RUN_MANUALLY opsiyonel)
const SECTION_HEADERS = ["SUMMARY", "FILES_CHANGED", "PATCH", "NEXT", "RISKS", "COMMANDS_TO_RUN_MANUALLY"] as const;

/** Markdown ``` code block wrapper'larını temizle (dış katman) */
function stripOuterCodeBlocks(raw: string): string {
  return raw.replace(/^```[\w]*\n?([\s\S]*?)```\s*$/gm, "$1");
}

/** Bölüm başlığını tanı — hem strict hem markdown heading hem bold formatını destekle */
function matchOutputHeader(line: string): string | null {
  const trimmed = line.trim();
  // Strict: "SUMMARY:" veya "PATCH:"
  const strictMatch = /^([A-Z_]+):\s*$/.exec(trimmed);
  if (strictMatch && SECTION_HEADERS.includes(strictMatch[1] as any)) return strictMatch[1];
  // Markdown heading: "## SUMMARY:" veya "# PATCH:"
  const mdMatch = /^#{1,3}\s*([A-Z_]+):?\s*$/.exec(trimmed);
  if (mdMatch && SECTION_HEADERS.includes(mdMatch[1] as any)) return mdMatch[1];
  // Bold: "**SUMMARY:**"
  const boldMatch = /^\*{2}([A-Z_]+)\*{2}:?\s*$/.exec(trimmed);
  if (boldMatch && SECTION_HEADERS.includes(boldMatch[1] as any)) return boldMatch[1];
  return null;
}

function splitSections(raw: string): Record<string, string> {
  // Dış markdown code block'ları temizle
  const cleaned = stripOuterCodeBlocks(raw);
  const lines = cleaned.split(/\r?\n/);
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    const header = matchOutputHeader(line);
    if (header) {
      current = header;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }

  // SUMMARY yoksa tüm çıktıdan kurtarmaya çalış
  if (!sections["SUMMARY"]) {
    // Ham çıktıda diff varsa PATCH var demektir, SUMMARY'yi baştan al
    const diffIdx = lines.findIndex(l => l.includes("--- ") || l.includes("diff --git"));
    if (diffIdx > 0) {
      sections["SUMMARY"] = lines.slice(0, Math.min(diffIdx, 10));
    } else {
      throw new Error("Bölüm eksik: SUMMARY:");
    }
  }

  // PATCH yoksa ham çıktıda diff ara
  if (!sections["PATCH"]) {
    const fullText = cleaned;
    if (fullText.includes("diff --git") || (fullText.includes("--- ") && fullText.includes("+++ "))) {
      const startIdx = Math.max(fullText.indexOf("diff --git"), 0) ||
        Math.min(
          fullText.indexOf("--- ") >= 0 ? fullText.indexOf("--- ") : Infinity,
          fullText.indexOf("+++ ") >= 0 ? fullText.indexOf("+++ ") : Infinity
        );
      if (startIdx < Infinity) {
        sections["PATCH"] = [fullText.slice(startIdx)];
      }
    }
    if (!sections["PATCH"]) sections["PATCH"] = [];
  }

  // Opsiyonel bölümler yoksa boş bırak
  for (const header of ["FILES_CHANGED", "NEXT", "RISKS", "COMMANDS_TO_RUN_MANUALLY"]) {
    if (!sections[header]) sections[header] = [];
  }

  const result: Record<string, string> = {};
  for (const key of Object.keys(sections)) {
    result[key] = sections[key].join("\n");
  }
  return result;
}

// Bullet list satırlarını normalize eder (başındaki tireleri ve boşlukları temizler)
function normalizeBulletList(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !!l)
    .map((l) => {
      // Başında "-" varsa kaldır
      if (l.startsWith("-")) {
        return l.replace(/^-+\s*/, "").trim();
      }
      return l;
    });
}

// PATCH bölümünden ```diff veya ``` bloğunu çıkarır; yoksa ham çıktıda diff aranır
function extractPatchBlock(block: string, fullRaw: string): string {
  // Boş PATCH bölümü — patch yok, bu kabul edilebilir
  if (!block.trim()) return "";

  const lines = block.split(/\r?\n/);
  // 1) ```diff ... ``` içindeki diff
  const codeFenceStart = lines.findIndex((l) => /^```\s*diff?\s*$/.test(l.trim()));
  if (codeFenceStart >= 0) {
    const endSearchIdx = lines.slice(codeFenceStart + 1).findIndex((l) => l.trim() === "```");
    const endIndex = endSearchIdx >= 0 ? endSearchIdx + codeFenceStart + 1 : -1;
    if (endIndex > codeFenceStart) {
      const joined = lines.slice(codeFenceStart + 1, endIndex).join("\n");
      if (joined.trim() && (joined.includes("diff --git") || joined.includes("--- ") || joined.includes("+++ "))) return joined;
    }
    // Kapanmamış code fence — truncated çıktı, fence'den sonraki her şeyi al
    if (endIndex <= codeFenceStart) {
      const joined = lines.slice(codeFenceStart + 1).filter((l) => l.trim() !== "```").join("\n");
      if (joined.trim() && (joined.includes("--- ") || joined.includes("+++ "))) return joined;
    }
  }
  // 2) PATCH bölümünde ``` ile başlayan herhangi bir blok
  const anyFence = lines.findIndex((l) => l.trim().startsWith("```"));
  if (anyFence >= 0) {
    const endSearchIdx = lines.slice(anyFence + 1).findIndex((l) => l.trim() === "```");
    const endIdx = endSearchIdx >= 0 ? endSearchIdx + anyFence + 1 : -1;
    if (endIdx > anyFence) {
      const joined = lines.slice(anyFence + 1, endIdx).join("\n");
      if (joined.trim() && (joined.includes("--- ") || joined.includes("+++ "))) return joined;
    }
    // Kapanmamış — truncated
    if (endIdx <= anyFence) {
      const joined = lines.slice(anyFence + 1).filter((l) => l.trim() !== "```").join("\n");
      if (joined.trim() && (joined.includes("--- ") || joined.includes("+++ "))) return joined;
    }
  }
  // 3) PATCH bölümünde doğrudan diff --git veya ---/+++ varsa
  if (block.includes("diff --git") || (block.includes("--- ") && block.includes("+++ "))) {
    const gitIdx = block.indexOf("diff --git");
    const minusIdx = block.indexOf("--- ");
    const plusIdx = block.indexOf("+++ ");
    const start = gitIdx >= 0 ? gitIdx : (minusIdx >= 0 && plusIdx >= 0 ? Math.min(minusIdx, plusIdx) : minusIdx >= 0 ? minusIdx : plusIdx);
    if (start >= 0) {
      const rest = block.slice(start).split(/\n/).filter((l) => !/^```\s*$/.test(l.trim())).join("\n");
      if (rest.trim()) return rest;
    }
  }
  // 4) Tüm ham çıktıda diff --git ara
  if (fullRaw.includes("diff --git")) {
    const idx = fullRaw.indexOf("diff --git");
    let rest = fullRaw.slice(idx);
    const nextHeader = rest.match(/\n[A-Z_]+:\s*$/m);
    if (nextHeader) rest = rest.slice(0, rest.indexOf(nextHeader[0]));
    if (rest.trim()) return rest.trim();
  }
  // 5) Hiç diff içeriği yok — boş patch döndür (hata fırlatma)
  return "";
}

