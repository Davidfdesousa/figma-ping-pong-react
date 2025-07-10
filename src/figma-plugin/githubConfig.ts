// githubConfig.ts
import { define } from './ModuleLoader';

/**
 * GitHub Config Module
 *
 * Fornece funções para carregar e salvar configurações
 * de GitHub do armazenamento local do Figma.
 */
define('githubConfig', ['figma'], function(figma: any) {
  /**
   * loadGitHubConfig
   *
   * Tenta obter a configuração 'github-config' do clientStorage
   * e envia via postMessage para a UI.
   */
  async function loadGitHubConfig(): Promise<void> {
    try {
      const config = await figma.clientStorage.getAsync('github-config');
      figma.ui.postMessage({
        type: 'github-config-loaded',
        data: config || {}
      });
    } catch (error: any) {
      console.error('Error loading GitHub configuration:', error);
      figma.ui.postMessage({
        type: 'github-config-loaded',
        data: {}
      });
    }
  }

  /**
   * saveGitHubConfig
   *
   * Salva a configuração no clientStorage e notifica a UI.
   *
   * @param config Objeto de configuração a ser salvo.
   */
  async function saveGitHubConfig(config: any): Promise<void> {
    try {
      await figma.clientStorage.setAsync('github-config', config);
      figma.ui.postMessage({
        type: 'github-config-saved',
        message: 'GitHub configuration saved successfully!'
      });
    } catch (error: any) {
      console.error('Error saving GitHub configuration:', error);
      figma.ui.postMessage({
        type: 'github-error',
        message: 'Error saving configuration: ' + error.message
      });
    }
  }

  return { loadGitHubConfig, saveGitHubConfig };
});
