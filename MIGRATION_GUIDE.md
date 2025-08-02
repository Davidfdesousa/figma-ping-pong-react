# Guia de Migração - Figma Token Exporter v7.0.0

## Overview

Este guia ajuda você a migrar do formato de export antigo (JSON único) para o novo formato estruturado em pastas.

## Mudanças Principais

### Antes (v6.x)
```json
{
  "Global": {
    "spacing/small": {
      "value": "8px",
      "type": "other"
    },
    "colors/primary": {
      "value": "#3366CC", 
      "type": "other"
    }
  },
  "Creative Brand": {
    "colors/brand-primary": {
      "value": "#E61945",
      "type": "other"
    }
  }
}
```

### Depois (v7.0+)
```
src/tokens/
├── foundation/
│   ├── spacing.json
│   └── primitives.json
└── themes/
    └── creative/
        └── color.json
```

## Migração Automática

### 1. Usando o Plugin

1. **Abrir o plugin** no Figma
2. **Selecionar coleções** que deseja exportar
3. **Escolher formato**:
   - "Export Single JSON" (formato antigo)
   - "Export Structured Tokens" (formato novo)
   - "Download Tokens ZIP" (formato novo + ZIP)

### 2. Script de Conversão

Para converter JSONs antigos para nova estrutura:

```javascript
/**
 * Script para converter tokens do formato antigo para novo
 */
const fs = require('fs');
const path = require('path');

function migrarTokensAntigos(arquivoAntigo, diretorioSaida) {
  const tokensAntigos = JSON.parse(fs.readFileSync(arquivoAntigo, 'utf8'));
  
  const estruturaNova = {
    foundation: {},
    themes: {}
  };
  
  Object.entries(tokensAntigos).forEach(([colecaoNome, tokens]) => {
    if (isFoundationCollection(colecaoNome)) {
      processarFoundationTokens(tokens, estruturaNova.foundation);
    } else {
      const temaNome = extrairNomeTema(colecaoNome);
      estruturaNova.themes[temaNome] = {};
      processarThemeTokens(tokens, estruturaNova.themes[temaNome], temaNome);
    }
  });
  
  salvarEstruturaNova(estruturaNova, diretorioSaida);
}

function isFoundationCollection(nome) {
  const palavrasChave = ['global', 'foundation', 'base', 'primitive'];
  return palavrasChave.some(palavra => 
    nome.toLowerCase().includes(palavra)
  );
}

function processarFoundationTokens(tokens, foundation) {
  Object.entries(tokens).forEach(([nomeToken, dadosToken]) => {
    const categoria = categorizarToken(nomeToken);
    
    if (!foundation[categoria]) {
      foundation[categoria] = {};
    }
    
    foundation[categoria][nomeToken] = dadosToken;
  });
}

function processarThemeTokens(tokens, tema, nomeTheme) {
  Object.entries(tokens).forEach(([nomeToken, dadosToken]) => {
    const categoria = categorizarThemeToken(nomeToken);
    
    if (!tema[categoria]) {
      tema[categoria] = {};
    }
    
    tema[categoria][nomeToken] = {
      ...dadosToken,
      theme: nomeTheme
    };
  });
}

function categorizarToken(nomeToken) {
  const nome = nomeToken.toLowerCase();
  
  if (nome.includes('spacing') || nome.includes('gap')) return 'spacing';
  if (nome.includes('size')) return 'sizing';
  if (nome.includes('color')) return 'primitives';
  if (nome.includes('corner') || nome.includes('radius')) return 'corner';
  if (nome.includes('opacity')) return 'opacity';
  if (nome.includes('font')) return 'font';
  
  return 'primitives';
}

function categorizarThemeToken(nomeToken) {
  const nome = nomeToken.toLowerCase();
  
  if (nome.includes('color') || nome.includes('bg')) return 'color';
  if (nome.includes('text') || nome.includes('font')) return 'text';
  if (nome.includes('spacing')) return 'spacing';
  if (nome.includes('size')) return 'size';
  if (nome.includes('opacity')) return 'opacity';
  
  return 'color';
}

function extrairNomeTema(nomeColecao) {
  return nomeColecao
    .toLowerCase()
    .replace(/\s*(brand|theme|color)\s*/g, '')
    .trim() || 'default';
}

function salvarEstruturaNova(estrutura, diretorioSaida) {
  // Criar diretórios
  const foundationDir = path.join(diretorioSaida, 'foundation');
  const themesDir = path.join(diretorioSaida, 'themes');
  
  fs.mkdirSync(foundationDir, { recursive: true });
  fs.mkdirSync(themesDir, { recursive: true });
  
  // Salvar foundation tokens
  Object.entries(estrutura.foundation).forEach(([categoria, tokens]) => {
    const arquivo = path.join(foundationDir, `${categoria}.json`);
    fs.writeFileSync(arquivo, JSON.stringify({ [categoria]: tokens }, null, 2));
  });
  
  // Salvar theme tokens
  Object.entries(estrutura.themes).forEach(([tema, categorias]) => {
    const temaDir = path.join(themesDir, tema);
    fs.mkdirSync(temaDir, { recursive: true });
    
    Object.entries(categorias).forEach(([categoria, tokens]) => {
      const arquivo = path.join(temaDir, `${categoria}.json`);
      fs.writeFileSync(arquivo, JSON.stringify({ [categoria]: tokens }, null, 2));
    });
  });
  
  console.log(`Migração concluída! Arquivos salvos em: ${diretorioSaida}`);
}

// Uso do script
migrarTokensAntigos('./tokens-antigo.json', './src/tokens');
```

## Atualizando Código Existente

### 1. Importações

**Antes:**
```javascript
import tokens from './figma-tokens.json';

const primaryColor = tokens.Global['colors/primary'].value;
const spacing = tokens.Global['spacing/small'].value;
```

**Depois:**
```javascript
import colors from './src/tokens/foundation/primitives.json';
import spacing from './src/tokens/foundation/spacing.json';

const primaryColor = colors.primitives.primary.value;
const spacingSmall = spacing.spacing.small.value;
```

### 2. CSS Custom Properties

**Antes:**
```css
:root {
  --primary-color: #3366CC;
  --small-spacing: 8px;
}
```

**Depois:**
```css
@import './src/tokens/foundation/primitives.css';
@import './src/tokens/foundation/spacing.css';

/* Ou usar diretamente */
:root {
  --primary-color: var(--foundation-primitives-primary);
  --small-spacing: var(--foundation-spacing-small);
}
```

### 3. Styled Components

**Antes:**
```javascript
import tokens from './figma-tokens.json';

const Button = styled.button`
  color: ${tokens.Global['colors/primary'].value};
  padding: ${tokens.Global['spacing/small'].value};
`;
```

**Depois:**
```javascript
import colors from './src/tokens/foundation/primitives.json';
import spacing from './src/tokens/foundation/spacing.json';

const Button = styled.button`
  color: ${colors.primitives.primary.value};
  padding: ${spacing.spacing.small.value};
`;
```

## Benefícios da Nova Estrutura

### 1. Organização Melhorada
- Tokens organizados por categoria e tema
- Estrutura de pastas clara e intuitiva
- Separação entre foundation e theme tokens

### 2. Performance
- Importações específicas reduzem bundle size
- Tree shaking mais eficiente
- Carregamento sob demanda

### 3. Manutenibilidade
- Arquivos menores e mais focados
- Easier to track changes in version control
- Better collaboration between design and dev teams

### 4. Flexibilidade
- Support for multiple themes
- Easy to add new token categories
- Better integration with build tools

## Rollback (se necessário)

Se precisar voltar para o formato antigo temporariamente:

1. **No plugin**: Use "Export Single JSON"
2. **Código**: Mantenha importações antigas funcionando
3. **CI/CD**: Configure pipeline para ambos os formatos

## Suporte

- **Documentação**: Ver `STRUCTURED_TOKENS_README.md`
- **Exemplos**: Ver pasta `examples/`
- **Testes**: Execute `npm test` para validar
- **Issues**: Reporte problemas no GitHub

## Checklist de Migração

- [ ] Backup dos tokens atuais
- [ ] Testar nova estrutura em ambiente dev  
- [ ] Atualizar importações no código
- [ ] Atualizar build scripts
- [ ] Atualizar CI/CD pipelines
- [ ] Testar em todos os ambientes
- [ ] Documentar mudanças para o time
- [ ] Treinar desenvolvedores na nova estrutura

## Timeline Recomendado

- **Semana 1**: Setup e testes iniciais
- **Semana 2**: Migração gradual do código
- **Semana 3**: Testes em staging
- **Semana 4**: Deploy para produção
- **Semana 5**: Monitoramento e ajustes finais
