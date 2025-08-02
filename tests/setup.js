// Jest setup file
require('jest-fetch-mock').enableMocks();

// Mock figma global
global.figma = {
  variables: {
    getLocalVariableCollectionsAsync: jest.fn(),
    getLocalVariablesAsync: jest.fn(),
    getVariableCollectionByIdAsync: jest.fn(),
    getVariableByIdAsync: jest.fn()
  },
  ui: {
    postMessage: jest.fn(),
    onmessage: null
  },
  clientStorage: {
    getAsync: jest.fn(),
    setAsync: jest.fn()
  },
  fileKey: 'test-file-key', 
  root: { name: 'Test File' }
};

// Mock console to avoid test noise
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
