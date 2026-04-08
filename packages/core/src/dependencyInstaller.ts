/**
 * Proje klasöründe bağımlılık kurulumu (npm install / pnpm install / yarn).
 * Patch uygulandıktan sonra package.json varsa otomatik çalıştırılabilir.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type InstallResult = { success: boolean; stderr?: string; stdout?: string };

/**
 * Proje klasöründe package.json varsa npm install çalıştırır.
 * pnpm-lock.yaml varsa pnpm install, yarn.lock varsa yarn kullanılır.
 */
export async function installDependencies(repoPath: string): Promise<InstallResult> {
  const dir = path.resolve(repoPath);
  const packageJson = path.join(dir, "package.json");
  if (!fs.existsSync(packageJson)) {
    return { success: true };
  }

  const lockPnpm = path.join(dir, "pnpm-lock.yaml");
  const lockYarn = path.join(dir, "yarn.lock");
  const hasPnpm = fs.existsSync(lockPnpm);
  const hasYarn = fs.existsSync(lockYarn);

  const cmd = hasPnpm ? "pnpm" : hasYarn ? "yarn" : "npm";
  const args = hasPnpm ? ["install"] : hasYarn ? ["install"] : ["install"];

  return new Promise<InstallResult>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      resolve({
        success: code === 0,
        stderr: stderr || undefined,
        stdout: stdout || undefined
      });
    });
    child.on("error", (err) => {
      resolve({ success: false, stderr: err.message });
    });
  });
}
