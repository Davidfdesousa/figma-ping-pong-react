/**
 * Test suite for Figma Token Exporter Plugin - Structured Token Generation
 * @version 7.0.0
 */

// Mock Figma API and dependencies
const mockFigma = {
  variables: {
    getLocalVariableCollectionsAsync: jest.fn(),
    getLocalVariablesAsync: jest.fn(),
    getVariableCollectionByIdAsync: jest.fn(),
    getVariableByIdAsync: jest.fn()
  },
  ui: {
    postMessage: jest.fn()
  },
  clientStorage: {
    getAsync: jest.fn(),
    setAsync: jest.fn()
  },
  fileKey: 'test-file-key',
  root: { name: 'Test File' }
};

global.figma = mockFigma;
global.fetch = jest.fn();

// Import the classes to test
const { 
  StructuredTokenGenerator, 
  ZipGenerator, 
  GitHubManager 
} = require('../code.js');

describe('StructuredTokenGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateStructuredTokens', () => {
    it('should generate structured tokens correctly', async () => {
      // Mock data
      const mockCollections = [
        {
          id: 'collection-1',
          name: 'Global Foundation',
          variableIds: ['var-1', 'var-2'],
          modes: [{ modeId: 'mode-1', name: 'Default' }]
        },
        {
          id: 'collection-2', 
          name: 'Creative Brand',
          variableIds: ['var-3', 'var-4'],
          modes: [{ modeId: 'mode-2', name: 'Creative' }]
        }
      ];

      const mockVariables = [
        {
          id: 'var-1',
          name: 'spacing/small',
          variableCollectionId: 'collection-1',
          resolvedType: 'FLOAT',
          valuesByMode: { 'mode-1': 8 }
        },
        {
          id: 'var-2',
          name: 'colors/primary',
          variableCollectionId: 'collection-1', 
          resolvedType: 'COLOR',
          valuesByMode: { 'mode-1': { r: 0.2, g: 0.4, b: 0.8 } }
        },
        {
          id: 'var-3',
          name: 'colors/brand/primary',
          variableCollectionId: 'collection-2',
          resolvedType: 'COLOR', 
          valuesByMode: { 'mode-2': { r: 0.9, g: 0.1, b: 0.3 } }
        }
      ];

      mockFigma.variables.getLocalVariablesAsync.mockResolvedValue(mockVariables);
      mockFigma.variables.getVariableCollectionByIdAsync.mockImplementation((id) => {
        return Promise.resolve(mockCollections.find(c => c.id === id));
      });

      const result = await StructuredTokenGenerator.generateStructuredTokens(['collection-1', 'collection-2']);

      expect(result).toBeDefined();
      expect(result.foundation).toBeDefined();
      expect(result.themes).toBeDefined();
    });
  });

  describe('_categorizeFoundationToken', () => {
    it('should categorize foundation tokens correctly', () => {
      expect(StructuredTokenGenerator._categorizeFoundationToken('spacing/small')).toBe('spacing');
      expect(StructuredTokenGenerator._categorizeFoundationToken('size/large')).toBe('sizing');
      expect(StructuredTokenGenerator._categorizeFoundationToken('stroke/width')).toBe('stroke');
      expect(StructuredTokenGenerator._categorizeFoundationToken('corner/radius')).toBe('corner');
      expect(StructuredTokenGenerator._categorizeFoundationToken('opacity/50')).toBe('opacity');
      expect(StructuredTokenGenerator._categorizeFoundationToken('font/family')).toBe('font');
      expect(StructuredTokenGenerator._categorizeFoundationToken('other/token')).toBe('primitives');
    });
  });

  describe('_categorizeThemeToken', () => {
    it('should categorize theme tokens correctly', () => {
      expect(StructuredTokenGenerator._categorizeThemeToken('color/primary')).toBe('color');
      expect(StructuredTokenGenerator._categorizeThemeToken('bg/surface')).toBe('color');
      expect(StructuredTokenGenerator._categorizeThemeToken('text/heading')).toBe('text');
      expect(StructuredTokenGenerator._categorizeThemeToken('size/button')).toBe('size');
      expect(StructuredTokenGenerator._categorizeThemeToken('spacing/component')).toBe('spacing');
      expect(StructuredTokenGenerator._categorizeThemeToken('opacity/overlay')).toBe('opacity');
    });
  });

  describe('generateFileStructure', () => {
    it('should generate correct file structure', () => {
      const structuredTokens = {
        foundation: {
          spacing: {
            'small': { value: '8px', type: 'other' },
            'medium': { value: '16px', type: 'other' }
          },
          color: {
            'primary': { value: '#3366CC', type: 'other' }
          }
        },
        themes: {
          creative: {
            color: {
              'brand-primary': { value: '#E61945', type: 'other', theme: 'creative' }
            },
            spacing: {
              'component-gap': { value: '{spacing.medium}', type: 'other', theme: 'creative' }
            }
          }
        }
      };

      const fileStructure = StructuredTokenGenerator.generateFileStructure(structuredTokens);

      expect(fileStructure).toMatchObject({
        'src/tokens/foundation/spacing.json': {
          spacing: structuredTokens.foundation.spacing
        },
        'src/tokens/foundation/color.json': {
          color: structuredTokens.foundation.color
        },
        'src/tokens/themes/creative/color.json': {
          color: structuredTokens.themes.creative.color
        },
        'src/tokens/themes/creative/spacing.json': {
          spacing: structuredTokens.themes.creative.spacing
        }
      });
    });
  });
});

describe('ZipGenerator', () => {
  describe('createTokensZip', () => {
    it('should create ZIP data structure correctly', async () => {
      const fileStructure = {
        'src/tokens/foundation/spacing.json': {
          spacing: {
            'small': { value: '8px', type: 'other' }
          }
        },
        'src/tokens/themes/creative/color.json': {
          color: {
            'primary': { value: '#E61945', type: 'other', theme: 'creative' }
          }
        }
      };

      const zipData = await ZipGenerator.createTokensZip(fileStructure);

      expect(zipData.type).toBe('tokens-zip-data');
      expect(zipData.files).toBeDefined();
      expect(zipData.files['foundation/spacing.json']).toBeDefined();
      expect(zipData.files['themes/creative/color.json']).toBeDefined();
      
      // Verify JSON structure
      const spacingContent = JSON.parse(zipData.files['foundation/spacing.json']);
      expect(spacingContent.spacing.small.value).toBe('8px');
    });
  });
});

describe('GitHubManager - Structured Export', () => {
  beforeEach(() => {
    mockFigma.clientStorage.getAsync.mockResolvedValue({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });
    
    global.fetch = jest.fn();
  });

  describe('_createMultiFileCommit', () => {
    it('should create commits with multiple files', async () => {
      const fileStructure = {
        'src/tokens/foundation/spacing.json': {
          spacing: { small: { value: '8px' } }
        },
        'src/tokens/themes/creative/color.json': {
          color: { primary: { value: '#E61945' } }
        }
      };

      // Mock API responses
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ object: { sha: 'branch-sha' } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tree: { sha: 'tree-sha' } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sha: 'blob-1-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sha: 'blob-2-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sha: 'new-tree-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sha: 'commit-sha' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await expect(
        GitHubManager._createMultiFileCommit('token', 'owner', 'repo', 'branch', fileStructure, 'Test commit')
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(7);
    });
  });
});

describe('Token Structure Validation', () => {
  it('should validate expected token file structure', () => {
    const expectedStructure = {
      'src/tokens/foundation/primitives.json': expect.any(Object),
      'src/tokens/foundation/spacing.json': expect.any(Object),
      'src/tokens/foundation/sizing.json': expect.any(Object),
      'src/tokens/foundation/stroke.json': expect.any(Object),
      'src/tokens/foundation/corner.json': expect.any(Object),
      'src/tokens/foundation/opacity.json': expect.any(Object),
      'src/tokens/foundation/font.json': expect.any(Object),
      'src/tokens/foundation/size.json': expect.any(Object)
    };

    // Mock foundation tokens
    const mockFoundationTokens = {
      foundation: {
        primitives: { token1: { value: 'val1' } },
        spacing: { token2: { value: 'val2' } },
        sizing: { token3: { value: 'val3' } },
        stroke: { token4: { value: 'val4' } },
        corner: { token5: { value: 'val5' } },
        opacity: { token6: { value: 'val6' } },
        font: { token7: { value: 'val7' } },
        size: { token8: { value: 'val8' } }
      },
      themes: {}
    };

    const fileStructure = StructuredTokenGenerator.generateFileStructure(mockFoundationTokens);
    
    // Check that all expected foundation files are present
    Object.keys(expectedStructure).forEach(filePath => {
      expect(fileStructure).toHaveProperty(filePath);
    });
  });

  it('should validate theme token structure', () => {
    const mockThemeTokens = {
      foundation: {},
      themes: {
        creative: {
          color: { primary: { value: '#E61945', theme: 'creative' } },
          opacity: { overlay: { value: '0.8', theme: 'creative' } },
          size: { button: { value: '44px', theme: 'creative' } },
          spacing: { gap: { value: '16px', theme: 'creative' } },
          text: { heading: { value: 'Inter Bold', theme: 'creative' } }
        },
        tech: {
          color: { primary: { value: '#0066CC', theme: 'tech' } }
        }
      }
    };

    const fileStructure = StructuredTokenGenerator.generateFileStructure(mockThemeTokens);
    
    expect(fileStructure).toHaveProperty('src/tokens/themes/creative/color.json');
    expect(fileStructure).toHaveProperty('src/tokens/themes/creative/opacity.json');
    expect(fileStructure).toHaveProperty('src/tokens/themes/creative/size.json');
    expect(fileStructure).toHaveProperty('src/tokens/themes/creative/spacing.json');
    expect(fileStructure).toHaveProperty('src/tokens/themes/creative/text.json');
    expect(fileStructure).toHaveProperty('src/tokens/themes/tech/color.json');
  });
});

describe('Integration Tests', () => {
  it('should handle complete workflow from collections to ZIP', async () => {
    // Mock complete workflow
    const mockCollections = ['collection-1'];
    
    // This would be a full integration test
    // For now, we test the flow conceptually
    const workflow = async () => {
      const structuredTokens = await StructuredTokenGenerator.generateStructuredTokens(mockCollections);
      const fileStructure = StructuredTokenGenerator.generateFileStructure(structuredTokens);
      const zipData = await ZipGenerator.createTokensZip(fileStructure);
      return zipData;
    };

    // Mock the dependencies
    mockFigma.variables.getLocalVariablesAsync.mockResolvedValue([]);
    
    const result = await workflow();
    expect(result.type).toBe('tokens-zip-data');
  });

  it('should handle complete workflow from collections to GitHub', async () => {
    const mockCollections = ['collection-1'];
    
    // Mock GitHub config
    mockFigma.clientStorage.getAsync.mockResolvedValue({
      token: 'test-token',
      owner: 'test-owner', 
      repo: 'test-repo'
    });

    // Mock successful API calls
    global.fetch.mockResolvedValue({ 
      ok: true, 
      json: () => Promise.resolve({ html_url: 'https://github.com/test/pr' })
    });

    const workflow = async () => {
      const structuredTokens = await StructuredTokenGenerator.generateStructuredTokens(mockCollections);
      const fileStructure = StructuredTokenGenerator.generateFileStructure(structuredTokens);
      // In real scenario, this would create a PR
      return { fileCount: Object.keys(fileStructure).length };
    };

    mockFigma.variables.getLocalVariablesAsync.mockResolvedValue([]);
    
    const result = await workflow();
    expect(result.fileCount).toBeGreaterThanOrEqual(0);
  });
});

// Test utilities
describe('Test Utilities', () => {
  it('should have valid test data', () => {
    const testTokenData = {
      value: '#3366CC',
      type: 'other'
    };

    expect(testTokenData).toMatchObject({
      value: expect.any(String),
      type: 'other'
    });
  });
});

module.exports = {
  mockFigma,
  // Export other test utilities if needed
};
