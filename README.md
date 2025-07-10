
# Figma Token Exporter

Plugin modular para Figma que permite exportar design tokens e integração completa com GitHub workflows.

## 🚀 Funcionalidades

- ✅ **Exportação de Tokens**: Exporta tokens/variáveis do Figma com suporte a múltiplos modos
- ✅ **Integração GitHub**: Criação automática de PRs com rastreamento de mudanças
- ✅ **Comparação de Tokens**: Detecção inteligente de alterações entre versões
- ✅ **Arquitetura Modular**: Código limpo e organizado com responsabilidades separadas
- ✅ **Tratamento de Aliases**: Suporte completo a referências entre variáveis
- ✅ **Interface Intuitiva**: UI React moderna e responsiva

## 📥 Como usar

1. No Figma Desktop, vá em **Plugins** > **Development** > **Import plugin from manifest...**
2. Selecione o arquivo `manifest.json` deste projeto
3. Execute o plugin
4. Escolha entre:
   - **Exportar Tokens**: Exporta todas as variáveis (cores, tipografia, espaçamentos, etc.)
   - **Exportar Collections**: Exporta a estrutura das collections e seus modos
5. Clique no link de download para baixar o arquivo JSON

## 📁 Estrutura dos arquivos exportados

### Tokens JSON
```json
{
  "Collection Name": {
    "token-name": {
      "name": "token-name",
      "type": "COLOR",
      "scopes": ["ALL_SCOPES"],
      "values": {
        "Mode 1": "#FF0000",
        "Mode 2": "#00FF00"
      }
    }
  }
}
```

### Collections JSON
```json
{
  "Collection Name": {
    "id": "collection-id",
    "name": "Collection Name",
    "modes": [
      {
        "modeId": "mode-id",
        "name": "Light"
      }
    ],
    "variableIds": ["var-id-1", "var-id-2"]
  }
}
```

## 🏗️ Arquitetura Modular

```
├── manifest.json           # Configuração do plugin
├── code.js                # Orquestrador principal (roda no ambiente Figma)
├── ui.html                # Interface do usuário
├── hooks/                 # Módulos de serviços
│   ├── figma-api-service.js    # Operações da API do Figma
│   ├── github-service.js       # Operações da API do GitHub
│   ├── token-service.js        # Processamento de tokens
│   ├── utils.js               # Funções utilitárias
│   ├── comparison-service.js   # Comparação de tokens
│   ├── pr-service.js          # Geração de descrições de PR
│   └── message-handler.js     # Comunicação plugin-UI
└── src/                   # Código fonte da UI React
```

### Separação de Responsabilidades

- **code.js**: Orquestrador principal que delega para serviços especializados
- **figma-api-service.js**: Gerencia todas as interações com a API do Figma
- **github-service.js**: Operações de GitHub e criação de PRs
- **token-service.js**: Processamento e estruturação de dados de tokens
- **utils.js**: Funções utilitárias compartilhadas
- **comparison-service.js**: Lógica de comparação entre versões de tokens
- **pr-service.js**: Geração de descrições detalhadas de PRs
- **message-handler.js**: Gerenciamento de comunicação entre plugin e UI

## 💡 Casos de uso

- Migração de design tokens para outras ferramentas
- Backup das variáveis do Figma
- Integração com sistemas de design
- Documentação automática de tokens
- Sincronização com código frontend

## 🛠️ Desenvolvimento

Este plugin utiliza a Figma Variables API para acessar e exportar as variáveis locais do arquivo. Suporta todos os tipos de variáveis disponíveis no Figma (cores, números, strings, booleanos).
