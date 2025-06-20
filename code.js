
// This is the main plugin code that runs in the Figma environment
figma.showUI(__html__, { width: 300, height: 200 });

figma.ui.onmessage = msg => {
  console.log('Received message in code.js:', msg);
  
  if (msg.type === 'ping') {
    console.log('▶️ Ping recebido no code.js');
    figma.ui.postMessage({ type: 'pong' });
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
