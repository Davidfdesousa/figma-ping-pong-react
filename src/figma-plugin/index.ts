// index.ts
import './ModuleLoader';
import './utils/utils';
import './collections';
import './tokenGeneration';
import './comparison';
import './githubConfig';
import './app';

import { require } from './ModuleLoader';

export const { loadCollections } = require('collections') as {
  loadCollections: () => Promise<void>;
};

export const { generateTokensData } = require('tokenGeneration') as {
  generateTokensData: (selectedCollectionIds: string[]) => Promise<Record<string, any>>;
};

export const { compareTokens } = require('comparison') as {
  compareTokens: (
    prevData: Record<string, any>,
    newData: Record<string, any>
  ) => {
    added: Array<{ path: string; value: any }>;
    removed: Array<{ path: string; value: any }>;
    modified: Array<{ path: string; oldValue: string; newValue: string }>;
  };
};

export const { loadGitHubConfig, saveGitHubConfig } = require('githubConfig') as {
  loadGitHubConfig: () => Promise<void>;
  saveGitHubConfig: (config: any) => Promise<void>;
};

export const { handleMessage } = require('app') as {
  handleMessage: (msg: any) => void;
};
