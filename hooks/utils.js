/**
 * Utility Functions for Token Processing
 * 
 * This module contains essential utility functions used throughout the token export process.
 * These functions handle data transformation, encoding, and object manipulation operations
 * that are common across different parts of the plugin.
 * 
 * @module Utils
 * @version 1.0.0
 */

/**
 * Converts a string to Base64 encoding
 * 
 * This function implements a custom Base64 encoding algorithm that's compatible
 * with the GitHub API requirements. It's used primarily for encoding file content
 * when creating or updating files in GitHub repositories.
 * 
 * @param {string} str - The input string to encode
 * @returns {string} The Base64 encoded string
 * 
 * @example
 * const encoded = stringToBase64("Hello World");
 * console.log(encoded); // "SGVsbG8gV29ybGQ="
 */
function stringToBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += chars.charAt((bitmap >> 6) & 63);
    result += chars.charAt(bitmap & 63);
  }
  
  const padding = str.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + '==';
  } else if (padding === 2) {
    result = result.slice(0, -1) + '=';
  }
  
  return result;
}

/**
 * Formats token values according to their data type
 * 
 * This function standardizes token values into their appropriate string representations
 * based on the token type. It handles color conversion from RGB objects to hex,
 * adds units to numeric values, and preserves string values as-is.
 * 
 * @param {*} value - The raw token value from Figma
 * @param {string} type - The token type ('COLOR', 'FLOAT', 'STRING', etc.)
 * @returns {string|*} The formatted token value
 * 
 * @example
 * // Color formatting
 * formatTokenValue({r: 1, g: 0, b: 0}, 'COLOR'); // "#FF0000"
 * 
 * // Numeric formatting with units
 * formatTokenValue(16, 'FLOAT'); // "16px"
 * 
 * // String passthrough
 * formatTokenValue("Inter", 'STRING'); // "Inter"
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
 * Parses a token name into a structured path array
 * 
 * This function converts Figma token names (which may use various separators like 
 * forward slashes or hyphens) into a consistent dot-notation path structure.
 * It's essential for creating properly nested token objects.
 * 
 * @param {string} tokenName - The raw token name from Figma (e.g., "colors/primary/500")
 * @returns {string[]} An array representing the token's hierarchical path
 * 
 * @example
 * parseTokenPath("colors/primary/500"); // ["colors", "primary", "500"]
 * parseTokenPath("spacing-lg"); // ["spacing", "lg"]
 * parseTokenPath("typography.heading.large"); // ["typography", "heading", "large"]
 */
function parseTokenPath(tokenName) {
  let path = tokenName.replace(/[\/-]/g, '.').split('.');
  path = path.map(part => part.trim()).filter(part => part.length > 0);
  return path;
}

/**
 * Sets a nested object value using a path array
 * 
 * This function creates a nested object structure and sets a value at the specified path.
 * It automatically creates intermediate objects if they don't exist, ensuring that
 * deep token structures can be built without manual object creation.
 * 
 * @param {Object} obj - The target object to modify
 * @param {string[]} path - Array representing the nested path
 * @param {*} value - The value to set at the path location
 * 
 * @example
 * const tokens = {};
 * setNestedValue(tokens, ["colors", "primary", "500"], "#3B82F6");
 * // Result: { colors: { primary: { "500": "#3B82F6" } } }
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
 * Module exports for Node.js compatibility
 * 
 * Exports all utility functions for use in other modules when running
 * in a Node.js environment (primarily for testing purposes).
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stringToBase64,
    formatTokenValue,
    parseTokenPath,
    setNestedValue
  };
}