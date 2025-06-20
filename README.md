
# Figma Ping Pong Plugin

Plugin básico para Figma que demonstra comunicação entre UI e código do plugin.

## Como usar

1. No Figma Desktop, vá em **Plugins** > **Development** > **Import plugin from manifest...**
2. Selecione o arquivo `manifest.json` deste projeto
3. Execute o plugin
4. Clique em "Ping" para testar a comunicação
5. Você verá um alert "Pong recebido!" quando a mensagem for processada

## Estrutura

- `manifest.json` - Configuração do plugin
- `code.js` - Código principal que roda no ambiente Figma
- `ui.html` - Interface do usuário do plugin

## Funcionalidades

- ✅ Abre UI React dentro do Figma (300×200px)
- ✅ Sistema de mensagens Ping-Pong
- ✅ Botão de fechar plugin
- ✅ Feedback visual no UI

## Desenvolvimento

Este é um plugin básico que serve como base para futuras integrações. Não faz chamadas reais à Figma API, apenas demonstra a comunicação básica entre UI e código do plugin.
