
# Figma Token Exporter

Plugin para Figma que permite exportar tokens (variáveis) e collections do seu arquivo Figma para formato JSON.

## 🚀 Funcionalidades

- ✅ Exportar todos os tokens/variáveis do arquivo Figma
- ✅ Exportar collections de variáveis
- ✅ Download automático dos arquivos JSON
- ✅ Suporte a múltiplos modos (light/dark, etc.)
- ✅ Tratamento de aliases entre variáveis

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

## 🔧 Estrutura do projeto

- `manifest.json` - Configuração do plugin
- `code.js` - Código principal (roda no ambiente Figma)
- `ui.html` - Interface do usuário
- `README.md` - Documentação

## 💡 Casos de uso

- Migração de design tokens para outras ferramentas
- Backup das variáveis do Figma
- Integração com sistemas de design
- Documentação automática de tokens
- Sincronização com código frontend

## 🛠️ Desenvolvimento

Este plugin utiliza a Figma Variables API para acessar e exportar as variáveis locais do arquivo. Suporta todos os tipos de variáveis disponíveis no Figma (cores, números, strings, booleanos).
