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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts a string to Base64 encoding for GitHub API compatibility
 */
function stringToBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += chars.charAt((bitmap >> 6) & 63);
    result += chars.charAt(bitmap & 63);
  }
  
  const padding = str.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + '==';
  } else if (padding === 2) {
    result = result.slice(0, -1) + '=';
  }
  
  return result;
}

/**
 * Formats token values according to their data type
 */
function formatTokenValue(value, type) {
  if (type === 'COLOR') {
    if (typeof value === 'object' && value.r !== undefined) {
      const r = Math.round(value.r * 255);
      const g = Math.round(value.g * 255);
      const b = Math.round(value.b * 255);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }
  } else if (type === 'FLOAT') {
    return `${value}px`;
  } else if (type === 'STRING') {
    return value;
  }
  return value;
}

/**
 * Parses a token name into a structured path array
 */
function parseTokenPath(tokenName) {
  let path = tokenName.replace(/[\/-]/g, '.').split('.');
  path = path.map(part => part.trim()).filter(part => part.length > 0);
  return path;
}

/**
 * Sets a nested object value using a path array
 */
function setNestedValue(obj, path, value) {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

// ============================================================================
// FIGMA API FUNCTIONS
// ============================================================================

/**
 * Loads all variable collections from the current Figma file
 */
async function loadCollections() {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionsData = [];
    
    for (const collection of collections) {
      const variableCount = collection.variableIds.length;
      collectionsData.push({
        id: collection.id,
        name: collection.name,
        variableCount: variableCount,
        modes: collection.modes.map(mode => ({
          modeId: mode.modeId,
          name: mode.name
        }))
      });
    }
    
    figma.ui.postMessage({ 
      type: 'collections-loaded', 
      data: collectionsData 
    });
    
  } catch (error) {
    console.error('Error loading collections:', error);
    figma.ui.postMessage({ 
      type: 'load-error', 
      message: 'Error loading collections: ' + error.message 
    });
  }
}

/**
 * Exports tokens from selected collections
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

/**
 * Generates structured token data from selected collections
 */
async function generateTokensData(selectedCollectionIds) {
  const localVariables = await figma.variables.getLocalVariablesAsync();
  const structuredTokens = {};
  
  for (const variable of localVariables) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    
    if (!selectedCollectionIds.includes(collection.id)) {
      continue;
    }
    
    const tokenValues = {};
    const hasMultipleModes = collection.modes.length > 1;
    
    for (const modeId of collection.modes.map(mode => mode.modeId)) {
      const mode = collection.modes.find(m => m.modeId === modeId);
      const value = variable.valuesByMode[modeId];
      
      if (value !== undefined) {
        if (typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
          const aliasedVariable = await figma.variables.getVariableByIdAsync(value.id);
          tokenValues[mode.name] = `{${aliasedVariable.name.replace(/\//g, '.')}}`;
        } else {
          tokenValues[mode.name] = formatTokenValue(value, variable.resolvedType);
        }
      }
    }
    
    const collectionName = collection.name;
    const tokenPath = parseTokenPath(variable.name);
    
    if (!structuredTokens[collectionName]) {
      structuredTokens[collectionName] = {};
    }
    
    const tokenData = {
      value: tokenValues[collection.modes[0].name] || null,
      type: "other"
    };
    
    if (hasMultipleModes && Object.keys(tokenValues).length > 1) {
      tokenData["$extensions"] = {
        mode: tokenValues
      };
    }
    
    setNestedValue(structuredTokens[collectionName], tokenPath, tokenData);
  }
  
  return structuredTokens;
}

// ============================================================================
// GITHUB FUNCTIONS
// ============================================================================

/**
 * Loads GitHub configuration from Figma's client storage
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
 * Saves GitHub configuration to Figma's client storage
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

/**
 * Exports design tokens to GitHub repository via automated pull request
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

/**
 * Creates a GitHub pull request with token updates
 */
async function createGitHubPR(config, tokensData, commitDescription = '', prevData = {}) {
  const { token, repo, owner } = config;
  const apiBase = 'https://api.github.com';
  
  try {
    // Get main branch SHA
    const branchResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/ref/heads/main`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!branchResponse.ok) {
      throw new Error(`Error getting main branch: ${branchResponse.statusText}`);
    }
    
    const branchData = await branchResponse.json();
    const mainSha = branchData.object.sha;
    
    // Create new branch
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `figma-tokens-update-${timestamp}`;
    
    const createBranchResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: mainSha
      })
    });
    
    if (!createBranchResponse.ok) {
      throw new Error(`Error creating branch: ${createBranchResponse.statusText}`);
    }
    
    // Create or update file
    const filePath = 'src/figma-output/selected-tokens.json';
    const fileContent = stringToBase64(JSON.stringify(tokensData, null, 2));
    
    // Check if file exists to get SHA
    let fileSha = null;
    try {
      const fileResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}?ref=${branchName}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        fileSha = fileData.sha;
      }
    } catch (e) {
      // File doesn't exist, which is fine
    }
    
    // Create/update file
    const commitMessage = commitDescription 
      ? commitDescription 
      : `Update Figma tokens - ${new Date().toLocaleString()}`;
    
    const updateFilePayload = {
      message: commitMessage,
      content: fileContent,
      branch: branchName
    };
    
    if (fileSha) {
      updateFilePayload.sha = fileSha;
    }
    
    const updateFileResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateFilePayload)
    });
    
    if (!updateFileResponse.ok) {
      throw new Error(`Error updating file: ${updateFileResponse.statusText}`);
    }
    
    // Create Pull Request
    const prResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
        body: JSON.stringify({
          title: `🎨 Update Figma Design Tokens`,
          head: branchName,
          base: 'main',
          body: `## 🎨 Figma Design Tokens Update\n\n${commitDescription ? `### Changes:\n${commitDescription}\n\n` : ''}### Update Details:\n- File updated: \`${filePath}\`\n- Exported at: ${new Date().toLocaleString()}\n\n_This PR was generated automatically by the Figma Token Exporter plugin._`
        })
    });
    
    if (!prResponse.ok) {
      throw new Error(`Error creating PR: ${prResponse.statusText}`);
    }
    
    const prData = await prResponse.json();
    
    figma.ui.postMessage({ 
      type: 'github-success', 
      message: 'PR created successfully!',
      prUrl: prData.html_url
    });
    
  } catch (error) {
    console.error('GitHub API error:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'GitHub API error: ' + error.message 
    });
  }
}

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

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