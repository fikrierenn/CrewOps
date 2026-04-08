# CrewOps Proje Dokümantasyonu – Genel Bakış

CrewOps, **çok-ajanlı (multi-agent) yazılım geliştirme süreçlerini** yöneten, web tabanlı bir **orkestrasyon arayüzüdür**. Agent kataloglarını (ör. agents-main) besleyen, roller ve görevleri yöneten, Claude Code ve Gemini CLI ile çalışan tek merkez olarak konumlandırılır.

---

## Doküman İndeksi

| Dosya | İçerik |
|-------|--------|
| [01-vision-and-architecture.md](01-vision-and-architecture.md) | Vizyon, hedefler, üst seviye mimari |
| [02-agent-skills.md](02-agent-skills.md) | Agent Skills (Anthropic): yapı, seviyeler, CrewOps entegrasyonu |
| [03-project-structure.md](03-project-structure.md) | Repo dizin yapısı, paketler, uygulamalar |
| [04-layers-and-data-flow.md](04-layers-and-data-flow.md) | Katmanlar (core/db/api/web), veri akışı |
| [05-agent-catalog-and-roles.md](05-agent-catalog-and-roles.md) | Built-in roller, agent kataloğu, prompt kompozisyonu |
| [06-run-pipeline-and-contracts.md](06-run-pipeline-and-contracts.md) | Koşu akışı, çıktı sözleşmesi, Guarded Mode |
| [07-work-plan-and-roadmap.md](07-work-plan-and-roadmap.md) | İş planı, fazlar, yol haritası |
| [08-claude-code-main.md](08-claude-code-main.md) | claude-code-main klasörü: yapı, plugin/agent/skill formatı, CrewOps ilişkisi |
| [09-nasil-kullanilir.md](09-nasil-kullanilir.md) | Web arayüzü ile adım adım kullanım rehberi |
| [10-proje-incelemesi-detay.md](10-proje-incelemesi-detay.md) | Tüm projenin detaylı incelemesi (yapı, API, DB, akışlar) |
| [agent-teams.md](agent-teams.md) | Claude Code Subagents vs Agent Teams (mevcut) |
| [architecture.md](architecture.md) | Mimari notlar (mevcut) |

---

## Kısa Özet

- **CrewOps**: Projeler, görevler, bağımlılıklar, hafıza (NOW/DECISIONS/ARCH_SHORT) ve koşu geçmişini yönetir; hangi **agent/rol** ile hangi **LLM** (Claude / Gemini) kullanılacağını seçer.
- **Agent kaynakları**: Built-in roller (`templates/roles`) + dış katalog (`agents-main/plugins/*/agents`). İleride Agent Skills (SKILL.md) ile zenginleştirilebilir.
- **Çıktı**: Sıkı sözleşmeye (SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY) uyan tek bir yanıt; dosya değişiklikleri yalnızca PATCH ile, komutlar yalnızca listede.

Bu dizindeki MD dosyaları proje yapısını, katmanları ve çalışma mantığını tek referans noktasında toplar.
