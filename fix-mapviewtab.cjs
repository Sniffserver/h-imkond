const fs = require('fs');
let content = fs.readFileSync('src/components/MapViewTab.tsx', 'utf-8');

// Fix 1: localGridToGeoPoint calls
content = content.replace(/activeCity\.coordinates\)/g, 'activeCity.centerCoordsText)');

// Fix 2: lat/lng on GeoPoint
content = content.replace(/tl\.lat/g, 'tl.latitude');
content = content.replace(/br\.lat/g, 'br.latitude');
content = content.replace(/bl\.lat/g, 'bl.latitude');
content = content.replace(/tr\.lat/g, 'tr.latitude');

content = content.replace(/tl\.lng/g, 'tl.longitude');
content = content.replace(/br\.lng/g, 'br.longitude');
content = content.replace(/bl\.lng/g, 'bl.longitude');
content = content.replace(/tr\.lng/g, 'tr.longitude');

fs.writeFileSync('src/components/MapViewTab.tsx', content, 'utf-8');
console.log('Fixed MapViewTab.tsx');
