/**
 * Token Export Service - Handles token export functionality
 */

// Import token generation from existing service
import { generateTokensData } from './token-generation-service.js';

/**
 * Export selected tokens
 */
async function exportSelectedTokens(selectedCollectionIds) {
  try {
    const structuredTokens = await generateTokensData(selectedCollectionIds);
    
    figma.ui.postMessage({ 
      type: 'tokens-exported', 
      data: structuredTokens 
    });
    
  } catch (error) {
    console.error('Error exporting selected tokens:', error);
    figma.ui.postMessage({ 
      type: 'export-error', 
      message: 'Error exporting selected tokens: ' + error.message 
    });
  }
}

export { exportSelectedTokens };