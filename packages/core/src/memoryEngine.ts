// MemoryEngine
// Token-minimal hafıza dosyalarını yönetir ve doğrular.
// Zorunlu dosyalar: NOW.md, DECISIONS.md, ARCH_SHORT.md

import * as fs from "fs";
import * as path from "path";

export interface MemoryFiles {
  nowPath: string;
  decisionsPath: string;
  archShortPath: string;
}

export interface MemoryContent {
  now: string;
  decisions: string;
  archShort: string;
}

// Basit parsed output ara yüzü; MemoryEngine çekirdek pakete bağımlı olmadan
// sadece ihtiyaç duyduğu alanları bilir. Bu sayede hafıza güncellemesi,
// rol çıktılarıyla gevşek bağlı (loosely coupled) kalır.
export interface ParsedSummaryLike {
  summary: string[];
  next: string[];
}

export class MemoryEngine {
  constructor(private rootDir: string) {}

  // Memory klasöründeki zorunlu dosya yollarını döndürür
  getMemoryPaths(): MemoryFiles {
    const memoryDir = path.join(this.rootDir, "memory");
    return {
      nowPath: path.join(memoryDir, "NOW.md"),
      decisionsPath: path.join(memoryDir, "DECISIONS.md"),
      archShortPath: path.join(memoryDir, "ARCH_SHORT.md")
    };
  }

  // Zorunlu hafıza dosyalarının varlığını kontrol eder
  // Eksikse hangi dosyanın eksik olduğunu döndürür
  validatePresence(): { ok: boolean; missing: string[] } {
    const paths = this.getMemoryPaths();
    const missing: string[] = [];
    if (!fs.existsSync(paths.nowPath)) missing.push("NOW.md");
    if (!fs.existsSync(paths.decisionsPath)) missing.push("DECISIONS.md");
    if (!fs.existsSync(paths.archShortPath)) missing.push("ARCH_SHORT.md");
    return { ok: missing.length === 0, missing };
  }

  // Tüm hafıza dosyalarının içeriğini okur
  load(): MemoryContent {
    const paths = this.getMemoryPaths();
    return {
      now: fs.readFileSync(paths.nowPath, "utf8"),
      decisions: fs.readFileSync(paths.decisionsPath, "utf8"),
      archShort: fs.readFileSync(paths.archShortPath, "utf8")
    };
  }

  // NOW.md içeriğini güncellemek için basit bir şablon fonksiyonu (MVP: sadece stub)
  // Not: Şimdilik sadece tam metin overwrite yapıyoruz; daha akıllı merge ileride eklenebilir.
  updateNowFile(newContent: string): void {
    const { nowPath } = this.getMemoryPaths();
    fs.writeFileSync(nowPath, newContent, "utf8");
  }

  // Başarılı bir rol koşusundan sonra NOW.md dosyasını otomatik güncellemek için
  // yardımcı fonksiyon. Böylece sen elle dosya düzenlemeden hafıza "akıcılığı"
  // sağlanmış olur.
  //
  // Basit strateji:
  // - LAST: önceki NOW içeriğinin tek satır özeti
  // - NOW: parsed.summary içindeki maddeleri tek satırda birleştirir
  // - NEXT: parsed.next içindeki ilk madde (varsa), yoksa önceki NEXT olduğu gibi kalır
  // - BLOCK ve CONTRACT_CHANGE? alanlarını önceki içerikten olduğu gibi korur
  autoUpdateNowFromParsed(parsed: ParsedSummaryLike): void {
    const { nowPath } = this.getMemoryPaths();
    let previous = "";
    try {
      if (fs.existsSync(nowPath)) {
        previous = fs.readFileSync(nowPath, "utf8");
      }
    } catch {
      // Okuma hatası durumunda önceki içerik yokmuş gibi davranacağız
      previous = "";
    }

    const prevLines = previous.split(/\r?\n/);

    // Önceki BLOCK ve CONTRACT satırlarını korumaya çalış
    const prevBlockLine =
      prevLines.find((l) => l.startsWith("BLOCK:")) ?? "BLOCK: ...";
    const prevContractLine =
      prevLines.find((l) => l.startsWith("CONTRACT_CHANGE?")) ??
      "CONTRACT_CHANGE?: no";

    const lastSummary =
      prevLines.find((l) => l.startsWith("NOW:")) ?? "NOW: henüz tanımlı değil";

    const newLast = lastSummary.replace(/^NOW:/, "LAST:");
    const newNow = `NOW: ${parsed.summary.join(" | ") || "özet yok"}`;
    const newNext = `NEXT: ${parsed.next[0] ?? "bir sonraki adım tanımlanmadı"}`;

    const content = [newLast, newNow, newNext, prevBlockLine, prevContractLine, ""].join(
      "\n"
    );

    fs.writeFileSync(nowPath, content, "utf8");
  }
}

