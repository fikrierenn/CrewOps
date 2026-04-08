// PmChatEngine
// PM ile çok turlu sohbeti yönetir.

import * as fs from "fs";
import * as path from "path";
import { LLMRunner } from "./llmRunner";
import { RoleRegistry } from "./roleRegistry";
import { MemoryEngine } from "./memoryEngine";
import type { Project, ChatMessage } from "@shared/index";

export class PmChatEngine {
  static async chat(opts: {
    rootDir: string;
    project: Project;
    chatHistory: ChatMessage[];
    userMessage: string;
  }): Promise<{ pmReply: string; mutabakatReady: boolean; mutabakatDocument?: string }> {
    const { rootDir, project, chatHistory, userMessage } = opts;

    // PM rol tanımını yükle
    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    const pmRole = roleRegistry.getRoleConfig("pm");
    if (!pmRole) throw new Error("PM rol tanımı bulunamadı");

    // PM chat sözleşmesini yükle
    const chatContract = fs.readFileSync(
      path.join(rootDir, "templates", "pm_chat_contract.md"),
      "utf8"
    );

    // Chat geçmişini prompt'a dönüştür
    const historyText = chatHistory
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    // Prompt oluştur
    const prompt = [
      `# PM Chat Oturumu`,
      ``,
      `## Proje Bilgisi`,
      `Ad: ${project.name}`,
      `Stack: ${project.stack}`,
      `Repo: ${project.repoPath}`,
      ``,
      `## PM Chat Sözleşmesi`,
      chatContract,
      ``,
      `## Chat Geçmişi`,
      historyText || "(İlk mesaj)",
      ``,
      `## Yeni Kullanıcı Mesajı`,
      userMessage,
      ``,
      `## Talimat`,
      `Yukarıdaki chat sözleşmesine uygun şekilde yanıt ver. Yanıtını düz metin olarak yaz.`,
      `Eğer yeterli bilgi toplandıysa, yanıtının sonuna [MUTABAKAT_HAZIR] marker'ı ile mutabakat belgesi ekle.`,
    ].join("\n");

    // Memory dosyalarını yükle (varsa)
    const memoryEngine = new MemoryEngine(rootDir);
    let memory = { now: "", decisions: "", archShort: "" };
    try {
      const memStatus = memoryEngine.validatePresence();
      if (memStatus.ok) {
        memory = memoryEngine.load();
      }
    } catch {}

    // LLM'i çalıştır
    const result = await LLMRunner.run({
      rootDir,
      projectRepoPath: project.repoPath,
      roleConfig: pmRole,
      taskDescription: prompt,
      complexity: "medium",
      memory,
      outputContractTemplate: "",
      taskContractTemplate: ""
    });

    // Hata kontrolü: LLM başarısız olduysa hatayı fırlat
    if (result.exitCode !== 0 && result.exitCode !== null) {
      const errDetail = result.stderr || "Bilinmeyen LLM hatası";
      throw new Error(`PM Chat LLM hatası (exit ${result.exitCode}): ${errDetail}`);
    }

    const fullOutput = result.stdout.trim();

    // Boş yanıt kontrolü
    if (!fullOutput) {
      const hint = result.stderr ? ` (stderr: ${result.stderr.slice(0, 200)})` : "";
      throw new Error(`PM yanıtı boş geldi. LLM çağrısı başarısız olmuş olabilir.${hint}`);
    }

    // [MUTABAKAT_HAZIR] marker'ını kontrol et
    const markerIndex = fullOutput.indexOf("[MUTABAKAT_HAZIR]");
    const mutabakatReady = markerIndex !== -1;
    let pmReply = fullOutput;
    let mutabakatDocument: string | undefined;

    if (mutabakatReady) {
      pmReply = fullOutput.substring(0, markerIndex).trim();
      mutabakatDocument = fullOutput.substring(markerIndex + "[MUTABAKAT_HAZIR]".length).trim();
    }

    return { pmReply, mutabakatReady, mutabakatDocument };
  }

  static async chatWithStream(opts: {
    rootDir: string;
    project: Project;
    chatHistory: ChatMessage[];
    userMessage: string;
    onChunk: (data: string) => void;
  }): Promise<{ pmReply: string; mutabakatReady: boolean; mutabakatDocument?: string }> {
    const { rootDir, project, chatHistory, userMessage, onChunk } = opts;

    const roleRegistry = new RoleRegistry(rootDir);
    roleRegistry.loadRolesFromTemplates();
    const pmRole = roleRegistry.getRoleConfig("pm");
    if (!pmRole) throw new Error("PM rol tanımı bulunamadı");

    const chatContract = fs.readFileSync(
      path.join(rootDir, "templates", "pm_chat_contract.md"),
      "utf8"
    );

    const historyText = chatHistory
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    const prompt = [
      `# PM Chat Oturumu`,
      ``,
      `## Proje Bilgisi`,
      `Ad: ${project.name}`,
      `Stack: ${project.stack}`,
      `Repo: ${project.repoPath}`,
      ``,
      `## PM Chat Sözleşmesi`,
      chatContract,
      ``,
      `## Chat Geçmişi`,
      historyText || "(İlk mesaj)",
      ``,
      `## Yeni Kullanıcı Mesajı`,
      userMessage,
      ``,
      `## Talimat`,
      `Yukarıdaki chat sözleşmesine uygun şekilde yanıt ver. Yanıtını düz metin olarak yaz.`,
      `Eğer yeterli bilgi toplandıysa, yanıtının sonuna [MUTABAKAT_HAZIR] marker'ı ile mutabakat belgesi ekle.`,
    ].join("\n");

    const memoryEngine = new MemoryEngine(rootDir);
    let memory = { now: "", decisions: "", archShort: "" };
    try {
      const memStatus = memoryEngine.validatePresence();
      if (memStatus.ok) {
        memory = memoryEngine.load();
      }
    } catch {}

    const result = await LLMRunner.runWithStream(
      {
        rootDir,
        projectRepoPath: project.repoPath,
        roleConfig: pmRole,
        taskDescription: prompt,
        complexity: "medium",
        memory,
        outputContractTemplate: "",
        taskContractTemplate: ""
      },
      (source, data) => {
        if (source === "stdout") onChunk(data);
      }
    );

    // Hata kontrolü
    if (result.exitCode !== 0 && result.exitCode !== null) {
      const errDetail = result.stderr || "Bilinmeyen LLM hatası";
      throw new Error(`PM Chat LLM hatası (exit ${result.exitCode}): ${errDetail}`);
    }

    const fullOutput = result.stdout.trim();

    if (!fullOutput) {
      const hint = result.stderr ? ` (stderr: ${result.stderr.slice(0, 200)})` : "";
      throw new Error(`PM yanıtı boş geldi. LLM çağrısı başarısız olmuş olabilir.${hint}`);
    }
    const markerIndex = fullOutput.indexOf("[MUTABAKAT_HAZIR]");
    const mutabakatReady = markerIndex !== -1;
    let pmReply = fullOutput;
    let mutabakatDocument: string | undefined;

    if (mutabakatReady) {
      pmReply = fullOutput.substring(0, markerIndex).trim();
      mutabakatDocument = fullOutput.substring(markerIndex + "[MUTABAKAT_HAZIR]".length).trim();
    }

    return { pmReply, mutabakatReady, mutabakatDocument };
  }
}
