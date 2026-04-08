# İş Planı ve Yol Haritası

CrewOps’u agent orkestratörü olarak tamamlama ve dokümante etme için yapılanlar ve kalan işler.

---

## 1. Tamamlananlar (Özet)

- **Subagents / Agent teams**: `.claude/agents/*.md` ve docs/agent-teams.md; rollerin Claude Code ile uyumlu tanımı.
- **Web + API**: apps/web (Vite+React), apps/api (Express); projeler, görevler, roller, hafıza, geçmiş, agent-catalog, run/start, run/stream, run/finished.
- **Core**: ClaudeCodeRunner, GeminiRunner, LLMRunner (model `gemini:` ise Gemini); agentCatalog (listAgents, loadAgent, agentToRoleConfig); WorkflowEngine, MemoryEngine, OutputParser, ArtifactManager, RoleRegistry.
- **Sözleşmeler**: output_contract (PATCH + COMMANDS_TO_RUN_MANUALLY, dosya sadece PATCH); task_contract.
- **Guarded Mode**: Komut otomatik çalışmaz; patch sadece kullanıcı onayıyla.
- **Dokümantasyon**: docs/00–07 ve agent-teams, architecture ile proje yapısı, katmanlar, Agent Skills, run pipeline ve sözleşmeler dokümante edildi.

---

## 2. Devam Eden / Kısa Vadeli

- **Web – Rol/Agent birleşik liste**: Görev formunda `GET /api/agent-catalog` ile katalog agent’larının alınması ve rol dropdown’ında “Built-in” + “Katalog” şeklinde birleşik liste. API ve core hazır; frontend’de dropdown’ın bu veriyle doldurulması.
- **README**: CrewOps’u “agent’ları besleyen ve yöneten orkestrasyon arayüzü” olarak net şekilde konumlandıran kısa bölüm.

---

## 3. Orta Vadeli (Agent Skills Entegrasyonu)

- **Agent–Skill eşlemesi**: agents-main’de `plugins/<id>/skills/*/SKILL.md` taranması; hangi skill’lerin hangi agent’a bağlı olduğunun (örn. aynı plugin) tanımlanması.
- **Skill yükleme**: Seçilen agent için ilgili Skill’lerin SKILL.md gövdesinin (Level 2) okunması; token üst sınırı ile prompt’a “İlgili Skills” bölümü olarak eklenmesi.
- **Token bütçesi**: Skill metinleri için maksimum token veya karakter sınırı; öncelik (örn. sadece description’da eşleşen skill’ler) isteğe bağlı.

Detay: [02-agent-skills.md](02-agent-skills.md).

---

## 4. Uzun Vadeli / Opsiyonel

- **Agent teams (Claude Code)**: Deneysel flag ile çoklu oturum; CrewOps’tan “takım” başlatma (lead + teammate’lar) için entegrasyon.
- **Skill Level 3**: Script ve ek referans dosyalarının koşu ortamında kullanılması (büyük ölçüde CLI tek-seferlik modeli ile sınırlı).
- **Çoklu dil / çoklu stack**: Proje şablonları ve preset’lerin genişletilmesi.

---

## 5. Doküman Güncellemesi

Yeni özellikler eklendikçe:

- Mimari değişiklikler → 01-vision-and-architecture.md, 04-layers-and-data-flow.md.
- Skill/agent değişiklikleri → 02-agent-skills.md, 05-agent-catalog-and-roles.md.
- Run/contract değişiklikleri → 06-run-pipeline-and-contracts.md.
- Repo yapısı → 03-project-structure.md.

Bu dosya (07-work-plan-and-roadmap.md) tamamlanan ve planlanan işlerin özeti olarak güncellenebilir.
