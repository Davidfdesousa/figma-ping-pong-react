# Figma Token Exporter Plugin - Structured Tokens Documentation

## Overview

O plugin Figma Token Exporter foi aprimorado para suportar exportação de tokens em uma estrutura de pastas organizadas, além da funcionalidade original de exportação em JSON único.

## Novas Funcionalidades

### 1. Exportação Estruturada de Tokens

#### Estrutura de Arquivos Gerada

```
src/tokens/
├── foundation/
│   ├── primitives.json
│   ├── spacing.json
│   ├── sizing.json
│   ├── stroke.json
│   ├── corner.json
│   ├── opacity.json
│   ├── font.json
│   └── size.json
└── themes/
    ├── creative/
    │   ├── color.json
    │   ├── opacity.json
    │   ├── size.json
    │   ├── spacing.json
    │   └── text.json
    ├── tech/
    │   └── color.json
    └── nature/
        └── color.json
```

#### Categorização Automática

**Foundation Tokens** - Detectados por coleções com nomes contendo:
- 'global', 'foundation', 'primitive', 'base'

**Theme Tokens** - Todas as outras coleções são tratadas como temas

**Categorias Foundation:**
- `spacing`: tokens contendo 'spacing', 'gap', 'margin', 'padding'
- `sizing`: tokens contendo 'size', 'width', 'height'
- `stroke`: tokens contendo 'stroke', 'border'
- `corner`: tokens contendo 'corner', 'radius'
- `opacity`: tokens contendo 'opacity', 'alpha'
- `font`: tokens contendo 'font', 'typography'
- `primitives`: categoria padrão para outros tokens

**Categorias Theme:**
- `color`: tokens contendo 'color', 'bg', 'background', 'fg', 'foreground'
- `opacity`: tokens contendo 'opacity', 'alpha'
- `size`: tokens contendo 'size', 'scale'
- `spacing`: tokens contendo 'spacing', 'gap'
- `text`: tokens contendo 'text', 'font', 'typography'

### 2. Download ZIP

- Compacta toda a estrutura `src/tokens/` em um arquivo ZIP
- Usa a biblioteca JSZip no cliente
- Download automático pelo navegador

### 3. Export GitHub Estruturado

- Cria um único commit com todos os arquivos da estrutura
- Utiliza GitHub Tree API para commits eficientes
- Mantém histórico organizado no repositório

## Formato dos Arquivos JSON

### Exemplo - Foundation Spacing

```json
{
  "spacing": {
    "spacing100": {
      "value": "8px",
      "type": "other"
    },
    "spacing200": {
      "value": "16px", 
      "type": "other"
    }
  }
}
```

### Exemplo - Theme Color

```json
{
  "color": {
    "primary": {
      "value": "#E61945",
      "type": "other",
      "theme": "creative"
    },
    "secondary": {
      "value": "{foundation.color.blue}",
      "type": "other", 
      "theme": "creative"
    }
  }
}
```

## Classes Principais

### StructuredTokenGenerator

**Responsabilidades:**
- Organizar tokens em estrutura foundation/themes
- Categorizar tokens por tipo
- Gerar estrutura de arquivos

**Métodos Principais:**
- `generateStructuredTokens(selectedCollectionIds)`: Gera tokens organizados
- `generateFileStructure(structuredTokens)`: Converte para estrutura de arquivos
- `_organizeTokensByStructure(rawTokens)`: Organiza tokens por estrutura
- `_categorizeFoundationToken(tokenName)`: Categoriza tokens foundation
- `_categorizeThemeToken(tokenName)`: Categoriza tokens de tema

### ZipGenerator

**Responsabilidades:**
- Criar dados para geração de ZIP no cliente
- Preparar estrutura de arquivos para compactação

**Métodos Principais:**
- `createTokensZip(fileStructure)`: Prepara dados para ZIP

### GitHubManager (Expandido)

**Novas Responsabilidades:**
- Criar commits com múltiplos arquivos
- Gerenciar estrutura de arquivos no GitHub

**Novos Métodos:**
- `exportStructuredToGitHub()`: Export estruturado para GitHub
- `_createStructuredPR()`: Criar PR com estrutura de arquivos
- `_createMultiFileCommit()`: Commit com múltiplos arquivos
- `_getBranchRef()`: Obter referência de branch
- `_getCommit()`: Obter dados de commit

## Interface do Usuário

### Novos Botões

1. **"Export Structured Tokens"** - Exporta estrutura organizada (visualização)
2. **"Download Tokens ZIP"** - Download da pasta tokens como ZIP
3. **"Export to GitHub (Structured)"** - Export estruturado para GitHub

### Indicadores Visuais

- Badge "NEW" nas novas funcionalidades
- Ícones específicos para cada tipo de export
- Status messages detalhados

## Fluxo de Uso

### Para Download ZIP:

1. Selecionar coleções desejadas
2. Clicar em "Download Tokens ZIP"
3. Plugin gera estrutura de arquivos
4. JSZip compacta no cliente
5. Download automático do arquivo

### Para GitHub Estruturado:

1. Configurar credenciais GitHub
2. Selecionar coleções desejadas
3. Adicionar descrição do commit (opcional)
4. Clicar em "Export to GitHub (Structured)"
5. Plugin cria branch e commit com todos os arquivos
6. PR é criado automaticamente

## Configuração GitHub

Requer as mesmas configurações do export tradicional:
- Personal Access Token
- Repository Owner
- Repository Name

## Tratamento de Erros

### Erros Comuns:

- **ZIP Library Not Loaded**: JSZip não carregou corretamente
- **No Collections Selected**: Nenhuma coleção selecionada
- **Invalid GitHub Config**: Configuração GitHub incompleta
- **API Rate Limits**: Limites da API GitHub atingidos

### Logs Detalhados:

- Todas as operações são logadas com timestamps
- Erros incluem contexto completo
- Status de progresso para operações longas

## Compatibilidade

### Funcionalidades Mantidas:

- Export JSON único (funcionalidade original)
- Gerenciamento de marcas
- Configuração GitHub existente
- Todos os tipos de token suportados

### Versioning:

- Plugin versão 7.0.0
- Backward compatible com projetos existentes
- Estruturas antigas continuam funcionando

## Testes

### Cobertura de Testes:

- **Unit Tests**: Categorização de tokens, geração de estrutura
- **Integration Tests**: Fluxo completo de export
- **GitHub API Tests**: Criação de commits e PRs
- **ZIP Generation Tests**: Estrutura de arquivos

### Comandos de Teste:

```bash
npm test                    # Todos os testes
npm test -- --watch       # Modo watch
npm test structured-tokens # Testes específicos
```

## Troubleshooting

### Problemas Comuns:

1. **ZIP não baixa**: Verificar se JSZip carregou (`window.JSZip`)
2. **GitHub falha**: Verificar token e permissões
3. **Estrutura incorreta**: Verificar nomes das coleções
4. **Performance lenta**: Reduzir número de coleções selecionadas

### Debug:

- Abrir DevTools para logs detalhados
- Verificar Network tab para chamadas GitHub
- Console mostra progresso das operações

## Melhorias Futuras

### Roadmap:

- [ ] Configuração customizada de categorias
- [ ] Templates de estrutura personalizáveis
- [ ] Suporte a mais formatos (SCSS, CSS Custom Properties)
- [ ] Integração com outros sistemas de design
- [ ] Backup automático de configurações
- [ ] Histórico de exports

### Contribuições:

- Issues no GitHub para bugs e sugestões
- PRs bem-vindos com testes
- Documentação deve ser atualizada junto com código
