(() => {
  if (!window.L || window.__atlasMapBridgeInstalled) return;
  window.__atlasMapBridgeInstalled = true;
  const originalMap = window.L.map.bind(window.L);
  window.L.map = function atlasHarborMap(target, options) {
    const map = originalMap(target, options);
    const id = typeof target === 'string' ? target : target?.id;
    if (id === 'map') {
      window.__atlasMainGameMap = map;
      window.dispatchEvent(new CustomEvent('atlas-main-game-map-ready', { detail: { map } }));
    }
    return map;
  };
})();
