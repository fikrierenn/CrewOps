## Orchestrator Mimari Özeti

Bu belge, AI Team Orchestrator (CrewOps) MVP mimarisini yüksek seviyede özetler. Proje yapısı, katmanlar, Agent Skills, run pipeline ve sözleşmeler için tam doküman seti: **[00-overview.md](00-overview.md)** (indeks).

### Katmanlar

- **TUI (apps/orchestrator)**: Ink tabanlı terminal arayüzü. Proje, rol, görev ve koşu yönetimini sağlar. Guarded Mode onaylarını kullanıcıdan alır.
- **Core (packages/core)**: İş kurallarını barındırır.
  - `WorkflowEngine`: Görev DAG'ini ve bağımlılık kontrollerini yönetir.
  - `RoleRegistry`: Rol şablonlarını `/templates/roles` altından yükler.
  - `MemoryEngine`: `/memory` altındaki üç zorunlu hafıza dosyasını yönetir.
  - `ClaudeCodeRunner`: `claude-code` CLI çağrılarını orkestre eder.
  - `OutputParser`: Sıkı çıktı sözleşmesini parse eder.
  - `ArtifactManager`: Çıktı artefact'larını dosya sistemi ve DB üzerinde saklar.
  - `CostEstimator`: Yaklaşık token ve maliyet tahmini yapar.
- **DB (packages/db)**: better-sqlite3 üzerinde çalışan senkron repository katmanı.
- **Shared (packages/shared)**: Ortak tipler ve yardımcılar.
- **Templates & Memory**:
  - `/templates/output_contract.md`: Zorunlu çıktı sözleşmesi.
  - `/templates/task_contract.md`: Rol çalıştırma görev sözleşmesi.
  - `/templates/roles/*.json`: Rol tanımları.
  - `/memory/*.md`: Token-minimal hafıza dosyaları.

### Guarded Mode

- Her `claude-code` koşumu sadece patch üretir; dosya değişikliğini otomatik uygulamaz.
- PATCH bölümü boş değilse:
  - TUI içinde diff görünümü gösterilir.
  - Kullanıcıdan "Apply changes? (y/n)" onayı alınır.
  - `y` seçilirse `git apply` ile patch uygulanır.
  - `n` seçilirse patch sadece artefact olarak saklanır.

### Kalıcı Veri

- **SQLite (orchestrator.db)**:
  - `projects`: Proje meta bilgisi (ad, repo yolu, stack).
  - `roles`: Proje için etkin rol konfigürasyonları.
  - `tasks`: Rol tabanlı görevler, karmaşıklık ve bağımlılıklar.
  - `runs`: Görev koşuları, durum, özet ve parse bilgisi.
  - `artifacts`: Ham ve parse edilmiş çıktılar, patch'ler.
  - `cost_ledger`: Yaklaşık token/maliyet kayıtları.

