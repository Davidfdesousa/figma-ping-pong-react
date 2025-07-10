/**
 * GitHub Configuration Service - Handles GitHub config management
 */

/**
 * Load GitHub configuration from storage
 */
async function loadGitHubConfig() {
  try {
    const config = await figma.clientStorage.getAsync('github-config');
    figma.ui.postMessage({ 
      type: 'github-config-loaded',
      data: config || {}
    });
  } catch (error) {
    console.error('Error loading GitHub configuration:', error);
    figma.ui.postMessage({ 
      type: 'github-config-loaded',
      data: {}
    });
  }
}

/**
 * Save GitHub configuration to storage
 */
async function saveGitHubConfig(config) {
  try {
    await figma.clientStorage.setAsync('github-config', config);
    figma.ui.postMessage({ 
      type: 'github-config-saved',
      message: 'GitHub configuration saved successfully!'
    });
  } catch (error) {
    console.error('Error saving GitHub configuration:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Error saving configuration: ' + error.message 
    });
  }
}

export { loadGitHubConfig, saveGitHubConfig };