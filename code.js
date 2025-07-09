// This is the main plugin code that runs in the Figma environment

// Helper function to convert string to base64 (compatible with Figma environment)
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
  
  // Add padding
  const padding = str.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + '==';
  } else if (padding === 2) {
    result = result.slice(0, -1) + '=';
  }
  
  return result;
}

figma.showUI(__html__, { width: 500, height: 800 });

figma.ui.onmessage = msg => {
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
    exportToGitHub(msg.selectedCollections);
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

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
    console.error('Erro ao carregar collections:', error);
    figma.ui.postMessage({ 
      type: 'load-error', 
      message: 'Erro ao carregar collections: ' + error.message 
    });
  }
}

async function exportSelectedTokens(selectedCollectionIds) {
  try {
    const localVariables = await figma.variables.getLocalVariablesAsync();
    const structuredTokens = {};
    
    for (const variable of localVariables) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      
      // Only export if collection is selected
      if (!selectedCollectionIds.includes(collection.id)) {
        continue;
      }
      
      // Process each mode to get token values
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
      
      // Use collection name directly as category
      const collectionName = collection.name;
      const tokenPath = parseTokenPath(variable.name);
      
      // Initialize collection category if it doesn't exist
      if (!structuredTokens[collectionName]) {
        structuredTokens[collectionName] = {};
      }
      
      // Create token structure
      const tokenData = {
        value: tokenValues[collection.modes[0].name] || null,
        type: "other"
      };
      
      // Add mode extensions if multiple modes exist
      if (hasMultipleModes && Object.keys(tokenValues).length > 1) {
        tokenData["$extensions"] = {
          mode: tokenValues
        };
      }
      
      // Place token in collection category using exact Figma structure
      setNestedValue(structuredTokens[collectionName], tokenPath, tokenData);
    }
    
    figma.ui.postMessage({ 
      type: 'tokens-exported', 
      data: structuredTokens 
    });
    
  } catch (error) {
    console.error('Erro ao exportar tokens selecionados:', error);
    figma.ui.postMessage({ 
      type: 'export-error', 
      message: 'Erro ao exportar tokens selecionados: ' + error.message 
    });
  }
}


// Helper function to format token values based on type
function formatTokenValue(value, type) {
  if (type === 'COLOR') {
    if (typeof value === 'object' && value.r !== undefined) {
      // Convert RGB to hex
      const r = Math.round(value.r * 255);
      const g = Math.round(value.g * 255);
      const b = Math.round(value.b * 255);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }
  } else if (type === 'FLOAT') {
    // Convert numbers to px for spacing, border, etc.
    return `${value}px`;
  } else if (type === 'STRING') {
    return value;
  }
  
  return value;
}


// Helper function to parse token path from name
function parseTokenPath(tokenName) {
  // Convert token name to nested path
  // Examples: "color/neutral/100" -> ["color", "neutral", "100"]
  //           "spacing-4" -> ["spacing", "4"]
  //           "button.bg" -> ["button", "bg"]
  
  let path = tokenName.replace(/[\/-]/g, '.').split('.');
  
  // Clean up path elements
  path = path.map(part => part.trim()).filter(part => part.length > 0);
  
  return path;
}

// Helper function to set nested values in object
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

// GitHub integration functions
async function loadGitHubConfig() {
  try {
    const config = await figma.clientStorage.getAsync('github-config');
    figma.ui.postMessage({ 
      type: 'github-config-loaded',
      data: config || {}
    });
  } catch (error) {
    console.error('Erro ao carregar configuração do GitHub:', error);
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
      message: 'Configuração do GitHub salva com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao salvar configuração do GitHub:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Erro ao salvar configuração: ' + error.message 
    });
  }
}

async function exportToGitHub(selectedCollectionIds) {
  try {
    // Get GitHub configuration
    const githubConfig = await figma.clientStorage.getAsync('github-config');
    
    if (!githubConfig || !githubConfig.token || !githubConfig.repo) {
      figma.ui.postMessage({ 
        type: 'github-error', 
        message: 'Configuração do GitHub não encontrada. Configure primeiro.' 
      });
      return;
    }

    // Generate tokens data
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

    // Create GitHub PR
    await createGitHubPR(githubConfig, structuredTokens);
    
  } catch (error) {
    console.error('Erro ao exportar para GitHub:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Erro ao exportar para GitHub: ' + error.message 
    });
  }
}

async function createGitHubPR(config, tokensData) {
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
      throw new Error(`Erro ao obter branch principal: ${branchResponse.statusText}`);
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
      throw new Error(`Erro ao criar branch: ${createBranchResponse.statusText}`);
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
    const updateFilePayload = {
      message: `Update Figma tokens - ${new Date().toLocaleString()}`,
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
      throw new Error(`Erro ao atualizar arquivo: ${updateFileResponse.statusText}`);
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
        body: `## 🎨 Figma Design Tokens Update\n\nThis PR updates the design tokens exported from Figma.\n\n### Changes:\n- Updated \`${filePath}\` with latest token values\n- Exported at: ${new Date().toLocaleString()}\n\n### Collections Updated:\n${Object.keys(tokensData).map(name => `- ${name}`).join('\n')}\n\n_This PR was automatically generated by the Figma Token Exporter plugin._`
      })
    });
    
    if (!prResponse.ok) {
      throw new Error(`Erro ao criar PR: ${prResponse.statusText}`);
    }
    
    const prData = await prResponse.json();
    
    figma.ui.postMessage({ 
      type: 'github-success', 
      message: 'PR criado com sucesso!',
      prUrl: prData.html_url
    });
    
  } catch (error) {
    console.error('Erro na API do GitHub:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Erro na API do GitHub: ' + error.message 
    });
  }
}
