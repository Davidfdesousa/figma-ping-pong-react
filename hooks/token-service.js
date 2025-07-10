// Token management service for Figma Token Exporter Plugin

// Helper function to format token values based on type
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

// Helper function to parse token path from name
function parseTokenPath(tokenName) {
  let path = tokenName.replace(/[\/-]/g, '.').split('.');
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

// Load collections from Figma
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

// Export selected tokens
async function exportSelectedTokens(selectedCollectionIds) {
  try {
    const structuredTokens = await generateTokensData(selectedCollectionIds);
    
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

// Generate tokens data structure
async function generateTokensData(selectedCollectionIds) {
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
  
  return structuredTokens;
}

// Utility functions for token analysis
function countTokensInCollection(collection) {
  let count = 0;
  
  function countRecursive(obj) {
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        if (obj[key].hasOwnProperty('value') && obj[key].hasOwnProperty('type')) {
          count++;
        } else {
          countRecursive(obj[key]);
        }
      }
    }
  }
  
  countRecursive(collection);
  return count;
}

function getTokenListFromCollection(collection, collectionName, prefix = '') {
  const tokens = [];
  
  function extractTokens(obj, currentPrefix) {
    for (const key in obj) {
      const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key;
      
      if (obj[key] && typeof obj[key] === 'object') {
        if (obj[key].hasOwnProperty('value') && obj[key].hasOwnProperty('type')) {
          tokens.push({
            name: fullKey,
            value: obj[key].value,
            type: obj[key].type
          });
        } else {
          extractTokens(obj[key], fullKey);
        }
      }
    }
  }
  
  extractTokens(collection, prefix);
  return tokens;
}

// Export functions to be used in code.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadCollections,
    exportSelectedTokens,
    generateTokensData,
    countTokensInCollection,
    getTokenListFromCollection,
    formatTokenValue,
    parseTokenPath,
    setNestedValue
  };
}