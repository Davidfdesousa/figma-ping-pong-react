/**
 * GitHub Integration Service
 * 
 * This service handles all GitHub-related operations for the token export plugin.
 * It manages configuration persistence, repository interactions, and automated
 * pull request creation with detailed change tracking.
 * 
 * Features:
 * - GitHub configuration management (tokens, repository settings)
 * - Automated branch creation for token updates
 * - File creation/updating in repositories
 * - Pull request generation with detailed changelogs
 * - Integration with comparison service for change detection
 * 
 * @module GitHubService
 * @version 1.0.0
 */

/**
 * Custom Base64 encoding function for GitHub API compatibility
 * 
 * GitHub API requires file content to be Base64 encoded. This implementation
 * is compatible with the Figma plugin environment and doesn't rely on external libraries.
 * 
 * @param {string} str - String to encode
 * @returns {string} Base64 encoded string
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
  
  // Add padding
  const padding = str.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + '==';
  } else if (padding === 2) {
    result = result.slice(0, -1) + '=';
  }
  
  return result;
}

/**
 * Loads GitHub configuration from Figma's client storage
 * 
 * Retrieves previously saved GitHub configuration including access token,
 * repository details, and user preferences. Returns empty object if no
 * configuration exists.
 * 
 * @async
 * @function loadGitHubConfig
 * @returns {Promise<void>} Sends configuration data to UI via postMessage
 * 
 * @example
 * // Load saved GitHub settings
 * await loadGitHubConfig();
 */
async function loadGitHubConfig() {
  try {
    const config = await figma.clientStorage.getAsync('github-config');
    figma.ui.postMessage({ 
      type: 'github-config-loaded',
      data: config || {}
    });
  } catch (error) {
    console.error('Error loading GitHub configuration:', error);
    figma.ui.postMessage({ 
      type: 'github-config-loaded',
      data: {}
    });
  }
}

/**
 * Saves GitHub configuration to Figma's client storage
 * 
 * Persists GitHub settings including access token, repository information,
 * and user preferences for future plugin sessions.
 * 
 * @async
 * @function saveGitHubConfig
 * @param {Object} config - GitHub configuration object
 * @param {string} config.token - GitHub personal access token
 * @param {string} config.owner - Repository owner/organization
 * @param {string} config.repo - Repository name
 * @returns {Promise<void>} Sends success/error message to UI
 * 
 * @example
 * await saveGitHubConfig({
 *   token: 'ghp_xxxxxxxxxxxx',
 *   owner: 'myorg',
 *   repo: 'design-tokens'
 * });
 */
async function saveGitHubConfig(config) {
  try {
    await figma.clientStorage.setAsync('github-config', config);
    figma.ui.postMessage({ 
      type: 'github-config-saved',
      message: 'GitHub configuration saved successfully!'
    });
  } catch (error) {
    console.error('Error saving GitHub configuration:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Error saving configuration: ' + error.message 
    });
  }
}

/**
 * Exports design tokens to GitHub repository via automated pull request
 * 
 * This is the main GitHub integration function that orchestrates the entire
 * export process including token generation, change detection, and PR creation.
 * 
 * @async
 * @function exportToGitHub
 * @param {string[]} selectedCollectionIds - Collections to export
 * @param {string} [commitDescription=''] - Optional commit description
 * @returns {Promise<void>} Creates PR and sends result to UI
 * 
 * @throws {Error} When GitHub configuration is missing or API calls fail
 * 
 * @example
 * await exportToGitHub(
 *   ['collection-1', 'collection-2'], 
 *   'Updated primary color palette'
 * );
 */
async function exportToGitHub(selectedCollectionIds, commitDescription = '') {
  try {
    // Load previous version for comparison BEFORE generating new data
    const prevData = await figma.clientStorage.getAsync('previous-tokens-data') || {};

    // Get GitHub configuration
    const githubConfig = await figma.clientStorage.getAsync('github-config');
    
    if (!githubConfig || !githubConfig.token || !githubConfig.repo) {
      figma.ui.postMessage({ 
        type: 'github-error', 
        message: 'GitHub configuration not found. Please configure first.' 
      });
      return;
    }

    // Generate tokens data (imported from figma-api-service)
    const structuredTokens = await generateTokensData(selectedCollectionIds);

    // Create GitHub PR with comparison
    await createGitHubPR(githubConfig, structuredTokens, commitDescription, prevData);
    
    // Save current tokens as previous version for next comparison (only after successful PR creation)
    await figma.clientStorage.setAsync('previous-tokens-data', structuredTokens);
    
  } catch (error) {
    console.error('Error exporting to GitHub:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'Error exporting to GitHub: ' + error.message 
    });
  }
}

/**
 * Creates a GitHub pull request with token updates
 * 
 * This function handles the complete GitHub workflow:
 * 1. Gets the main branch SHA
 * 2. Creates a new feature branch with timestamp
 * 3. Creates/updates the tokens file
 * 4. Creates a pull request with detailed changelog
 * 
 * @async
 * @function createGitHubPR
 * @param {Object} config - GitHub configuration
 * @param {Object} tokensData - Structured token data to commit
 * @param {string} [commitDescription=''] - Custom commit message
 * @param {Object} [prevData={}] - Previous token data for comparison
 * @returns {Promise<void>} Sends PR URL and status to UI
 * 
 * @throws {Error} When GitHub API operations fail
 * 
 * @example
 * await createGitHubPR(githubConfig, tokens, 'Color system update', previousTokens);
 */
async function createGitHubPR(config, tokensData, commitDescription = '', prevData = {}) {
  const { token, repo, owner } = config;
  const apiBase = 'https://api.github.com';
  
  try {
    // Step 1: Get main branch SHA for creating new branch
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
    const mainSha = branchData.object.sha;
    
    // Step 2: Create new branch with unique timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `figma-tokens-update-${timestamp}`;
    
    const createBranchResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: mainSha
      })
    });
    
    if (!createBranchResponse.ok) {
      throw new Error(`Error creating branch: ${createBranchResponse.statusText}`);
    }
    
    // Step 3: Prepare file content and check if file exists
    const filePath = 'src/figma-output/selected-tokens.json';
    const fileContent = stringToBase64(JSON.stringify(tokensData, null, 2));
    
    // Check if file exists to get SHA (required for updates)
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
      // File doesn't exist, which is fine for new files
      console.log('File does not exist yet, will create new file');
    }
    
    // Step 4: Create or update the file
    const commitMessage = commitDescription 
      ? commitDescription 
      : `Update Figma tokens - ${new Date().toLocaleString()}`;
    
    const updateFilePayload = {
      message: commitMessage,
      content: fileContent,
      branch: branchName
    };
    
    // Include SHA only if file already exists
    if (fileSha) {
      updateFilePayload.sha = fileSha;
    }
    
    const updateFileResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateFilePayload)
    });
    
    if (!updateFileResponse.ok) {
      throw new Error(`Error updating file: ${updateFileResponse.statusText}`);
    }
    
    // Step 5: Create Pull Request with detailed description
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
          body: await generatePRDescription(tokensData, commitDescription, prevData)
        })
    });
    
    if (!prResponse.ok) {
      throw new Error(`Error creating PR: ${prResponse.statusText}`);
    }
    
    const prData = await prResponse.json();
    
    // Send success message to UI with PR URL
    figma.ui.postMessage({ 
      type: 'github-success', 
      message: 'PR created successfully!',
      prUrl: prData.html_url
    });
    
  } catch (error) {
    console.error('GitHub API error:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'GitHub API error: ' + error.message 
    });
  }
}

/**
 * Module exports for Node.js compatibility
 * 
 * Exports GitHub service functions for use in other modules when running
 * in a Node.js environment (primarily for testing purposes).
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadGitHubConfig,
    saveGitHubConfig,
    exportToGitHub,
    createGitHubPR
  };
}