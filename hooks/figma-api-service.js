/**
 * Figma API Service
 * 
 * This service handles all interactions with the Figma API for token-related operations.
 * It provides functions to load variable collections, export tokens, and generate
 * structured token data that can be consumed by design systems and development teams.
 * 
 * The service manages:
 * - Loading variable collections from Figma
 * - Processing individual variables and their modes
 * - Handling variable aliases and references
 * - Structuring token data for export
 * 
 * @module FigmaAPIService
 * @version 1.0.0
 */

/**
 * Loads all variable collections from the current Figma file
 * 
 * This function retrieves all local variable collections and formats them
 * for display in the plugin UI. It includes metadata about each collection
 * such as variable count and available modes.
 * 
 * @async
 * @function loadCollections
 * @returns {Promise<void>} Sends collection data to UI via postMessage
 * 
 * @throws {Error} When Figma API calls fail or collections can't be loaded
 * 
 * @example
 * // Called from main plugin when UI requests collection data
 * await loadCollections();
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
    console.error('Erro ao carregar collections:', error);
    figma.ui.postMessage({ 
      type: 'load-error', 
      message: 'Erro ao carregar collections: ' + error.message 
    });
  }
}

/**
 * Exports tokens from selected collections
 * 
 * This function processes the selected variable collections and exports their
 * tokens in a structured format. It's the main entry point for token export
 * operations that don't involve GitHub integration.
 * 
 * @async
 * @function exportSelectedTokens
 * @param {string[]} selectedCollectionIds - Array of collection IDs to export
 * @returns {Promise<void>} Sends structured token data to UI via postMessage
 * 
 * @throws {Error} When token generation fails or collections can't be processed
 * 
 * @example
 * // Export tokens from specific collections
 * await exportSelectedTokens(['collection-id-1', 'collection-id-2']);
 */
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

/**
 * Generates structured token data from selected collections
 * 
 * This is the core function that processes Figma variables and converts them
 * into a structured token format. It handles:
 * - Variable value extraction across different modes
 * - Alias resolution for referenced variables
 * - Token type classification and formatting
 * - Hierarchical token structure creation
 * 
 * @async
 * @function generateTokensData
 * @param {string[]} selectedCollectionIds - Collection IDs to process
 * @returns {Promise<Object>} Structured token data organized by collection
 * 
 * @throws {Error} When variable processing fails or API calls are unsuccessful
 * 
 * @example
 * const tokens = await generateTokensData(['collection-1', 'collection-2']);
 * // Returns: { "Collection Name": { "token": { "path": { value: "...", type: "..." } } } }
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadCollections,
    exportSelectedTokens,
    generateTokensData
  };
}