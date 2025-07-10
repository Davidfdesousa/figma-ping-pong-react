/**
 * Figma Token Exporter Plugin - Main Entry Point
 * 
 * This is the main Figma plugin file that orchestrates all token export operations.
 * It acts as a lightweight coordinator that delegates functionality to specialized service modules.
 * 
 * The plugin supports:
 * - Loading and exporting Figma design tokens from variable collections
 * - Integrating with GitHub to create automated pull requests
 * - Comparing token changes between versions
 * - Generating detailed change logs for token updates
 * 
 * @version 1.0.0
 * @author Figma Token Exporter Team
 */

/**
 * Plugin Initialization
 * 
 * Initializes the Figma plugin UI with specified dimensions and sets up
 * the message handling system for communication between the plugin and UI.
 */
figma.showUI(__html__, { width: 500, height: 800 });

/**
 * Central Message Handler
 * 
 * Handles all incoming messages from the plugin UI and routes them to
 * the appropriate service functions. This is the main communication bridge
 * between the UI and the plugin's core functionality.
 * 
 * @param {Object} msg - The message object from the UI
 * @param {string} msg.type - The type of message/action to perform
 * @param {*} msg.data - Additional data payload for the message
 */
figma.ui.onmessage = (msg) => {
  console.log('📨 Message received in main plugin:', msg);
  
  // Health check - verify plugin communication
  if (msg.type === 'ping') {
    console.log('▶️ Ping received, responding with pong');
    figma.ui.postMessage({ type: 'pong' });
  }
  
  // GitHub configuration management
  if (msg.type === 'load-github-config') {
    console.log('📋 Loading GitHub configuration...');
    loadGitHubConfig();
  }
  
  // Figma collections management
  if (msg.type === 'load-collections') {
    console.log('📁 Loading Figma variable collections...');
    loadCollections();
  }
  
  // Token export operations
  if (msg.type === 'export-selected-tokens') {
    console.log('🎨 Exporting selected design tokens...');
    exportSelectedTokens(msg.selectedCollections);
  }
  
  // GitHub configuration persistence
  if (msg.type === 'save-github-config') {
    console.log('⚙️ Saving GitHub configuration...');
    saveGitHubConfig(msg.config);
  }
  
  // GitHub integration - create pull request
  if (msg.type === 'export-to-github') {
    console.log('🚀 Exporting tokens to GitHub...');
    exportToGitHub(msg.selectedCollections, msg.commitDescription);
  }
  
  // Plugin cleanup
  if (msg.type === 'close') {
    console.log('👋 Closing plugin...');
    figma.closePlugin();
  }
};