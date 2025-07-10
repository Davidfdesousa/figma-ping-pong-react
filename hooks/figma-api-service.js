// Figma API service for token operations

// Load collections from Figma API
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

// Export selected tokens from Figma
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

// Generate tokens data from selected collections
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadCollections,
    exportSelectedTokens,
    generateTokensData
  };
}