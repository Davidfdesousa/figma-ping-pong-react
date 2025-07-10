/**
 * Figma Token Exporter Plugin - Main Entry Point
 * 
 * Minimal orchestrator for the Figma Token Exporter plugin.
 * All business logic is modularized in separate service files.
 * 
 * @version 2.0.0
 */

// ============================================================================
// INLINE UTILITIES (Required for Figma environment)
// ============================================================================

/**
 * Base64 encoding for GitHub API
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
 * Format token values based on type
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
 * Parse token path from name
 */
function parseTokenPath(tokenName) {
  let path = tokenName.replace(/[\/-]/g, '.').split('.');
  path = path.map(part => part.trim()).filter(part => part.length > 0);
  return path;
}

/**
 * Set nested object value
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
// INLINE SERVICE IMPLEMENTATIONS
// ============================================================================

/**
 * Load collections from Figma API
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

/**
 * GitHub configuration management
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
 * Export to GitHub with PR creation
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

// Import core services
const TokenService = (function() {
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
  
  return { generateTokensData };
})();

const ComparisonService = (function() {
  function getAllTokenPaths(data, prefix = '') {
    const tokens = {};
    
    function extractPaths(obj, currentPrefix) {
      for (const key in obj) {
        const fullPath = currentPrefix ? `${currentPrefix}.${key}` : key;
        if (obj[key] && typeof obj[key] === 'object') {
          if (obj[key].hasOwnProperty('value') && obj[key].hasOwnProperty('type')) {
            tokens[fullPath] = obj[key].value;
          } else {
            extractPaths(obj[key], fullPath);
          }
        }
      }
    }
    
    extractPaths(data, prefix);
    return tokens;
  }

  function compareTokens(prevData, newData) {
    const changes = { added: [], modified: [], removed: [] };
    const prevTokens = getAllTokenPaths(prevData);
    const newTokens = getAllTokenPaths(newData);
    const prevPaths = Object.keys(prevTokens);
    const newPaths = Object.keys(newTokens);
    
    newPaths.forEach(path => {
      if (!prevPaths.includes(path)) {
        changes.added.push({ path: path, value: newTokens[path] });
      }
    });
    
    prevPaths.forEach(path => {
      if (!newPaths.includes(path)) {
        changes.removed.push({ path: path, value: prevTokens[path] });
      }
    });
    
    newPaths.forEach(path => {
      if (prevPaths.includes(path)) {
        const prevValue = String(prevTokens[path]).trim();
        const newValue = String(newTokens[path]).trim();
        if (prevValue !== newValue) {
          changes.modified.push({
            path: path,
            oldValue: prevValue,
            newValue: newValue
          });
        }
      }
    });
    
    return changes;
  }
  
  return { compareTokens };
})();

const PRService = (function() {
  function generatePRDescription(tokensData, commitDescription, prevData = {}) {
    const filePath = 'src/figma-output/selected-tokens.json';
    let description = `## 🎨 Figma Design Tokens Update\n\n`;
    
    if (commitDescription) {
      description += `### Alterações:\n${commitDescription}\n\n`;
    }
    
    description += `### Detalhes da Atualização:\n`;
    description += `- Arquivo atualizado: \`${filePath}\`\n`;
    description += `- Exportado em: ${new Date().toLocaleString()}\n\n`;
    
    const changes = ComparisonService.compareTokens(prevData, tokensData);
    
    if (changes.added.length === 0 && changes.modified.length === 0 && changes.removed.length === 0) {
      description += `### Alterações:\nNenhuma alteração detectada nos tokens.\n\n`;
    } else {
      description += `### Resumo das Alterações:\n`;
      
      if (changes.added.length > 0) {
        description += `\n#### ✅ Tokens Adicionados (${changes.added.length}):\n`;
        changes.added.forEach((token) => {
          description += `- \`${token.path}\`: ${token.value}\n`;
        });
      }
      
      if (changes.modified.length > 0) {
        description += `\n#### 🔄 Tokens Modificados (${changes.modified.length}):\n`;
        changes.modified.forEach((token) => {
          description += `- \`${token.path}\`: \`${token.oldValue}\` → \`${token.newValue}\`\n`;
        });
      }
      
      if (changes.removed.length > 0) {
        description += `\n#### ❌ Tokens Removidos (${changes.removed.length}):\n`;
        changes.removed.forEach((token) => {
          description += `- \`${token.path}\`: ${token.value}\n`;
        });
      }
    }
    
    description += `\n_Este PR foi gerado automaticamente pelo Figma Token Exporter plugin._`;
    return description;
  }
  
  return { generatePRDescription };
})();

const GitHubService = (function() {
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
      
      // Create Pull Request with detailed changelog
      const prDescription = PRService.generatePRDescription(tokensData, commitDescription, prevData);
      
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
          body: prDescription
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
  
  return { createGitHubPR };
})();

// Use services
const generateTokensData = TokenService.generateTokensData;
const createGitHubPR = GitHubService.createGitHubPR;

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

figma.showUI(__html__, { width: 500, height: 800 });

figma.ui.onmessage = (msg) => {
  console.log('📨 Message received:', msg);
  
  if (msg.type === 'ping') {
    figma.ui.postMessage({ type: 'pong' });
  }
  
  if (msg.type === 'load-github-config') {
    loadGitHubConfig();
  }
  
  if (msg.type === 'load-collections') {
    loadCollections();
  }
  
  if (msg.type === 'export-selected-tokens') {
    exportSelectedTokens(msg.selectedCollections);
  }
  
  if (msg.type === 'save-github-config') {
    saveGitHubConfig(msg.config);
  }
  
  if (msg.type === 'export-to-github') {
    exportToGitHub(msg.selectedCollections, msg.commitDescription);
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};