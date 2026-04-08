# CrewOps V2 — MVP Kapsam Belgesi

Bu belge CrewOps V2 MVP'sinin kapsamını, başarı kriterlerini ve veritabanı şemasını tanımlar. MVP sınırı kasıtlı olarak dardır: çalışan bir governance döngüsünü kanıtlamak yeterlidir.

---

## MVP Tanımı

En küçük gerçek çalışan teslimat döngüsü. Demo gösterisi değil, gerçek işlevsel bir governance loop.

MVP kapsamı şunu kanıtlamalıdır:

> CrewOps V2 ile bir proje oluşturulabilir, PM ile mutabakat sağlanabilir, görevler yürütülebilir, review yapılabilir ve insan onayına sunulabilir.

Bu kanıt uçtan uca çalışan bir senaryo üzerinden doğrulanır. Her bileşen bağımsız olarak çalışması yeterli değildir; bütün akış entegre olarak çalışmalıdır.

---

## MVP Kapsamında Olan Ozellikler

### Proje Yonetimi

- Proje oluştur (`CreateProjectCommand` + Blazor formu)
- Proje listele ve detay görüntüle
- Proje state machine: tüm `ProjectState` değerleri tanımlı, MVP geçişleri çalışıyor (`NEW` → `COMPLETED`)

### PM Sohbet ve Mutabakat

- PM ile çok turlu sohbet (`PmService.SendMessageAsync()`)
- `[MUTABAKAT_HAZIR]` marker algılama
- `AgreementDraft` oluşturma ve veritabanına kaydetme
- İnsan onayı → `AGREEMENT_APPROVED` state geçişi

### Planlama

- Onaylanmış mutabakattan görev ayrıştırma (`PlannerService.DecomposeAsync()`)
- MVP kısıtı: maksimum 5 görev
- 7 built-in rol ataması (`RoleProfile` listesi)
- DAG bağımlılık modeli (task dependency graph)

### Yurutme

- Tek sıralı `ExecutionRun` (paralel yürütme V2.1)
- `LocalClaudeWorker`: Claude Code CLI spawn ile görev yürütme
- `WorkerResultNormalizer`: 5-bölüm output parsing (SUMMARY / FILES_CHANGED / PATCH / NEXT / RISKS)
- Her run için izole temp workspace (`WorkspaceManager`)
- `ExecutionArtifact` toplama ve veritabanına kaydetme

### Review Gate

- PM review: approve / revise / escalate kararı (`PmService.ReviewTaskOutputAsync()`)
- Revise kararında retry (maksimum 2 deneme)
- Escalation → proje `CHANGES_REQUESTED` state'ine geçer

### PM Ozeti ve Insan Incelemesi

- PM konsolide özeti (`PmService.GenerateSummaryAsync()`)
- `READY_FOR_HUMAN_REVIEW` state geçişi
- `ApprovalPanel` üzerinden onay / red

### Audit Trail

- Temel `AuditEvent`'ler: proje, görev, onay, yürütme olayları
- `ProjectTimeline` sorgusu (proje geçmişi kronolojik sırayla)

### Teknik Altyapi

- ASP.NET Core 10 Minimal API (port 5000)
- SignalR execution streaming (`ExecutionHub`)
- SQL Server + EF Core 10 (8 temel tablo)
- MediatR CQRS (command/query ayrımı)
- Serilog yapılandırmalı structured logging (konsol + dosya)
- Blazor Server UI: PmChat, Dashboard, Tasks, ApprovalPanel, RunConsole

---

## MVP Disinda Olan Ozellikler (V2.1+)

Bu özellikler V2 mimarisinde **tasarım olarak** yer alır (arayüzler ve stub'lar hazır); ancak MVP'de implement edilmez.

### Release Yonetimi

- Staging deploy controller (`IDeploymentProvider` stub olarak mevcut)
- Production gate enforcer (`ProductionGateEnforcer` sınıfı hazır, deploy mekanizması bağlı değil)
- RollbackPlan UI

### Capability Sistemi

- Tam `CapabilityPack` sistemi (MVP: 7 built-in rol yeterli)
- `ProjectBootstrapPack`
- `CapabilityUsageMetrics` (maliyet ve kullanım analitikleri)

### Entegrasyonlar

- Gemini worker (`GeminiWorker` — `ILlmWorker` implementasyonu V2.1'de)
- `agents-main` tam katalog entegrasyonu (MVP'de seed-only, tam dinamik yükleme V2.1)
- MCP entegrasyonları

### Auth

- Multi-user role-based authentication (MVP: tek kullanıcı, local-first)

### Paralel Yurutme

- Concurrent task execution (MVP: sıralı, paralel V2.1)

---

## MVP Basari Kriterleri

Aşağıdaki senaryo uçtan uca hatasız çalışıyorsa MVP tamamdır:

1. Kullanıcı Blazor Dashboard'da yeni proje oluşturur.
2. PmChat sayfasında proje gereksinimleri tartışılır; sistem `[MUTABAKAT_HAZIR]` marker'ını algılar.
3. Kullanıcı ApprovalPanel'de `AgreementDraft`'ı inceler ve onaylar.
4. Sistem otomatik olarak 3-5 görev oluşturur; Tasks sayfasında DAG görüntülenir.
5. Sistem görevleri sırayla yürütür (`LocalClaudeWorker` via Claude Code CLI); RunConsole'da gerçek zamanlı log akar.
6. Her görev tamamlandıktan sonra PM review yapılır; gerekirse revise döngüsü çalışır.
7. Orchestration tamamlanır; PM konsolide özet üretir.
8. Dashboard'da `READY_FOR_HUMAN_REVIEW` durumu görüntülenir; kullanıcı son onayı ApprovalPanel'den verir.
9. Proje `COMPLETED` durumuna geçer.
10. Tüm süreç `ProjectTimeline` sorgusunda audit event'leriyle kronolojik sırayla görünür.

Bu kriterlerin tamamının otomatik test kapsamı olmak zorunda değildir; ancak manuel çalıştırma ile doğrulanmış olmalıdır.

---

## MVP Veritabani Semasi (8 Tablo)

MVP'de aşağıdaki 8 temel tablo yeterlidir. Her tablo EF Core entity configuration ile tanımlanır; şema değişiklikleri migration ile yönetilir.

```sql
-- Temel tablolar
Projects          -- Project aggregate, ProjectState sütunu
Tasks             -- Task aggregate, bağımlılık ilişkileri
ExecutionRuns     -- ExecutionRun aggregate, workspace path
AgreementDrafts   -- AgreementDraft entity, onay durumu
TaskReviews       -- TaskReview entity, ReviewDecision enum
AuditEvents       -- Tüm denetim kayıtları, EventType sütunu
CostRecords       -- LLM çağrı maliyetleri
Artifacts         -- ExecutionArtifact, TrustLevel sütunu
```

Tablo detayları ve EF Core konfigürasyonları: `CORE_MODULES_MAP.md` → Infrastructure bölümü.

### Tablo Iliskileri Ozeti

```
Projects ─┬─ Tasks (1:N)
           ├─ AgreementDrafts (1:N, genellikle 1:1)
           ├─ AuditEvents (1:N)
           └─ CostRecords (1:N, proje toplam maliyet özeti için)

Tasks ─────┬─ ExecutionRuns (1:N)
            └─ TaskReviews (1:N)

ExecutionRuns ── Artifacts (1:N)
```

---

## MVP Mimari Ozeti

MVP aşağıdaki projeleri içerir. Her proje bir katmana karşılık gelir:

| Proje | Katman | Bağımlılık |
|-------|--------|-----------|
| `CrewOps.Domain` | Domain | Yok (saf C#) |
| `CrewOps.Contracts` | Shared DTOs | Yok |
| `CrewOps.Application` | Application | Domain, Contracts |
| `CrewOps.Infrastructure` | Infrastructure | Application, Domain |
| `CrewOps.Execution` | Execution | Application, Domain |
| `CrewOps.Orchestration` | Orchestration | Execution, Application |
| `CrewOps.Governance` | Governance | Application, Domain |
| `CrewOps.Observability` | Observability | Application |
| `CrewOps.Capabilities` | Capabilities | Domain |
| `CrewOps.Api` | API Host | Tüm katmanlar |
| `CrewOps.Web` | Blazor UI | Contracts, Api (HTTP) |

MVP dışında kalan `CrewOps.Releases` projesi de oluşturulur; ancak Faz 5'te yalnızca stub implementasyonları içerir.

---

*Son güncelleme: 2026-03-08*
