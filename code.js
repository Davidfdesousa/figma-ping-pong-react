/**
 * Figma Token Exporter Plugin - Optimized & Fixed
 * @version 6.0.0
 */

// ============================================================================
// CORE UTILITIES
// ============================================================================

const Utils = {
  stringToBase64(str) {
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
  },

  formatTokenValue(value, type) {
    if (type === 'COLOR') {
      if (typeof value === 'object' && value.r !== undefined) {
        const r = Math.round(value.r * 255);
        const g = Math.round(value.g * 255);
        const b = Math.round(value.b * 255);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      }
    } else if (type === 'FLOAT') {
      return `${value}px`;
    }
    return value;
  },

  parseTokenPath(tokenName) {
    const path = tokenName.replace(/[\/-]/g, '.').split('.');
    return path.map(part => part.trim()).filter(part => part.length > 0);
  },

  setNestedValue(obj, path, value) {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  },

  normalizeString(str) {
    return str ? str.toString().trim().toLowerCase() : '';
  }
};

// ============================================================================
// COLLECTION MANAGER
// ============================================================================

const CollectionManager = {
  async loadCollections() {
    try {
      console.log('🔄 Loading collections...');
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      
      const collectionsData = collections.map(collection => ({
        id: collection.id,
        name: collection.name,
        variableCount: collection.variableIds.length,
        modes: collection.modes.map(mode => ({
          modeId: mode.modeId,
          name: mode.name
        }))
      }));
      
      console.log(`✅ Loaded ${collectionsData.length} collections`);
      figma.ui.postMessage({ 
        type: 'collections-loaded', 
        data: collectionsData 
      });
    } catch (error) {
      console.error('❌ Error loading collections:', error);
      figma.ui.postMessage({ 
        type: 'load-error', 
        message: 'Error loading collections: ' + error.message 
      });
    }
  },

  async findCollectionByName(name) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const normalizedName = Utils.normalizeString(name);
    return collections.find(c => Utils.normalizeString(c.name) === normalizedName);
  },

  async getVariablesFromCollection(collection) {
    if (!collection || !collection.variableIds) {
      console.warn('⚠️ Invalid collection provided');
      return [];
    }
    
    const variables = await Promise.all(
      collection.variableIds.map(async id => {
        try {
          return await figma.variables.getVariableByIdAsync(id);
        } catch (error) {
          console.warn(`⚠️ Could not load variable ${id}:`, error);
          return null;
        }
      })
    );
    
    return variables.filter(Boolean);
  }
};

// ============================================================================
// TOKEN GENERATOR
// ============================================================================

const TokenGenerator = {
  async generateTokensData(selectedCollectionIds) {
    if (!Array.isArray(selectedCollectionIds) || selectedCollectionIds.length === 0) {
      throw new Error('No collections selected');
    }

    console.log('🎨 Generating tokens for collections:', selectedCollectionIds);
    
    const localVariables = await figma.variables.getLocalVariablesAsync();
    const structuredTokens = {};
    
    for (const variable of localVariables) {
      if (!variable || !variable.variableCollectionId) continue;
      
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      
      if (!selectedCollectionIds.includes(collection.id)) continue;
      
      const tokenValues = {};
      const hasMultipleModes = collection.modes.length > 1;
      
      for (const mode of collection.modes) {
        const value = variable.valuesByMode[mode.modeId];
        
        if (value !== undefined) {
          if (typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
            try {
              const aliasedVariable = await figma.variables.getVariableByIdAsync(value.id);
              tokenValues[mode.name] = `{${aliasedVariable.name.replace(/\//g, '.')}}`;
            } catch (error) {
              console.warn(`⚠️ Could not resolve alias for ${variable.name}:`, error);
              tokenValues[mode.name] = null;
            }
          } else {
            tokenValues[mode.name] = Utils.formatTokenValue(value, variable.resolvedType);
          }
        }
      }
      
      const collectionName = collection.name;
      const tokenPath = Utils.parseTokenPath(variable.name);
      
      if (!structuredTokens[collectionName]) {
        structuredTokens[collectionName] = {};
      }
      
      const tokenData = {
        value: tokenValues[collection.modes[0].name] || null,
        type: "other"
      };
      
      if (hasMultipleModes && Object.keys(tokenValues).length > 1) {
        tokenData["$extensions"] = { mode: tokenValues };
      }
      
      Utils.setNestedValue(structuredTokens[collectionName], tokenPath, tokenData);
    }
    
    console.log('✅ Tokens generation completed');
    return structuredTokens;
  }
};

// ============================================================================
// BRAND MANAGER
// ============================================================================

const BrandManager = {
  async loadBrands() {
    try {
      console.log('🏷️ Loading brands from Brands collection...');
      
      const brandsCollection = await CollectionManager.findCollectionByName('brands');
      if (!brandsCollection) {
        throw new Error('Collection "Brands" not found');
      }
      
      const brandsVariables = await CollectionManager.getVariablesFromCollection(brandsCollection);
      
      const brands = brandsCollection.modes.map(mode => {
        const variablesInMode = brandsVariables.filter(variable => 
          variable && variable.valuesByMode[mode.modeId] !== undefined
        ).length;
        
        return {
          id: mode.name,
          name: mode.name,
          variableCount: variablesInMode,
          modes: [{
            id: mode.modeId,
            name: mode.name
          }]
        };
      });
      
      console.log(`✅ Loaded ${brands.length} brands:`, brands.map(b => b.name));
      
      figma.ui.postMessage({
        type: 'brands-loaded',
        data: brands
      });
      
    } catch (error) {
      console.error('❌ Error loading brands:', error);
      figma.ui.postMessage({
        type: 'load-error',
        message: error.message
      });
    }
  },

  async createBrandInFigma(brandName, baseBrandName) {
    try {
      console.log(`🎨 === BRAND CREATION START ===`);
      console.log(`📝 Target brand: "${brandName}"`);
      console.log(`📝 Base brand: "${baseBrandName}"`);
      console.log(`📝 Parameters received - brandName type: ${typeof brandName}, baseBrandName type: ${typeof baseBrandName}`);
      
      // Validate inputs
      if (!brandName || !baseBrandName) {
        throw new Error(`Invalid parameters: brandName="${brandName}", baseBrandName="${baseBrandName}"`);
      }
      
      // Get collections
      const [globalCollection, brandsCollection] = await Promise.all([
        CollectionManager.findCollectionByName('global'),
        CollectionManager.findCollectionByName('brands')
      ]);
      
      if (!globalCollection || !brandsCollection) {
        throw new Error('Collections "Global" and "Brands" not found');
      }
      
      console.log(`📁 Collections found - Global: ${globalCollection.name}, Brands: ${brandsCollection.name}`);
      
      // Get variables
      const [globalVariables, brandsVariables] = await Promise.all([
        CollectionManager.getVariablesFromCollection(globalCollection),
        CollectionManager.getVariablesFromCollection(brandsCollection)
      ]);
      
      console.log(`📊 Variables loaded - Global: ${globalVariables.length}, Brands: ${brandsVariables.length}`);
      
      // Find base brand mode with explicit debugging
      const availableModes = brandsCollection.modes.map(m => m.name);
      console.log(`🎯 Available modes in Brands collection:`, availableModes);
      console.log(`🔍 Looking for base brand mode: "${baseBrandName}"`);
      
      const normalizedBaseBrandName = Utils.normalizeString(baseBrandName);
      console.log(`🔍 Normalized base brand name: "${normalizedBaseBrandName}"`);
      
      let baseBrandMode = null;
      for (const mode of brandsCollection.modes) {
        const normalizedModeName = Utils.normalizeString(mode.name);
        console.log(`🔍 Comparing mode "${mode.name}" (normalized: "${normalizedModeName}") with base "${baseBrandName}" (normalized: "${normalizedBaseBrandName}")`);
        
        if (normalizedModeName === normalizedBaseBrandName) {
          baseBrandMode = mode;
          console.log(`✅ MATCH FOUND! Using mode: ${mode.name}`);
          break;
        }
      }
      
      if (!baseBrandMode) {
        const availableModesStr = availableModes.join(', ');
        throw new Error(
          `Mode '${baseBrandName}' not found in Brands collection. ` +
          `Available modes: ${availableModesStr}`
        );
      }
      
      console.log(`🎯 Base mode confirmed: ${baseBrandMode.name} (ID: ${baseBrandMode.modeId})`);
      
      // Check if brand already exists (update mode) or create new mode
      const normalizedBrandName = Utils.normalizeString(brandName);
      let targetBrandMode = brandsCollection.modes.find(mode => 
        Utils.normalizeString(mode.name) === normalizedBrandName
      );
      
      if (targetBrandMode) {
        console.log(`🔄 Updating existing brand mode: ${brandName}`);
      } else {
        // Check mode limit only when creating new mode
        if (brandsCollection.modes.length >= 4) {
          const existingModes = brandsCollection.modes.map(m => m.name).join(', ');
          throw new Error(
            `Cannot create new brand. Brands collection already has maximum 4 modes: ${existingModes}. ` +
            `Choose one of the existing modes to update: ${existingModes}`
          );
        }
        targetBrandMode = brandsCollection.addMode(brandName);
        console.log(`✨ Created new brand mode: ${brandName} (ID: ${targetBrandMode.modeId})`);
      }
      
      // Create new variables in Global collection (create a brand-specific group)
      const newGlobalVariables = await this.createGlobalBrandVariables(
        globalCollection, globalVariables, brandName, baseBrandName
      );
      
      // Copy values from base brand mode to target brand mode
      const copiedBrandsVariables = await this.copyBrandModeValues(
        brandsVariables, baseBrandMode, targetBrandMode
      );
      
      // Generate response data
      const tokens = await TokenGenerator.generateTokensData([
        globalCollection.id, 
        brandsCollection.id
      ]);
      
      const brand = {
        name: brandName,
        description: `Brand group ${brandName} created from ${baseBrandName}`,
        type: 'complete',
        createdAt: new Date().toISOString(),
        baseBrand: baseBrandName,
        collections: [
          {
            id: globalCollection.id,
            name: globalCollection.name,
            variableCount: globalCollection.variableIds.length
          },
          {
            id: brandsCollection.id,
            name: brandsCollection.name,
            variableCount: brandsCollection.variableIds.length
          }
        ],
        tokens: tokens,
        metadata: {
          figmaFileKey: figma.fileKey,
          figmaFileName: figma.root.name,
          totalTokens: newGlobalVariables.length + copiedBrandsVariables,
          collectionsUsed: 2,
          createdFromBrand: baseBrandName,
          groupCreated: brandName,
          collectionsModified: ['Global', 'Brands']
        }
      };
      
      console.log(`🎉 === BRAND CREATION SUCCESS ===`);
      console.log(`✅ Brand "${brandName}" created/updated successfully based on "${baseBrandName}"`);
      console.log(`📊 Variables created: ${newGlobalVariables.length}, Variables copied: ${copiedBrandsVariables}`);
      
      figma.ui.postMessage({
        type: 'brand-created-in-figma',
        brandName: brandName,
        data: brand,
        variablesCreated: newGlobalVariables.length + copiedBrandsVariables
      });
      
    } catch (error) {
      console.error('❌ === BRAND CREATION FAILED ===');
      console.error('❌ Error creating brand:', error);
      figma.ui.postMessage({
        type: 'brand-error',
        message: error.message
      });
    }
  },

  async createGlobalBrandVariables(globalCollection, globalVariables, brandName, baseBrandName) {
    console.log(`🛠️ Creating Global brand variables for "${brandName}"`);
    
    // Create brand-specific variants of common tokens
    const commonTokens = [
      'spacing/100', 'spacing/200', 'spacing/300',
      'sizing/100', 'sizing/200', 'sizing/300',
      'corner/radius/none', 'corner/radius/thin'
    ];
    
    const newVariables = [];
    
    // Find existing common tokens and create brand versions
    for (const tokenPath of commonTokens) {
      const existingVar = globalVariables.find(v => 
        v && Utils.normalizeString(v.name) === Utils.normalizeString(tokenPath)
      );
      
      if (existingVar) {
        const newVarName = `${brandName.toLowerCase()}/${tokenPath}`;
        console.log(`🔧 Creating Global variable: ${newVarName}`);
        
        try {
          const newVariable = figma.variables.createVariable(
            newVarName, 
            globalCollection, 
            existingVar.resolvedType
          );
          
          // Copy values from all modes
          for (const modeId of Object.keys(existingVar.valuesByMode)) {
            const baseValue = existingVar.valuesByMode[modeId];
            try {
              newVariable.setValueForMode(modeId, baseValue);
            } catch (error) {
              console.warn(`⚠️ Could not set value for ${newVarName}:`, error);
            }
          }
          
          newVariables.push(newVariable);
        } catch (error) {
          console.warn(`⚠️ Could not create variable ${newVarName}:`, error);
        }
      }
    }
    
    console.log(`✅ Created ${newVariables.length} new Global variables`);
    return newVariables;
  },

  async copyBrandModeValues(brandsVariables, baseBrandMode, newBrandMode) {
    console.log(`📋 Copying values from "${baseBrandMode.name}" to "${newBrandMode.name}"`);
    
    let copiedCount = 0;
    
    for (const brandsVar of brandsVariables) {
      if (brandsVar && brandsVar.valuesByMode[baseBrandMode.modeId] !== undefined) {
        const baseValue = brandsVar.valuesByMode[baseBrandMode.modeId];
        try {
          brandsVar.setValueForMode(newBrandMode.modeId, baseValue);
          copiedCount++;
        } catch (error) {
          console.warn(`⚠️ Could not copy value for ${brandsVar.name}:`, error);
        }
      }
    }
    
    console.log(`✅ Copied ${copiedCount} values to new Brands mode`);
    return copiedCount;
  }
};

// ============================================================================
// GITHUB MANAGER
// ============================================================================

const GitHubManager = {
  async loadConfig() {
    try {
      const config = await figma.clientStorage.getAsync('github-config');
      figma.ui.postMessage({ 
        type: 'github-config-loaded',
        data: config || {}
      });
    } catch (error) {
      console.error('❌ Error loading GitHub config:', error);
      figma.ui.postMessage({ 
        type: 'github-config-loaded',
        data: {}
      });
    }
  },

  async saveConfig(config) {
    try {
      await figma.clientStorage.setAsync('github-config', config);
      figma.ui.postMessage({ 
        type: 'github-config-saved',
        message: 'GitHub configuration saved successfully!'
      });
    } catch (error) {
      console.error('❌ Error saving GitHub config:', error);
      figma.ui.postMessage({ 
        type: 'github-error', 
        message: 'Error saving configuration: ' + error.message 
      });
    }
  },

  async exportToGitHub(selectedCollectionIds, commitDescription = '') {
    try {
      const prevData = await figma.clientStorage.getAsync('previous-tokens-data') || {};
      const githubConfig = await figma.clientStorage.getAsync('github-config');
      
      if (!githubConfig || !githubConfig.token || !githubConfig.repo) {
        figma.ui.postMessage({ 
          type: 'github-error', 
          message: 'GitHub configuration not found. Please configure first.' 
        });
        return;
      }

      const structuredTokens = await TokenGenerator.generateTokensData(selectedCollectionIds);
      await this.createPR(githubConfig, structuredTokens, commitDescription, prevData);
      await figma.clientStorage.setAsync('previous-tokens-data', structuredTokens);
      
    } catch (error) {
      console.error('❌ Error exporting to GitHub:', error);
      figma.ui.postMessage({ 
        type: 'github-error', 
        message: 'Error exporting to GitHub: ' + error.message 
      });
    }
  },

  async createPR(config, tokensData, commitDescription, prevData) {
    const { token, repo, owner } = config;
    const apiBase = 'https://api.github.com';
    
    // Get main branch
    const branchResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/ref/heads/main`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!branchResponse.ok) {
      throw new Error(`Error getting main branch: ${branchResponse.statusText}`);
    }
    
    const branchData = await branchResponse.json();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `figma-tokens-update-${timestamp}`;
    
    // Create branch
    await fetch(`${apiBase}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: branchData.object.sha
      })
    });
    
    // Update file
    const filePath = 'src/figma-output/selected-tokens.json';
    const fileContent = Utils.stringToBase64(JSON.stringify(tokensData, null, 2));
    
    let fileSha = null;
    try {
      const fileResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}?ref=${branchName}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        fileSha = fileData.sha;
      }
    } catch (e) {
      // File doesn't exist, which is fine
    }
    
    const commitMessage = commitDescription || `Update Figma tokens - ${new Date().toLocaleString()}`;
    const updateFilePayload = {
      message: commitMessage,
      content: fileContent,
      branch: branchName
    };
    
    if (fileSha) updateFilePayload.sha = fileSha;
    
    await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateFilePayload)
    });
    
    // Create PR
    const prResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `🎨 Update Figma Design Tokens`,
        head: branchName,
        base: 'main',
        body: `## 🎨 Figma Design Tokens Update\n\n${commitDescription || 'Updated design tokens from Figma'}\n\n_Auto-generated by Figma Token Exporter plugin._`
      })
    });
    
    if (!prResponse.ok) {
      throw new Error(`Error creating PR: ${prResponse.statusText}`);
    }
    
    const prData = await prResponse.json();
    
    figma.ui.postMessage({ 
      type: 'github-success', 
      message: 'PR created successfully!',
      prUrl: prData.html_url
    });
  }
};

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

const MessageHandler = {
  async handle(msg) {
    console.log(`📨 Message received: ${msg.type}`);
    
    try {
      const handlers = {
        'ping': () => figma.ui.postMessage({ type: 'pong' }),
        'load-github-config': () => GitHubManager.loadConfig(),
        'load-brands': () => BrandManager.loadBrands(),
        'load-collections': () => CollectionManager.loadCollections(),
        'export-selected-tokens': () => this.exportSelectedTokens(msg.selectedCollections),
        'create-brand-in-figma': () => {
          console.log(`🎯 Handler received: brandName="${msg.brandName}", baseBrandName="${msg.baseBrandName}"`);
          return BrandManager.createBrandInFigma(msg.brandName, msg.baseBrandName);
        },
        'save-github-config': () => GitHubManager.saveConfig(msg.config),
        'export-to-github': () => GitHubManager.exportToGitHub(msg.selectedCollections, msg.commitDescription),
        'close': () => figma.closePlugin()
      };

      const handler = handlers[msg.type];
      if (handler) {
        await handler();
      } else {
        console.warn('⚠️ Unknown message type:', msg.type);
      }
    } catch (error) {
      console.error(`❌ Error handling message ${msg.type}:`, error);
      figma.ui.postMessage({
        type: 'error',
        message: `Error handling ${msg.type}: ${error.message}`
      });
    }
  },

  async exportSelectedTokens(selectedCollectionIds) {
    try {
      const structuredTokens = await TokenGenerator.generateTokensData(selectedCollectionIds);
      figma.ui.postMessage({ 
        type: 'tokens-exported', 
        data: structuredTokens 
      });
    } catch (error) {
      console.error('❌ Error exporting tokens:', error);
      figma.ui.postMessage({ 
        type: 'export-error', 
        message: 'Error exporting tokens: ' + error.message 
      });
    }
  }
};

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

figma.showUI(__html__, { 
  width: 500, 
  height: 600,
  themeColors: true 
});

// Listen for messages from UI
figma.ui.onmessage = (msg) => {
  MessageHandler.handle(msg).catch(error => {
    console.error('❌ Unhandled error in message handler:', error);
    figma.ui.postMessage({
      type: 'error',
      message: `Unhandled error: ${error.message}`
    });
  });
};

console.log('🚀 Figma Token Exporter Plugin initialized successfully');