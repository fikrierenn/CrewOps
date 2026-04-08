# CrewOps — AI Takım Orkestratörü

PM-first, onay-yönetimli, evrensel AI takım orkestratörü. Kullanıcı **sadece PM ile konuşur**, seçilen sektöre göre agent takımı oluşturulur ve işi halleder.

**Güzellik salonu, diş kliniği, restoran, avukat — hangi sektör olursa olsun.**

## Ne Yapıyor?

1. PM ile sohbet et → "Bursa'daki diş kliniklerini bul"
2. PM plan çıkarır → görevlere böler, rolleri atar
3. Onaylarsan orkestrasyon başlar → agent'lar çalışır
4. Google Search ile gerçek işletmeler bulunur (ilçe ilçe)
5. Web sitesi doğrulaması yapılır (HTTP + SEO analizi)
6. Premium demo siteler oluşturulur (6 farklı template)
7. WhatsApp/mail pazarlama mesajları hazırlanır

## Gerçek Sonuç Örneği

**Bursa Diş Klinikleri** projesi:
- 3 ilçe (Nilüfer, Osmangazi, Yıldırım) tarandı
- **39 diş kliniği** bulundu
- **30 demo site** oluşturuldu
- **21+ pazarlama mesajı** hazırlandı

## Tech Stack

**V2 (aktif geliştirme):**
- .NET 10, C# 13, ASP.NET Core Minimal API
- Blazor Server (dark theme dashboard)
- SQL Server + EF Core
- MediatR (CQRS), Serilog, SignalR (real-time)
- Multi-LLM: Groq (Llama 3.3 70B) + Gemini (Google Search) + Claude

**V1 (referans):** Node.js, TypeScript, Express, React/Vite, SQLite

## Kurulum

### Gereksinimler
- .NET 10 SDK
- SQL Server (LocalDB veya Express)
- API key'lerden en az biri: Groq, Gemini, Claude

### Adımlar

```bash
git clone https://github.com/fikrierenn/CrewOps.git
cd CrewOps

# appsettings oluştur
cp src/CrewOps.Api/appsettings.example.json src/CrewOps.Api/appsettings.json
# API key'lerini düzenle

# DB oluştur
dotnet ef database update --project src/CrewOps.Infrastructure --startup-project src/CrewOps.Api

# Çalıştır
dotnet run --project src/CrewOps.Api
```

Tarayıcıda: `http://localhost:5037`

## Proje Yapısı

```
src/
  CrewOps.Domain/          → DDD: Aggregates, value objects, state machine
  CrewOps.Contracts/       → DTOs, commands, queries
  CrewOps.Application/     → MediatR handlers, mapping
  CrewOps.Capabilities/    → SkillSourceScanner, CapabilityRegistry
  CrewOps.Infrastructure/  → EF Core, SQL Server, repositories
  CrewOps.Api/             → Minimal API + Blazor Server + SignalR

agents-main/plugins/       → 74 plugin, 112 agent, 147 skill
templates/team-templates/  → 6 TeamTemplate JSON
tests/                     → 115 test (xUnit + FluentAssertions)
```

## Özellikler

### Pipeline
- **PM Chat**: Groq ile anında plan çıkarma
- **Akıllı LLM routing**: Web search → Gemini, content → Groq, fallback → Claude
- **İlçe ilçe arama**: Her ilçe ayrı Google sorgusu
- **Lead doğrulama**: WebsiteProber (HTTP) → Gemini Search → SeoAnalyzer
- **SEO analizi**: Meta tag, mobile, SSL, H1, img alt, skor 0-100
- **Demo site**: 6 premium template (MagicUI animasyonları)
- **Pazarlama mesajı**: Lead'e özel WhatsApp/mail şablonu

### Dashboard (Blazor)
- PM Chat (quick action butonları)
- Proje listesi + durum takibi
- Lead listesi + demo site linkleri
- Görev panosu + execution timeline
- Agent aktivite logu + analytics

### Geliştirme Workflow (Superpowers adaptasyonu)
- `/design-gate` → 9 adımlı tasarım onayı
- `/verify` → kanıt-tabanlı doğrulama
- `/debug` → 4 fazlı sistematik debugging
- `/review-two-stage` → spec uyumu + kod kalitesi

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/health` | Sağlık kontrolü |
| POST | `/api/projects/universal` | Yeni proje oluştur |
| POST | `/api/projects/{id}/chat` | PM'e mesaj gönder |
| POST | `/api/orchestration/{id}/start` | Orkestrasyon başlat |
| POST | `/api/orchestration/{id}/verify-leads` | Lead doğrulama |
| POST | `/api/orchestration/{id}/generate-demos` | Demo site oluştur |
| GET | `/api/demo-templates/preview` | Template önizleme |
| GET | `/api/team-templates` | Takım şablonları |
| GET | `/api/skills` | 147 skill listesi |

## Template Preview

`http://localhost:5037/demo-preview.html` — 6 template × 12 renk = 72 kombinasyon

| Template | Stil |
|----------|------|
| Luxury Dark | Aurora, meteor, glass cards |
| Modern Minimal | Blur-fade, border-beam, shimmer |
| Warm Organic | Retro grid, serif, earth tones |
| Bold Gradient | Gradient mesh, pulsing borders |
| Magazine Editorial | Large type, striped pattern |
| Interactive Card | Magic card (mouse tracking), marquee |

## Lisans

Proprietary — Tüm hakları saklıdır.
