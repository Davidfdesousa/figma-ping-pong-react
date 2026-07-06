# Figma Plugin API — Referência Técnica

> Documentação baseada exclusivamente nas fontes oficiais da Figma:
> - https://developers.figma.com/docs/plugins/api/
> - https://www.figma.com/plugin-docs/working-with-variables/
> - https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection
>
> **Não contém inferências ou invenções.** Onde há incerteza, está explicitamente marcado.
> Atualizado com base na documentação disponível em julho de 2025.

---

## Índice

1. [Modelo Conceitual de Variáveis](#1-modelo-conceitual-de-variáveis)
2. [VariableCollection](#2-variablecollection)
3. [ExtendedVariableCollection](#3-extendedvariablecollection)
4. [Variable](#4-variable)
5. [VariableAlias](#5-variablealias)
6. [VariableResolvedDataType](#6-variableresolvedtype)
7. [VariableScope](#7-variablescope)
8. [figma.variables — API Global](#8-figmavariables--api-global)
9. [Extended Collections — Como Funcionam](#9-extended-collections--como-funcionam)
10. [Restrições de Plano](#10-restrições-de-plano)
11. [Padrões de Código — Exemplos Oficiais](#11-padrões-de-código--exemplos-oficiais)
12. [Impacto no Plugin (este projeto)](#12-impacto-no-plugin-este-projeto)

---

## 1. Modelo Conceitual de Variáveis

Uma **variável** (`Variable`) é um design token que armazena um valor reutilizável. Toda variável pertence a exatamente uma **collection** (`VariableCollection`). Uma collection define um conjunto de **modos** (ex: `light`, `dark`). Cada variável define um valor para cada modo da sua collection.

```
VariableCollection
  ├── modes: [{modeId, name}, ...]
  └── variableIds: [id1, id2, ...]

Variable
  ├── variableCollectionId  → aponta para a collection dona
  ├── resolvedType          → BOOLEAN | COLOR | FLOAT | STRING
  └── valuesByMode: { [modeId]: VariableValue }
```

`VariableValue` pode ser um valor primitivo ou um `VariableAlias` (referência a outra variável).

---

## 2. VariableCollection

**Fonte:** https://developers.figma.com/docs/plugins/api/VariableCollection/

### Propriedades

| Propriedade | Tipo | Acesso | Descrição |
|---|---|---|---|
| `id` | `string` | readonly | Identificador único da collection |
| `name` | `string` | leitura/escrita | Nome da collection |
| `hiddenFromPublishing` | `boolean` | leitura/escrita | Ocultar ao publicar como biblioteca |
| `remote` | `boolean` | readonly | `true` se for uma collection remota (biblioteca) |
| `isExtension` | `boolean` | readonly | `true` se for uma extended collection |
| `modes` | `Array<{modeId: string, name: string}>` | readonly | Lista de modos definidos |
| `variableIds` | `string[]` | readonly | IDs das variáveis contidas |
| `defaultModeId` | `string` | readonly | ID do modo padrão |
| `key` | `string` | readonly | Chave para uso com `getVariablesInLibraryCollectionAsync` |

### Métodos

| Método | Retorno | Descrição |
|---|---|---|
| `addMode(name: string)` | `string` | Cria novo modo; retorna o **modeId** criado. Limitado pelo plano. |
| `removeMode(modeId: string)` | `void` | Remove um modo pelo ID |
| `renameMode(modeId: string, newName: string)` | `void` | Renomeia um modo |
| `extend(name: string)` | `ExtendedVariableCollection` | Cria uma extended collection a partir desta. Apenas em collections **locais**. Requer Enterprise. |
| `remove()` | `void` | Remove a collection e todas as suas variáveis |
| `getPublishStatusAsync()` | `Promise<PublishStatus>` | Status de publicação |

> **Atenção `addMode`:** A API retorna uma `string` (o `modeId`), não um objeto `{modeId, name}`.
> O padrão observado na documentação oficial confirma isso:
> ```js
> const darkModeId = collection.addMode("dark") // retorna string
> ```
> Para obter o objeto completo, leia `collection.modes` após a chamada.

---

## 3. ExtendedVariableCollection

**Fonte:** https://developers.figma.com/docs/plugins/api/ExtendedVariableCollection/

Uma `ExtendedVariableCollection` **é** uma `VariableCollection` com propriedades adicionais. Herda todos os campos e métodos de `VariableCollection` e adiciona:

### Propriedades exclusivas

| Propriedade | Tipo | Acesso | Descrição |
|---|---|---|---|
| `isExtension` | `true` | readonly | Sempre `true`. Distingue de collections normais. |
| `parentVariableCollectionId` | `string` | readonly | ID da collection pai imediata |
| `rootVariableCollectionId` | `string` | readonly | ID da collection raiz (topo da cadeia de herança) |
| `variableIds` | `string[]` | readonly | IDs de **todas** as variáveis, incluindo as herdadas do pai |
| `variableOverrides` | `{ [variableId: string]: { [extendedModeId: string]: VariableValue } }` | readonly | Apenas os valores que foram explicitamente sobrescritos nesta collection |
| `modes` | `Array<{modeId: string, name: string, parentModeId: string}>` | readonly | Modos herdados do pai. Cada modo tem `parentModeId` apontando para o modo equivalente na collection pai. |

### Métodos exclusivos

| Método | Retorno | Descrição |
|---|---|---|
| `removeOverridesForVariable(variable: Variable)` | `void` | Remove **todos** os overrides desta collection para a variável informada. O valor volta ao herdado do pai. |
| `removeMode(modeId: string)` | `void` | Remove um modo **apenas se o modo pai já tiver sido deletado** |

### Restrições importantes (documentação oficial)

- **Não é possível** adicionar variáveis em uma extended collection — variáveis só existem na collection pai.
- **Não é possível** adicionar modos em uma extended collection — modos são herdados do pai.
- **Não é possível** alterar `name`, `description` ou `scope` de uma variável a partir da extended collection — essas propriedades são editadas na collection pai.
- `variableCollectionId` de uma variável sempre aponta para a **collection onde ela foi criada** (pai), mesmo quando acessada via extended collection.

### Cadeia de herança

```
Collection A (raiz)
  ├── variáveis: [x, y, z]
  ├── modos: [light, dark]
  └── extend("Brand B") → ExtendedCollection B
        ├── herda variáveis de A
        ├── herda modos de A (com novos modeIds)
        ├── variableOverrides: { varId_x: { modeId_B_light: valor_custom } }
        └── extend("Brand C") → ExtendedCollection C
              ├── herda de B (que herda de A)
              ├── rootVariableCollectionId = A.id
              └── parentVariableCollectionId = B.id
```

---

## 4. Variable

**Fonte:** https://developers.figma.com/docs/plugins/api/Variable/

### Propriedades

| Propriedade | Tipo | Acesso | Descrição |
|---|---|---|---|
| `id` | `string` | readonly | Identificador único |
| `name` | `string` | leitura/escrita | Nome da variável |
| `description` | `string` | leitura/escrita | Descrição |
| `hiddenFromPublishing` | `boolean` | leitura/escrita | Ocultar ao publicar |
| `remote` | `boolean` | readonly | `true` se for variável remota |
| `variableCollectionId` | `string` | readonly | ID da collection **dona** (onde foi criada) |
| `key` | `string` | readonly | Chave para uso com `importVariableByKeyAsync` |
| `resolvedType` | `VariableResolvedDataType` | readonly | Tipo resolvido: `BOOLEAN`, `COLOR`, `FLOAT` ou `STRING` |
| `valuesByMode` | `{ [modeId: string]: VariableValue }` | readonly | Valores por modo da **collection dona** (não resolve aliases, não inclui valores de extended collections) |
| `scopes` | `Array<VariableScope>` | leitura/escrita | Onde a variável aparece no picker da UI do Figma |
| `codeSyntax` | `{ [platform]: string }` | readonly | Sintaxe de código por plataforma (`WEB`, `ANDROID`, `iOS`) |

### Métodos

| Método | Retorno | Descrição |
|---|---|---|
| `setValueForMode(modeId: string, newValue: VariableValue)` | `void` | Define valor para um modo. **Se o `modeId` pertencer a uma extended collection, o valor é gravado como override na extension.** |
| `valuesByModeForCollectionAsync(collection: VariableCollection)` | `Promise<{ [modeId: string]: VariableValue }>` | Retorna os valores por modo **para uma collection que herda esta variável**, combinando herança + overrides. Não resolve aliases. Para resolução completa, usar `resolveForConsumer`. |
| `removeOverrideForMode(extendedModeId: string)` | `void` | Remove o override de um modo específico em uma extended collection, revertendo ao valor herdado. |
| `resolveForConsumer(consumer: SceneNode)` | `{ value: VariableValue, resolvedType: VariableResolvedDataType }` | Retorna o valor totalmente resolvido como seria aplicado ao nó informado. |
| `remove()` | `void` | Remove a variável do documento |
| `setVariableCodeSyntax(platform, value)` | `void` | Define sintaxe de código para uma plataforma |
| `removeVariableCodeSyntax(platform)` | `void` | Remove sintaxe de código de uma plataforma |
| `getPublishStatusAsync()` | `Promise<PublishStatus>` | Status de publicação |

### `valuesByMode` vs `valuesByModeForCollectionAsync`

Este é o ponto mais crítico para o plugin:

| | `valuesByMode` | `valuesByModeForCollectionAsync(extColl)` |
|---|---|---|
| Escopo | Modos da **collection dona** (pai) | Modos da **extended collection** informada |
| Inclui overrides? | Não | Sim |
| Inclui herança? | N/A (são os valores originais) | Sim |
| Resolve aliases? | Não | Não |
| Síncrono? | Sim | Não (retorna Promise) |
| Uso | Coletar valores de collections normais | Coletar valores de extended collections |

---

## 5. VariableAlias

**Fonte:** https://developers.figma.com/docs/plugins/api/VariableAlias/

```typescript
interface VariableAlias {
  type: 'VARIABLE_ALIAS'
  id: string  // ID da variável referenciada
}
```

Quando um valor em `valuesByMode` é do tipo `VARIABLE_ALIAS`, significa que aquela variável aponta para outra variável em vez de ter um valor primitivo. Para resolver o valor final, é necessário seguir a cadeia de aliases.

O `id` pode ser usado com `figma.variables.getVariableByIdAsync(id)` para obter a variável referenciada.

---

## 6. VariableResolvedDataType

**Fonte:** https://developers.figma.com/docs/plugins/api/VariableResolvedDataType/

```typescript
type VariableResolvedDataType = "BOOLEAN" | "COLOR" | "FLOAT" | "STRING"
```

| Tipo | Valores aceitos |
|---|---|
| `BOOLEAN` | `true` ou `false` |
| `COLOR` | `{ r: number, g: number, b: number }` (valores 0–1) |
| `FLOAT` | `number` |
| `STRING` | `string` |

Uma variável pode ter um `VariableAlias` como valor para qualquer modo. O `resolvedType` refere-se ao tipo do **valor final** após resolver todos os aliases.

---

## 7. VariableScope

**Fonte:** https://developers.figma.com/docs/plugins/api/VariableScope/

Controla em quais campos do picker da UI do Figma a variável aparece.

```typescript
type VariableScope =
  "ALL_SCOPES" | "TEXT_CONTENT" | "CORNER_RADIUS" | "WIDTH_HEIGHT" | "GAP" |
  "ALL_FILLS" | "FRAME_FILL" | "SHAPE_FILL" | "TEXT_FILL" | "STROKE_COLOR" |
  "EFFECT_COLOR" | "STROKE_FLOAT" | "EFFECT_FLOAT" | "OPACITY" |
  "FONT_FAMILY" | "FONT_STYLE" | "FONT_WEIGHT" | "FONT_SIZE" |
  "LINE_HEIGHT" | "LETTER_SPACING" | "PARAGRAPH_SPACING" | "PARAGRAPH_INDENT"
```

- `ALL_SCOPES` — variável aparece em todos os campos. Não pode ser combinado com outros.
- `ALL_FILLS` — aparece em todos os campos de cor fill. Não pode ser combinado com outros fills.
- Suportado para: `FLOAT`, `STRING` e `COLOR`. `BOOLEAN` não suporta scopes.

---

## 8. figma.variables — API Global

**Fonte:** https://developers.figma.com/docs/plugins/api/figma-variables/

Todos os métodos de variáveis ficam em `figma.variables`.

### Métodos de leitura

| Método | Retorno | Descrição |
|---|---|---|
| `getLocalVariableCollectionsAsync()` | `Promise<VariableCollection[]>` | Todas as collections locais do arquivo (inclui extended collections) |
| `getVariableCollectionByIdAsync(id)` | `Promise<VariableCollection \| null>` | Collection por ID |
| `getLocalVariablesAsync(type?)` | `Promise<Variable[]>` | Todas as variáveis locais, opcionalmente filtradas por tipo |
| `getVariableByIdAsync(id)` | `Promise<Variable \| null>` | Variável por ID |
| `getLocalVariableCollections()` | `VariableCollection[]` | **DEPRECATED** — usar `Async` |
| `getVariableCollectionById(id)` | `VariableCollection \| null` | **DEPRECATED** — usar `Async` |
| `getLocalVariables(type?)` | `Variable[]` | **DEPRECATED** — usar `Async` |
| `getVariableById(id)` | `Variable \| null` | **DEPRECATED** — usar `Async` |

> As versões síncronas (sem `Async`) estão **deprecated** e lançam exceção se o manifest tiver `"documentAccess": "dynamic-page"`.

### Métodos de criação

| Método | Retorno | Descrição |
|---|---|---|
| `createVariableCollection(name)` | `VariableCollection` | Cria uma nova collection |
| `createVariable(name, collection, resolvedType)` | `Variable` | Cria variável dentro de uma collection |
| `extendLibraryCollectionByKeyAsync(collectionKey, name)` | `Promise<ExtendedVariableCollection>` | Cria extended collection a partir de uma collection de biblioteca |

### Helpers

| Método | Retorno | Descrição |
|---|---|---|
| `createVariableAlias(variable)` | `VariableAlias` | Cria um alias para uso em `setBoundVariable` / `setProperties` |
| `createVariableAliasByIdAsync(variableId)` | `Promise<VariableAlias>` | Idem, a partir de ID |
| `setBoundVariableForPaint(paint, field, variable)` | `SolidPaint` | Vincula variável a um `SolidPaint` |
| `setBoundVariableForEffect(effect, field, variable)` | `Effect` | Vincula variável a um `Effect` |
| `setBoundVariableForLayoutGrid(grid, field, variable)` | `LayoutGrid` | Vincula variável a um `LayoutGrid` |
| `importVariableByKeyAsync(key)` | `Promise<Variable>` | Importa variável da biblioteca |

---

## 9. Extended Collections — Como Funcionam

**Fontes:**
- https://www.figma.com/plugin-docs/working-with-variables/ (seção "Extended variable collections")
- https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection

### Conceito

Extended collections permitem theming multi-brand. Uma collection pai define as variáveis e modos base. Collections filhas herdam tudo e podem **sobrescrever** apenas os valores que diferem.

- Feature **exclusiva do plano Enterprise**.
- Uma extended collection não duplica variáveis — as variáveis residem apenas na collection pai.
- Os modos da extended collection têm IDs próprios (diferentes dos modos do pai), codificados com o ID da collection.
- A correspondência entre modo filho e modo pai é feita por `parentModeId`.

### Fluxo de herança de valores

```
Para um dado modeId de uma ExtendedCollection:
  1. Verifica se existe override em variableOverrides[varId][modeId]
  2. Se sim → usa o valor override
  3. Se não → usa o valor do modo pai (via parentModeId em valuesByMode do pai)
```

O método oficial que faz isso automaticamente é:

```javascript
// retorna { [extendedModeId]: VariableValue } com herança + overrides já combinados
const values = await variable.valuesByModeForCollectionAsync(extendedCollection);
```

### Criar uma extended collection via API

```javascript
// A partir de uma collection local
const localCollection = figma.variables.createVariableCollection("base");
const extColl = localCollection.extend("brand-x");

// A partir de uma collection de biblioteca
const libCollection = await figma.variables.getVariableCollectionByIdAsync("...");
const extColl = await figma.variables.extendLibraryCollectionByKeyAsync(
  libCollection.key,
  "brand-x"
);
```

### Sobrescrever um valor em uma extended collection

```javascript
// modeId deve ser o modeId da EXTENDED collection (não do pai)
const modeId = extendedCollection.modes[0].modeId; // ex: "VariableCollectionId:1:3/0:1"
const variable = await figma.variables.getVariableByIdAsync(extendedCollection.variableIds[0]);

// setValueForMode com modeId de extended collection → grava como override
variable.setValueForMode(modeId, { r: 1, g: 0, b: 0 });
```

### Ler valores de uma extended collection

```javascript
// valuesByMode retorna apenas os valores da collection PAI (não inclui overrides)
console.log(variable.valuesByMode);
// { "parentModeId_light": { r: 0, g: 0, b: 0 } }

// valuesByModeForCollectionAsync retorna herança + overrides da extended collection
const values = await variable.valuesByModeForCollectionAsync(extendedCollection);
console.log(values);
// { "extModeId_light": { r: 1, g: 0, b: 0 } }  ← override aplicado

// variableOverrides: apenas o que foi explicitamente sobrescrito
console.log(extendedCollection.variableOverrides);
// { "VariableID:1:4": { "extModeId_light": { r: 1, g: 0, b: 0 } } }
```

### Remover overrides

```javascript
// Remove override de um modo específico (valor volta ao herdado do pai)
variable.removeOverrideForMode(extendedCollection.modes[0].modeId);

// Remove todos os overrides desta variável na extended collection
extendedCollection.removeOverridesForVariable(variable);
```

### Limitações de uma extended collection (UI Figma)

Segundo a documentação do Help Center:
- Não é possível adicionar variáveis ou modos em uma extended collection — tudo vem do pai.
- Não é possível alterar nome, descrição ou scope de variáveis a partir da extended collection.
- Valores que diferem do pai aparecem destacados em azul na UI.
- O botão "Reset change" reverte o override para o valor herdado do pai.

### Migração de collections existentes

O Help Center documenta dois cenários de migração:

**Cenário 1 — Collection única com múltiplos modos de brand:**
1. Exportar cada modo como JSON (`Export mode`)
2. Deletar os modos brand-específicos, manter apenas o modo base
3. Criar uma extended collection para cada brand via `Extend collection`
4. Importar o JSON de cada brand na extended collection correspondente

**Cenário 2 — Múltiplas collections separadas por brand:**
1. Exportar todos os modos de cada collection de brand
2. Escolher uma collection como pai
3. Criar extended collections a partir dela para cada brand
4. Importar os JSONs nas extended collections

---

## 10. Restrições de Plano

| Recurso | Plano necessário |
|---|---|
| Extended collections (`extend()`, `extendLibraryCollectionByKeyAsync()`) | **Enterprise** |
| `addMode()` | Limitado por plano (ex: free = 1 modo por collection) |

Erros lançados pela API quando o plano não suporta:
- `extend()`: `"in extend: Cannot create extended collections outside of enterprise plan."`
- `addMode()`: `"in addMode: Limited to N modes only"` (onde N é o limite do plano)

O campo `isExtension` em `VariableCollection` existe em todos os planos e pode ser lido para detectar se uma collection é extended, mesmo que criar novas não seja possível.

---

## 11. Padrões de Código — Exemplos Oficiais

### Listar collections e variáveis

```javascript
// Listar todas as collections locais
const collections = await figma.variables.getLocalVariableCollectionsAsync();

// Listar todas as variáveis locais
const variables = await figma.variables.getLocalVariablesAsync();

// Filtrar por tipo
const colorVars = await figma.variables.getLocalVariablesAsync('COLOR');
```

### Criar collection e variável

```javascript
const collection = figma.variables.createVariableCollection("new-collection");
collection.renameMode(collection.modes[0].modeId, "light");

const darkModeId = collection.addMode("dark"); // retorna string (modeId)

const colorVar = figma.variables.createVariable("primary", collection, "COLOR");
colorVar.setValueForMode(collection.modes[0].modeId, { r: 0, g: 0, b: 0 });
colorVar.setValueForMode(darkModeId, { r: 1, g: 1, b: 1 });
```

### Ler e exportar tokens

```javascript
const collections = await figma.variables.getLocalVariableCollectionsAsync();

for (const collection of collections) {
  const isExtended = collection.isExtension === true;

  for (const varId of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(varId);

    let valuesByMode;
    if (isExtended) {
      // Para extended collections, usar o método que combina herança + overrides
      valuesByMode = await variable.valuesByModeForCollectionAsync(collection);
    } else {
      // Para collections normais, valuesByMode é suficiente
      valuesByMode = variable.valuesByMode;
    }

    for (const [modeId, value] of Object.entries(valuesByMode)) {
      if (value.type === 'VARIABLE_ALIAS') {
        // É um alias — referenciar a outra variável pelo ID
        const aliasVar = await figma.variables.getVariableByIdAsync(value.id);
        // aliasVar.name contém o caminho para resolver como {path.to.token}
      } else {
        // Valor primitivo: COLOR, FLOAT, BOOLEAN ou STRING
      }
    }
  }
}
```

### Detectar extended collections

```javascript
const collections = await figma.variables.getLocalVariableCollectionsAsync();

for (const collection of collections) {
  if (collection.isExtension === true) {
    // É uma ExtendedVariableCollection
    console.log("Parent ID:", collection.parentVariableCollectionId);
    console.log("Root ID:", collection.rootVariableCollectionId);

    // Modos têm parentModeId
    for (const mode of collection.modes) {
      console.log(`Mode: ${mode.name}, parentModeId: ${mode.parentModeId}`);
    }

    // Ver apenas o que foi sobrescrito
    console.log("Overrides:", collection.variableOverrides);
  }
}
```

---

## 12. Impacto no Plugin (este projeto)

### Como o plugin usa a API hoje

O `FigmaApiService` em `code.js` usa as versões **sync** (deprecated) por compatibilidade com a estrutura atual do manifest. Se o manifest for atualizado para `"documentAccess": "dynamic-page"`, **todas as chamadas síncronas lançarão exceção** e precisarão ser migradas para as versões `Async`.

| Chamada atual no plugin | Versão correta (Async) |
|---|---|
| `figma.variables.getLocalVariableCollections()` | `figma.variables.getLocalVariableCollectionsAsync()` |
| `figma.variables.getLocalVariables()` | `figma.variables.getLocalVariablesAsync()` |
| `figma.variables.getVariableCollectionById(id)` | `figma.variables.getVariableCollectionByIdAsync(id)` |
| `figma.variables.getVariableById(id)` | `figma.variables.getVariableByIdAsync(id)` |

### `addMode` retorna string, não objeto

A documentação oficial confirma que `addMode(name)` retorna uma `string` (o `modeId`), não um objeto `{modeId, name}`. O `ModeManager` em `code.js` trata isso corretamente com um fallback que lê `collection.modes` após a chamada, mas o comportamento ideal é:

```javascript
const newModeId = collection.addMode("novo-modo"); // string
// Para obter o objeto completo:
const newModeObj = collection.modes.find(m => m.modeId === newModeId);
```

### Leitura de valores em extended collections

O `TokenGenerator` deve usar `variable.valuesByModeForCollectionAsync(collection)` quando `collection.isExtension === true`. Isso garante que overrides sejam incluídos e que o mapeamento `modeId → valor` use os IDs de modos da extended collection (não do pai).

Usar `variable.valuesByMode` em uma extended collection retornaria os modos e valores da collection **pai** — os modeIds seriam diferentes e os overrides não apareceriam.

### variableCollectionId em variáveis de extended collections

Uma variável criada na collection pai tem `variableCollectionId` apontando para o **pai**, mesmo quando listada via `extendedCollection.variableIds`. Isso significa:

```javascript
const variable = await figma.variables.getVariableByIdAsync(extendedCollection.variableIds[0]);
variable.variableCollectionId; // ID da collection PAI, não da extended
```

O plugin trata isso corretamente identificando a collection pelo contexto (qual collection está sendo processada), não pelo `variableCollectionId` da variável.

### Não é possível criar modos ou variáveis em extended collections

Se alguma feature futura precisar adicionar modos, isso deve ser feito na **collection pai**. A extended collection herda automaticamente. Tentar chamar `addMode()` em uma `ExtendedVariableCollection` causará erro (a API não expõe `addMode` em extended collections — `removeMode` só está disponível para remover modos cujo pai foi deletado).

---

## Links de Referência

| Documento | URL |
|---|---|
| Variable | https://developers.figma.com/docs/plugins/api/Variable/ |
| VariableCollection | https://developers.figma.com/docs/plugins/api/VariableCollection/ |
| ExtendedVariableCollection | https://developers.figma.com/docs/plugins/api/ExtendedVariableCollection/ |
| VariableAlias | https://developers.figma.com/docs/plugins/api/VariableAlias/ |
| VariableResolvedDataType | https://developers.figma.com/docs/plugins/api/VariableResolvedDataType/ |
| VariableScope | https://developers.figma.com/docs/plugins/api/VariableScope/ |
| figma.variables (global) | https://developers.figma.com/docs/plugins/api/figma-variables/ |
| Working with Variables (guia) | https://www.figma.com/plugin-docs/working-with-variables/ |
| Extend a variable collection (Help Center) | https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection |
