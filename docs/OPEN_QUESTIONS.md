# CrewOps V2 — Açık Sorular

Bu belge tasarım sürecinde ortaya çıkan ve kesin karar verilmemiş soruları kayıt altında tutar. Her soru bağlamı, mevcut önerisi ve önceliğiyle birlikte belgelenmiştir.

Sorular bağımsız olarak takip edilir; bir sorunun karar verilmesi diğer soruları etkilemiyorsa sıralarına bakılmaksızın karara bağlanabilir.

---

## Durum Aciklamasi

| Simge | Anlam |
|-------|-------|
| ACIK | Henüz karar verilmedi |
| KARAR VERILDI | Karar açıklanmış, uygulama bekliyor veya uygulandı |
| SONRAYA BIRAK | V2.1 veya sonraki iterasyon için ertelendi |

---

## Soru 1: `[MUTABAKAT_HAZIR]` Markeri Ingilizceye Cevrilmeli mi?

**Durum:** ACIK

**Baglam:**
V1'de PM'in LLM output'unda ürettiği Türkçe marker: `[MUTABAKAT_HAZIR]`. V2'de İngilizce alternatifleri değerlendirildi: `[AGREEMENT_READY]`.

Bu marker, detection regex'inde, tüm PM chat contract template'lerinde, role JSON tanımlarında ve test fixture'larında yer alır. Değiştirme kararı bu dosyaların tamamını etkiler.

**Oneri:** Koru. Türkçe domain dili CrewOps'un kimliğinin bir parçasıdır. Marker değişikliğinin getireceği fayda, güncellenmesi gereken dosya sayısıyla orantılı değildir.

**Alternatif:** `[AGREEMENT_READY]` — İngilizce birliktelik tercih edilirse bu seçilebilir.

**Karar:** *(henüz verilmedi)*

**Etkilenen bilesenler:** `PmService` (detection regex), `templates/role-profiles/` (tüm PM role tanımları), test fixture'ları.

---

## Soru 2: Worker Izolasyon Seviyesi MVP'de Ne Olmali?

**Durum:** ACIK

**Baglam:**
V1'de `ClaudeCodeRunner`, Claude Code CLI'yı doğrudan proje repo'suna spawn ediyordu. Workspace izolasyonu yoktu; başarısız bir run proje dosyalarını bozabiliyordu.

V2 için üç seçenek değerlendirildi:

1. **Temp directory** — Her run için ayrı geçici dizin, proje dosyalarının shallow copy'si. Basit, hızlı.
2. **Snapshot copy** — Proje repo'sunun tam snapshot'ı alınır; başarısız run geri döndürülebilir. Daha güvenli, daha yavaş.
3. **Docker container** — Tam izolasyon; ağ ve dosya sistemi tamamen ayrı. En güvenli, en karmaşık.

**Oneri:** MVP'de temp directory (Seçenek 1). Container izolasyonu V2.1'e ertelenir.

**Gerekce:** MVP'de tek kullanıcı ve kontrollü ortam. Temp directory yeterli izolasyonu sağlar; container kurulumu MVP karmaşıklığını gereksiz artırır.

**Karar:** *(henüz verilmedi)*

**Etkilenen bilesenler:** `WorkspaceManager`, `IWorkspaceManager` arayüzü, `SECURITY_GUARDRAILS.md`.

---

## Soru 3: Blazor Server Baglanti Kesilmesi Edge Case

**Durum:** ACIK

**Baglam:**
Blazor Server, tarayıcı ile sunucu arasında kalıcı bir WebSocket bağlantısı üzerinden çalışır. Uzun süren execution run sırasında bağlantı kesilirse UI durumu kaybeder. `ExecutionRun` veritabanında çalışmaya devam eder; ancak kullanıcı sayfayı yenilediğinde devam eden çalışmayı göremeyebilir.

**Etki seviyesi:** MVP için kabul edilebilir. Tek kullanıcı, local network. Bağlantı kesilme riski düşük.

**Azaltma:** `ExecutionRun` durumu her adımda DB'ye yazılır. Sayfa yenilemede son durum `GetProjectByIdQuery` ile sorgulanır; UI state rebuild edilir. SignalR yeniden bağlantıda mevcut stream'e katılma mekanizması araştırılacak.

**Karar:** *(henüz verilmedi)*

**Etkilenen bilesenler:** `RunConsole.razor`, `ExecutionHub`, `ExecutionRunManager`.

---

## Soru 4: CapabilityRegistry Startup Scan mi, Migration Sirasinda mi?

**Durum:** ACIK

**Baglam:**
V1'deki `agents-main/` kataloğu (73 plugin, 112 agent, 129 skill) V2 `CapabilityRegistry` için seed kaynağı. Bu seed ne zaman ve nasıl yapılmalı?

**Secenekler:**

1. **Startup file scan** — Her başlatmada `v1/agents-main/` dizini taranır; yeni veya değişen dosyalar DB'ye sync edilir. Dinamik; kod değişikliği gerekmez.
2. **Seed migration** — Tek seferlik migration; ilk kurulumda çalışır, sonuçlar DB'ye yazılır. Statik; değişiklik için yeniden migration gerekir.
3. **Manuel import** — Admin kullanıcısı UI'dan JSON dosya seçerek import eder. Kontrollü; fakat sürtünme yaratır.

**Oneri:** Startup file scan (Seçenek 1). En az sürtünme, canlı güncelleme, geliştirme sırasında katalog değişikliklerini otomatik yakalar.

**Karar:** *(henüz verilmedi)*

**Etkilenen bilesenler:** `FileSystemCapabilityLoader`, `CapabilityRegistry`, uygulama başlatma pipeline'ı.

---

## Soru 5: Memory Dosyalari Temizlenmeli mi?

**Durum:** KARAR VERILDI

**Baglam:**
`memory/` dizinindeki dosyalar (NOW.md, DECISIONS.md, ARCH_SHORT.md) farklı bir projeye ait içerik barındırıyor. V2'de file-based memory mimarisi kullanılmıyor; tüm proje durumu SQL Server'da tutulur.

**Karar:** V2 geliştirmesi başlamadan önce `memory/` dizini temizlenecek. `memory/` → `v1/memory/` olarak taşınacak; silinmeyecek. V2'de file-based memory yoktur.

**Aksiyon:** `CURRENT_STATE_ASSESSMENT.md`'de belgelendi.

---

## Soru 6: SQL Server Lokal Gelistirme icin Docker Zorunlu mu?

**Durum:** KARAR VERILDI

**Karar:** `infra/docker/docker-compose.yml` ile SQL Server 2022 Developer Edition Docker container'ı sağlanacak. Geliştirici makinesinde Docker Desktop kurulu olması yeterli. LocalDB (SQL Server Express LocalDB) opsiyonel fallback olarak belgelenecek; `appsettings.Development.json`'da connection string örneği verilecek.

---

## Soru 7: MVP'de Paralel Task Execution Olacak mi?

**Durum:** KARAR VERILDI

**Karar:** MVP'de sıralı yürütme (serial execution). Paralel yürütme V2.1'e ertelendi.

**Gerekce:** Paralel yürütme iki ek gereksinim doğurur: birden fazla `ExecutionRun`'ın aynı anda izole workspace'lerde çalışması ve `ExecutionHub`'ın birden fazla stream'i multiplexing ile istemciye göndermesi. Bu karmaşıklık MVP kapsamını aşıyor.

**Mimariye etkisi:** `OrchestrationLoop.cs` sıralı tasarımla yazılır; ancak `ITaskDispatcher` arayüzü paralel genişlemeye kapalı olmayacak şekilde tasarlanır.

---

## Soru 8: ApprovalGate icin UI Akisi Nasil Olmali?

**Durum:** ACIK

**Baglam:**
MVP'de tek kullanıcı aynı zamanda hem PM hem de approver rolündedir. `ApprovalPanel.razor` iki farklı onay noktasında kullanılır: agreement onayı ve final insan incelemesi.

**Secenekler:**

1. **Basit buton** — Onayla / Reddet. Yorum isteğe bağlı.
2. **Onay formu** — Yorum alanı zorunlu; approver kararını gerekçelendirmek zorunda.
3. **Checklist** — Approver her gate kuralını ayrı ayrı onaylar.

**Oneri:** Basit buton (Seçenek 1), isteğe bağlı yorum alanı. MVP'de sürtünme minimuma indirilmeli; zorunlu gerekçe V2.1'de opsiyonel yapılabilir.

**Karar:** *(henüz verilmedi)*

**Etkilenen bilesenler:** `ApprovalPanel.razor`, `ApproveAgreementCommand`, `ApproveDeliveryCommand`.

---

## Soru 9: Blazor UI'in Turkce Metinleri Nasil Yonetilecek?

**Durum:** KARAR VERILDI

**Karar:** Blazor UI metinleri (butonlar, etiketler, başlıklar, bildirimler, hata mesajları) Türkçe yazılacak. Çoklu dil desteği (i18n / resource files) V2 kapsamında değil. Kod (C# class/method adları, Blazor component adları, parametre adları) İngilizce kalır.

**Gerekce:** CrewOps tek kullanıcı, local-first. i18n altyapısı kurmak MVP karmaşıklığını artırır; fayda orantısız.

---

## Soru 10: Delivery Model'de Gercek CI/CD Entegrasyonu?

**Durum:** SONRAYA BIRAK

**Baglam:**
`IDeploymentProvider` arayüzü tasarlandı (bkz. `TARGET_ARCHITECTURE.md` → Releases katmanı). Gerçek implementasyon GitHub Actions webhook, Azure DevOps pipeline trigger veya shell script ile yapılabilir.

**Karar:** MVP'de `IDeploymentProvider` stub/mock implementasyonu. `LocalDeploymentProvider` sembolik olarak bir klasöre "deploy" eder. Gerçek CI/CD entegrasyonu V2.1.

---

## Soru 11: `RiskItem` Seviye Esikleri Kim Belirler?

**Durum:** ACIK

**Baglam:**
`RiskGateEngine`, worker output'undaki RISKS bölümünden `RiskItem` listesi üretir ve her bir item'a `LOW/MEDIUM/HIGH/CRITICAL` seviyesi atar. Bu atama şu anda LLM output'undan parse ediliyor (V1 davranışı). V2'de iki seçenek var:

1. **LLM-belirlenen seviye** — LLM output'undaki severity etiketi olduğu gibi kullanılır.
2. **Kural tabanlı yeniden değerlendirme** — `RiskGateEngine`, LLM seviyesini keyword pattern'leriyle override edebilir.

**Oneri:** Karma yaklaşım: LLM output'unu temel al, `ForbiddenActions` pattern eşleşmelerini `CRITICAL` olarak override et.

**Karar:** *(henüz verilmedi)*

**Etkilenen bilesenler:** `RiskGateEngine`, `WorkerResultNormalizer`, `SECURITY_GUARDRAILS.md`.

---

## Soru 12: EF Core Migration Stratejisi — Code First mi, Database First mi?

**Durum:** KARAR VERILDI

**Karar:** Code First. EF Core migration'ları `src/CrewOps.Infrastructure/Persistence/Migrations/` dizininde tutulur. Veritabanı şeması her zaman C# entity sınıflarından türetilir. `dotnet ef database update` ile migration uygulanır.

**Gerekce:** V2 greenfield proje; mevcut bir veritabanı şeması yok. Code First geliştirme hızını artırır ve şema değişikliklerini versiyon kontrolünde tutar.

---

*Son güncelleme: 2026-03-08*
