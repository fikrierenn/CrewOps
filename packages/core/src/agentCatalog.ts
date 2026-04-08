/**
 * Agent kataloğu: agents-main klasöründeki plugin agent'larını tarar ve yükler.
 * CrewOps, bu agent'ları "rol" gibi kullanarak prompt'u besler; böylece agents-main
 * kataloğu orkestrasyon arayüzü tarafından yönetilmiş olur.
 */

import * as fs from "fs";
import * as path from "path";
import type { RoleConfig } from "./roleRegistry";

/** agents-main kök yolu (env veya varsayılan: rootDir/agents-main) */
export function getAgentsBasePath(rootDir: string): string {
  return process.env.CREWOPS_AGENTS_PATH || path.join(rootDir, "agents-main");
}

export interface CatalogAgent {
  id: string;
  name: string;
  description: string;
  plugin: string;
  path: string;
}

/** Frontmatter + gövde ayrıştırması */
function parseAgentMd(content: string): { name: string; description: string; model: string; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  let name = "";
  let description = "";
  let model = "inherit";
  let body = content;

  if (match) {
    body = match[2].trim();
    const fm = match[1];
    for (const line of fm.split(/\r?\n/)) {
      const colon = line.indexOf(":");
      if (colon > 0) {
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
        if (key === "name") name = val;
        else if (key === "description") description = val;
        else if (key === "model") model = val;
      }
    }
  }

  return { name, description, model, body };
}

/**
 * agents-main/plugins altındaki tüm agent .md dosyalarını listeler.
 * Klasör yoksa veya boşsa boş dizi döner.
 */
export function listAgents(rootDir: string): CatalogAgent[] {
  const base = getAgentsBasePath(rootDir);
  const pluginsDir = path.join(base, "plugins");
  if (!fs.existsSync(pluginsDir)) return [];

  const out: CatalogAgent[] = [];
  const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const plug of pluginDirs) {
    const agentsDir = path.join(pluginsDir, plug.name, "agents");
    if (!fs.existsSync(agentsDir)) continue;
    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const id = file.replace(/\.md$/, "");
      const fullPath = path.join(agentsDir, file);
      let name = id;
      let description = "";
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = parseAgentMd(raw);
        name = parsed.name || id;
        description = parsed.description || "";
      } catch (_) {}
      out.push({
        id,
        name,
        description,
        plugin: plug.name,
        path: fullPath
      });
    }
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Belirtilen id'ye sahip agent'ın tam içeriğini yükler.
 * Yoksa null döner.
 */
export function loadAgent(rootDir: string, agentId: string): {
  name: string;
  description: string;
  model: string;
  body: string;
} | null {
  const base = getAgentsBasePath(rootDir);
  const pluginsDir = path.join(base, "plugins");
  if (!fs.existsSync(pluginsDir)) return null;

  const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const plug of pluginDirs) {
    const agentsDir = path.join(pluginsDir, plug.name, "agents");
    const file = agentId + ".md";
    const fullPath = path.join(agentsDir, file);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = parseAgentMd(raw);
    return {
      name: parsed.name || agentId,
      description: parsed.description || "",
      model: parsed.model || "inherit",
      body: parsed.body
    };
  }

  return null;
}

/**
 * Katalog agent'ını CrewOps RoleConfig formatına dönüştürür.
 * Böylece mevcut prompt builder ve LLM runner aynen kullanılır.
 */
export function agentToRoleConfig(agentId: string, loaded: {
  name: string;
  description: string;
  model: string;
  body: string;
}, skillNames?: string[]): RoleConfig {
  const model = loaded.model === "inherit" ? "inherit" : loaded.model;
  return {
    roleId: agentId,
    displayName: loaded.name,
    avatar: "🤖",
    skills: skillNames ?? [],
    workStyle: loaded.body,
    defaultModelPolicy: {
      simple: model,
      medium: model,
      complex: model
    },
    definitionOfDone: []
  };
}
