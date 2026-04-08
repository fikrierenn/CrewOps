---
description: "agents-main/ altına yeni plugin dizini oluştur (agent + skill scaffold)"
argument-hint: "<plugin-name>"
---

# Yeni Plugin Oluştur

agents-main/plugins/ altına yeni bir plugin scaffold'la: dizin yapısı, plugin.json, agent tanımı ve opsiyonel skill dosyaları.

## Ön Kontroller

1. `agents-main/plugins/` altında aynı isimde plugin var mı kontrol et
2. `.claude-plugin/marketplace.json` oku — mevcut plugin listesini öğren
3. Kullanıcıdan plugin'in amacını ve domain'ini öğren

## Dizin Yapısı Oluştur

```
agents-main/plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── {agent-name}.md
└── skills/
    └── {skill-name}/
        └── SKILL.md
```

## plugin.json Oluştur

```json
{
  "name": "{plugin-name}",
  "version": "1.0.0",
  "description": "{Plugin açıklaması}",
  "author": {
    "name": "CrewOps",
    "email": ""
  },
  "license": "MIT"
}
```

## Agent Dosyası Oluştur

`agents/{agent-name}.md` — YAML frontmatter + body:

```yaml
---
name: {agent-name}
description: {Bir cümle uzmanlık açıklaması}
model: sonnet
---
```

Body bölümleri:
1. Opening: "You are a [role] specializing in..."
2. `## Purpose`
3. `## Capabilities` (alt başlıklarla)
4. `## Behavioral Traits` (8-10 madde)
5. `## Response Approach` (numaralı adımlar)
6. `## Example Interactions`

Model seçimi:
- Rutin/hızlı iş → `haiku`
- Dengeli → `sonnet`
- Kritik/mimari → `opus`

## SKILL.md Oluştur (opsiyonel)

Kullanıcı skill isterse `skills/{skill-name}/SKILL.md` oluştur:

```yaml
---
name: {skill-name}
description: {Skill açıklaması}
---
```

Body: When to Use, Core Concepts, Best Practices, Common Pitfalls bölümleri.
Max ~10KB — fazlası `references/` altına.

## Tamamlama

1. Oluşturulan dosyaları listele
2. marketplace.json'a yeni plugin'i ekle
3. SkillSourceScanner'ın bulacağını doğrula (dizin yapısı kontrolü)
