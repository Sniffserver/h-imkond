export const RASTER_CACHE_NAME = 'hoimu-raster-tiles';

function lon2tile(lon: number, zoom: number) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)
  );
}

export async function downloadRasterTilesForRegion(
  lat: number,
  lng: number,
  radiusKm: number,
  minZoom = 12,
  maxZoom = 15,
  onProgress?: (downloaded: number, total: number) => void
) {
  const cache = await caches.open(RASTER_CACHE_NAME);
  
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
  
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const urlsToFetch: string[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = lon2tile(minLng, z);
    const maxX = lon2tile(maxLng, z);
    const minY = lat2tile(maxLat, z); // maxLat is top, so smaller Y
    const maxY = lat2tile(minLat, z); // minLat is bottom, so larger Y

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // OpenStreetMap standard tile URL
        urlsToFetch.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }

  // To prevent overwhelming the browser/server, download in batches
  const batchSize = 10;
  let downloaded = 0;
  
  for (let i = 0; i < urlsToFetch.length; i += batchSize) {
    const batch = urlsToFetch.slice(i, i + batchSize);
    await Promise.all(batch.map(async (url) => {
      try {
        const match = await cache.match(url);
        if (!match) {
          const res = await fetch(url, { mode: 'cors' }); // Ensure CORS is okay
          if (res.ok) {
            await cache.put(url, res);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch tile', url, e);
      }
    }));
    downloaded += batch.length;
    if (onProgress) {
      onProgress(Math.min(downloaded, urlsToFetch.length), urlsToFetch.length);
    }
  }
}

export function getOfflineMaplibreProtocol() {
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
}

export async function downloadRasterTilesForBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  minZoom = 12,
  maxZoom = 15,
  onProgress?: (downloaded: number, total: number) => void
) {
  const cache = await caches.open(RASTER_CACHE_NAME);
  
  const urlsToFetch: string[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = lon2tile(minLng, z);
    const maxX = lon2tile(maxLng, z);
    const minY = lat2tile(maxLat, z); // maxLat is top, so smaller Y
    const maxY = lat2tile(minLat, z); // minLat is bottom, so larger Y

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        urlsToFetch.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }

  const batchSize = 10;
  let downloaded = 0;
  
  for (let i = 0; i < urlsToFetch.length; i += batchSize) {
    const batch = urlsToFetch.slice(i, i + batchSize);
    await Promise.all(batch.map(async (url) => {
      try {
        const match = await cache.match(url);
        if (!match) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) {
            await cache.put(url, res);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch tile', url, e);
      }
    }));
    downloaded += batch.length;
    if (onProgress) {
      onProgress(Math.min(downloaded, urlsToFetch.length), urlsToFetch.length);
    }
  }
}

export function estimateTileCountForBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  minZoom = 12,
  maxZoom = 15
): number {
  let count = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = lon2tile(minLng, z);
    const maxX = lon2tile(maxLng, z);
    const minY = lat2tile(maxLat, z);
    const maxY = lat2tile(minLat, z);
    
    // Width and height in tiles
    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);
    count += (w * h);
  }
  return count;
}
