// PlanningOutputParser
// PM'in planlama çıktısını parse eder.
// Gemini dahil farklı LLM çıktı stillerini tolere eder.

import type { PlanningOutput, PlannedTask } from "@shared/index";

export class PlanningOutputParser {
  static parse(raw: string): { ok: true; value: PlanningOutput } | { ok: false; error: string } {
    try {
      // Markdown code block'larını temizle
      const cleaned = stripCodeBlocks(raw);

      const sections = splitPlanningSections(cleaned);

      const archShort = sections["ARCH_SHORT"] ?? "";
      const decisions = sections["DECISIONS"] ?? "";
      const nowUpdate = sections["NOW_UPDATE"] ?? "";
      const tasksRaw = sections["TASKS"] ?? "";

      const tasks = parseTaskLines(tasksRaw);

      return {
        ok: true,
        value: { archShort: archShort.trim(), decisions: decisions.trim(), nowUpdate: nowUpdate.trim(), tasks }
      };
    } catch (err: any) {
      return { ok: false, error: `Planlama çıktısı parse hatası: ${err?.message ?? String(err)}` };
    }
  }
}

const PLANNING_HEADERS = ["ARCH_SHORT", "DECISIONS", "NOW_UPDATE", "TASKS"] as const;

/** Markdown ``` code block wrapper'larını temizle */
function stripCodeBlocks(raw: string): string {
  // Tüm ```...``` bloklarının içini aç
  let result = raw.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");
  return result;
}

/** Bölüm başlıklarını tanıyan esnek regex */
function matchHeader(line: string): string | null {
  const trimmed = line.trim();
  // Strict: "TASKS:" veya "ARCH_SHORT:" (orijinal format)
  const strictMatch = /^([A-Z_]+):\s*$/.exec(trimmed);
  if (strictMatch && PLANNING_HEADERS.includes(strictMatch[1] as any)) {
    return strictMatch[1];
  }
  // Markdown heading: "## TASKS:" veya "# ARCH_SHORT:"
  const mdMatch = /^#{1,3}\s*([A-Z_]+):?\s*$/.exec(trimmed);
  if (mdMatch && PLANNING_HEADERS.includes(mdMatch[1] as any)) {
    return mdMatch[1];
  }
  // Bold: "**TASKS:**" veya "**TASKS**:"
  const boldMatch = /^\*{2}([A-Z_]+)\*{2}:?\s*$/.exec(trimmed);
  if (boldMatch && PLANNING_HEADERS.includes(boldMatch[1] as any)) {
    return boldMatch[1];
  }
  // İngilizce/Türkçe eşleştirme (Gemini/Claude bazen kendi başlıkları kullanır)
  const lower = trimmed.toLowerCase().replace(/[#*:]/g, "").trim();
  const aliases: Record<string, string> = {
    "arch_short": "ARCH_SHORT",
    "architecture": "ARCH_SHORT",
    "mimari": "ARCH_SHORT",
    "mimari ozet": "ARCH_SHORT",
    "mimari özet": "ARCH_SHORT",
    "decisions": "DECISIONS",
    "kararlar": "DECISIONS",
    "onemli kararlar": "DECISIONS",
    "önemli kararlar": "DECISIONS",
    "now_update": "NOW_UPDATE",
    "now update": "NOW_UPDATE",
    "now": "NOW_UPDATE",
    "tasks": "TASKS",
    "gorevler": "TASKS",
    "görevler": "TASKS",
    "gorev listesi": "TASKS",
    "görev listesi": "TASKS",
    "task listesi": "TASKS",
    "planlanan gorevler": "TASKS",
    "planlanan görevler": "TASKS",
    "is listesi": "TASKS",
    "iş listesi": "TASKS",
  };
  if (aliases[lower]) return aliases[lower];
  // Tek kelime "tasks" / "görevler" (başında # veya * kalmış olabilir)
  if (lower === "tasks" || lower === "görevler" || lower === "gorevler") return "TASKS";
  return null;
}

function splitPlanningSections(raw: string): Record<string, string> {
  const lines = raw.split(/\r?\n/);
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    const header = matchHeader(line);
    if (header) {
      current = header;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }

  // En az TASKS bölümü olmalı
  if (!sections["TASKS"]) {
    // 1) Tüm çıktıda görev satırı pattern'ı ara (id: T1, role:, title: vb.)
    const taskLinePattern = /(id:\s*T\d|role:\s*\w+.*title:|-\s*id:\s*T\d)/i;
    let taskLines = lines.filter(l => taskLinePattern.test(l));
    if (taskLines.length > 0) {
      sections["TASKS"] = taskLines;
    } else {
      // 2) "TASKS" / "Görevler" satırından sonraki liste satırlarını topla
      let inTaskBlock = false;
      const fallbackTaskLines: string[] = [];
      for (const line of lines) {
        const t = line.trim().toLowerCase();
        if (/^(tasks|görevler|gorevler|görev listesi|task listesi):?\s*$/i.test(t) || /^#+\s*(tasks|görevler)/i.test(t)) {
          inTaskBlock = true;
          continue;
        }
        if (inTaskBlock && (line.startsWith("-") || /^\d+\./.test(line) || /id:\s*T\d/i.test(line) || /role:/.test(line))) {
          fallbackTaskLines.push(line);
        } else if (inTaskBlock && line.trim() === "" && fallbackTaskLines.length > 0) {
          break;
        }
      }
      if (fallbackTaskLines.length > 0) {
        sections["TASKS"] = fallbackTaskLines;
      } else {
        // 3) Son çare: herhangi bir satırda "role:" veya "architect:" "backend:" vb. + açıklama varsa görev say
        const roleTitlePattern = /^[-*\d.]*\s*(pm|architect|backend|frontend|sql|qa|devops):\s*(.+)$/i;
        const anyRoleLines = lines.filter(l => roleTitlePattern.test(l.trim()));
        if (anyRoleLines.length > 0) {
          sections["TASKS"] = anyRoleLines;
        } else {
          throw new Error("TASKS bölümü bulunamadı");
        }
      }
    }
  }

  const result: Record<string, string> = {};
  for (const key of Object.keys(sections)) {
    result[key] = sections[key].join("\n");
  }
  return result;
}

function parseTaskLines(tasksBlock: string): PlannedTask[] {
  const lines = tasksBlock.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tasks: PlannedTask[] = [];

  for (const line of lines) {
    // Format 1: - id: T1, role: architect, title: "...", complexity: medium, deps: [T1, T2]
    const idMatch = /id:\s*(\w+)/.exec(line);
    const roleMatch = /role:\s*(\w+)/.exec(line);
    const titleMatch = /title:\s*"([^"]*)"/.exec(line) || /title:\s*([^,]+)/.exec(line);

    if (idMatch && roleMatch && titleMatch) {
      const complexityMatch = /complexity:\s*(\w+)/.exec(line);
      const depsMatch = /deps:\s*\[([^\]]*)\]/.exec(line);
      const deps = depsMatch?.[1]
        ? depsMatch[1].split(",").map((d) => d.trim()).filter(Boolean)
        : [];
      let complexity = (complexityMatch?.[1] ?? "medium") as PlannedTask["complexity"];
      if (!["simple", "medium", "complex"].includes(complexity)) complexity = "medium";
      const title = titleMatch[1].replace(/,\s*$/, "").trim();
      tasks.push({ tempId: idMatch[1], role: roleMatch[1], title, complexity, deps });
      continue;
    }

    // Format 2: "- architect: Proje yapısı kurulumu" veya "1. backend: API endpoint'leri" veya "architect: Proje yapısı"
    const simpleMatch = /^[-*\d.]*\s*(pm|architect|backend|frontend|sql|qa|devops):\s*(.+)$/i.exec(line);
    if (simpleMatch && simpleMatch[2].length > 2) {
      const role = simpleMatch[1].toLowerCase();
      const title = simpleMatch[2].replace(/,\s*$/, "").trim();
      tasks.push({
        tempId: `T${tasks.length + 1}`,
        role,
        title,
        complexity: "medium",
        deps: []
      });
    }
  }

  if (tasks.length === 0) {
    throw new Error("TASKS bölümünde hiç görev bulunamadı");
  }

  return tasks;
}
