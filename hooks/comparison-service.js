/**
 * Token Comparison Service
 * 
 * This service provides functionality to compare different versions of design tokens
 * and detect changes between them. It's essential for generating meaningful changelogs
 * and tracking token evolution over time.
 * 
 * The service can detect:
 * - Added tokens (new tokens that didn't exist before)
 * - Modified tokens (existing tokens with changed values)
 * - Removed tokens (tokens that no longer exist)
 * 
 * @module ComparisonService
 * @version 1.0.0
 */

/**
 * Compares two token datasets and identifies all changes
 * 
 * This function performs a comprehensive comparison between previous and new
 * token data, categorizing changes into added, modified, and removed tokens.
 * It's used primarily for generating pull request descriptions and changelogs.
 * 
 * @function compareTokens
 * @param {Object} prevData - Previous token dataset
 * @param {Object} newData - New token dataset
 * @returns {Object} Object containing arrays of added, modified, and removed tokens
 * 
 * @example
 * const changes = compareTokens(oldTokens, newTokens);
 * console.log(`${changes.added.length} tokens added`);
 * console.log(`${changes.modified.length} tokens modified`);
 * console.log(`${changes.removed.length} tokens removed`);
 */
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
  
  // Find added tokens (exist in new but not in previous)
  newPaths.forEach(path => {
    if (!prevPaths.includes(path)) {
      changes.added.push({
        path: path,
        value: newTokens[path]
      });
    }
  });
  
  // Find removed tokens (exist in previous but not in new)
  prevPaths.forEach(path => {
    if (!newPaths.includes(path)) {
      changes.removed.push({
        path: path,
        value: prevTokens[path]
      });
    }
  });
  
  // Find modified tokens (exist in both but with different values)
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

/**
 * Extracts all token paths from a nested data structure
 * 
 * This function recursively traverses the token data structure and creates
 * a flat map of all token paths to their values. It's used for efficient
 * comparison operations between different token versions.
 * 
 * @function getAllTokenPaths
 * @param {Object} data - Nested token data structure
 * @param {string} [prefix=''] - Path prefix for recursive calls
 * @returns {Object} Flat object mapping token paths to their values
 * 
 * @example
 * const paths = getAllTokenPaths({
 *   colors: {
 *     primary: { value: '#3B82F6', type: 'color' }
 *   }
 * });
 * // Returns: { 'colors.primary': '#3B82F6' }
 */
function getAllTokenPaths(data, prefix = '') {
  const tokens = {};
  
  /**
   * Recursive function to extract token paths from nested structure
   * 
   * @param {Object} obj - Current object being processed
   * @param {string} currentPrefix - Current path prefix
   */
  function extractPaths(obj, currentPrefix) {
    for (const key in obj) {
      const fullPath = currentPrefix ? `${currentPrefix}.${key}` : key;
      
      if (obj[key] && typeof obj[key] === 'object') {
        // Check if this is a token object (has value and type properties)
        if (obj[key].hasOwnProperty('value') && obj[key].hasOwnProperty('type')) {
          tokens[fullPath] = obj[key].value;
        } else {
          // Continue recursing for nested objects
          extractPaths(obj[key], fullPath);
        }
      }
    }
  }
  
  extractPaths(data, prefix);
  return tokens;
}

/**
 * Module exports for Node.js compatibility
 * 
 * Exports comparison functions for use in other modules when running
 * in a Node.js environment (primarily for testing purposes).
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    compareTokens,
    getAllTokenPaths
  };
}