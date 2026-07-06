/**
 * Figma Token Exporter Plugin - Clean Code Refactored
 * @version 7.0.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const CONSTANTS = {
  MAX_MODES_PER_COLLECTION: 4,
  GITHUB_API_BASE: 'https://api.github.com',
  TARGET_FILE_PATH: 'src/figma-output/selected-tokens.json'
};

const MESSAGE_TYPES = {
  LOAD_GITHUB_CONFIG: 'load-github-config',
  LOAD_COLLECTIONS: 'load-collections',
  EXPORT_SELECTED_TOKENS: 'export-selected-tokens',
  CREATE_MODE_IN_COLLECTION: 'create-mode-in-collection',
  SAVE_GITHUB_CONFIG: 'save-github-config',
  EXPORT_TO_GITHUB: 'export-to-github',
  CLOSE: 'close'
};

// ============================================================================
// CORE UTILITIES
// ============================================================================

class Utils {
  static stringToBase64(str) {
    if (!str) return '';
    
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
    if (padding === 1) result = result.slice(0, -2) + '==';
    else if (padding === 2) result = result.slice(0, -1) + '=';
    
    return result;
  }

  static formatTokenValue(value, type) {
    const formatters = {
      COLOR: (val) => Utils._formatColorValue(val),
      FLOAT: (val) => `${val}px`
    };

    return formatters[type] ? formatters[type](value) : value;
  }

  static _formatColorValue(value) {
    if (typeof value !== 'object' || value.r === undefined) return value;
    
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
  }

  static parseTokenPath(tokenName) {
    if (!tokenName) return [];
    
    const path = tokenName.replace(/[\/-]/g, '.').split('.');
    return path.map(part => part.trim()).filter(Boolean);
  }

  static setNestedValue(obj, path, value) {
    if (!obj || !Array.isArray(path) || path.length === 0) return;
    
    let current = obj;
    const lastIndex = path.length - 1;
    
    for (let i = 0; i < lastIndex; i++) {
      const key = path[i];
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    current[path[lastIndex]] = value;
  }

  static normalizeString(str) {
    if (!str) return '';
    
    // Convert to string, trim whitespace, convert to lowercase, and remove any invisible characters
    const normalized = str.toString()
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
      
    // Only log during critical debugging phases
    if (str !== normalized) {
      Logger.debug(`String normalization: "${str}" -> "${normalized}"`);
    }
    return normalized;
  }

  static validateInputs(...inputs) {
    return inputs.every(input => input !== null && input !== undefined && input !== '');
  }
}

// ============================================================================
// LOGGER UTILITY
// ============================================================================

class Logger {
  static info(message, ...args) {
    console.log(`ℹ️ ${message}`, ...args);
  }

  static success(message, ...args) {
    console.log(`✅ ${message}`, ...args);
  }

  static warning(message, ...args) {
    console.warn(`⚠️ ${message}`, ...args);
  }

  static error(message, ...args) {
    console.error(`❌ ${message}`, ...args);
  }

  static debug(message, ...args) {
    console.log(`🔍 ${message}`, ...args);
  }
}

// ============================================================================
// FIGMA API SERVICE
// ============================================================================

class FigmaApiService {
  static async getLocalVariableCollections() {
    try {
      Logger.info('Loading collections...');
      return await figma.variables.getLocalVariableCollectionsAsync();
    } catch (error) {
      Logger.error('Failed to load collections:', error);
      throw error;
    }
  }

  static async getLocalVariables() {
    try {
      return await figma.variables.getLocalVariablesAsync();
    } catch (error) {
      Logger.error('Failed to load variables:', error);
      throw error;
    }
  }

  static async getVariableCollectionById(id) {
    try {
      return await figma.variables.getVariableCollectionByIdAsync(id);
    } catch (error) {
      Logger.error(`Failed to load collection ${id}:`, error);
      throw error;
    }
  }

  static async getVariableById(id) {
    try {
      return await figma.variables.getVariableByIdAsync(id);
    } catch (error) {
      Logger.warning(`Could not load variable ${id}:`, error);
      return null;
    }
  }

  static async getVariablesFromCollection(collection) {
    if (!collection || !collection.variableIds) {
      Logger.warning('Invalid collection provided');
      return [];
    }

    const variables = await Promise.all(
      collection.variableIds.map(id => FigmaApiService.getVariableById(id))
    );

    return variables.filter(Boolean);
  }

  /**
   * Checks whether a collection object is an ExtendedVariableCollection.
   * Extended collections have isExtension === true (Figma Enterprise feature).
   */
  static isExtendedCollection(collection) {
    return collection && collection.isExtension === true;
  }
}

// ============================================================================
// COLLECTION MANAGER
// ============================================================================

class CollectionManager {
  static async loadCollections() {
    try {
      const collections = await FigmaApiService.getLocalVariableCollections();
      
      const collectionsData = collections.map(collection => {
        const isExtended = FigmaApiService.isExtendedCollection(collection);
        
        const data = {
          id: collection.id,
          name: collection.name,
          variableCount: collection.variableIds.length,
          modes: collection.modes.map(mode => ({
            modeId: mode.modeId,
            name: mode.name,
            parentModeId: mode.parentModeId || null
          })),
          isExtended: isExtended
        };

        // Include extended collection metadata when available
        if (isExtended) {
          data.parentCollectionId = collection.parentVariableCollectionId || null;
          data.rootCollectionId = collection.rootVariableCollectionId || null;
          Logger.info(`Extended collection detected: "${collection.name}" (parent: ${data.parentCollectionId})`);
        }

        return data;
      });
      
      const extendedCount = collectionsData.filter(c => c.isExtended).length;
      Logger.success(`Loaded ${collectionsData.length} collections (${extendedCount} extended)`);
      
      MessageService.postToUI({ 
        type: 'collections-loaded', 
        data: collectionsData 
      });
      
      return collectionsData;
    } catch (error) {
      const errorMessage = `Error loading collections: ${error.message}`;
      Logger.error(errorMessage);
      
      MessageService.postToUI({ 
        type: 'load-error', 
        message: errorMessage
      });
      
      throw error;
    }
  }

  static async findCollectionByName(name) {
    if (!name) throw new Error('Collection name is required');
    
    const collections = await FigmaApiService.getLocalVariableCollections();
    const normalizedName = Utils.normalizeString(name);
    
    return collections.find(c => Utils.normalizeString(c.name) === normalizedName);
  }

  static async getVariablesFromCollection(collection) {
    return await FigmaApiService.getVariablesFromCollection(collection);
  }
}

// ============================================================================
// MESSAGE SERVICE
// ============================================================================

class MessageService {
  static postToUI(message) {
    figma.ui.postMessage(message);
  }

  static createErrorMessage(type, error) {
    return {
      type: 'error',
      message: `Error handling ${type}: ${error.message}`
    };
  }
}

// ============================================================================
// TOKEN GENERATOR
// ============================================================================

class TokenGenerator {
  static async generateTokensData(selectedCollectionIds) {
    TokenGenerator._validateInput(selectedCollectionIds);

    Logger.info('Generating tokens for collections:', selectedCollectionIds);
    
    const localVariables = await FigmaApiService.getLocalVariables();
    const structuredTokens = {};
    
    // Build a collection cache to avoid redundant async fetches
    const collectionCache = {};

    for (const variable of localVariables) {
      await TokenGenerator._processVariable(variable, selectedCollectionIds, structuredTokens, collectionCache);
    }
    
    Logger.success('Tokens generation completed');
    return structuredTokens;
  }

  static _validateInput(selectedCollectionIds) {
    if (!Array.isArray(selectedCollectionIds) || selectedCollectionIds.length === 0) {
      throw new Error('No collections selected');
    }
  }

  static async _getCollectionCached(collectionId, cache) {
    if (!cache[collectionId]) {
      cache[collectionId] = await FigmaApiService.getVariableCollectionById(collectionId);
    }
    return cache[collectionId];
  }

  static async _processVariable(variable, selectedCollectionIds, structuredTokens, collectionCache) {
    if (!variable || !variable.variableCollectionId) return;
    
    const collection = await TokenGenerator._getCollectionCached(variable.variableCollectionId, collectionCache);
    
    if (!selectedCollectionIds.includes(collection.id)) return;

    let tokenValues;

    if (FigmaApiService.isExtendedCollection(collection)) {
      // Extended collection: merge parent values with local overrides
      tokenValues = await TokenGenerator._extractExtendedTokenValues(variable, collection, collectionCache);
    } else {
      // Standard collection: use valuesByMode directly
      tokenValues = await TokenGenerator._extractTokenValues(variable, collection);
    }
    
    const tokenData = TokenGenerator._createTokenData(tokenValues, collection);
    
    TokenGenerator._addToStructuredTokens(structuredTokens, collection.name, variable.name, tokenData);
  }

  // ── Standard collection value extraction ────────────────────────────────────

  static async _extractTokenValues(variable, collection) {
    const tokenValues = {};
    
    for (const mode of collection.modes) {
      const value = variable.valuesByMode[mode.modeId];
      
      if (value !== undefined) {
        tokenValues[mode.name] = await TokenGenerator._resolveTokenValue(value, variable);
      }
    }
    
    return tokenValues;
  }

  // ── Extended collection value extraction ────────────────────────────────────

  /**
   * For an extended collection variable, uses the official Figma API method
   * `variable.valuesByModeForCollectionAsync(extendedCollection)` which returns
   * the correct merged map of { modeId: value } — already combining inherited
   * values from the parent collection with any brand-specific overrides.
   *
   * Falls back to reading variableOverrides manually if the async method is
   * unavailable (older plugin API versions).
   */
  static async _extractExtendedTokenValues(variable, extendedCollection, collectionCache) {
    const tokenValues = {};

    let valuesByMode = null;

    // Preferred path: use the official API that handles inheritance automatically
    if (typeof variable.valuesByModeForCollectionAsync === 'function') {
      try {
        valuesByMode = await variable.valuesByModeForCollectionAsync(extendedCollection);
        Logger.debug(`Extended collection "${extendedCollection.name}": used valuesByModeForCollectionAsync for "${variable.name}"`);
      } catch (e) {
        Logger.warning(`valuesByModeForCollectionAsync failed for "${variable.name}" in "${extendedCollection.name}":`, e);
      }
    }

    // Fallback: reconstruct manually via variableOverrides + parent inheritance
    if (!valuesByMode) {
      Logger.debug(`Extended collection "${extendedCollection.name}": falling back to manual override resolution for "${variable.name}"`);
      valuesByMode = await TokenGenerator._resolveExtendedValuesFallback(variable, extendedCollection, collectionCache);
    }

    // Convert the flat modeId→value map into modeName→formattedValue
    for (const mode of extendedCollection.modes) {
      const rawValue = valuesByMode[mode.modeId];
      if (rawValue !== undefined && rawValue !== null) {
        tokenValues[mode.name] = await TokenGenerator._resolveTokenValue(rawValue, variable);
      }
    }

    return tokenValues;
  }

  /**
   * Manual fallback for resolving extended collection values when
   * valuesByModeForCollectionAsync is not available.
   *
   * Resolution order per mode:
   *   1. variableOverrides[variable.id][mode.modeId]  — brand-specific override
   *   2. parent collection's variable value at mode.parentModeId — inherited
   *   3. variable.valuesByMode[mode.modeId]            — last resort
   */
  static async _resolveExtendedValuesFallback(variable, extendedCollection, collectionCache) {
    const valuesByMode = {};
    const overrides = (extendedCollection.variableOverrides || {})[variable.id] || {};

    // Pre-fetch parent variable once if needed
    let parentVariable = null;
    const needsParent = extendedCollection.modes.some(
      mode => overrides[mode.modeId] === undefined && mode.parentModeId
    );
    if (needsParent && extendedCollection.parentVariableCollectionId) {
      try {
        parentVariable = await FigmaApiService.getVariableById(variable.id);
      } catch (e) {
        Logger.warning(`Could not fetch parent variable for "${variable.name}":`, e);
      }
    }

    for (const mode of extendedCollection.modes) {
      if (overrides[mode.modeId] !== undefined) {
        valuesByMode[mode.modeId] = overrides[mode.modeId];
      } else if (parentVariable && mode.parentModeId && parentVariable.valuesByMode[mode.parentModeId] !== undefined) {
        valuesByMode[mode.modeId] = parentVariable.valuesByMode[mode.parentModeId];
      } else if (variable.valuesByMode[mode.modeId] !== undefined) {
        valuesByMode[mode.modeId] = variable.valuesByMode[mode.modeId];
      }
    }

    return valuesByMode;
  }

  // ── Shared helpers ───────────────────────────────────────────────────────────

  static async _resolveTokenValue(value, variable) {
    if (typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
      return await TokenGenerator._resolveAlias(value, variable.name);
    }
    
    return Utils.formatTokenValue(value, variable.resolvedType);
  }

  static async _resolveAlias(aliasValue, variableName) {
    try {
      const aliasedVariable = await FigmaApiService.getVariableById(aliasValue.id);
      return `{${aliasedVariable.name.replace(/\//g, '.')}}`;
    } catch (error) {
      Logger.warning(`Could not resolve alias for ${variableName}:`, error);
      return null;
    }
  }

  static _createTokenData(tokenValues, collection) {
    const hasMultipleModes = collection.modes.length > 1;
    const primaryValue = tokenValues[collection.modes[0].name] || null;
    
    const tokenData = {
      value: primaryValue,
      type: "other"
    };
    
    if (hasMultipleModes && Object.keys(tokenValues).length > 1) {
      tokenData["$extensions"] = { mode: tokenValues };
    }
    
    return tokenData;
  }

  static _addToStructuredTokens(structuredTokens, collectionName, variableName, tokenData) {
    if (!structuredTokens[collectionName]) {
      structuredTokens[collectionName] = {};
    }
    
    const tokenPath = Utils.parseTokenPath(variableName);
    Utils.setNestedValue(structuredTokens[collectionName], tokenPath, tokenData);
  }
}

// ============================================================================
// MODE MANAGER
// Fully agnostic: operates on collection IDs and mode IDs supplied by the UI.
// No collection or mode names are assumed or hardcoded here.
// ============================================================================

class ModeManager {
  /**
   * Creates a new mode in any collection, copying all variable values from a
   * base mode. All parameters come from the UI (IDs, not names).
   *
   * @param {string} collectionId   - ID of the target collection
   * @param {string} baseModeId     - ID of the mode to copy values from
   * @param {string} newModeName    - Name for the new mode
   */
  static async createModeInCollection(collectionId, baseModeId, newModeName) {
    try {
      if (!collectionId || !baseModeId || !newModeName || !newModeName.trim()) {
        throw new Error('collectionId, baseModeId and newModeName are required');
      }

      const cleanModeName = newModeName.trim();
      Logger.info(`Creating mode "${cleanModeName}" in collection ${collectionId} from base mode ${baseModeId}`);

      const collection = await FigmaApiService.getVariableCollectionById(collectionId);
      if (!collection) throw new Error(`Collection ${collectionId} not found`);

      const baseModeObj = collection.modes.find(m => m.modeId === baseModeId);
      if (!baseModeObj) {
        throw new Error(
          `Mode ${baseModeId} not found in collection "${collection.name}". ` +
          `Available: ${collection.modes.map(m => m.modeId).join(', ')}`
        );
      }

      const targetModeObj = await ModeManager._getOrCreateMode(collection, cleanModeName);
      const variables = await FigmaApiService.getVariablesFromCollection(collection);
      const copiedCount = await ModeManager._copyModeValues(variables, baseModeObj.modeId, targetModeObj.modeId, collection.name);

      const tokens = await TokenGenerator.generateTokensData([collection.id]);

      Logger.success(`Mode "${cleanModeName}" ready in "${collection.name}" — ${copiedCount} values copied`);

      MessageService.postToUI({
        type: 'mode-created-in-collection',
        collectionName: collection.name,
        modeName: cleanModeName,
        variablesUpdated: copiedCount,
        data: {
          collectionId: collection.id,
          collectionName: collection.name,
          modeName: cleanModeName,
          baseModeId,
          baseModeName: baseModeObj.name,
          createdAt: new Date().toISOString(),
          tokens
        }
      });
    } catch (error) {
      Logger.error('Mode creation failed:', error);
      MessageService.postToUI({ type: 'mode-error', message: error.message });
    }
  }

  static async _getOrCreateMode(collection, modeName) {
    const normalized = Utils.normalizeString(modeName);

    // Return existing mode if already present
    const existing = collection.modes.find(m => Utils.normalizeString(m.name) === normalized);
    if (existing) {
      Logger.info(`Mode "${modeName}" already exists — will overwrite values`);
      return existing;
    }

    // Enforce Figma plan mode limit
    if (collection.modes.length >= CONSTANTS.MAX_MODES_PER_COLLECTION) {
      const names = collection.modes.map(m => m.name).join(', ');
      throw new Error(
        `Collection "${collection.name}" already has the maximum of ${CONSTANTS.MAX_MODES_PER_COLLECTION} modes: ${names}. ` +
        `Remove one or choose an existing mode to overwrite.`
      );
    }

    if (typeof collection.addMode !== 'function') {
      throw new Error(`collection.addMode is not available on "${collection.name}"`);
    }

    const result = collection.addMode(modeName);
    Logger.debug(`addMode returned:`, typeof result, result);

    // addMode may return a mode object or just a string modeId depending on API version
    if (result && typeof result === 'object' && result.modeId) return result;

    // Fallback: find the newly created mode by name
    const created = collection.modes.find(m => m.name === modeName);
    if (created) return created;

    throw new Error(`addMode did not create mode "${modeName}" in "${collection.name}"`);
  }

  static async _copyModeValues(variables, sourceModeId, targetModeId, collectionName) {
    let copiedCount = 0;
    const failed = [];

    for (const variable of variables) {
      if (!variable || !variable.valuesByMode) continue;
      if (variable.valuesByMode[sourceModeId] === undefined) continue;

      try {
        variable.setValueForMode(targetModeId, variable.valuesByMode[sourceModeId]);
        copiedCount++;
      } catch (e) {
        failed.push(variable.name);
        Logger.error(`Failed to copy "${variable.name}" in "${collectionName}":`, e);
      }
    }

    if (failed.length) Logger.warning(`${failed.length} variables could not be copied: ${failed.join(', ')}`);
    Logger.success(`Copied ${copiedCount} values in "${collectionName}"`);
    return copiedCount;
  }
}

// ============================================================================
// GITHUB MANAGER
// ============================================================================

class GitHubManager {
  static async loadConfig() {
    try {
      const config = await figma.clientStorage.getAsync('github-config');
      MessageService.postToUI({ 
        type: 'github-config-loaded',
        data: config || {}
      });
      return config;
    } catch (error) {
      Logger.error('Error loading GitHub config:', error);
      MessageService.postToUI({ 
        type: 'github-config-loaded',
        data: {}
      });
      throw error;
    }
  }

  static async saveConfig(config) {
    try {
      GitHubManager._validateConfig(config);
      await figma.clientStorage.setAsync('github-config', config);
      MessageService.postToUI({ 
        type: 'github-config-saved',
        message: 'GitHub configuration saved successfully!'
      });
    } catch (error) {
      Logger.error('Error saving GitHub config:', error);
      MessageService.postToUI({ 
        type: 'github-error', 
        message: `Error saving configuration: ${error.message}`
      });
      throw error;
    }
  }

  static _validateConfig(config) {
    const requiredFields = ['token', 'owner', 'repo'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  static async exportToGitHub(selectedCollectionIds, commitDescription = '') {
    try {
      const [prevData, githubConfig] = await Promise.all([
        figma.clientStorage.getAsync('previous-tokens-data'),
        figma.clientStorage.getAsync('github-config')
      ]);

      GitHubManager._validateGitHubConfig(githubConfig);

      const structuredTokens = await TokenGenerator.generateTokensData(selectedCollectionIds);
      await GitHubManager._createPR(githubConfig, structuredTokens, commitDescription, prevData || {});
      await figma.clientStorage.setAsync('previous-tokens-data', structuredTokens);
      
    } catch (error) {
      Logger.error('Error exporting to GitHub:', error);
      MessageService.postToUI({ 
        type: 'github-error', 
        message: `Error exporting to GitHub: ${error.message}`
      });
      throw error;
    }
  }

  static _validateGitHubConfig(githubConfig) {
    if (!githubConfig || !githubConfig.token || !githubConfig.repo || !githubConfig.owner) {
      throw new Error('GitHub configuration not found. Please configure first.');
    }
  }

  static async _createPR(config, tokensData, commitDescription, prevData) {
    const { token, repo, owner } = config;
    
    const branchData = await GitHubManager._getMainBranch(token, owner, repo);
    const branchName = GitHubManager._generateBranchName();
    
    await GitHubManager._createBranch(token, owner, repo, branchName, branchData.object.sha);
    
    const fileSha = await GitHubManager._getFileSha(token, owner, repo, branchName);
    await GitHubManager._updateFile(token, owner, repo, branchName, tokensData, commitDescription, fileSha);
    
    const prData = await GitHubManager._createPullRequest(token, owner, repo, branchName, commitDescription);
    
    MessageService.postToUI({ 
      type: 'github-success', 
      message: 'PR created successfully!',
      prUrl: prData.html_url
    });
  }

  static async _getMainBranch(token, owner, repo) {
    const response = await fetch(`${CONSTANTS.GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/main`, {
      headers: GitHubManager._getHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error(`Error getting main branch: ${response.statusText}`);
    }
    
    return await response.json();
  }

  static _generateBranchName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `figma-tokens-update-${timestamp}`;
  }

  static async _createBranch(token, owner, repo, branchName, sha) {
    const response = await fetch(`${CONSTANTS.GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: GitHubManager._getHeaders(token, true),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: sha
      })
    });

    if (!response.ok) {
      throw new Error(`Error creating branch: ${response.statusText}`);
    }
  }

  static async _getFileSha(token, owner, repo, branchName) {
    try {
      const response = await fetch(`${CONSTANTS.GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${CONSTANTS.TARGET_FILE_PATH}?ref=${branchName}`, {
        headers: GitHubManager._getHeaders(token)
      });
      
      if (response.ok) {
        const fileData = await response.json();
        return fileData.sha;
      }
    } catch (error) {
      // File doesn't exist, which is fine for new files
      Logger.info('File does not exist, will create new file');
    }
    
    return null;
  }

  static async _updateFile(token, owner, repo, branchName, tokensData, commitDescription, fileSha) {
    const commitMessage = commitDescription || `Update Figma tokens - ${new Date().toLocaleString()}`;
    const fileContent = Utils.stringToBase64(JSON.stringify(tokensData, null, 2));
    
    const updateFilePayload = {
      message: commitMessage,
      content: fileContent,
      branch: branchName
    };
    
    if (fileSha) updateFilePayload.sha = fileSha;
    
    const response = await fetch(`${CONSTANTS.GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${CONSTANTS.TARGET_FILE_PATH}`, {
      method: 'PUT',
      headers: GitHubManager._getHeaders(token, true),
      body: JSON.stringify(updateFilePayload)
    });

    if (!response.ok) {
      throw new Error(`Error updating file: ${response.statusText}`);
    }
  }

  static async _createPullRequest(token, owner, repo, branchName, commitDescription) {
    const response = await fetch(`${CONSTANTS.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: GitHubManager._getHeaders(token, true),
      body: JSON.stringify({
        title: `🎨 Update Figma Design Tokens`,
        head: branchName,
        base: 'main',
        body: `## 🎨 Figma Design Tokens Update\n\n${commitDescription || 'Updated design tokens from Figma'}\n\n_Auto-generated by Figma Token Exporter plugin._`
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error creating PR: ${response.statusText}`);
    }
    
    return await response.json();
  }

  static _getHeaders(token, includeContentType = false) {
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }
}

// ============================================================================
// MESSAGE HANDLER - Command Pattern Implementation
// ============================================================================

class MessageHandler {
  static async handle(msg) {
    Logger.info(`Message received: ${msg.type}`);
    
    try {
      const command = MessageHandler._createCommand(msg);
      await command.execute();
    } catch (error) {
      Logger.error(`Error handling message ${msg.type}:`, error);
      MessageService.postToUI(MessageService.createErrorMessage(msg.type, error));
    }
  }

  static _createCommand(msg) {
    Logger.debug(`🔍 Processing message: ${msg.type}`);
    Logger.debug(`📋 Full message object:`, JSON.stringify(msg, null, 2));
    
    const commands = {
      [MESSAGE_TYPES.LOAD_GITHUB_CONFIG]: () => new LoadGitHubConfigCommand(),
      [MESSAGE_TYPES.LOAD_COLLECTIONS]: () => new LoadCollectionsCommand(),
      [MESSAGE_TYPES.EXPORT_SELECTED_TOKENS]: () => new ExportSelectedTokensCommand(msg.selectedCollections),
      [MESSAGE_TYPES.CREATE_MODE_IN_COLLECTION]: () => new CreateModeInCollectionCommand(msg.collectionId, msg.baseModeId, msg.newModeName),
      [MESSAGE_TYPES.SAVE_GITHUB_CONFIG]: () => new SaveGitHubConfigCommand(msg.config),
      [MESSAGE_TYPES.EXPORT_TO_GITHUB]: () => new ExportToGitHubCommand(msg.selectedCollections, msg.commitDescription),
      [MESSAGE_TYPES.CLOSE]: () => new ClosePluginCommand()
    };

    const commandFactory = commands[msg.type];
    if (!commandFactory) {
      Logger.warning('Unknown message type:', msg.type);
      throw new Error(`Unknown message type: ${msg.type}`);
    }

    return commandFactory();
  }
}

// ============================================================================
// COMMAND CLASSES - Command Pattern
// ============================================================================

class Command {
  async execute() {
    throw new Error('Execute method must be implemented');
  }
}

class LoadGitHubConfigCommand extends Command {
  async execute() {
    await GitHubManager.loadConfig();
  }
}

class LoadCollectionsCommand extends Command {
  async execute() {
    await CollectionManager.loadCollections();
  }
}

class ExportSelectedTokensCommand extends Command {
  constructor(selectedCollections) {
    super();
    this.selectedCollections = selectedCollections;
  }

  async execute() {
    if (!this.selectedCollections || this.selectedCollections.length === 0) {
      throw new Error('No collections selected for export');
    }

    const structuredTokens = await TokenGenerator.generateTokensData(this.selectedCollections);
    MessageService.postToUI({ 
      type: 'tokens-exported', 
      data: structuredTokens 
    });
  }
}

class CreateModeInCollectionCommand extends Command {
  constructor(collectionId, baseModeId, newModeName) {
    super();
    this.collectionId = collectionId;
    this.baseModeId = baseModeId;
    this.newModeName = newModeName;
  }

  async execute() {
    await ModeManager.createModeInCollection(this.collectionId, this.baseModeId, this.newModeName);
  }
}

class SaveGitHubConfigCommand extends Command {
  constructor(config) {
    super();
    this.config = config;
  }

  async execute() {
    await GitHubManager.saveConfig(this.config);
  }
}

class ExportToGitHubCommand extends Command {
  constructor(selectedCollections, commitDescription) {
    super();
    this.selectedCollections = selectedCollections;
    this.commitDescription = commitDescription;
  }

  async execute() {
    await GitHubManager.exportToGitHub(this.selectedCollections, this.commitDescription);
  }
}

class ClosePluginCommand extends Command {
  async execute() {
    figma.closePlugin();
  }
}

// ============================================================================
// PLUGIN CONTROLLER - Facade Pattern
// ============================================================================

class PluginController {
  static initialize() {
    PluginController._setupUI();
    PluginController._setupMessageListener();
    PluginController._logInitialization();
  }

  static _setupUI() {
    figma.showUI(__html__, { 
      width: 500, 
      height: 600,
      themeColors: true 
    });
  }

  static _setupMessageListener() {
    figma.ui.onmessage = async (msg) => {
      try {
        await MessageHandler.handle(msg);
      } catch (error) {
        Logger.error('Unhandled error in message handler:', error);
        MessageService.postToUI({
          type: 'error',
          message: `Unhandled error: ${error.message}`
        });
      }
    };
  }

  static _logInitialization() {
    Logger.success('Figma Token Exporter Plugin initialized successfully');
  }
}

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

PluginController.initialize();