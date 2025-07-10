// collections.ts
import { define } from './ModuleLoader';

/** Representa um modo de variável no Figma. */
interface Mode {
  modeId: string;
  name: string;
}

/** Estrutura dos dados de coleção enviados à UI. */
export interface CollectionData {
  id: string;
  name: string;
  variableCount: number;
  modes: Mode[];
}

/**
 * Collections Module
 *
 * Carrega todas as Collections de variáveis locais do Figma
 * e envia à UI via postMessage.
 */
define('collections', ['figma'], function(figma: any) {
  /**
   * loadCollections
   *
   * Busca todas as collections locais no Figma,
   * monta CollectionData e envia para a UI.
   */
  async function loadCollections(): Promise<void> {
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const collectionsData: CollectionData[] = [];

      for (const collection of collections) {
        const variableCount = collection.variableIds.length;
        collectionsData.push({
          id: collection.id,
          name: collection.name,
          variableCount,
          modes: collection.modes.map((mode: Mode) => ({
            modeId: mode.modeId,
            name: mode.name
          }))
        });
      }

      figma.ui.postMessage({
        type: 'collections-loaded',
        data: collectionsData
      });
    } catch (error: any) {
      console.error('Error loading collections:', error);
      figma.ui.postMessage({
        type: 'load-error',
        message: 'Error loading collections: ' + error.message
      });
    }
  }

  return { loadCollections };
});
