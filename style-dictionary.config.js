const StyleDictionary = require('style-dictionary');

// Register custom transforms for Figma tokens
StyleDictionary.registerTransform({
  name: 'size/px',
  type: 'value',
  matcher: function(prop) {
    return prop.value && typeof prop.value === 'string' && prop.value.includes('px');
  },
  transformer: function(prop) {
    return prop.value;
  }
});

StyleDictionary.registerTransform({
  name: 'color/css',
  type: 'value',
  matcher: function(prop) {
    return prop.value && typeof prop.value === 'string' && prop.value.startsWith('#');
  },
  transformer: function(prop) {
    return prop.value;
  }
});

// Register format for CSS custom properties
StyleDictionary.registerFormat({
  name: 'css/variables',
  formatter: function(dictionary, config) {
    return `:root {\n${dictionary.allProperties.map(prop => 
      `  --${prop.name}: ${prop.value};`
    ).join('\n')}\n}`;
  }
});

module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      transforms: ['attribute/cti', 'name/cti/kebab', 'size/px', 'color/css'],
      buildPath: 'build/css/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables'
      }]
    },
    scss: {
      transformGroup: 'scss',
      transforms: ['attribute/cti', 'name/cti/kebab', 'size/px', 'color/css'],
      buildPath: 'build/scss/',
      files: [{
        destination: '_variables.scss',
        format: 'scss/variables'
      }]
    }
  }
};