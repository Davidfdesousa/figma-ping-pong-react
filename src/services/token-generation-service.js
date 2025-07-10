/**
 * Token Generation Service - Core token processing logic
 */

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

/**
 * Generate tokens data from selected collections
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

export { generateTokensData };