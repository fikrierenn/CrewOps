# development-team

Geliştirme takımı agent'ları: mimari, backend, frontend, test, mobil, DevOps, CLI/UI. CrewOps agent kataloğunda rol olarak seçilebilir.

**Kaynak:** [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) — `cli-tool/components/agents/development-team/`

## Eklenen agent'lar

| Agent | Açıklama |
|-------|----------|
| backend-architect | RESTful API, microservice sınırları, DB şeması, ölçeklenebilirlik |
| backend-developer | Sunucu tarafı API’ler, microservices, DB, auth, cache, test |
| code-architect | Kod tabanı analizi, uygulama mavi baskıları, dosya/component tasarımı |
| code-explorer | Execution path analizi, mimari katmanlar, bağımlılık haritası |
| test-generator | Test case üretimi, mevcut test pattern’leri, edge case’ler |
| test-runner | Test çalıştırma, hata analizi, kök neden ve düzeltme önerileri |
| ios-developer | Swift/SwiftUI, UIKit, Core Data, App Store uyumu |

Orijinal repoda ayrıca şunlar var: frontend-developer, fullstack-developer, devops-engineer, ui-designer, ui-ux-designer, cli-ui-designer, electron-pro, mobile-developer, mobile-app-developer, flutter-ui-developer. İhtiyaç halinde aynı formatta eklenebilir.

## Kullanım

CrewOps web arayüzünde veya API’de görev oluştururken **Rol/Agent** listesinde "development-team" plugin’inden bu agent’lar görünür (örn. `backend-architect`, `code-explorer`, `test-runner`).
