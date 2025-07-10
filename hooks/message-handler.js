// Message handler for Figma plugin communication

// Message handler function
function handleMessage(msg) {
  console.log('Received message in code.js:', msg);
  
  if (msg.type === 'ping') {
    console.log('▶️ Ping recebido no code.js');
    figma.ui.postMessage({ type: 'pong' });
  }
  
  if (msg.type === 'load-github-config') {
    console.log('📋 Carregando configuração do GitHub...');
    loadGitHubConfig();
  }
  
  if (msg.type === 'load-collections') {
    console.log('📁 Carregando collections...');
    loadCollections();
  }
  
  if (msg.type === 'export-selected-tokens') {
    console.log('🎨 Exportando tokens selecionados...');
    exportSelectedTokens(msg.selectedCollections);
  }
  
  if (msg.type === 'save-github-config') {
    console.log('⚙️ Salvando configuração do GitHub...');
    saveGitHubConfig(msg.config);
  }
  
  if (msg.type === 'export-to-github') {
    console.log('🚀 Exportando para GitHub...');
    exportToGitHub(msg.selectedCollections, msg.commitDescription);
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
}

// Export function for use in main code
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMessage
  };
}