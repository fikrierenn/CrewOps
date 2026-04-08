# Agent Kataloğu ve Roller

CrewOps’ta “rol” iki kaynaktan gelir: **built-in roller** ve **agent kataloğu** (agents-main). Her ikisi de nihayette prompt’ta “bu rolün talimatları” olarak kullanılır.

---

## 1. Built-in Roller

- **Konum**: `templates/roles/*.json`.
- **Yükleme**: `RoleRegistry` (packages/core) monorepo kökünü `rootDir` kabul eder; `path.join(rootDir, "templates", "roles")` altındaki JSON dosyalarını okur.
- **İçerik**: roleId, displayName, avatar, skills, workStyle (markdown metin), defaultModelPolicy, definitionOfDone.
- **Kullanım**: Görev oluştururken “Rol” olarak seçilen built-in rol id’si (örn. `backend`, `frontend`) doğrudan bu şablonla eşlenir; `workStyle` ve diğer alanlar prompt’a eklenir.

---

## 2. Agent Kataloğu (agents-main)

- **Konum**: `agents-main/plugins/<plugin>/agents/*.md` (veya `CREWOPS_AGENTS_PATH`).
- **API**: Core’da `listAgents(rootDir)` ve `loadAgent(rootDir, agentId)`; API’de `GET /api/agent-catalog` bu listeyi döner.
- **Agent .md formatı**: YAML frontmatter (name, description, model) + gövde (markdown). `parseAgentMd` ile ayrıştırılır.
- **RoleConfig’e dönüşüm**: `agentToRoleConfig(agentId, loaded)` ile CrewOps’un RoleConfig formatına çevrilir; böylece prompt builder ve LLMRunner aynı yapıyı kullanır. `workStyle` = agent gövdesi; model “inherit” veya frontmatter’daki değer.

---

## 3. Rol/Agent Seçimi (Web ve API)

- **Görev formu**: Rol alanında hem built-in roller hem katalog agent’ları gösterilir (birleşik liste). Katalog agent’ları `GET /api/agent-catalog` ile alınır; “Built-in” ve “Katalog” grupları veya tek listede id/name/description ile sunulur.
- **Koşu başlatma**: `POST /run/start` ile gelen `roleId`:
  - Eğer built-in rol id’si ise → RoleRegistry’den şablon alınır.
  - Değilse → Katalogdan `loadAgent(rootDir, roleId)` denenir; bulunursa `agentToRoleConfig` ile RoleConfig üretilir.
- **Model**: Katalog agent’ında `model` alanı varsa kullanılır; yoksa “inherit” veya kullanıcının seçtiği model (modelOverride) kullanılır.

---

## 4. Prompt Kompozisyonu

Koşu için tek prompt şu bileşenlerden oluşturulur (sıra örnek):

1. **Rol/Agent talimatları**: RoleConfig’in workStyle (ve displayName/description) metni.
2. **Görev**: Task title + description + bağlam.
3. **Hafıza**: NOW, DECISIONS, ARCH_SHORT içerikleri.
4. **Task contract**: Görev sözleşmesi metni.
5. **Output contract**: SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY kuralları.

İleride Agent Skills entegre edilirse (bkz. [02-agent-skills.md](02-agent-skills.md)), seçilen agent’a bağlı Skill’lerin SKILL.md gövdesi “İlgili Skills” bölümü olarak rol talimatlarından sonra eklenebilir.

---

## 5. Dış Kaynaklar (claude-code-templates)

[davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) repodan agent ve skill’ler agents-main’e uyarlanarak eklenebilir:

- **development-team** (agents): `cli-tool/components/agents/development-team/` — backend-architect, backend-developer, code-architect, code-explorer, test-generator, test-runner, ios-developer vb. CrewOps’ta `agents-main/plugins/development-team/agents/` altında yer alır.
- **senior-backend** (skill): `cli-tool/components/skills/development/senior-backend/` — agents-main’de `backend-development/skills/senior-backend/` olarak eklenmiştir.

Yeni agent/skill eklerken resmî format için claude-code-main; içerik örneği için claude-code-templates kullanılabilir (bkz. [08-claude-code-main.md](08-claude-code-main.md)).

## 6. Özet

- **Built-in roller**: `templates/roles/*.json`, RoleRegistry.
- **Katalog agent’ları**: agents-main/plugins/*/agents/*.md, agentCatalog (listAgents, loadAgent, agentToRoleConfig).
- **Birleşik kullanım**: Aynı RoleConfig soyutlaması; prompt’ta tek “rol talimatları” bloğu. Web’de rol seçimi tek listede Built-in + Katalog olarak sunulur.
