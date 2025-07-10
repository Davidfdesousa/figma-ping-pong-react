// tokenGeneration.ts
import { define } from './ModuleLoader';
import { Utils } from './utils';

/** Estrutura interna de variável Figma usada pelo módulo. */
interface FigmaVariable {
  variableCollectionId: string;
  name: string;
  valuesByMode: Record<string, any>;
  resolvedType: string;
}

/** Estrutura do token gerado. */
interface TokenData {
  value: any;
  type: string;
  $extensions?: { mode: Record<string, any> };
}

/**
 * Token Generation Module
 *
 * Gera JSON estruturado de tokens usando
 * variáveis locais do Figma e funções utilitárias.
 */
define('tokenGeneration', ['figma', 'utils'], function(figma: any, utils: Utils) {
  /**
   * generateTokensData
   *
   * Para cada variável local:
   * - Se não pertencer às collections selecionadas, pula.
   * - Formata valores por modo.
   * - Insere no objeto estruturado com setNestedValue.
   */
  async function generateTokensData(
    selectedCollectionIds: string[]
  ): Promise<Record<string, any>> {
    const localVariables: FigmaVariable[] = await figma.variables.getLocalVariablesAsync();
    const structuredTokens: Record<string, any> = {};

    for (const variable of localVariables) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(
        variable.variableCollectionId
      );

      if (!selectedCollectionIds.includes(collection.id)) continue;

      const tokenValues: Record<string, any> = {};
      const hasMultipleModes = collection.modes.length > 1;

      for (const mode of collection.modes) {
        const rawValue = variable.valuesByMode[mode.modeId];
        if (rawValue !== undefined) {
          if (typeof rawValue === 'object' && rawValue.type === 'VARIABLE_ALIAS') {
            const aliased = await figma.variables.getVariableByIdAsync(rawValue.id);
            tokenValues[mode.name] = `{${aliased.name.replace(/\//g, '.')}}`;
          } else {
            tokenValues[mode.name] = utils.formatTokenValue(rawValue, variable.resolvedType);
          }
        }
      }

      const collectionName = collection.name;
      const tokenPath = utils.parseTokenPath(variable.name);

      if (!structuredTokens[collectionName]) {
        structuredTokens[collectionName] = {};
      }

      const tokenData: TokenData = {
        value: tokenValues[collection.modes[0].name] ?? null,
        type: 'other'
      };

      if (hasMultipleModes && Object.keys(tokenValues).length > 1) {
        tokenData.$extensions = { mode: tokenValues };
      }

      utils.setNestedValue(structuredTokens[collectionName], tokenPath, tokenData);
    }

    return structuredTokens;
  }

  return { generateTokensData };
});
