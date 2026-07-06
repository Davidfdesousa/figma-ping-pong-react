# Figma Token Exporter Plugin — Contexto Estrutural

> Leia este arquivo sempre que precisar entender o projeto antes de fazer qualquer alteração.
> Para referência técnica completa da Figma Plugin API (Variable, VariableCollection, ExtendedVariableCollection, etc.), consulte **`FIGMA_API.md`**.

---

## Visão Geral

Plugin Figma que exporta variáveis/design tokens das collections do Figma em formato JSON estruturado, com suporte a criação de brands e push para GitHub via PR.

**Stack:**
- Plugin Figma: JavaScript puro (`code.js` + `ui.html`)
- Interface React/TypeScript: Vite + React + Tailwind + shadcn/ui (pasta `src/`)
- Nota: a interface React (`src/`) existe como playground/referência, mas o plugin em si é o par `code.js` + `ui.html`

---

## Arquivos Principais

| Arquivo | Função |
|---|---|
| `code.js` | Código backend do plugin (roda no contexto Figma) |
| `ui.html` | Interface do plugin (roda em iframe sandboxado) |
| `manifest.json` | Manifesto do plugin Figma |
| `src/figma-output/selected-tokens.json` | Arquivo de destino para exportação via GitHub |
| `src/tokens/` | Tokens de referência (foundation + themes) |

---

## Arquitetura do code.js

O `code.js` usa padrão de projeto orientado a objetos com as seguintes classes:

### Classes Utilitárias
- **`Utils`** — helpers: formatação de cores (RGB→HEX), parsing de caminhos de token, normalização de strings, base64
- **`Logger`** — wrapper de console com emojis para níveis: info, success, warning, error, debug

### Serviços de API Figma
- **`FigmaApiService`** — abstração das chamadas async à API `figma.variables.*`
  - `getLocalVariableCollections()` — retorna todas as collections locais
  - `getLocalVariables()` — retorna todas as variáveis locais
  - `getVariableCollectionById(id)` — collection por ID
  - `getVariableById(id)` — variável por ID

### Gerenciadores de Negócio
- **`CollectionManager`** — carrega todas as collections (padrão e extended); envia para UI via `collections-loaded`
- **`ModeManager`** — cria um novo modo em **qualquer** collection a partir de IDs vindos da UI, copiando valores de um modo base; completamente agnóstico a nomes de collection ou de modo
- **`GitHubManager`** — salva/carrega config, cria PR no GitHub com o JSON dos tokens

### Geração de Tokens
- **`TokenGenerator`** — itera variáveis filtradas por collection IDs, resolve aliases (`VARIABLE_ALIAS` → `{path.to.token}`), formata valores e monta a estrutura JSON aninhada

### Padrão Command
- **`MessageHandler`** — roteador de mensagens da UI; cria e executa comandos
- **Comandos:** `LoadCollectionsCommand`, `ExportSelectedTokensCommand`, `LoadBrandsCommand`, `CreateBrandInFigmaCommand`, `SaveGitHubConfigCommand`, `ExportToGitHubCommand`, `ClosePluginCommand`

### Façade de Inicialização
- **`PluginController`** — mostra UI (500×600px), registra listener de mensagens

---

## Comunicação UI ↔ Backend (code.js)

```
UI (ui.html)  ──postMessage──>  code.js
code.js  ──figma.ui.postMessage──>  UI (ui.html)
```

### Mensagens UI → code.js (MESSAGE_TYPES)
| Tipo | Payload | Ação |
|---|---|---|
| `load-collections` | — | Carrega todas as collections (padrão e extended) |
| `export-selected-tokens` | `selectedCollections: string[]` | Exporta tokens como JSON para download |
| `export-to-github` | `selectedCollections, commitDescription` | Cria PR no GitHub |
| `create-mode-in-collection` | `collectionId, baseModeId, newModeName` | Cria novo modo em qualquer collection, copiando valores do modo base |
| `save-github-config` | `config: {token, owner, repo}` | Salva config no clientStorage |
| `load-github-config` | — | Lê config do clientStorage |
| `close` | — | Fecha o plugin |

### Mensagens code.js → UI
| Tipo | Dados |
|---|---|
| `collections-loaded` | `data: CollectionInfo[]` |
| `tokens-exported` | `data: StructuredTokensJSON` |
| `mode-created-in-collection` | `collectionName, modeName, variablesUpdated, data` |
| `github-config-loaded` | `data: GitHubConfig` |
| `github-config-saved` | `message` |
| `github-success` | `message, prUrl` |
| `github-error` / `mode-error` / `load-error` | `message` |

> **Princípio de agnosticidade:** o plugin nunca assume nomes de collections ou modos. Todo fluxo parte dos dados reais lidos do Figma. A UI recebe as collections, exibe para o usuário escolher, e envia de volta apenas IDs — nunca strings fixas como "Brands", "Global", "Tech", etc.

---

## Formato de Output JSON (selected-tokens.json)

### Estrutura Geral
```json
{
  "NomeDaCollection": {
    "caminhoDoToken": {
      "value": "<valorPrimário>",
      "type": "other",
      "$extensions": {
        "mode": {
          "NomeDoModo1": "<valor1>",
          "NomeDoModo2": "<valor2>"
        }
      }
    }
  }
}
```

**Regras:**
- O campo `$extensions.mode` só é incluído se a collection tiver **mais de 1 modo**.
- O `value` principal é sempre o valor do **primeiro modo** da collection.
- Aliases são resolvidos como referências `{caminho.do.token}` (barras viram pontos).
- Cores são convertidas de RGB float para HEX (`#RRGGBB`).
- Floats são formatados como `"<n>px"`.
- O caminho do token é derivado do nome da variável: separadores `/` e `-` viram `.` para criar o objeto aninhado.

### Exemplo com Multi-modo (collection "Semantics" — modos: light, dark, contrast)
```json
{
  "Semantics": {
    "border": {
      "value": "{colors.neutral.0}",
      "type": "other",
      "$extensions": {
        "mode": {
          "light": "{colors.neutral.0}",
          "dark": "{colors.neutral.900}",
          "contrast": "{colors.neutral.0}"
        }
      }
    }
  }
}
```

### Exemplo sem modos (collection "Primitives" — 1 modo)
```json
{
  "Primitives": {
    "colors": {
      "neutral": {
        "0": { "value": "#F1F1F1", "type": "other" }
      }
    }
  }
}
```

---

## Estrutura de Collections Esperada no Figma (Projeto Padrão)

| Collection | Modos | Descrição |
|---|---|---|
| `Primitives` | 1 (Value) | Cores brutas, espaçamentos, fontes, borders |
| `Semantics` | 3 (light, dark, contrast) | Tokens semânticos que referenciam Primitives |
| `Brands` | N (Tech, Nature, Creative...) | Tokens de brand; cada **modo** é uma brand |
| `Global` | 1 | Tokens globais sem tema |

---

## Extended Collections (Figma Enterprise)

### O que são
Feature do Figma Enterprise que permite criar collections "filhas" que **herdam** variáveis e modos de uma collection "pai". A collection filha pode **sobrescrever** apenas os valores específicos da sua brand/contexto.

### Diferença na API Figma
Uma `ExtendedVariableCollection` tem propriedades adicionais em relação a uma `VariableCollection` normal:

| Propriedade | Tipo | Descrição |
|---|---|---|
| `isExtension` | `true` | Flag que identifica que é uma extended collection |
| `parentVariableCollectionId` | `string` | ID da collection pai |
| `rootVariableCollectionId` | `string` | ID da collection raiz (topo da cadeia) |
| `variableOverrides` | `{ [varId]: { [modeId]: VariableValue } }` | Valores sobrescritos (apenas os overrides) |
| `modes` | `Array<{modeId, name, parentModeId}>` | Modos herdados (cada modo tem `parentModeId`) |

### Estrutura no Figma com Extended Collections
```
[Brands] (collection pai/raiz)
   ↳ [Brands/Tech]  (extended collection — sobrescreve cores Tech)
   ↳ [Brands/Nature] (extended collection — sobrescreve cores Nature)
   ↳ [Brands/Creative] (extended collection — sobrescreve cores Creative)
```

### Como o Plugin Trata Extended Collections
O plugin detecta `collection.isExtension === true` e:
1. **Na listagem de collections:** exibe a collection com badge "Extended" e informa qual é a collection pai
2. **Na exportação:** para variáveis de extended collections, usa o método oficial da API Figma `variable.valuesByModeForCollectionAsync(extendedCollection)` que retorna automaticamente o mapa `{ modeId: valor }` já com herança + overrides resolvidos. Existe também um fallback manual via `variableOverrides` para versões antigas da API.
3. **Sem conflito de nós:** variáveis de extended collections têm `variableCollectionId` apontando para a **extended collection**, não para a pai. Portanto, selecionando pai + filho, cada variável é processada uma vez, na sua própria collection. O JSON final é idêntico ao formato padrão.

### Método oficial da API Figma para Extended Collections
```javascript
// Retorna { [modeId]: VariableValue } com herança+overrides já resolvidos
const values = await variable.valuesByModeForCollectionAsync(extendedCollection);
```

---

## Fluxo de Exportação

```
UI clica "Exportar"
  → postMessage { type: 'export-selected-tokens', selectedCollections: [id1, id2...] }
  → ExportSelectedTokensCommand.execute()
  → TokenGenerator.generateTokensData([id1, id2...])
    → FigmaApiService.getLocalVariables()
    → para cada variável:
        → getVariableCollectionById(variable.variableCollectionId)
        → se collection.id está nos selecionados → processa
        → para cada modo: extrai valor (resolve alias se necessário)
        → monta tokenData { value, type, $extensions }
        → insere em structuredTokens[collectionName][tokenPath...]
  → postMessage { type: 'tokens-exported', data: structuredTokens }
UI recebe → cria link de download do JSON
```

---

## Fluxo de Exportação para GitHub

```
UI clica "Exportar para GitHub"
  → GitHubManager.exportToGitHub(selectedCollectionIds, commitDescription)
  → TokenGenerator.generateTokensData(selectedCollectionIds)
  → GitHub API: GET main branch SHA
  → GitHub API: POST criar branch 'figma-tokens-update-{timestamp}'
  → GitHub API: GET SHA do arquivo existente (src/figma-output/selected-tokens.json)
  → GitHub API: PUT atualizar arquivo (conteúdo em base64)
  → GitHub API: POST criar PR
  → postMessage { type: 'github-success', prUrl }
```

---

## Estrutura de Pastas src/ (Interface React — referência/playground)

```
src/
  tokens/
    foundation/
      colors.json      ← cores primitivas
      font.json        ← fontes
      border.json      ← bordas
      spacing.json     ← espaçamentos
      sizing.json      ← tamanhos
    themes/
      tech/            ← tokens específicos do tema Tech
        color.json, opacity.json, size.json, spacing.json, text.json
      nature/          ← idem para Nature
      creative/        ← idem para Creative
      funka/           ← idem para Funka
  figma-output/
    selected-tokens.json  ← OUTPUT do plugin (atualizado pelo PR do GitHub)
```

---

## Constantes Importantes (code.js)

```javascript
CONSTANTS = {
  MAX_MODES_PER_COLLECTION: 4,      // limite de modos por collection no Figma free
  GITHUB_API_BASE: 'https://api.github.com',
  TARGET_FILE_PATH: 'src/figma-output/selected-tokens.json'
}
```

---

## Notas de Desenvolvimento

- O `code.js` não usa módulos ES (é um arquivo único, concatenado).
- A UI (`ui.html`) é um HTML/JS vanilla embutido — sem bundler, sem imports.
- Ao adicionar funcionalidades, manter os padrões: novas classes, novos Command objects, novos MESSAGE_TYPES.
- Nunca fazer commit automático — o usuário não quer commits automáticos.
- Testar via Figma Desktop: Plugins > Development > Import plugin from manifest.
