/**
 * Message Handler Service
 * 
 * This service manages all communication between the Figma plugin UI and the
 * main plugin code. It acts as a central message router that dispatches
 * incoming messages to appropriate service functions.
 * 
 * The handler supports:
 * - Health check messages (ping/pong)
 * - GitHub configuration operations
 * - Token collection management
 * - Export operations (local and GitHub)
 * - Plugin lifecycle management
 * 
 * @module MessageHandler
 * @version 1.0.0
 */

/**
 * Central message handling function for plugin communication
 * 
 * This function receives all messages from the plugin UI and routes them
 * to the appropriate service functions. It provides a clean separation
 * between UI communication and business logic.
 * 
 * @function handleMessage
 * @param {Object} msg - Message object from the plugin UI
 * @param {string} msg.type - Type of operation to perform
 * @param {*} [msg.data] - Additional data payload for the operation
 * 
 * @example
 * // Called automatically when UI sends messages
 * handleMessage({ type: 'load-collections' });
 * handleMessage({ 
 *   type: 'export-tokens', 
 *   selectedCollections: ['collection-id-1'] 
 * });
 */
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