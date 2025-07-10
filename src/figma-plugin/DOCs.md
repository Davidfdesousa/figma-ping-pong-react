# Fluxo de Carregamento de Módulos

## 1. Registro dos módulos (via `define`)

Na ordem em que você faz os `import './xxx'` no topo do `index.ts`, o loader simplesmente armazena cada módulo:

- `utils`
- `collections`
- `tokenGeneration`
- `comparison`
- `githubConfig`
- `app`

Até aqui não executa nenhuma lógica de negócio, só registra fábrica e dependências.

---

## 2. Resolução (e execução) dos módulos (via `require`)

Ainda dentro do `index.ts`, você faz:

```ts
export const { loadCollections } = require('collections')
export const { generateTokensData } = require('tokenGeneration')
export const { compareTokens } = require('comparison')
export const { loadGitHubConfig, saveGitHubConfig } = require('githubConfig')
export const { handleMessage } = require('app')
```

A partir daqui, o loader:

1. **`require('collections')`**  
   → executa a fábrica de `collections` (injetando o `figma`) e guarda o resultado.

2. **`require('tokenGeneration')`**  
   → antes de rodar a fábrica, puxa `figma` e `utils` (chama `require('utils')` se ainda não foi) e então executa a fábrica.

3. **`require('comparison')`**  
   → executa a fábrica de `comparison` (não tem dependências além de si mesmo).

4. **`require('githubConfig')`**  
   → executa a fábrica de `githubConfig` (injeção de `figma`).

5. **`require('app')`**  
   → para rodar o `app` ele precisa, em ordem, de:

   - `collections` (já carregado)  
   - `tokenGeneration` (já carregado)  
   - `comparison` (já carregado)  
   - `githubConfig` (já carregado)  
   - `utils` (já carregado)  
   - `figma` (global)  

   Então ele chama a função `factory(collections, tokenGeneration, …, figma)`, retorna `{ handleMessage }` e guarda esse valor.

---

## 3. Inicialização do plugin

Agora que você tem `handleMessage`, o resto é puro Figma API:

```ts
const app = require('app')
figma.showUI(__html__, { width: 500, height: 800 })
figma.ui.onmessage = app.handleMessage
```

Ou seja, só depois de todos os `require` acima sua UI aparece e o roteador de mensagens fica pronto.

---

## 4. Resumindo a ordem de execução das fábricas

1. `utils` (na primeira vez que `tokenGeneration` ou outro pedir)  
2. `collections`  
3. `tokenGeneration`  
4. `comparison`  
5. `githubConfig`  
6. `app`

E então, finalmente, `app.handleMessage` passa a ser chamado sempre que a UI enviar algo. Cada módulo é executado **apenas uma vez**, graças ao cache interno do loader.
