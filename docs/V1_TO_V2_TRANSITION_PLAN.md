# CrewOps — V1'den V2'ye Geçiş Planı

Bu belge Node.js/TypeScript tabanlı V1 sisteminden .NET 10 tabanlı V2 sistemine geçiş stratejisini, kavram eşleştirme tablolarını, veri migration yaklaşımını ve risk değerlendirmesini kapsar.

---

## Geçiş Stratejisi

**Büyük patlama (big bang) değil, paralel geliştirme.**

V1 çalışmaya devam eder. V2, `src/` dizini altında sıfırdan inşa edilir. V1 kodu `v1/` klasörüne taşınır; silinmez. Bu yaklaşım iki avantaj sağlar: V1 referans implementasyonu olarak kullanılabilir ve geçiş sırasında bir şeyler ters giderse V1'e dönmek mümkündür.

Dizin yapısı:

```
D:\Dev\CrewOps\
├── src\                    ← V2: .NET 10 temiz başlangıç
├── v1\                     ← V1: Node.js/TypeScript (çalışmaya devam eder)
│   ├── apps\
│   ├── packages\
│   └── agents-main\        ← V2 CapabilityRegistry seed kaynağı
└── docs\                   ← Her iki versiyona ait belgeler
```

V2 minimum çalışır hale geldiğinde (MVP başarı kriterleri sağlandığında) production geçişi yapılır. V1 bu noktadan sonra arşivlenir.

---

## Domain Kavram Eşleştirme Tablosu

V1'deki TypeScript tiplerinin V2 C# karşılıkları aşağıda verilmiştir. Eşleştirme yapılırken V1'deki isimlendirme sorunları düzeltilmiş, V2'de daha açık ve tutarlı isimler tercih edilmiştir.

| V1 TypeScript Tipi | V2 C# Entity/Class | Notlar |
|---|---|---|
| `Project` interface | `Project` aggregate | `phase` → `ProjectState` enum olarak tiplandı |
| `ProjectPhase` string union | `ProjectState` enum + `ProjectStateMachine` | Merkezi geçiş yönetimi, geçersiz geçiş exception fırlatır |
| `Task` interface | `Task` aggregate | `dependencyIds` → entity relation (EF Core navigation property) |
| `Run` interface | `ExecutionRun` aggregate | Daha zengin lifecycle: `QUEUED → RUNNING → COMPLETED/FAILED` |
| `Artifact` interface | `ExecutionArtifact` entity | `kind` enum korunur, `trustLevel` alanı eklendi |
| `Role` interface | `RoleProfile` (Capabilities katmanı) | `rawConfig` kaldırıldı; `AllowedTools` ve `ForbiddenActions` eklendi |
| `ChatMessage` interface | `PmMessage` entity | `role: 'pm'/'user'/'system'` → `PmMessageRole` enum |
| `PlanDraft` interface | `AgreementDraft` entity | Daha açık isimlendirme; onay durumu `AgreementDraftStatus` enum |
| `TaskReview` interface | `TaskReview` entity | `decision` string → `ReviewDecision` enum (Approve/Revise/Escalate) |
| `OrchestrationEvent` | `OrchestrationEvent` domain event | `type` string → `OrchestrationEventType` typed enum |
| `CostLedgerEntry` | `CostRecord` entity | Daha açık isimlendirme; `provider` alanı eklendi |
| `DeliveryReport` | `DeliveryReport` (Releases katmanı) | Daha zengin yapı; `ReleaseRequest` ile ilişkilendirildi |

---

## Phase Eşleştirme Tablosu

V1'deki `ProjectPhase` string union değerleri, V2'de daha granüler bir `ProjectState` enum yapısına dönüştürülmüştür. Bu granülerlik yalnızca daha fazla state eklemekten ibaret değildir; her state geçişi için iş kuralları tanımlanmıştır.

| V1 `ProjectPhase` | V2 `ProjectState` | Notlar |
|---|---|---|
| `mutabakat_bekliyor` | `NEW` → `DISCOVERY` | İki state'e ayrıldı: proje oluşturulmuş ama PM chat başlamamış vs. PM chat devam ediyor |
| `mutabakat_devam` | `NEEDS_CLARIFICATION` | PM clarification döngüsü için ayrı state |
| `mutabakat_tamamlandi` | `AGREEMENT_DRAFTED` → `AGREEMENT_APPROVED` | V1'de tek adım, V2'de taslak ve onay ayrı state'ler |
| `planlama` | `PLANNED` → `TASKS_CREATED` → `CAPABILITIES_ASSIGNED` | Görev decomposition ve capability assignment ayrı geçişler |
| `gelistirme` | `IN_EXECUTION` → `IN_QA` → `IN_REVIEW` | Her alt aşama ayrı izlenebilir |
| `review` | `READY_FOR_PM_SUMMARY` → `READY_FOR_HUMAN_REVIEW` | PM özeti oluşturulması ayrı bir state geçişi |
| `teslim_edildi` | `APPROVED_FOR_STAGING` → `DEPLOYED_TO_STAGING` → `APPROVED_FOR_PRODUCTION` → `COMPLETED` | Release lifecycle eklendi |

`ProjectStateMachine` sınıfı geçerli geçişler listesini merkezi olarak yönetir. Bu tablodan türetilen geçiş matrisi Faz 1 domain testlerinin temel kaynağıdır.

---

## Marker Dili Kararı

V1'de kullanılan `[MUTABAKAT_HAZIR]` marker'ı V2'de korunur.

Gerekçe: Bu marker, PM'in LLM output'unda ürettiği Türkçe domain dilidir. Değiştirmek aşağıdaki güncellemeleri zorunlu kılar:
- Tüm PM chat contract template'leri (`templates/role-profiles/`)
- Tüm role JSON tanımları
- Test data ve fixture'lar
- Dokümantasyon

Fayda/maliyet analizi, mevcut marker'ı korumanın tercih edilmesini destekler. Türkçe domain dili CrewOps'un kimliğinin bir parçasıdır.

İngilizce alternatifleri tercih edilirse: `[AGREEMENT_READY]`. Bu seçenek OPEN_QUESTIONS.md'de soru olarak kayıt altına alınmıştır (Soru 1).

---

## Veri Migration Stratejisi

V1 SQLite verisi V2 SQL Server'a migrate edilebilir, ancak bu zorunlu değildir.

V1 bir prototip olarak çalıştı. Gerçek üretim kullanımına geçilmeden önce V2'ye geçiş yapılabilir; bu durumda data migration gereksizdir. Eğer V1'de anlamlı proje verisi birikmişse aşağıdaki migration yaklaşımı uygulanır:

Migration adımları:
1. V1 SQLite tablolarını oku; V2 SQL Server tablolarına yaz.
2. V1 `INTEGER` ID'lerini V2 `GUID`'e dönüştür (yeni UUID üretimi).
3. Enum string'lerden typed enum'lara dönüşüm yapılır: örneğin `'mutabakat_tamamlandi'` → `ProjectState.AGREEMENT_APPROVED`.
4. `AuditEvent` kayıtları migrate edilmez — bunlar geçmiş log bilgisidir; V2'de sıfır noktasından başlar.

Migration scripti gerekirse `infra/scripts/migrate-v1-to-v2.sql` ve bir C# `MigrationTool` yardımcı projesi olarak oluşturulur.

---

## Risk Değerlendirmesi

| Risk | Olasılık | Etki | Azaltma |
|------|---------|------|--------|
| V1 çalışırken V2 geliştirmek için çift bağlam yükü | Orta | Düşük | Ayrı dizinler (`src/` ve `v1/`), net dizin sınırı, V1'e bakılmadan V2 geliştirilebilir |
| `agents-main` kataloğunun V2 `CapabilityRegistry` seed formatına dönüştürülmesi | Düşük | Orta | Dosya taraması basit; seed formatı JSON; V1 katalog yapısı değiştirilmez |
| Blazor Server öğrenme eğrisi | Orta | Düşük | Blazor Server component modeli React'e kavramsal olarak benzer; Faz 5 son faz olduğu için öğrenme için yeterli süre var |
| SQL Server Docker kurulumu ve Windows ortam sorunları | Düşük | Düşük | `docker-compose.yml` geliştirme ortamı kurulumunu standartlaştırır; LocalDB fallback opsiyonel olarak belgelenecek |
| V1 marker ve template'lerinin V2'ye port edilmesi sırasında içerik kayıpları | Düşük | Orta | `templates/role-profiles/` dizini V1'den kopyalanır; diff ile doğrulanır |

---

## Geçiş Adımları

Adımlar sıralı olarak uygulanır. Her adım bir önceki tamamlanmadan başlamaz.

### Adım 1 — V1 Kodu Taşıma

```
mevcut dizin → v1/ altına taşı (git mv veya kopyalama)
v1/apps/
v1/packages/
v1/agents-main/
v1/memory/
v1/templates/
```

V1 `package.json` ve Node.js konfigürasyonları `v1/` altında kalır. `D:\Dev\CrewOps\` root'u temizlenir.

### Adım 2 — .NET Solution Oluşturma

```bash
cd D:\Dev\CrewOps
dotnet new sln -n CrewOps
# Faz 1'de her proje için: dotnet new classlib / dotnet sln add
```

### Adım 3 — Faz 1: Domain Katmanı

`CrewOps.Domain` ve `CrewOps.Contracts` projeleri, `CrewOps.Domain.Tests` test projesi. Detay: IMPLEMENTATION_PLAN.md → Faz 1.

### Adım 4 — Faz 2: Infrastructure Katmanı

EF Core, SQL Server, `AnthropicHttpClient`. Docker Compose ile yerel SQL Server. Detay: IMPLEMENTATION_PLAN.md → Faz 2.

### Adım 5 — Faz 3: Application + API

MediatR handler'ları, `PmService`, `PlannerService`, Minimal API endpoint'leri, SignalR hub. Detay: IMPLEMENTATION_PLAN.md → Faz 3.

### Adım 6 — Faz 4: Execution + Orchestration

`LocalClaudeWorker` (V1 `ClaudeCodeRunner` port), `OrchestrationLoop` (V1 port), `WorkspaceManager`, `CapabilityRegistry`. Detay: IMPLEMENTATION_PLAN.md → Faz 4.

### Adım 7 — Faz 5: Governance + Web UI

`ApprovalGateEngine`, `AuditEventPublisher`, Blazor Server sayfaları. Detay: IMPLEMENTATION_PLAN.md → Faz 5.

### Adım 8 — Production Geçişi

V2 MVP başarı kriterleri doğrulandıktan sonra (bkz. MVP_SCOPE.md) production kullanımı V2'ye taşınır. V1 `v1/` dizininde arşiv olarak tutulur.

---

## V1 Korunacak Değerler

V1 prototip olarak çalıştı ve bu süreçte önemli bilgiler üretildi. Aşağıdakiler V1'den V2'ye birebir veya adapte edilerek port edilir:

| V1 Bileşen | V2 Hedef | Not |
|---|---|---|
| `OutputParser` (5-bölüm contract parser) | `WorkerResultNormalizer` | 5-bölüm sözleşme (SUMMARY/FILES_CHANGED/PATCH/NEXT/RISKS) korunur |
| `sanitizeSkillContent()` | `SkillContentSanitizer` | Unsafe pattern listesi genişletilir |
| `OrchestrationLoop` | `OrchestrationLoop` | DAG mantığı korunur; retry policy sınıfa taşınır |
| `PmChatEngine` | `PmService` | Marker algılama dahil |
| `PmPlannerEngine` | `PlannerService` | Task decomposition mantığı |
| `templates/roles/*.json` | `templates/role-profiles/` | Format adapte edilir; içerik korunur |
| `agents-main/` katalog | `CapabilityRegistry` seed | Startup scan ile yüklenir |

---

*Son güncelleme: 2026-03-08*
