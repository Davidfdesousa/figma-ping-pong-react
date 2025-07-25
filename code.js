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
  LOAD_BRANDS: 'load-brands',
  LOAD_COLLECTIONS: 'load-collections',
  EXPORT_SELECTED_TOKENS: 'export-selected-tokens',
  CREATE_BRAND_IN_FIGMA: 'create-brand-in-figma',
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
    return str ? str.toString().trim().toLowerCase() : '';
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
}

// ============================================================================
// COLLECTION MANAGER
// ============================================================================

class CollectionManager {
  static async loadCollections() {
    try {
      const collections = await FigmaApiService.getLocalVariableCollections();
      
      const collectionsData = collections.map(collection => ({
        id: collection.id,
        name: collection.name,
        variableCount: collection.variableIds.length,
        modes: collection.modes.map(mode => ({
          modeId: mode.modeId,
          name: mode.name
        }))
      }));
      
      Logger.success(`Loaded ${collectionsData.length} collections`);
      
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
    
    for (const variable of localVariables) {
      await TokenGenerator._processVariable(variable, selectedCollectionIds, structuredTokens);
    }
    
    Logger.success('Tokens generation completed');
    return structuredTokens;
  }

  static _validateInput(selectedCollectionIds) {
    if (!Array.isArray(selectedCollectionIds) || selectedCollectionIds.length === 0) {
      throw new Error('No collections selected');
    }
  }

  static async _processVariable(variable, selectedCollectionIds, structuredTokens) {
    if (!variable || !variable.variableCollectionId) return;
    
    const collection = await FigmaApiService.getVariableCollectionById(variable.variableCollectionId);
    
    if (!selectedCollectionIds.includes(collection.id)) return;
    
    const tokenValues = await TokenGenerator._extractTokenValues(variable, collection);
    const tokenData = TokenGenerator._createTokenData(tokenValues, collection);
    
    TokenGenerator._addToStructuredTokens(structuredTokens, collection.name, variable.name, tokenData);
  }

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
// BRAND MANAGER
// ============================================================================

class BrandManager {
  static async loadBrands() {
    try {
      Logger.info('Loading brands from Brands collection...');
      
      const brandsCollection = await CollectionManager.findCollectionByName('brands');
      if (!brandsCollection) {
        throw new Error('Collection "Brands" not found');
      }
      
      const brands = await BrandManager._extractBrandsFromCollection(brandsCollection);
      
      Logger.success(`Loaded ${brands.length} brands:`, brands.map(b => b.name));
      
      MessageService.postToUI({
        type: 'brands-loaded',
        data: brands
      });
      
      return brands;
    } catch (error) {
      Logger.error('Error loading brands:', error);
      MessageService.postToUI({
        type: 'load-error',
        message: error.message
      });
      throw error;
    }
  }

  static async _extractBrandsFromCollection(brandsCollection) {
    const brandsVariables = await CollectionManager.getVariablesFromCollection(brandsCollection);
    
    return brandsCollection.modes.map(mode => {
      const variablesInMode = brandsVariables.filter(variable => 
        variable && variable.valuesByMode && variable.valuesByMode[mode.modeId] !== undefined
      ).length;
      
      return {
        id: mode.name,
        name: mode.name,
        variableCount: variablesInMode,
        modes: [{ id: mode.modeId, name: mode.name }]
      };
    });
  }

  static async createBrandInFigma(brandName, baseBrandName) {
    try {
      Logger.info(`Creating brand "${brandName}" from "${baseBrandName}"`);
      
      BrandManager._validateBrandInputs(brandName, baseBrandName);
      
      const { globalCollection, brandsCollection } = await BrandManager._getRequiredCollections();
      const { brandsVariables } = await BrandManager._getCollectionVariables(globalCollection, brandsCollection);
      
      const baseBrandMode = BrandManager._findBaseBrandMode(brandsCollection, baseBrandName);
      const targetBrandMode = await BrandManager._getOrCreateTargetBrandMode(brandsCollection, brandName);
      
      const copiedBrandsVariables = await BrandManager._copyBrandModeValues(brandsVariables, baseBrandMode, targetBrandMode);
      
      const brandData = await BrandManager._generateBrandResponse(brandName, baseBrandName, globalCollection, brandsCollection, 0, copiedBrandsVariables);
      
      Logger.success(`Brand "${brandName}" created/updated successfully`);
      Logger.info(`Variables copied: ${copiedBrandsVariables} (no new variables created in Global)`);
      
      MessageService.postToUI({
        type: 'brand-created-in-figma',
        brandName: brandName,
        data: brandData,
        variablesCreated: copiedBrandsVariables
      });
      
    } catch (error) {
      Logger.error('BRAND CREATION FAILED:', error);
      MessageService.postToUI({
        type: 'brand-error',
        message: error.message
      });
    }
  }

  static _validateBrandInputs(brandName, baseBrandName) {
    if (!Utils.validateInputs(brandName, baseBrandName)) {
      throw new Error(`Invalid parameters: brandName="${brandName}", baseBrandName="${baseBrandName}"`);
    }
  }

  static async _getRequiredCollections() {
    const [globalCollection, brandsCollection] = await Promise.all([
      CollectionManager.findCollectionByName('global'),
      CollectionManager.findCollectionByName('brands')
    ]);
    
    if (!globalCollection || !brandsCollection) {
      throw new Error('Collections "Global" and "Brands" not found');
    }
    
    return { globalCollection, brandsCollection };
  }

  static async _getCollectionVariables(globalCollection, brandsCollection) {
    const brandsVariables = await CollectionManager.getVariablesFromCollection(brandsCollection);
    return { brandsVariables };
  }

  static _findBaseBrandMode(brandsCollection, baseBrandName) {
    const normalizedBaseBrandName = Utils.normalizeString(baseBrandName);
    Logger.debug(`Looking for base brand: "${baseBrandName}"`);
    
    const baseBrandMode = brandsCollection.modes.find(mode => 
      Utils.normalizeString(mode.name) === normalizedBaseBrandName
    );
    
    if (!baseBrandMode) {
      const availableModes = brandsCollection.modes.map(m => m.name);
      throw new Error(
        `Mode '${baseBrandName}' not found in Brands collection. ` +
        `Available modes: ${availableModes.join(', ')}`
      );
    }
    
    Logger.debug(`Base mode found: "${baseBrandMode.name}"`);
    return baseBrandMode;
  }

  static async _getOrCreateTargetBrandMode(brandsCollection, brandName) {
    const normalizedBrandName = Utils.normalizeString(brandName);
    let targetBrandMode = brandsCollection.modes.find(mode => 
      Utils.normalizeString(mode.name) === normalizedBrandName
    );
    
    if (targetBrandMode) {
      Logger.info(`Updating existing brand mode: ${brandName}`);
    } else {
      BrandManager._validateModeLimit(brandsCollection);
      targetBrandMode = brandsCollection.addMode(brandName);
      Logger.success(`Created new brand mode: ${brandName}`);
    }
    
    return targetBrandMode;
  }

  static _validateModeLimit(brandsCollection) {
    if (brandsCollection.modes.length >= CONSTANTS.MAX_MODES_PER_COLLECTION) {
      const existingModes = brandsCollection.modes.map(m => m.name).join(', ');
      throw new Error(
        `Cannot create new brand. Brands collection already has maximum ${CONSTANTS.MAX_MODES_PER_COLLECTION} modes: ${existingModes}. ` +
        `Choose one of the existing modes to update.`
      );
    }
  }

  static async _copyBrandModeValues(brandsVariables, baseBrandMode, newBrandMode) {
    Logger.info(`Copying values from "${baseBrandMode.name}" to "${newBrandMode.name}"`);
    
    let copiedCount = 0;
    
    for (const brandsVar of brandsVariables) {
      if (brandsVar && brandsVar.valuesByMode && brandsVar.valuesByMode[baseBrandMode.modeId] !== undefined) {
        const baseValue = brandsVar.valuesByMode[baseBrandMode.modeId];
        try {
          brandsVar.setValueForMode(newBrandMode.modeId, baseValue);
          copiedCount++;
        } catch (error) {
          Logger.warning(`Could not copy value for ${brandsVar.name}:`, error);
        }
      }
    }
    
    Logger.success(`Copied ${copiedCount} values to new Brands mode`);
    return copiedCount;
  }

  static async _generateBrandResponse(brandName, baseBrandName, globalCollection, brandsCollection, newGlobalVariablesCount, copiedBrandsVariables) {
    const tokens = await TokenGenerator.generateTokensData([
      globalCollection.id, 
      brandsCollection.id
    ]);
    
    return {
      name: brandName,
      description: `Brand mode ${brandName} created from ${baseBrandName} in Brands collection only`,
      type: 'complete',
      createdAt: new Date().toISOString(),
      baseBrand: baseBrandName,
      collections: [
        {
          id: globalCollection.id,
          name: globalCollection.name,
          variableCount: globalCollection.variableIds.length,
          modified: false
        },
        {
          id: brandsCollection.id,
          name: brandsCollection.name,
          variableCount: brandsCollection.variableIds.length,
          modified: true
        }
      ],
      tokens: tokens,
      metadata: {
        figmaFileKey: figma.fileKey,
        figmaFileName: figma.root.name,
        totalTokens: copiedBrandsVariables,
        collectionsUsed: 2,
        createdFromBrand: baseBrandName,
        groupCreated: brandName,
        collectionsModified: ['Brands'],
        newVariablesCreated: 0,
        variableValuesCopied: copiedBrandsVariables
      }
    };
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
    Logger.debug(`Processing message: ${msg.type}`);
    
    if (msg.type === MESSAGE_TYPES.CREATE_BRAND_IN_FIGMA) {
      Logger.debug(`Brand creation: "${msg.brandName}" from "${msg.baseBrandName}"`);
    }
    
    const commands = {
      [MESSAGE_TYPES.LOAD_GITHUB_CONFIG]: () => new LoadGitHubConfigCommand(),
      [MESSAGE_TYPES.LOAD_BRANDS]: () => new LoadBrandsCommand(),
      [MESSAGE_TYPES.LOAD_COLLECTIONS]: () => new LoadCollectionsCommand(),
      [MESSAGE_TYPES.EXPORT_SELECTED_TOKENS]: () => new ExportSelectedTokensCommand(msg.selectedCollections),
      [MESSAGE_TYPES.CREATE_BRAND_IN_FIGMA]: () => new CreateBrandInFigmaCommand(msg.brandName, msg.baseBrandName),
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

class LoadBrandsCommand extends Command {
  async execute() {
    await BrandManager.loadBrands();
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

class CreateBrandInFigmaCommand extends Command {
  constructor(brandName, baseBrandName) {
    super();
    this.brandName = brandName;
    this.baseBrandName = baseBrandName;
  }

  async execute() {
    Logger.debug(`Creating brand: ${this.brandName} from ${this.baseBrandName}`);
    await BrandManager.createBrandInFigma(this.brandName, this.baseBrandName);
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