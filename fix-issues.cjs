const fs = require('fs');

// 1. Fix CSS
let css = fs.readFileSync('src/index.css', 'utf-8');
css = css.replace(/body\.direct-sun \.bg-\[#203A2A\],/g, 'body.direct-sun .bg-\\[\\#203A2A\\],');
css = css.replace(/body\.direct-sun \.bg-\[#2A9D8F\],/g, 'body.direct-sun .bg-\\[\\#2A9D8F\\],');
css = css.replace(/body\.direct-sun \.bg-\[#588157\],/g, 'body.direct-sun .bg-\\[\\#588157\\],');
css = css.replace(/body\.direct-sun \.bg-\[#87A878\] \{/g, 'body.direct-sun .bg-\\[\\#87A878\\] {');
fs.writeFileSync('src/index.css', css, 'utf-8');

// 2. Fix dynamic imports in MapViewTab
let mapview = fs.readFileSync('src/components/MapViewTab.tsx', 'utf-8');
if (!mapview.includes("import { estimateTileCountForBounds, downloadRasterTilesForBounds }")) {
  mapview = "import { estimateTileCountForBounds, downloadRasterTilesForBounds } from '../services/rasterTileCacheService';\n" + mapview;
}

mapview = mapview.replace(
  /const \{ estimateTileCountForBounds \} = await import\('\.\.\/services\/rasterTileCacheService'\);\n/g,
  ""
);

mapview = mapview.replace(
  /const \{ downloadRasterTilesForBounds \} = await import\('\.\.\/services\/rasterTileCacheService'\);\n/g,
  ""
);

fs.writeFileSync('src/components/MapViewTab.tsx', mapview, 'utf-8');
console.log('Fixed CSS and MapViewTab imports');
