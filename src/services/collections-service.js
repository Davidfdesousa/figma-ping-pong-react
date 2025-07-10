/**
 * Collections Service - Handles Figma collections loading
 */

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

export { loadCollections };