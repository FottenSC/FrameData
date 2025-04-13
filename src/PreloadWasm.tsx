import React, { useEffect } from 'react';

export const PreloadWasm: React.FC = () => {
  useEffect(() => {
    // Preload the WebAssembly file
    const preloadLink = document.createElement('link');
    preloadLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm';
    preloadLink.rel = 'preload';
    preloadLink.as = 'fetch';
    preloadLink.crossOrigin = 'anonymous';
    preloadLink.type = 'application/wasm';
    
    document.head.appendChild(preloadLink);
    
    return () => {
      document.head.removeChild(preloadLink);
    };
  }, []);
  
  return null;
}; 