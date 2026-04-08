# Görev Sözleşmesi (Task Contract)

Bu sözleşme, AI Team Orchestrator içindeki her rol çalıştırması için geçerlidir.

## Rol
- Rol kimliği: belirli bir uzman rol (ör. `pm`, `architect`, `backend`, `frontend`, `sql`, `qa`, `devops`).
- Rol, kendi `skills`, `workStyle` ve `definitionOfDone` tanımına uymalıdır.

## Amaç (Objective)
- Verilen görevi, minimum token kullanımı ile, mümkün olduğunca odaklı ve artımlı (incremental) şekilde tamamlamak.
- Gereksiz kapsam genişletmesinden, proje dışı konulardan ve uzun anlatımlardan kaçınmak.

## Kapsam Kısıtları (Scope Constraints)
- Sadece verilen depo (project repo path) içinde çalış.
- Sadece görev açıklamasında ve hafıza dosyalarında belirtilen hedeflere odaklan.
- Yeni dosya/klasör oluşturma, değiştirme veya silme yapacaksan bunu **sadece PATCH diff'i içinde** ifade et; serbest metinde tarif etmek yeterli değildir.
- Büyük refactor'lar yerine küçük, gözden geçirilebilir adımlar tercih et.

## Zorunlu Girdiler (Required Inputs)
Aşağıdaki üç hafıza dosyası HER rol koşumu için girdi olarak kabul edilir ve **okunmuş varsayılmalıdır**:

- `memory/NOW.md`
- `memory/DECISIONS.md`
- `memory/ARCH_SHORT.md`

Bu dosyalar:
- Mevcut odak ve blokajları (`NOW.md`),
- Alınmış önemli kararları (`DECISIONS.md`),
- Mimariyi yüksek seviyede (`ARCH_SHORT.md`)
özetler.

Rol, bu içerikleri dikkate alarak hareket etmelidir.

## Çıktı Sözleşmesi (Output Contract Requirement)
- Üretilen çıktı **mutlaka** `templates/output_contract.md` dosyasında tanımlanan format ile **birebir uyumlu** olmalıdır.
- Ek açıklama, serbest metin, uyarı veya başka bir bölüm **EKLEME**.
- Özellikle:
  - `SUMMARY:` başlığı altında en fazla 5 madde,
  - `FILES_CHANGED:` altında dokunulan dosya yolları (veya boş),
  - `PATCH:` altında mutlaka bir ```diff kod bloğu (boş olabilir),
  - `NEXT:` altında en fazla 3 madde,
  - `RISKS:` altında en fazla 5 madde,
  - `COMMANDS_TO_RUN_MANUALLY:` altında (varsa) insan tarafından çalıştırılması gereken komutlar (her satırda bir komut) olmalıdır.

- Shell / CLI komutlarını **kesinlikle kendin çalıştırma**. Gerekli gördüğün komutları sadece `COMMANDS_TO_RUN_MANUALLY` bölümünde listele (ör. `npm init -y`, `npm install express pg`).

Parser, bu sözleşmeye sıkı şekilde bağımlıdır; uyumsuzluk, çalıştırmanın "başarısız" sayılmasına neden olur.

## Kısalık ve Odak (Brevity Constraints)
- Tüm metinler mümkün olduğunca kısa, doğrudan ve net olmalıdır.
- Açıklamalar gereksiz ayrıntılara girmemeli; sadece görevi tamamlamak için gereken kadar bağlam sağlanmalıdır.
- `SUMMARY`, `NEXT` ve `RISKS` bölümlerindeki her madde tek cümle veya kısa ifade olmalıdır.

