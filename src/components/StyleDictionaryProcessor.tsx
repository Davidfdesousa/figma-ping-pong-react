import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { processFigmaTokens, saveTokensForStyleDictionary } from '@/utils/tokenProcessor';
import { toast } from 'sonner';

export const StyleDictionaryProcessor: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedTokens, setProcessedTokens] = useState<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await file.text();
      const figmaTokens = JSON.parse(text);
      
      const processed = processFigmaTokens(figmaTokens);
      setProcessedTokens(processed);
      
      toast.success('Tokens processados com sucesso!');
    } catch (error) {
      toast.error('Erro ao processar arquivo JSON');
      console.error('Erro:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadProcessed = () => {
    if (processedTokens) {
      saveTokensForStyleDictionary(processedTokens, 'style-dictionary-tokens.json');
      toast.success('Arquivo baixado!');
    }
  };

  const generateCSS = () => {
    if (!processedTokens) return;

    const cssVariables = generateCSSVariables(processedTokens);
    const blob = new Blob([cssVariables], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'figma-tokens.css';
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success('CSS gerado e baixado!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🎨 Style Dictionary Processor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="json-upload" className="block text-sm font-medium mb-2">
              Upload do JSON exportado do Figma:
            </label>
            <input
              id="json-upload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm border border-border rounded-md p-2"
            />
          </div>

          {isProcessing && (
            <div className="text-center py-4">
              <p>Processando tokens...</p>
            </div>
          )}

          {processedTokens && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  ✅ Tokens processados com sucesso! 
                  Total de tokens: {Object.keys(flattenObject(processedTokens)).length}
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDownloadProcessed}>
                  📁 Baixar JSON para Style Dictionary
                </Button>
                <Button onClick={generateCSS} variant="outline">
                  🎨 Gerar CSS
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {processedTokens && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
              {JSON.stringify(processedTokens, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function generateCSSVariables(tokens: any, prefix = '--'): string {
  const variables: string[] = [':root {'];
  
  function traverse(obj: any, path: string[] = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && 'value' in value) {
        const varName = `${prefix}${path.concat(key).join('-')}`;
        variables.push(`  ${varName}: ${value.value};`);
      } else if (value && typeof value === 'object') {
        traverse(value, path.concat(key));
      }
    }
  }
  
  traverse(tokens);
  variables.push('}');
  
  return variables.join('\n');
}

function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && 'value' in value) {
      flattened[newKey] = value;
    } else if (value && typeof value === 'object') {
      Object.assign(flattened, flattenObject(value, newKey));
    }
  }
  
  return flattened;
}