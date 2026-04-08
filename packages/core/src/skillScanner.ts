// SkillScanner: agents-main/plugins/ altindaki SKILL.md dosyalarini tarar.
// YAML frontmatter'dan name + description cekilir, sonuclar cache'lenir.

import * as fs from "fs";
import * as path from "path";
import { getAgentsBasePath } from "./agentCatalog";

export interface SkillMeta {
  name: string;
  description: string;
  plugin: string;
  path: string;
}

export class SkillScanner {
  private rootDir: string;
  private cache: SkillMeta[] | null = null;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /** Tum skill'leri tarar (cache'li) */
  scan(): SkillMeta[] {
    if (this.cache) return this.cache;

    const base = getAgentsBasePath(this.rootDir);
    const pluginsDir = path.join(base, "plugins");
    if (!fs.existsSync(pluginsDir)) {
      this.cache = [];
      return this.cache;
    }

    const out: SkillMeta[] = [];
    const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

    for (const plug of pluginDirs) {
      const skillsDir = path.join(pluginsDir, plug.name, "skills");
      if (!fs.existsSync(skillsDir)) continue;

      const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const skillDir of skillDirs) {
        const skillMdPath = path.join(skillsDir, skillDir.name, "SKILL.md");
        if (!fs.existsSync(skillMdPath)) continue;

        try {
          const raw = fs.readFileSync(skillMdPath, "utf8");
          const parsed = parseFrontmatter(raw);
          out.push({
            name: parsed.name || skillDir.name,
            description: parsed.description || "",
            plugin: plug.name,
            path: skillMdPath
          });
        } catch {
          out.push({
            name: skillDir.name,
            description: "",
            plugin: plug.name,
            path: skillMdPath
          });
        }
      }
    }

    this.cache = out.sort((a, b) => a.name.localeCompare(b.name));
    return this.cache;
  }

  /** Plugin bazli filtrele */
  getSkillsByPlugin(pluginName: string): SkillMeta[] {
    return this.scan().filter((s) => s.plugin === pluginName);
  }

  /** Tam SKILL.md body'si (frontmatter disinda) */
  loadSkillContent(skillPath: string): string {
    if (!fs.existsSync(skillPath)) return "";
    const raw = fs.readFileSync(skillPath, "utf8");
    const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return match ? match[1].trim() : raw.trim();
  }
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let name = "";
  let description = "";

  if (match) {
    const fm = match[1];
    for (const line of fm.split(/\r?\n/)) {
      const colon = line.indexOf(":");
      if (colon > 0) {
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
        if (key === "name") name = val;
        else if (key === "description") description = val;
      }
    }
  }

  return { name, description };
}
