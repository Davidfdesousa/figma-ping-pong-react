/**
 * Pull Request Generation Service
 * 
 * This service specializes in generating detailed and informative pull request
 * descriptions for design token updates. It creates professional, structured
 * documentation that helps team members understand what changes were made.
 * 
 * Features:
 * - Automatic changelog generation
 * - Categorized change summaries (added/modified/removed)
 * - Timestamp and metadata inclusion
 * - Integration with comparison service for accurate change detection
 * 
 * @module PRService
 * @version 1.0.0
 */

/**
 * Generates a comprehensive pull request description with detailed changelog
 * 
 * This function creates a professional PR description that includes:
 * - Custom commit message (if provided)
 * - File update details and timestamp
 * - Categorized summary of all token changes
 * - Detailed breakdown of added, modified, and removed tokens
 * 
 * @async
 * @function generatePRDescription
 * @param {Object} tokensData - Current token data being committed
 * @param {string} commitDescription - Custom description from user
 * @param {Object} [prevData={}] - Previous token data for comparison
 * @returns {Promise<string>} Formatted markdown description for the PR
 * 
 * @example
 * const description = await generatePRDescription(
 *   newTokens, 
 *   'Updated color system', 
 *   oldTokens
 * );
 */
async function generatePRDescription(tokensData, commitDescription, prevData = {}) {
  const filePath = 'src/figma-output/selected-tokens.json';
  let description = `## 🎨 Figma Design Tokens Update\n\n`;
  
  if (commitDescription) {
    description += `### Alterações:\n${commitDescription}\n\n`;
  }
  
  description += `### Detalhes da Atualização:\n`;
  description += `- Arquivo atualizado: \`${filePath}\`\n`;
  description += `- Exportado em: ${new Date().toLocaleString()}\n\n`;
  
  // Compare with previous version
  const changes = compareTokens(prevData, tokensData);
  
  if (changes.added.length === 0 && changes.modified.length === 0 && changes.removed.length === 0) {
    description += `### Alterações:\nNenhuma alteração detectada nos tokens.\n\n`;
  } else {
    description += `### Resumo das Alterações:\n`;
    
    if (changes.added.length > 0) {
      description += `\n#### ✅ Tokens Adicionados (${changes.added.length}):\n`;
      changes.added.forEach((token) => {
        description += `- \`${token.path}\`: ${token.value}\n`;
      });
    }
    
    if (changes.modified.length > 0) {
      description += `\n#### 🔄 Tokens Modificados (${changes.modified.length}):\n`;
      changes.modified.forEach((token) => {
        description += `- \`${token.path}\`: \`${token.oldValue}\` → \`${token.newValue}\`\n`;
      });
    }
    
    if (changes.removed.length > 0) {
      description += `\n#### ❌ Tokens Removidos (${changes.removed.length}):\n`;
      changes.removed.forEach((token) => {
        description += `- \`${token.path}\`: ${token.value}\n`;
      });
    }
  }
  
  description += `\n_Este PR foi gerado automaticamente pelo Figma Token Exporter plugin._`;
  
  return description;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePRDescription
  };
}