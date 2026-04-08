---
description: "Yeni TeamTemplate JSON dosyası oluştur (takım şablonu tanımlama)"
argument-hint: "<template-id> <domain>"
---

# Yeni TeamTemplate Oluştur

Belirtilen domain için yeni bir takım şablonu JSON dosyası oluştur.

## Ön Kontroller

1. `templates/team-templates/` dizinini kontrol et — mevcut şablonları listele
2. `agents-main/plugins/` altında belirtilen domain'le ilgili plugin'leri bul
3. O plugin'lerdeki agent .md dosyalarını oku — mevcut rolleri öğren

## Bilgi Topla

Kullanıcıya sor (bilinmiyorsa):
- Takım adı (Türkçe displayName)
- Hangi roller gerekli (agents-main/'den mevcut agent'ları öner)
- Deploy gerektiriyor mu? (GovernancePreset: FullSoftware vs Minimal)
- Çıktı tipi nedir? (CodePatch / Document / Analysis / Plan)
- Repo path gerekli mi?

## JSON Oluştur

Dosya: `templates/team-templates/{template-id}.json`

```json
{
  "id": "{template-id}",
  "displayName": "{Türkçe ad}",
  "domain": "{domain}",
  "description": "{Türkçe açıklama}",
  "roleSlots": [
    {
      "roleProfileId": "{agent-name}",
      "isRequired": true,
      "maxInstances": 1,
      "capabilityPackIds": []
    }
  ],
  "workflowBundleId": "{domain}-delivery",
  "governance": {
    "requireAgreement": true,
    "requirePlanApproval": true,
    "requireHumanReview": true,
    "hasQaPhase": false,
    "hasStagingGate": false,
    "hasProductionGate": false
  },
  "defaultOutputType": "Document",
  "requiresRepoPath": false
}
```

## Doğrulama

1. JSON geçerli mi kontrol et
2. roleSlots'taki roleProfileId'lerin agents-main/'de karşılığı var mı kontrol et
3. Sonucu kullanıcıya göster
