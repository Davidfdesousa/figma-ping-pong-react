// This is the main plugin code that runs in the Figma environment
figma.showUI(__html__, { width: 500, height: 600 });

figma.ui.onmessage = msg => {
  console.log('Received message in code.js:', msg);
  
  if (msg.type === 'ping') {
    console.log('▶️ Ping recebido no code.js');
    figma.ui.postMessage({ type: 'pong' });
  }
  
  if (msg.type === 'load-collections') {
    console.log('📁 Carregando collections...');
    loadCollections();
  }
  
  if (msg.type === 'export-selected-tokens') {
    console.log('🎨 Exportando tokens selecionados...');
    exportSelectedTokens(msg.selectedCollections);
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
