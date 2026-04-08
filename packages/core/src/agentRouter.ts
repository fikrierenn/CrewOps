// AgentRouter: Gorev aciklamasi + rol bilgisine bakarak en uygun agent'i secer.
// Skorlama: rol eslesmesi (0.3) + keyword ortusme (0.4) + plugin uyumu (0.2) + skill bonus (0.1)
// Deterministic: ayni girdi -> ayni cikti. Loglama destegi var.

import { listAgents, type CatalogAgent } from "./agentCatalog";
import { SkillScanner } from "./skillScanner";

export interface AgentMatch {
  agentId: string;
  agentName: string;
  plugin: string;
  score: number;
  matchedSkills: string[];
}

export interface RouteResult {
  roleId: string;
  bestMatch: AgentMatch | null;
  alternatives: AgentMatch[];
  fallbackToBuiltIn: boolean;
}

export interface RouteLog {
  taskTitle: string;
  roleId: string;
  candidateCount: number;
  topResults: Array<{ agentId: string; score: number; breakdown: ScoreBreakdown }>;
  selectedAgent: string | null;
  fallback: boolean;
}

interface ScoreBreakdown {
  roleScore: number;
  keywordScore: number;
  pluginScore: number;
  skillBonus: number;
  total: number;
}

// TR + EN stopwords — kisa, anlamsiz kelimeler
const STOP_WORDS = new Set([
  // Turkce
  "ve", "ile", "bir", "bu", "da", "de", "icin", "olan", "gibi", "daha",
  "her", "ama", "hem", "ise", "kadar", "sonra", "once", "eger", "veya",
  "yap", "et", "ol", "var", "yok", "cok", "az", "ben", "sen", "biz",
  // English
  "the", "and", "for", "with", "that", "this", "from", "will", "are",
  "is", "in", "on", "to", "of", "a", "an", "be", "as", "at", "by",
  "or", "it", "its", "not", "but", "can", "has", "have", "was", "were",
  "been", "do", "does", "did", "may", "must", "should", "would", "could",
  "all", "some", "any", "each", "every", "use", "using", "used", "new"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Deterministic set-based Jaccard similarity */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export class AgentRouter {
  private rootDir: string;
  private skillScanner: SkillScanner;
  private lastLog: RouteLog | null = null;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.skillScanner = new SkillScanner(rootDir);
  }

  /** Son route islemi icin detayli log */
  getLastLog(): RouteLog | null {
    return this.lastLog;
  }

  /** Tek gorev icin en uygun agent'i bul */
  route(opts: { taskDescription: string; roleId: string; taskTitle: string }): RouteResult {
    const { taskDescription, roleId, taskTitle } = opts;
    const agents = listAgents(this.rootDir);
    const allSkills = this.skillScanner.scan();

    const taskTokens = tokenize(`${taskTitle} ${taskDescription}`);

    const scored: Array<AgentMatch & { breakdown: ScoreBreakdown }> = [];

    for (const agent of agents) {
      const agentTokens = tokenize(`${agent.name} ${agent.description}`);

      // Skill'leri bu agent'in plugin'inden al
      const pluginSkills = allSkills.filter((s) => s.plugin === agent.plugin);
      const skillTokens = pluginSkills.flatMap((s) => tokenize(`${s.name} ${s.description}`));
      const allAgentTokens = [...agentTokens, ...skillTokens];

      // 1. Rol eslesmesi (0.3)
      const rawRoleScore = this.roleMatchScore(roleId, agent);
      const roleScore = rawRoleScore * 0.3;

      // 2. Keyword ortusme (0.4)
      const rawKeywordScore = jaccardSimilarity(taskTokens, allAgentTokens);
      const keywordScore = rawKeywordScore * 0.4;

      // 3. Plugin uyumu (0.2)
      const pluginTokens = tokenize(agent.plugin);
      const rawPluginScore = jaccardSimilarity(taskTokens, pluginTokens);
      const pluginScore = rawPluginScore * 0.2;

      // 4. Skill spesifiklik bonusu (0.1)
      const matchedSkills: string[] = [];
      for (const skill of pluginSkills) {
        const sTokens = tokenize(`${skill.name} ${skill.description}`);
        const overlap = jaccardSimilarity(taskTokens, sTokens);
        if (overlap > 0.1) matchedSkills.push(skill.name);
      }
      const skillBonus = Math.min(matchedSkills.length * 0.03, 0.1);

      const totalScore = roleScore + keywordScore + pluginScore + skillBonus;

      scored.push({
        agentId: agent.id,
        agentName: agent.name,
        plugin: agent.plugin,
        score: Math.round(totalScore * 1000) / 1000,
        matchedSkills,
        breakdown: {
          roleScore: Math.round(roleScore * 1000) / 1000,
          keywordScore: Math.round(keywordScore * 1000) / 1000,
          pluginScore: Math.round(pluginScore * 1000) / 1000,
          skillBonus: Math.round(skillBonus * 1000) / 1000,
          total: Math.round(totalScore * 1000) / 1000
        }
      });
    }

    // Deterministic siralama: skor esitliginde agentId'ye gore (alfanumerik)
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.agentId.localeCompare(b.agentId);
    });

    const top3 = scored.slice(0, 3);
    const bestMatch = top3[0] ?? null;
    const fallbackToBuiltIn = !bestMatch || bestMatch.score < 0.15;

    // Log olustur
    this.lastLog = {
      taskTitle,
      roleId,
      candidateCount: agents.length,
      topResults: top3.map((m) => ({
        agentId: m.agentId,
        score: m.score,
        breakdown: m.breakdown
      })),
      selectedAgent: fallbackToBuiltIn ? null : (bestMatch?.agentId ?? null),
      fallback: fallbackToBuiltIn
    };

    return {
      roleId,
      bestMatch: fallbackToBuiltIn ? null : bestMatch,
      alternatives: top3.map(({ breakdown, ...match }) => match),
      fallbackToBuiltIn
    };
  }

  /** Tum plan gorevlerini toplu route et */
  routePlan(tasks: Array<{ tempId: string; role: string; title: string }>): Map<string, RouteResult> {
    const results = new Map<string, RouteResult>();
    for (const task of tasks) {
      results.set(
        task.tempId,
        this.route({
          taskDescription: task.title,
          roleId: task.role,
          taskTitle: task.title
        })
      );
    }
    return results;
  }

  private roleMatchScore(roleId: string, agent: CatalogAgent): number {
    const roleNorm = roleId.toLowerCase();
    const agentText = `${agent.name} ${agent.description} ${agent.plugin}`.toLowerCase();

    // Tam eslseme
    if (agentText.includes(roleNorm)) return 1.0;

    // Kismi eslseme
    const roleWords = roleNorm.split(/[-_\s]+/).filter((w) => w.length > 2);
    let matched = 0;
    for (const w of roleWords) {
      if (agentText.includes(w)) matched++;
    }
    return roleWords.length > 0 ? matched / roleWords.length : 0;
  }
}
