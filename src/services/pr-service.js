/**
 * Pull Request Service - Handles PR description generation
 */

// Import comparison service
import { compareTokens } from './comparison-service.js';

/**
 * Generate PR description with changelog
 */
function generatePRDescription(tokensData, commitDescription, prevData = {}) {
  const filePath = 'src/figma-output/selected-tokens.json';
  let description = `## 🎨 Figma Design Tokens Update\n\n`;
  
  if (commitDescription) {
    description += `### Alterações:\n${commitDescription}\n\n`;
  }
  
  description += `### Detalhes da Atualização:\n`;
  description += `- Arquivo atualizado: \`${filePath}\`\n`;
  description += `- Exportado em: ${new Date().toLocaleString()}\n\n`;
  
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

export { generatePRDescription };