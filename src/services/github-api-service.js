/**
 * GitHub API Service - Handles GitHub API interactions
 */

// Import required services
import { stringToBase64 } from './utils.js';
import { generatePRDescription } from './pr-service.js';

/**
 * Create GitHub Pull Request with token updates
 */
async function createGitHubPR(config, tokensData, commitDescription = '', prevData = {}) {
  const { token, repo, owner } = config;
  const apiBase = 'https://api.github.com';
  
  try {
    // Get main branch SHA
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
    
    // Create new branch
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
    
    // Create or update file
    const filePath = 'src/figma-output/selected-tokens.json';
    const fileContent = stringToBase64(JSON.stringify(tokensData, null, 2));
    
    // Check if file exists to get SHA
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
    
    // Create/update file
    const commitMessage = commitDescription 
      ? commitDescription 
      : `Update Figma tokens - ${new Date().toLocaleString()}`;
    
    const updateFilePayload = {
      message: commitMessage,
      content: fileContent,
      branch: branchName
    };
    
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
    
    // Create Pull Request with detailed changelog
    const prDescription = generatePRDescription(tokensData, commitDescription, prevData);
    
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
        body: prDescription
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
    
  } catch (error) {
    console.error('GitHub API error:', error);
    figma.ui.postMessage({ 
      type: 'github-error', 
      message: 'GitHub API error: ' + error.message 
    });
  }
}

export { createGitHubPR };