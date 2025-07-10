// comparison.ts
import { define } from './ModuleLoader';

/**
 * Comparison Module
 *
 * Fornece funções para extrair caminhos de tokens
 * e comparar dois conjuntos de tokens (anterior vs novo).
 */
define('comparison', [], function() {
  /**
   * getAllTokenPaths
   *
   * Percorre recursivamente o objeto de tokens e retorna
   * um mapa de caminho->valor apenas para objetos que
   * possuam propriedades 'value' e 'type'.
   *
   * @param data Estrutura de tokens a extrair.
   * @param prefix Prefixo opcional para os caminhos.
   * @returns Record<string, any> Mapa de caminho completo para valor.
   */
  function getAllTokenPaths(data: Record<string, any>, prefix = ''): Record<string, any> {
    const tokens: Record<string, any> = {};
    function extractPaths(obj: Record<string, any>, currentPrefix: string) {
      for (const key in obj) {
        const fullPath = currentPrefix ? `${currentPrefix}.${key}` : key;
        const valueObj = obj[key];
        if (valueObj && typeof valueObj === 'object') {
          if ('value' in valueObj && 'type' in valueObj) {
            tokens[fullPath] = valueObj.value;
          } else {
            extractPaths(valueObj, fullPath);
          }
        }
      }
    }
    extractPaths(data, prefix);
    return tokens;
  }

  /**
   * compareTokens
   *
   * Compara dois objetos de tokens e identifica quais foram:
   * - added: caminhos que aparecem apenas no novo conjunto.
   * - removed: caminhos que aparecem apenas no antigo conjunto.
   * - modified: caminhos que existem em ambos, mas com valores diferentes.
   *
   * @param prevData Tokens antigos.
   * @param newData Tokens novos.
   * @returns Objeto com listas de alterações.
   */
  function compareTokens(
    prevData: Record<string, any>,
    newData: Record<string, any>
  ): {
    added: Array<{ path: string; value: any }>;
    removed: Array<{ path: string; value: any }>;
    modified: Array<{ path: string; oldValue: string; newValue: string }>;
  } {
    const changes = {
      added: [] as Array<{ path: string; value: any }>,
      modified: [] as Array<{ path: string; oldValue: string; newValue: string }>,
      removed: [] as Array<{ path: string; value: any }>
    };
    const prevTokens = getAllTokenPaths(prevData);
    const newTokens = getAllTokenPaths(newData);
    const prevPaths = Object.keys(prevTokens);
    const newPaths = Object.keys(newTokens);

    newPaths.forEach(path => {
      if (!prevPaths.includes(path)) {
        changes.added.push({ path, value: newTokens[path] });
      }
    });

    prevPaths.forEach(path => {
      if (!newPaths.includes(path)) {
        changes.removed.push({ path, value: prevTokens[path] });
      }
    });

    newPaths.forEach(path => {
      if (prevPaths.includes(path)) {
        const prevValue = String(prevTokens[path]).trim();
        const newValue = String(newTokens[path]).trim();
        if (prevValue !== newValue) {
          changes.modified.push({ path, oldValue: prevValue, newValue });
        }
      }
    });

    return changes;
  }

  return { compareTokens };
});
