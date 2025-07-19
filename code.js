/**
 * Figma Token Exporter Plugin - Main Entry Point
 * 
 * Ultra-clean orchestrator with external service modules.
 * 
 * @version 4.0.0
 */

// ============================================================================
// MODULE LOADER (Figma-compatible)
// ============================================================================

const ModuleLoader = (function() {
  const modules = {};
  
  function define(name, dependencies, factory) {
    modules[name] = {
      dependencies,
      factory,
      exports: null
    };
  }
  
  function require(name) {
    if (!modules[name]) {
      throw new Error(`Module ${name} not found`);
    }
    
    const module = modules[name];
    if (module.exports) {
      return module.exports;
    }
    
    const deps = module.dependencies.map(dep => {
      if (dep === 'figma') return figma;
      return require(dep);
    });
    
    module.exports = module.factory.apply(null, deps);
    return module.exports;
  }
  
  return { define, require };
})();

// ============================================================================
// SERVICE MODULES
// ============================================================================

// Utils Module
ModuleLoader.define('utils', [], function() {
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

  function parseTokenPath(tokenName) {
    let path = tokenName.replace(/[\/-]/g, '.').split('.');
    path = path.map(part => part.trim()).filter(part => part.length > 0);
    return path;
  }

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

  return { stringToBase64, formatTokenValue, parseTokenPath, setNestedValue };
});

// Collections Module
ModuleLoader.define('collections', ['figma'], function(figma) {
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

  return { loadCollections };
});

// Token Generation Module
ModuleLoader.define('tokenGeneration', ['figma', 'utils'], function(figma, utils) {
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
            tokenValues[mode.name] = utils.formatTokenValue(value, variable.resolvedType);
          }
        }
      }
      
      const collectionName = collection.name;
      const tokenPath = utils.parseTokenPath(variable.name);
      
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
      
      utils.setNestedValue(structuredTokens[collectionName], tokenPath, tokenData);
    }
    
    return structuredTokens;
  }

  return { generateTokensData };
});

// Comparison Module
ModuleLoader.define('comparison', [], function() {
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
});

// GitHub Config Module
ModuleLoader.define('githubConfig', ['figma'], function(figma) {
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

  return { loadGitHubConfig, saveGitHubConfig };
});

// Main App Module
ModuleLoader.define('app', [
  'collections', 
  'tokenGeneration', 
  'comparison', 
  'githubConfig', 
  'utils',
  'figma'
], function(collections, tokenGeneration, comparison, githubConfig, utils, figma) {
  
  async function exportSelectedTokens(selectedCollectionIds) {
    try {
      const structuredTokens = await tokenGeneration.generateTokensData(selectedCollectionIds);
      
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

  function generatePRDescription(tokensData, commitDescription, prevData = {}) {
    const filePath = 'src/figma-output/selected-tokens.json';
    let description = `## 🎨 Figma Design Tokens Update\n\n`;
    
    if (commitDescription) {
      description += `### Alterações:\n${commitDescription}\n\n`;
    }
    
    description += `### Detalhes da Atualização:\n`;
    description += `- Arquivo atualizado: \`${filePath}\`\n`;
    description += `- Exportado em: ${new Date().toLocaleString()}\n\n`;
    
    const changes = comparison.compareTokens(prevData, tokensData);
    
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

  async function createGitHubPR(config, tokensData, commitDescription = '', prevData = {}) {
    const { token, repo, owner } = config;
    const apiBase = 'https://api.github.com';
    
    try {
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
      
      const filePath = 'src/figma-output/selected-tokens.json';
      const fileContent = utils.stringToBase64(JSON.stringify(tokensData, null, 2));
      
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
      
      const prDescription = generatePRDescription(tokensData, commitDescription, prevData);
      
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

      const structuredTokens = await tokenGeneration.generateTokensData(selectedCollectionIds);
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

  async function loadBrands() {
    try {
      console.log('🔍 Loading existing brand groups...');
      
      const existingCollections = await figma.variables.getLocalVariableCollections();
      
      // Find Global collection
      const globalCollection = existingCollections.find(collection => 
        collection.name.toLowerCase() === 'global'
      );
      
      if (!globalCollection) {
        throw new Error('Collection "Global" not found');
      }
      
      // Get all variables from Global collection
      const globalVariables = await Promise.all(
        globalCollection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
      );
      
      // Extract unique groups from variable names (e.g., "tech", "nature", "creative", "jupiter")
      const groups = new Set();
      globalVariables.forEach(variable => {
        if (variable && variable.name.includes('/')) {
          const groupName = variable.name.split('/')[0];
          groups.add(groupName);
        }
      });
      
      // Convert to brands format for UI
      const brands = Array.from(groups).map(groupName => {
        const groupVariables = globalVariables.filter(v => 
          v && v.name.toLowerCase().startsWith(groupName.toLowerCase() + '/')
        );
        
        return {
          id: groupName,
          name: groupName,
          variableCount: groupVariables.length,
          modes: globalCollection.modes.map(mode => ({
            id: mode.modeId,
            name: mode.name
          }))
        };
      });
      
      figma.ui.postMessage({
        type: 'brands-loaded',
        data: brands
      });
      
    } catch (error) {
      console.error('Error loading brands:', error);
      figma.ui.postMessage({
        type: 'load-error',
        message: error.message
      });
    }
  }

  async function createBrandInFigma(brandName, baseBrandName) {
    try {
      console.log(`🎨 Creating brand in Figma: ${brandName} based on ${baseBrandName}`);
      
      // Get existing collections
      const existingCollections = await figma.variables.getLocalVariableCollections();
      
      // Find Global and Brands collections
      const globalCollection = existingCollections.find(c => 
        c.name.toLowerCase() === 'global'
      );
      
      const brandsCollection = existingCollections.find(c => 
        c.name.toLowerCase() === 'brands'
      );
      
      if (!globalCollection || !brandsCollection) {
        throw new Error('Collections "Global" and "Brands" not found');
      }
      
      // Get all variables from Global collection
      const globalVariables = await Promise.all(
        globalCollection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
      );
      
      // Get all variables from Brands collection
      const brandsVariables = await Promise.all(
        brandsCollection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
      );
      
      // Filter variables that belong to the base brand group in Global
      const baseGlobalVariables = globalVariables.filter(variable => 
        variable && variable.name.toLowerCase().startsWith(baseBrandName.toLowerCase() + '/')
      );
      
      // For Brands collection, we'll duplicate ALL variables (primary, primary-dark, accent, etc.)
      // as they seem to represent the brand structure regardless of the specific brand
      const baseBrandsVariables = brandsVariables.filter(variable => variable);
      
      if (baseGlobalVariables.length === 0) {
        throw new Error(`No variables found for base group '${baseBrandName}' in Global collection`);
      }
      
      console.log(`Found ${baseGlobalVariables.length} variables in Global and ${baseBrandsVariables.length} variables in Brands`);
      
      const newVariables = {};
      
      // Create new variables in Global collection
      for (const baseVar of baseGlobalVariables) {
        // Replace the base brand name with the new brand name in variable path
        const newVarName = baseVar.name.replace(
          new RegExp(`^${baseBrandName}/`, 'i'), 
          `${brandName}/`
        );
        
        // Create new variable in the Global collection
        const newVariable = figma.variables.createVariable(newVarName, globalCollection, baseVar.resolvedType);
        
        // Copy values from all modes of the base variable
        for (const modeId of Object.keys(baseVar.valuesByMode)) {
          const baseValue = baseVar.valuesByMode[modeId];
          try {
            newVariable.setValueForMode(modeId, baseValue);
          } catch (error) {
            console.warn(`Could not set value for variable ${newVarName} in Global:`, error);
          }
        }
        
        newVariables[`Global/${newVarName}`] = newVariable;
      }
      
      // Create new variables in Brands collection
      for (const baseVar of baseBrandsVariables) {
        // Create variable name with brand suffix for Brands collection
        const newVarName = `${baseVar.name}-${brandName}`;
        
        // Create new variable in the Brands collection
        const newVariable = figma.variables.createVariable(newVarName, brandsCollection, baseVar.resolvedType);
        
        // Copy values from all modes of the base variable
        for (const modeId of Object.keys(baseVar.valuesByMode)) {
          const baseValue = baseVar.valuesByMode[modeId];
          try {
            newVariable.setValueForMode(modeId, baseValue);
          } catch (error) {
            console.warn(`Could not set value for variable ${newVarName} in Brands:`, error);
          }
        }
        
        newVariables[`Brands/${newVarName}`] = newVariable;
      }
      
      // Generate tokens data for both collections
      const tokens = await tokenGeneration.generateTokensData([globalCollection.id, brandsCollection.id]);
      
      const brand = {
        name: brandName,
        description: `Brand group ${brandName} created from ${baseBrandName} in Global and Brands collections`,
        type: 'complete',
        createdAt: new Date().toISOString(),
        baseBrand: baseBrandName,
        collections: [
          {
            id: globalCollection.id,
            name: globalCollection.name,
            variableCount: globalCollection.variableIds.length
          },
          {
            id: brandsCollection.id,
            name: brandsCollection.name,
            variableCount: brandsCollection.variableIds.length
          }
        ],
        tokens: tokens,
        metadata: {
          figmaFileKey: figma.fileKey,
          figmaFileName: figma.root.name,
          totalTokens: Object.keys(newVariables).length,
          collectionsUsed: 2,
          createdFromBrand: baseBrandName,
          groupCreated: brandName,
          collectionsModified: ['Global', 'Brands']
        }
      };
      
      figma.ui.postMessage({
        type: 'brand-created-in-figma',
        brandName: brandName,
        data: brand,
        variablesCreated: Object.keys(newVariables).length
      });
      
    } catch (error) {
      console.error('Error creating brand in Figma:', error);
      figma.ui.postMessage({
        type: 'brand-error',
        message: error.message
      });
    }
  }

  async function createBrand(brandName, brandDescription, brandType) {
    try {
      const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
      let filteredCollections = allCollections;
      
      // Filter collections based on brand type
      if (brandType !== 'complete') {
        const typeMap = {
          'colors': ['color', 'colours', 'cores'],
          'typography': ['typography', 'font', 'text', 'tipografia'],
          'spacing': ['spacing', 'space', 'espaçamento', 'margin', 'padding']
        };
        
        const keywords = typeMap[brandType] || [];
        filteredCollections = allCollections.filter(collection => 
          keywords.some(keyword => 
            collection.name.toLowerCase().includes(keyword)
          )
        );
      }
      
      if (filteredCollections.length === 0) {
        throw new Error('Nenhuma collection encontrada para o tipo selecionado');
      }
      
      const collectionIds = filteredCollections.map(c => c.id);
      const tokens = await tokenGeneration.generateTokensData(collectionIds);
      
      const brand = {
        name: brandName,
        description: brandDescription || `Brand ${brandName} criada automaticamente`,
        type: brandType,
        createdAt: new Date().toISOString(),
        collections: filteredCollections.map(c => ({
          id: c.id,
          name: c.name,
          variableCount: c.variableIds.length
        })),
        tokens: tokens,
        metadata: {
          figmaFileKey: figma.fileKey,
          figmaFileName: figma.root.name,
          totalTokens: Object.keys(tokens).length,
          collectionsUsed: filteredCollections.length
        }
      };
      
      figma.ui.postMessage({
        type: 'brand-created',
        brandName: brandName,
        data: brand
      });
    } catch (error) {
      console.error('Error creating brand:', error);
      figma.ui.postMessage({
        type: 'brand-error',
        message: error.message
      });
    }
  }

  function handleMessage(msg) {
    console.log('📨 Message received:', msg);
    
    switch (msg.type) {
      case 'ping':
        figma.ui.postMessage({ type: 'pong' });
        break;
        
      case 'load-github-config':
        githubConfig.loadGitHubConfig();
        break;
        
      case 'load-brands':
        loadBrands();
        break;
        
      case 'load-collections':
        collections.loadCollections();
        break;
        
      case 'export-selected-tokens':
        exportSelectedTokens(msg.selectedCollections);
        break;
        
      case 'create-brand-in-figma':
        createBrandInFigma(msg.brandName, msg.baseBrandName);
        break;
        
      case 'save-github-config':
        githubConfig.saveGitHubConfig(msg.config);
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

  return { handleMessage };
});

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

const app = ModuleLoader.require('app');

figma.showUI(__html__, { width: 500, height: 800 });
figma.ui.onmessage = app.handleMessage;