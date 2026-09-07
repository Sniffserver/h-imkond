const fs = require('fs');
let content = fs.readFileSync('src/services/rasterTileCacheService.ts', 'utf-8');

content = content.replace(
  /export function getOfflineMaplibreProtocol\(\) \{[\s\S]*?return \{ cancel: \(\) => \{\} \};\n  \};\n\}/,
  `export function getOfflineMaplibreProtocol() {
  return async (params: any) => {
    try {
      const url = params.url.replace('hoimu-tile://', 'https://');
      const cache = await caches.open(RASTER_CACHE_NAME);
      const match = await cache.match(url);
      
      if (match) {
        const arrayBuffer = await match.arrayBuffer();
        return { data: arrayBuffer };
      } else {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        return { data: arrayBuffer };
      }
    } catch (e) {
      throw e;
    }
  };
}`
);

fs.writeFileSync('src/services/rasterTileCacheService.ts', content, 'utf-8');
console.log('Fixed Protocol');
