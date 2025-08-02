/**
 * Exemplo de uso do Figma Token Exporter Plugin - Structured Tokens
 * 
 * Este arquivo demonstra como usar as novas funcionalidades de tokens estruturados
 */

// ============================================================================
// EXEMPLO 1: ESTRUTURA DE TOKENS GERADA
// ============================================================================

/*
Ao usar o plugin com as seguintes coleções no Figma:

1. "Global Foundation" (contém tokens base)
   - spacing/small = 8px
   - spacing/medium = 16px  
   - colors/primary = #3366CC
   - corner/radius = 4px

2. "Creative Brand" (tema creative)
   - colors/brand/primary = #E61945
   - colors/brand/secondary = {Global Foundation.colors/primary}
   - spacing/component/gap = {Global Foundation.spacing/medium}

O plugin gerará a seguinte estrutura:
*/

const exemploEstrutturaGerada = {
  "src/tokens/foundation/spacing.json": {
    "spacing": {
      "small": {
        "value": "8px",
        "type": "other"
      },
      "medium": {
        "value": "16px", 
        "type": "other"
      }
    }
  },
  
  "src/tokens/foundation/corner.json": {
    "corner": {
      "radius": {
        "value": "4px",
        "type": "other"
      }
    }
  },
  
  "src/tokens/foundation/primitives.json": {
    "primitives": {
      "primary": {
        "value": "#3366CC",
        "type": "other"
      }
    }
  },
  
  "src/tokens/themes/creative/color.json": {
    "color": {
      "brand.primary": {
        "value": "#E61945",
        "type": "other",
        "theme": "creative"
      },
      "brand.secondary": {
        "value": "{primitives.primary}",
        "type": "other", 
        "theme": "creative"
      }
    }
  },
  
  "src/tokens/themes/creative/spacing.json": {
    "spacing": {
      "component.gap": {
        "value": "{spacing.medium}",
        "type": "other",
        "theme": "creative"
      }
    }
  }
};

// ============================================================================
// EXEMPLO 2: USANDO PROGRAMATICAMENTE (Para developers)
// ============================================================================

/**
 * Função de exemplo para consumir os tokens gerados
 */
async function exemploConsumoTokens() {
  try {
    // Carregar tokens foundation
    const spacingTokens = await import('./src/tokens/foundation/spacing.json');
    const cornerTokens = await import('./src/tokens/foundation/corner.json');
    
    // Carregar tokens de tema
    const creativeColors = await import('./src/tokens/themes/creative/color.json');
    const creativeSpacing = await import('./src/tokens/themes/creative/spacing.json');
    
    // Exemplo de uso em CSS-in-JS
    const estilos = {
      container: {
        padding: spacingTokens.spacing.medium.value,
        borderRadius: cornerTokens.corner.radius.value,
        backgroundColor: creativeColors.color['brand.primary'].value,
        gap: creativeSpacing.spacing['component.gap'].value
      }
    };
    
    console.log('Estilos gerados:', estilos);
    
  } catch (error) {
    console.error('Erro ao carregar tokens:', error);
  }
}

// ============================================================================
// EXEMPLO 3: GERAÇÃO DE CSS CUSTOM PROPERTIES
// ============================================================================

/**
 * Converte tokens para CSS Custom Properties
 */
function gerarCSSCustomProperties(tokens) {
  let css = ':root {\n';
  
  // Foundation tokens
  if (tokens.foundation) {
    css += '  /* Foundation Tokens */\n';
    
    Object.entries(tokens.foundation).forEach(([categoria, categoriaTokens]) => {
      css += `  /* ${categoria} */\n`;
      
      Object.entries(categoriaTokens).forEach(([nome, token]) => {
        const cssVar = `--foundation-${categoria}-${nome.replace(/\./g, '-')}`;
        css += `  ${cssVar}: ${token.value};\n`;
      });
      
      css += '\n';
    });
  }
  
  // Theme tokens
  if (tokens.themes) {
    Object.entries(tokens.themes).forEach(([temaNome, tema]) => {
      css += `  /* ${temaNome} Theme */\n`;
      
      Object.entries(tema).forEach(([categoria, categoriaTokens]) => {
        Object.entries(categoriaTokens).forEach(([nome, token]) => {
          const cssVar = `--${temaNome}-${categoria}-${nome.replace(/\./g, '-')}`;
          css += `  ${cssVar}: ${token.value};\n`;
        });
      });
      
      css += '\n';
    });
  }
  
  css += '}';
  return css;
}

// Exemplo de uso:
const exemploCSS = gerarCSSCustomProperties({
  foundation: {
    spacing: {
      small: { value: '8px' },
      medium: { value: '16px' }
    }
  },
  themes: {
    creative: {
      color: {
        'brand.primary': { value: '#E61945' }
      }
    }
  }
});

console.log('CSS Generated:', exemploCSS);
/*
Output:
:root {
  /* Foundation Tokens */
  /* spacing */
  --foundation-spacing-small: 8px;
  --foundation-spacing-medium: 16px;

  /* creative Theme */
  --creative-color-brand-primary: #E61945;
}
*/

// ============================================================================
// EXEMPLO 4: INTEGRAÇÃO COM STYLED-COMPONENTS
// ============================================================================

/**
 * Exemplo de integração com styled-components
 */
const exemploStyledComponents = `
import styled from 'styled-components';
import spacingTokens from './src/tokens/foundation/spacing.json';
import creativeColors from './src/tokens/themes/creative/color.json';

const Container = styled.div\`
  padding: \${spacingTokens.spacing.medium.value};
  background-color: \${creativeColors.color['brand.primary'].value};
  
  @media (max-width: 768px) {
    padding: \${spacingTokens.spacing.small.value};
  }
\`;

const Button = styled.button\`
  padding: \${spacingTokens.spacing.small.value} \${spacingTokens.spacing.medium.value};
  background-color: \${creativeColors.color['brand.primary'].value};
  border-radius: 4px;
  border: none;
  color: white;
  
  &:hover {
    opacity: 0.8;
  }
\`;
`;

// ============================================================================
// EXEMPLO 5: SCRIPT DE BUILD PERSONALIZADO
// ============================================================================

/**
 * Script Node.js para processar tokens após export
 */
const exemploBuildScript = `
const fs = require('fs');
const path = require('path');

async function processarTokens() {
  const tokensDir = './src/tokens';
  const outputDir = './dist/tokens';
  
  // Criar diretório de saída
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Processar foundation tokens
  const foundationDir = path.join(tokensDir, 'foundation');
  if (fs.existsSync(foundationDir)) {
    const files = fs.readdirSync(foundationDir);
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const tokens = JSON.parse(
          fs.readFileSync(path.join(foundationDir, file), 'utf8')
        );
        
        // Gerar CSS
        const css = gerarCSSPorCategoria(tokens);
        const cssFile = file.replace('.json', '.css');
        fs.writeFileSync(path.join(outputDir, cssFile), css);
        
        // Gerar SCSS
        const scss = gerarSCSSPorCategoria(tokens);
        const scssFile = file.replace('.json', '.scss');
        fs.writeFileSync(path.join(outputDir, scssFile), scss);
      }
    });
  }
  
  console.log('Tokens processados com sucesso!');
}

function gerarCSSPorCategoria(tokens) {
  // Implementação específica para gerar CSS
  // ...
}

function gerarSCSSPorCategoria(tokens) {
  // Implementação específica para gerar SCSS
  // ...
}

processarTokens().catch(console.error);
`;

// ============================================================================
// EXEMPLO 6: CONFIGURAÇÃO WEBPACK/VITE
// ============================================================================

const exemploWebpackConfig = `
// webpack.config.js
const path = require('path');

module.exports = {
  // ... outras configurações
  
  resolve: {
    alias: {
      '@tokens': path.resolve(__dirname, 'src/tokens')
    }
  },
  
  module: {
    rules: [
      {
        test: /tokens.*\\.json$/,
        type: 'json'
      }
    ]
  }
};

// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@tokens': path.resolve(__dirname, 'src/tokens')
    }
  }
});

// Uso no código:
import spacingTokens from '@tokens/foundation/spacing.json';
import creativeColors from '@tokens/themes/creative/color.json';
`;

// ============================================================================
// EXEMPLO 7: TYPESCRIPT DEFINITIONS
// ============================================================================

const exemploTypeScript = `
// types/tokens.d.ts
export interface TokenValue {
  value: string;
  type: string;
  theme?: string;
}

export interface TokenCategory {
  [key: string]: TokenValue;
}

export interface FoundationTokens {
  spacing?: TokenCategory;
  sizing?: TokenCategory;
  color?: TokenCategory;
  corner?: TokenCategory;
  opacity?: TokenCategory;
  font?: TokenCategory;
  primitives?: TokenCategory;
}

export interface ThemeTokens {
  color?: TokenCategory;
  spacing?: TokenCategory;
  size?: TokenCategory;
  text?: TokenCategory;
  opacity?: TokenCategory;
}

export interface StructuredTokens {
  foundation: FoundationTokens;
  themes: {
    [themeName: string]: ThemeTokens;
  };
}

// Uso:
import type { StructuredTokens } from './types/tokens';
import spacingTokens from '@tokens/foundation/spacing.json';

const spacing: TokenCategory = spacingTokens.spacing;
`;

// Export para uso externo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exemploEstrutturaGerada,
    exemploConsumoTokens,
    gerarCSSCustomProperties,
    exemploStyledComponents,
    exemploBuildScript,
    exemploWebpackConfig,
    exemploTypeScript
  };
}
