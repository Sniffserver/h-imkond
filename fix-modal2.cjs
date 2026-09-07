const fs = require('fs');
let content = fs.readFileSync('src/components/DownloadOfflineRegionModal.tsx', 'utf-8');

const regex = /const geoCenter = \(cameraCenter\.lat \!== undefined && cameraCenter\.lng \!== undefined\) \n\s*\? \{ lat: cameraCenter\.lat, lng: cameraCenter\.lng \} \n\s*: localGridToGeoPoint\(cameraCenter\.x, cameraCenter\.y\);/g;

content = content.replace(
  /const geoCenter = \([\s\S]*?localGridToGeoPoint\(cameraCenter\.x, cameraCenter\.y\);/,
  `const geoCenterRaw = (cameraCenter.lat !== undefined && cameraCenter.lng !== undefined)
          ? { latitude: cameraCenter.lat, longitude: cameraCenter.lng }
          : localGridToGeoPoint(cameraCenter.x, cameraCenter.y, activeCity.centerCoordsText);
        const geoLat = geoCenterRaw.latitude;
        const geoLng = geoCenterRaw.longitude;`
);

content = content.replace(/geoCenter\.lat/g, 'geoLat');
content = content.replace(/geoCenter\.lng/g, 'geoLng');

fs.writeFileSync('src/components/DownloadOfflineRegionModal.tsx', content, 'utf-8');
console.log('Fixed DownloadOfflineRegionModal.tsx part 2');
