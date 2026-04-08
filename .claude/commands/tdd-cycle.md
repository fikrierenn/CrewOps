---
description: "TDD döngüsü — RED → GREEN → REFACTOR disipliniyle test-first geliştirme"
argument-hint: "<test edilecek özellik>"
---

# TDD Döngüsü (Red-Green-Refactor)

Strict TDD disipliniyle CrewOps V2 geliştirme. Her adımda önce test yaz, sonra kodu yaz.

## Kural: Asla test yazmadan kod yazma.

## Adım 1: Test Mimarisi

1. Hedef özelliği anla
2. Test edilecek senaryoları listele:
   - Happy path (başarılı akış)
   - Failure path (hata durumları)
   - Edge case (sınır değerler)
3. Test sınıfı ve dosya yapısını belirle

## Adım 2: RED — Başarısız Test Yaz

Bir test yaz. Henüz implemente ETME.

```csharp
[Fact]
public void MethodName_Scenario_ExpectedResult()
{
    // Arrange
    var sut = ...;

    // Act
    var result = ...;

    // Assert
    result.Should().Be(expected);
}
```

`dotnet test` çalıştır — test KIRMIZI olmalı (başarısız).
Eğer test zaten yeşilse: test yanlış yazılmış, düzelt.

## Adım 3: GREEN — Minimum Kod Yaz

Testi geçirecek EN MİNİMAL kodu yaz. Fazlasını yazma.
- Hardcoded değer bile olabilir bu aşamada
- Hedef: testi yeşile çevirmek, güzel kod yazmak DEĞİL

`dotnet test` çalıştır — test YEŞİL olmalı.

## Adım 4: REFACTOR — Temizle

Kod kalitesini iyileştir (test yeşil kalmalı):
- Duplicate kodu kaldır
- İsimlendirmeyi düzelt
- Pattern'e uy (factory method, sealed class, vb.)

`dotnet test` çalıştır — hala YEŞİL olmalı.

## Adım 5: Sonraki Test

Senaryo listesinden bir sonraki testi al ve Adım 2'ye dön.

Tüm senaryolar tamamlanana kadar döngüyü tekrarla:
```
RED → GREEN → REFACTOR → RED → GREEN → REFACTOR → ...
```

## Tamamlama

1. Tüm test'ler yeşil: `dotnet test`
2. Kapsam özeti: kaç test, kaç senaryo
3. İmplemente edilen kod listesi
4. Kalan edge case'ler varsa belgele
