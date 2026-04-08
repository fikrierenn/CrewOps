// PatchApplier
// Git patch'lerini uygular; git yoksa veya apply başarısızsa diff'i dosya sistemine manuel yazar.

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export class PatchApplier {
  static async apply(params: {
    repoPath: string;
    patchContent: string;
    taskId: number;
    taskTitle: string;
    autoCommit: boolean;
  }): Promise<{ success: boolean; filesAffected: string[]; error?: string }> {
    const { repoPath, patchContent, taskId, taskTitle, autoCommit } = params;

    if (!patchContent || !patchContent.trim()) {
      return { success: true, filesAffected: [] };
    }

    const root = path.resolve(repoPath);
    if (!fs.existsSync(root)) {
      return { success: false, filesAffected: [], error: "Proje klasörü yok: " + root };
    }

    const tmpDir = path.join(root, ".tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const patchPath = path.join(tmpDir, `patch_task_${taskId}_${Date.now()}.diff`);
    fs.writeFileSync(patchPath, patchContent, "utf8");

    // 1) Önce git apply dene (repo git ise ve patch uyumluysa)
    const gitResult = await tryGitApply(root, patchPath, autoCommit, taskId, taskTitle);
    try { fs.unlinkSync(patchPath); } catch {}
    if (gitResult.success) return gitResult;

    // 2) Fallback: diff'i parse edip dosyalara yaz (yeni dosyalar + mevcut dosya düzenlemeleri)
    const fsResult = applyPatchToFilesystem(root, patchContent);
    if (fsResult.filesAffected.length > 0) {
      if (autoCommit && isGitRepo(root)) {
        await runGit(root, ["add", "-A"]);
        await runGit(root, ["commit", "-m", `[CrewOps] Task #${taskId}: ${taskTitle}`]);
      }
      return { success: true, filesAffected: fsResult.filesAffected };
    }
    return {
      success: false,
      filesAffected: [],
      error: (gitResult.error || "") + (fsResult.error ? " Fallback: " + fsResult.error : "")
    };
  }
}

async function tryGitApply(
  repoPath: string,
  patchPath: string,
  autoCommit: boolean,
  taskId: number,
  taskTitle: string
): Promise<{ success: boolean; filesAffected: string[]; error?: string }> {
  if (!isGitRepo(repoPath)) return { success: false, filesAffected: [], error: "Git repo değil" };
  const checkResult = await runGit(repoPath, ["apply", "--check", patchPath]);
  if (checkResult.exitCode !== 0) {
    return { success: false, filesAffected: [], error: checkResult.stderr?.trim() || "git apply --check başarısız" };
  }
  const applyResult = await runGit(repoPath, ["apply", patchPath]);
  if (applyResult.exitCode !== 0) {
    return { success: false, filesAffected: [], error: applyResult.stderr?.trim() || "git apply başarısız" };
  }
  const statResult = await runGit(repoPath, ["apply", "--stat", patchPath]);
  const filesAffected = statResult.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l.includes("|"))
    .map((l) => l.split("|")[0].trim());
  if (autoCommit) {
    await runGit(repoPath, ["add", "-A"]);
    await runGit(repoPath, ["commit", "-m", `[CrewOps] Task #${taskId}: ${taskTitle}`]);
  }
  return { success: true, filesAffected };
}

function isGitRepo(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, ".git"));
  } catch {
    return false;
  }
}

/**
 * Unified diff'i parse edip dosyalara yazar.
 * Desteklenen formatlar:
 * 1) "diff --git a/file b/file" (standard git diff)
 * 2) "--- a/file" / "+++ b/file" çiftleri (Gemini/LLM formatı)
 * Hem yeni dosyalar hem mevcut dosya düzenlemeleri desteklenir.
 */
function applyPatchToFilesystem(
  repoPath: string,
  patchContent: string
): { filesAffected: string[]; error?: string } {
  const filesAffected: string[] = [];
  const root = path.resolve(repoPath);

  // Dosya bloklarını ayır
  const fileBlocks = splitIntoFileBlocks(patchContent);

  for (const block of fileBlocks) {
    const fullPath = path.join(root, block.filePath);
    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (block.isNewFile || !fs.existsSync(fullPath)) {
        // Yeni dosya: sadece + satırlarını yaz
        fs.writeFileSync(fullPath, block.addedLines.join("\n"), "utf8");
        filesAffected.push(block.filePath);
      } else {
        // Mevcut dosya düzenlemesi: hunk'ları uygulamaya çalış
        const existing = fs.readFileSync(fullPath, "utf8");
        const patched = applyHunks(existing, block.hunks);
        if (patched !== null && patched !== existing) {
          fs.writeFileSync(fullPath, patched, "utf8");
          filesAffected.push(block.filePath);
        } else if (block.addedLines.length > 0) {
          // Hunk uygulama başarısızsa, tüm + satırlarını yaz (son çare)
          fs.writeFileSync(fullPath, block.addedLines.join("\n"), "utf8");
          filesAffected.push(block.filePath);
        }
      }
    } catch (e) {
      return { filesAffected, error: `${block.filePath}: ${(e as Error).message}` };
    }
  }
  return { filesAffected };
}

interface FileBlock {
  filePath: string;
  isNewFile: boolean;
  addedLines: string[];  // Sadece + satırları (leading + kaldırılmış)
  hunks: Hunk[];
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];  // raw hunk satırları (+, -, boşluk prefix'li)
}

/** Patch içeriğini dosya bloklarına ayır */
function splitIntoFileBlocks(patchContent: string): FileBlock[] {
  const lines = patchContent.split(/\r?\n/);
  const blocks: FileBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    // "diff --git" veya "--- a/" ile başlayan bir dosya bloğu ara
    if (lines[i].startsWith("diff --git ")) {
      // Standard git diff format
      i++;
      // --- ve +++ satırlarını bul
      let isNewFile = false;
      let filePath = "";
      while (i < lines.length && !lines[i].startsWith("diff --git ")) {
        if (lines[i].startsWith("new file")) isNewFile = true;
        if (lines[i].startsWith("--- ") && lines[i].includes("/dev/null")) isNewFile = true;
        if (lines[i].startsWith("+++ ")) {
          filePath = lines[i].replace(/^\+\+\+ [ab]\//, "").replace(/^\+\+\+ /, "").trim();
          i++;
          break;
        }
        i++;
      }
      if (!filePath) continue;
      const { addedLines, hunks, endIdx } = parseHunks(lines, i, "diff --git ");
      i = endIdx;
      blocks.push({ filePath, isNewFile, addedLines, hunks });
    } else if (lines[i].startsWith("--- ") && i + 1 < lines.length && lines[i + 1].startsWith("+++ ")) {
      // Gemini/LLM format: --- a/file ve +++ b/file çiftleri
      const isNewFile = lines[i].includes("/dev/null");
      const filePath = lines[i + 1].replace(/^\+\+\+ [ab]\//, "").replace(/^\+\+\+ /, "").trim();
      i += 2;
      if (!filePath || filePath === "/dev/null") continue;
      const { addedLines, hunks, endIdx } = parseHunks(lines, i, "--- ");
      i = endIdx;
      blocks.push({ filePath, isNewFile, addedLines, hunks });
    } else {
      i++;
    }
  }

  return blocks;
}

/** Hunk satırlarını parse et */
function parseHunks(lines: string[], startIdx: number, stopPattern: string): { addedLines: string[]; hunks: Hunk[]; endIdx: number } {
  const addedLines: string[] = [];
  const hunks: Hunk[] = [];
  let i = startIdx;

  while (i < lines.length) {
    // Yeni dosya bloğu başlangıcı
    if (lines[i].startsWith(stopPattern) || (lines[i].startsWith("--- ") && i + 1 < lines.length && lines[i + 1].startsWith("+++ "))) {
      break;
    }

    // @@ hunk header
    const hunkMatch = /^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/.exec(lines[i]);
    if (hunkMatch) {
      const hunk: Hunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldCount: parseInt(hunkMatch[2] ?? "1"),
        newStart: parseInt(hunkMatch[3]),
        newCount: parseInt(hunkMatch[4] ?? "1"),
        lines: []
      };
      i++;
      while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith(stopPattern) && !(lines[i].startsWith("--- ") && i + 1 < lines.length && lines[i + 1].startsWith("+++ "))) {
        hunk.lines.push(lines[i]);
        if (lines[i].startsWith("+") && !lines[i].startsWith("+++")) {
          addedLines.push(lines[i].slice(1));
        }
        i++;
      }
      hunks.push(hunk);
    } else if (lines[i].startsWith("+") && !lines[i].startsWith("+++")) {
      addedLines.push(lines[i].slice(1));
      i++;
    } else {
      i++;
    }
  }

  return { addedLines, hunks, endIdx: i };
}

/** Hunk'ları mevcut dosya içeriğine uygula */
function applyHunks(original: string, hunks: Hunk[]): string | null {
  if (hunks.length === 0) return null;

  const origLines = original.split(/\r?\n/);
  const result = [...origLines];
  let offset = 0;  // Eklenen/silinen satır kayması

  for (const hunk of hunks) {
    const startLine = hunk.oldStart - 1 + offset;
    const newLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        newLines.push(line.slice(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        // Silinen satır — ekleme
      } else {
        // Context satırı (boşluk veya boş)
        newLines.push(line.startsWith(" ") ? line.slice(1) : line);
      }
    }

    result.splice(startLine, hunk.oldCount, ...newLines);
    offset += newLines.length - hunk.oldCount;
  }

  return result.join("\n");
}

function runGit(cwd: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
    child.on("error", (err) => resolve({ exitCode: 1, stdout, stderr: err.message }));
  });
}
