export interface FigmaToken {
  value: string;
  type: string;
  $extensions?: {
    mode: Record<string, string>;
  };
}

export interface ProcessedTokens {
  [key: string]: any;
}

export function processFigmaTokens(figmaTokens: Record<string, any>): ProcessedTokens {
  const processed: ProcessedTokens = {};

  function processObject(obj: any, path: string[] = []): void {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      
      if (value && typeof value === 'object') {
        // Check if this is a token object (has value and type)
        if ('value' in value && 'type' in value) {
          const token = value as FigmaToken;
          const tokenName = currentPath.join('-');
          
          // Set the main value
          setNestedValue(processed, currentPath, {
            value: token.value,
            type: mapFigmaTypeToStyleDictionary(token.type)
          });
          
          // Handle multiple modes if they exist
          if (token.$extensions?.mode) {
            for (const [modeName, modeValue] of Object.entries(token.$extensions.mode)) {
              if (modeName !== 'Default') { // Skip default mode as it's already the main value
                const modeTokenName = `${tokenName}-${modeName.toLowerCase()}`;
                const modePath = [...currentPath.slice(0, -1), `${currentPath[currentPath.length - 1]}-${modeName.toLowerCase()}`];
                setNestedValue(processed, modePath, {
                  value: modeValue,
                  type: mapFigmaTypeToStyleDictionary(token.type)
                });
              }
            }
          }
        } else {
          // Continue traversing the object
          processObject(value, currentPath);
        }
      }
    }
  }

  processObject(figmaTokens);
  return processed;
}

function mapFigmaTypeToStyleDictionary(figmaType: string): string {
  const typeMap: Record<string, string> = {
    'COLOR': 'color',
    'FLOAT': 'dimension',
    'STRING': 'string',
    'other': 'other'
  };
  
  return typeMap[figmaType] || 'other';
}

function setNestedValue(obj: any, path: string[], value: any): void {
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

export function saveTokensForStyleDictionary(tokens: ProcessedTokens, filename: string = 'figma-tokens.json'): void {
  const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}