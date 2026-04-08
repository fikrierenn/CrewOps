---
description: "CrewOps V2 feature geliştirme — gereksinim → tasarım → implementasyon → test → doğrulama"
argument-hint: "<feature açıklaması> [--phase plan|implement|test|all]"
---

# CrewOps Feature Geliştirme

End-to-end feature geliştirme orkestratörü. Her aşamada checkpoint ile kontrollü ilerleme.

## Faz 0: Ön Kontrol

1. `dotnet build src/CrewOps.Domain/` — projenin derlendiğini doğrula
2. Mevcut hataları gidermeden ilerle**ME**
3. Feature açıklamasını anla ve kapsamı belirle

## Faz 1: Design Gate (Zorunlu)

> `/design-gate` komutunu çalıştır. 9 adımlı keşif süreci ile tasarımı onayla.

Eğer `/design-gate` zaten çalıştırıldıysa, onaylanan atom plan'ı referans al.
Çalıştırılmadıysa, burada kısaltılmış versiyonu uygula:

1. Etkilenen aggregate'leri ve katmanları belirle
2. Mevcut dosyaları oku (tahmine dayalı tasarım YAPMA)
3. Benzer pattern'leri bul (Project.cs, ExecutionRun.cs referans)
4. Atom görevlere böl (2-5 dk, tam dosya yolu + kod bloğu, placeholder YASAK)
5. Tasarım kararlarını kullanıcıya sun

**CHECKPOINT 1**: Kullanıcı onayı olmadan Faz 2'ye geçme.

## Faz 2: İmplementasyon

Domain-first yaklaşım — her zaman bu sırada:

1. **Value Objects** — yeni enum veya record gerekiyorsa
2. **Domain Events** — yeni event gerekiyorsa
3. **Aggregate değişiklikleri** — property, method, factory method
4. **Port/Interface** — yeni repository veya service interface
5. **Application handlers** — MediatR command/query handlers
6. **Infrastructure** — EF Core configuration, external service
7. **API endpoints** — Minimal API route'lar
8. **UI** — Blazor component/page

Her adımda:
- Atom plan'dan sapmama — planlanan kodu yaz, fazlasını YAPMA
- Mevcut pattern'leri takip et (Project.cs, CrewOpsTask.cs referans)
- `sealed class`, `private set`, factory method kurallarına uy
- XML doc comment'ler Türkçe
- Her atom sonrası: `dotnet build` ile doğrula (kanıtsız "çalışıyor" deme → `/verify`)

**CHECKPOINT 2**: Implementasyon tamamlandı mı? Devam etmeden önce derleme başarılı olmalı.

## Faz 3: Test

1. Test dosyası oluştur: `tests/CrewOps.Domain.Tests/{Feature}Tests.cs`
2. Happy path test'leri yaz
3. Failure path test'leri yaz (invalid state transitions, null checks)
4. Edge case test'leri yaz
5. `dotnet test` ile tüm test'leri çalıştır

Test kuralları:
- xUnit + FluentAssertions
- `MethodName_Scenario_ExpectedResult` naming
- Arrange-Act-Assert pattern
- Her test bağımsız olmalı

## Faz 4: Doğrulama

1. `dotnet build` — sıfır warning
2. `dotnet test` — tüm test'ler yeşil
3. Domain katmanında dış bağımlılık yok — `dotnet list package` ile kontrol
4. Oluşturulan/değiştirilen dosya listesi
5. Kullanıcıya özet sun
