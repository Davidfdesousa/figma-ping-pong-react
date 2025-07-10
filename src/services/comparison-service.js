/**
 * Token Comparison Service - Handles token comparison and change detection
 */

/**
 * Extract all token paths from data structure
 */
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

/**
 * Compare tokens between old and new data
 */
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

export { compareTokens };