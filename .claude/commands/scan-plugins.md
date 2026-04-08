---
description: "agents-main/ plugin envanteri — mevcut agent, skill ve domain'leri tara ve raporla"
argument-hint: "[domain filtresi]"
---

# Plugin Envanter Taraması

agents-main/plugins/ dizinini tarayarak mevcut agent, skill ve domain envanterini çıkar.

## Tarama

1. `agents-main/plugins/` altındaki tüm dizinleri listele
2. Her plugin için:
   - `agents/*.md` dosyalarını say ve listele
   - `skills/*/SKILL.md` dosyalarını say ve listele
   - `commands/*.md` dosyalarını say ve listele
   - `.claude-plugin/plugin.json`'dan versiyon ve açıklamayı oku

Domain filtresi verilmişse sadece ilgili plugin'leri göster.

## Envanter Raporu

### Domain Özeti

| Domain | Plugin Sayısı | Agent Sayısı | Skill Sayısı | Command Sayısı |
|--------|--------------|-------------|-------------|----------------|
| backend | X | X | X | X |
| frontend | X | X | X | X |
| marketing | X | X | X | X |
| seo | X | X | X | X |
| ... | ... | ... | ... | ... |
| **TOPLAM** | **X** | **X** | **X** | **X** |

### Agent Detayları

Her agent için:
- İsim ve açıklama (YAML frontmatter'dan)
- Model tier (haiku/sonnet/opus/inherit)
- Ait olduğu plugin

### Skill Detayları

Her skill için:
- İsim ve açıklama (YAML frontmatter'dan)
- Dosya boyutu (KB)
- Ait olduğu plugin

## TeamTemplate Uygunluğu

Taranan agent'ları mevcut TeamTemplate'lerle eşleştir:
- `templates/team-templates/` altındaki şablonları oku
- Her şablondaki roleSlots'ta referans edilen agent'ların mevcut olup olmadığını kontrol et
- Eşleşmeyen role ID'leri raporla

## Eksik Analizi

- Hangi domain'ler için TeamTemplate yok?
- Hangi agent'lar hiçbir TeamTemplate'te kullanılmıyor?
- Skill'i olmayan plugin'ler hangileri?
- Çok büyük (>15KB) SKILL.md dosyaları var mı? (references/ altına taşınmalı)
