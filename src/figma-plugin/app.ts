/// <reference types="@figma/plugin-typings" />
declare const __html__: string;

import { define, require } from './ModuleLoader';
import { Utils } from './utils';

// registra os outros módulos antes de usar
import './collections';
import './tokenGeneration';
import './comparison';
import './githubConfig';
import './utils';

/**
 * Main App Module
 *
 * Gerencia exportação de tokens, criação de PR no GitHub
 * e roteamento de mensagens UI ↔ plugin.
 */
define(
  'app',
  [
    'collections',
    'tokenGeneration',
    'comparison',
    'githubConfig',
    'utils',
    'figma'
  ],
  function(
    collections: { loadCollections: () => Promise<void> },
    tokenGeneration: { generateTokensData: (ids: string[]) => Promise<Record<string, any>> },
    comparison: {
      compareTokens: (
        prev: Record<string, any>,
        next: Record<string, any>
      ) => {
        added: Array<{ path: string; value: any }>;
        removed: Array<{ path: string; value: any }>;
        modified: Array<{ path: string; oldValue: string; newValue: string }>;
      };
    },
    githubConfig: {
      loadGitHubConfig: () => Promise<void>;
      saveGitHubConfig: (cfg: any) => Promise<void>;
    },
    utils: Utils,
    figma: PluginAPI
  ) {
    // 1) exportSelectedTokens
    async function exportSelectedTokens(selectedCollectionIds: string[]) {
      try {
        const structured = await tokenGeneration.generateTokensData(selectedCollectionIds);
        figma.ui.postMessage({ type: 'tokens-exported', data: structured });
      } catch (e: any) {
        console.error(e);
        figma.ui.postMessage({ type: 'export-error', message: e.message });
      }
    }

    // 2) generatePRDescription
    function generatePRDescription(
      tokensData: Record<string, any>,
      commitDescription: string,
      prevData: Record<string, any> = {}
    ): string {
      const filePath = 'src/figma-output/selected-tokens.json';
      let desc = `## 🎨 Figma Design Tokens Update\n\n`;
      if (commitDescription) {
        desc += `### Alterações:\n${commitDescription}\n\n`;
      }
      desc += `### Detalhes:\n- Arquivo: \`${filePath}\`\n- Exportado em: ${new Date().toLocaleString()}\n\n`;
      const changes = comparison.compareTokens(prevData, tokensData);

      if (!changes.added.length && !changes.modified.length && !changes.removed.length) {
        desc += `### Alterações:\nNenhuma alteração detectada.\n\n`;
      } else {
        desc += `### Resumo das Alterações:\n`;
        if (changes.added.length) {
          desc += `\n#### ✅ Adicionados (${changes.added.length}):\n`;
          changes.added.forEach(t => (desc += `- \`${t.path}\`: ${t.value}\n`));
        }
        if (changes.modified.length) {
          desc += `\n#### 🔄 Modificados (${changes.modified.length}):\n`;
          changes.modified.forEach(t =>
            (desc += `- \`${t.path}\`: \`${t.oldValue}\` → \`${t.newValue}\`\n`)
          );
        }
        if (changes.removed.length) {
          desc += `\n#### ❌ Removidos (${changes.removed.length}):\n`;
          changes.removed.forEach(t => (desc += `- \`${t.path}\`: ${t.value}\n`));
        }
      }

      desc += `\n_Este PR foi gerado automaticamente._`;
      return desc;
    }

    // 3) createGitHubPR
    async function createGitHubPR(
      config: { token: string; repo: string; owner: string },
      tokensData: Record<string, any>,
      commitDescription = '',
      prevData: Record<string, any> = {}
    ) {
      const { token, repo, owner } = config;
      const api = 'https://api.github.com';

      // (a) pega sha da main
      const refRes = await fetch(`${api}/repos/${owner}/${repo}/git/ref/heads/main`, {
        headers: { Authorization: `token ${token}` }
      });
      if (!refRes.ok) throw new Error(refRes.statusText);
      const mainSha = (await refRes.json()).object.sha;

      // (b) cria branch nova
      const branchName = `figma-tokens-update-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const createBranch = await fetch(`${api}/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha })
      });
      if (!createBranch.ok) throw new Error(createBranch.statusText);

      // (c) prepara e envia o arquivo
      const path = 'src/figma-output/selected-tokens.json';
      const content = utils.stringToBase64(JSON.stringify(tokensData, null, 2));
      let sha: string | undefined;
      const getFile = await fetch(`${api}/repos/${owner}/${repo}/contents/${path}?ref=${branchName}`, {
        headers: { Authorization: `token ${token}` }
      });
      if (getFile.ok) sha = (await getFile.json()).sha;

      const updateRes = await fetch(`${api}/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitDescription || `Update Figma tokens`,
          content,
          branch: branchName,
          ...(sha && { sha })
        })
      });
      if (!updateRes.ok) throw new Error(updateRes.statusText);

      // (d) abre o PR
      const prRes = await fetch(`${api}/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `🎨 Update Tokens`,
          head: branchName,
          base: 'main',
          body: generatePRDescription(tokensData, commitDescription, prevData)
        })
      });
      if (!prRes.ok) throw new Error(prRes.statusText);
      const prUrl = (await prRes.json()).html_url;

      figma.ui.postMessage({ type: 'github-success', prUrl });
    }

    // 4) exportToGitHub (workflow completo)
    async function exportToGitHub(selectedCollectionIds: string[], commitDescription = '') {
      const prev =
        (await figma.clientStorage.getAsync('previous-tokens-data')) || {};
      const cfg = await figma.clientStorage.getAsync('github-config');
      if (!cfg?.token || !cfg?.repo) {
        figma.ui.postMessage({ type: 'github-error', message: 'Configure o GitHub antes.' });
        return;
      }
      const tokens = await tokenGeneration.generateTokensData(selectedCollectionIds);
      await createGitHubPR(cfg, tokens, commitDescription, prev);
      await figma.clientStorage.setAsync('previous-tokens-data', tokens);
    }

    // roteador de mensagens da UI
    function handleMessage(msg: any) {
      switch (msg.type) {
        case 'ping':
          figma.ui.postMessage({ type: 'pong' });
          break;
        case 'load-github-config':
          githubConfig.loadGitHubConfig();
          break;
        case 'load-collections':
          collections.loadCollections();
          break;
        case 'export-selected-tokens':
          exportSelectedTokens(msg.selectedCollections);
          break;
        case 'save-github-config':
          githubConfig.saveGitHubConfig(msg.config);
          break;
        case 'export-to-github':
          exportToGitHub(msg.selectedCollections, msg.commitDescription);
          break;
        case 'close':
          figma.closePlugin();
          break;
      }
    }

    return { handleMessage };
  }
);

// Plugin init
const app = require('app');
figma.showUI(__html__, { width: 500, height: 800 });
figma.ui.onmessage = app.handleMessage;
