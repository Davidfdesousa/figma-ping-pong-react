/**
 * GitHub Export Service - Orchestrates GitHub export workflow
 */

// Import required services
import { generateTokensData } from './token-generation-service.js';
import { createGitHubPR } from './github-api-service.js';

/**
 * Export tokens to GitHub with PR creation
 */
async function exportToGitHub(selectedCollectionIds, commitDescription = '') {
  try {
    const prevData = await figma.clientStorage.getAsync('previous-tokens-data') || {};
    const githubConfig = await figma.clientStorage.getAsync('github-config');
    
    if (!githubConfig || !githubConfig.token || !githubConfig.repo) {
      figma.ui.postMessage({ 
        type: 'github-error', 
        message: 'GitHub configuration not found. Please configure first.' 
      });
      return;
    }

    const structuredTokens = await generateTokensData(selectedCollectionIds);
    await createGitHubPR(githubConfig, structuredTokens, commitDescription, prevData);
    await figma.clientStorage.setAsync('previous-tokens-data', structuredTokens);
    
  } catch (error) {
    console.error('Error exporting to GitHub:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Error exporting to GitHub: ' + error.message 
    });
  }
}

export { exportToGitHub };