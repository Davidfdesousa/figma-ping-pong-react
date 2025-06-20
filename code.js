
// This is the main plugin code that runs in the Figma environment
figma.showUI(__html__, { width: 400, height: 300 });

figma.ui.onmessage = msg => {
  console.log('Received message in code.js:', msg);
  
  if (msg.type === 'ping') {
    console.log('▶️ Ping recebido no code.js');
    figma.ui.postMessage({ type: 'pong' });
  }
  
  if (msg.type === 'export-tokens') {
    console.log('🎨 Exportando tokens...');
    exportTokens();
  }
  
  if (msg.type === 'export-collections') {
    console.log('📁 Exportando collections...');
    exportCollections();
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

async function exportTokens() {
  try {
    const localVariables = await figma.variables.getLocalVariablesAsync();
    const tokens = {};
    
    for (const variable of localVariables) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      
      if (!tokens[collection.name]) {
        tokens[collection.name] = {};
      }
      
      // Get values for each mode
      const tokenData = {
        name: variable.name,
        type: variable.resolvedType,
        scopes: variable.scopes,
        values: {}
      };
      
      // Process each mode
      for (const modeId of collection.modes.map(mode => mode.modeId)) {
        const mode = collection.modes.find(m => m.modeId === modeId);
        const value = variable.valuesByMode[modeId];
        
        if (value !== undefined) {
          if (typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
            // Handle variable aliases
            const aliasedVariable = await figma.variables.getVariableByIdAsync(value.id);
            tokenData.values[mode.name] = `{${aliasedVariable.name}}`;
          } else {
            tokenData.values[mode.name] = value;
          }
        }
      }
      
      tokens[collection.name][variable.name] = tokenData;
    }
    
    figma.ui.postMessage({ 
      type: 'tokens-exported', 
      data: tokens 
    });
    
  } catch (error) {
    console.error('Erro ao exportar tokens:', error);
    figma.ui.postMessage({ 
      type: 'export-error', 
      message: 'Erro ao exportar tokens: ' + error.message 
    });
  }
}

async function exportCollections() {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionsData = {};
    
    for (const collection of collections) {
      collectionsData[collection.name] = {
        id: collection.id,
        name: collection.name,
        modes: collection.modes.map(mode => ({
          modeId: mode.modeId,
          name: mode.name
        })),
        variableIds: collection.variableIds
      };
    }
    
    figma.ui.postMessage({ 
      type: 'collections-exported', 
      data: collectionsData 
    });
    
  } catch (error) {
    console.error('Erro ao exportar collections:', error);
    figma.ui.postMessage({ 
      type: 'export-error', 
      message: 'Erro ao exportar collections: ' + error.message 
    });
  }
}
