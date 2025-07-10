/**
 * Message Handler Service - Handles UI message routing
 */

// Import all services
import { loadCollections } from './collections-service.js';
import { exportSelectedTokens } from './token-export-service.js';
import { loadGitHubConfig, saveGitHubConfig } from './github-config-service.js';
import { exportToGitHub } from './github-export-service.js';

/**
 * Handle messages from UI
 */
function handleMessage(msg) {
  console.log('📨 Message received:', msg);
  
  switch (msg.type) {
    case 'ping':
      figma.ui.postMessage({ type: 'pong' });
      break;
      
    case 'load-github-config':
      loadGitHubConfig();
      break;
      
    case 'load-collections':
      loadCollections();
      break;
      
    case 'export-selected-tokens':
      exportSelectedTokens(msg.selectedCollections);
      break;
      
    case 'save-github-config':
      saveGitHubConfig(msg.config);
      break;
      
    case 'export-to-github':
      exportToGitHub(msg.selectedCollections, msg.commitDescription);
      break;
      
    case 'close':
      figma.closePlugin();
      break;
      
    default:
      console.warn('Unknown message type:', msg.type);
  }
}

export { handleMessage };