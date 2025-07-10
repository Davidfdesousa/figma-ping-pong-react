// Token comparison service for tracking changes

// Function to compare tokens and find differences
function compareTokens(prevData, newData) {
  const changes = {
    added: [],
    modified: [],
    removed: []
  };
  
  // Get all token paths from both datasets
  const prevTokens = getAllTokenPaths(prevData);
  const newTokens = getAllTokenPaths(newData);
  
  const prevPaths = Object.keys(prevTokens);
  const newPaths = Object.keys(newTokens);
  
  // Find added tokens
  newPaths.forEach(path => {
    if (!prevPaths.includes(path)) {
      changes.added.push({
        path: path,
        value: newTokens[path]
      });
    }
  });
  
  // Find removed tokens
  prevPaths.forEach(path => {
    if (!newPaths.includes(path)) {
      changes.removed.push({
        path: path,
        value: prevTokens[path]
      });
    }
  });
  
  // Find modified tokens
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

// Helper function to get all token paths with their values
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    compareTokens,
    getAllTokenPaths
  };
}