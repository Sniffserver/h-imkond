const fs = require('fs');

let content = fs.readFileSync('src/components/MapViewTab.tsx', 'utf-8');

// 1. Add states
const stateInjection = `
  // Offline Region Download Utility State
  const [isOfflineDownloadOpen, setIsOfflineDownloadOpen] = useState(false);
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineMapRegion[]>(() =>
    offlineMapService.getDownloadedRegions()
  );

  // Viewport Cache State
  const [isViewportCacheModalOpen, setIsViewportCacheModalOpen] = useState(false);
  const [viewportCacheStatus, setViewportCacheStatus] = useState<'idle' | 'estimating' | 'downloading' | 'done'>('idle');
  const [viewportCacheBounds, setViewportCacheBounds] = useState<{minLat: number, maxLat: number, minLng: number, maxLng: number} | null>(null);
  const [viewportCacheCount, setViewportCacheCount] = useState<number>(0);
  const [viewportCacheProgress, setViewportCacheProgress] = useState<{downloaded: number, total: number}>({downloaded: 0, total: 0});

  const handleOpenViewportCache = async () => {
    const activeCity = CITY_MAPS[selectedCityId];
    if (!activeCity) return;
    
    setIsViewportCacheModalOpen(true);
    setViewportCacheStatus('estimating');
    
    // Calculate viewport bounds in local grid coordinates
    const w = window.innerWidth;
    const h = window.innerHeight;
    const minX = -transform.offsetX / transform.scale;
    const maxX = (w - transform.offsetX) / transform.scale;
    const minY = -transform.offsetY / transform.scale;
    const maxY = (h - transform.offsetY) / transform.scale;

    const tl = localGridToGeoPoint(minX, minY, activeCity.coordinates);
    const br = localGridToGeoPoint(maxX, maxY, activeCity.coordinates);
    const bl = localGridToGeoPoint(minX, maxY, activeCity.coordinates);
    const tr = localGridToGeoPoint(maxX, minY, activeCity.coordinates);
    
    const lats = [tl.lat, br.lat, bl.lat, tr.lat];
    const lngs = [tl.lng, br.lng, bl.lng, tr.lng];
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    setViewportCacheBounds({ minLat, maxLat, minLng, maxLng });
    
    try {
      const { estimateTileCountForBounds } = await import('../services/rasterTileCacheService');
      const count = estimateTileCountForBounds(minLat, maxLat, minLng, maxLng, 12, 15);
      setViewportCacheCount(count);
      setViewportCacheStatus('idle');
    } catch (e) {
      setViewportCacheStatus('idle');
    }
  };

  const handleStartViewportCache = async () => {
    if (!viewportCacheBounds) return;
    setViewportCacheStatus('downloading');
    setViewportCacheProgress({ downloaded: 0, total: viewportCacheCount });
    
    try {
      const { downloadRasterTilesForBounds } = await import('../services/rasterTileCacheService');
      await downloadRasterTilesForBounds(
        viewportCacheBounds.minLat,
        viewportCacheBounds.maxLat,
        viewportCacheBounds.minLng,
        viewportCacheBounds.maxLng,
        12,
        15,
        (downloaded, total) => {
          setViewportCacheProgress({ downloaded, total });
        }
      );
      setViewportCacheStatus('done');
      setTimeout(() => {
        setIsViewportCacheModalOpen(false);
        if (onAddToast) onAddToast('🌐 Vaateväli vahemällu salvestatud', 'Kõik rasterkaardi kihid on nüüd saadaval võrguühenduseta.', 'success');
      }, 1500);
    } catch (e) {
      console.error(e);
      setViewportCacheStatus('idle');
    }
  };
`;

content = content.replace(
  /  \/\/ Offline Region Download Utility State\n  const \[isOfflineDownloadOpen, setIsOfflineDownloadOpen\] = useState\(false\);\n  const \[downloadedRegions, setDownloadedRegions\] = useState<OfflineMapRegion\[\]>\(\(\) =>\n    offlineMapService\.getDownloadedRegions\(\)\n  \);/,
  stateInjection
);

// 2. Add button
const buttonInjection = `
          {/* Download Offline Region Floating Button */}
          <button
            id="btn-floating-download-offline"
            type="button"
            onClick={() => setIsOfflineDownloadOpen(true)}
            title="Download Offline Region (Laadi piirkond võrguühenduseta / Salvesta maastik & sõlmed)"
            className={\`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative \${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#2A9D8F] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#2A9D8F] hover:bg-[#FAF6EE]'
            }\`}
          >
            <FolderDown className="w-4 h-4 text-[#2A9D8F]" />
            {downloadedRegions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#2A9D8F] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Cache Viewport Floating Button */}
          <button
            id="btn-floating-cache-viewport"
            type="button"
            onClick={handleOpenViewportCache}
            title="Cache Current Viewport (Salvesta praegune vaateväli rasterkaardina)"
            className={\`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative \${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#E76F51] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#E76F51] hover:bg-[#FAF6EE]'
            }\`}
          >
            <HardDrive className="w-4 h-4 text-[#E76F51]" />
          </button>
`;

content = content.replace(
  /          \{\/\* Download Offline Region Floating Button \*\/\}[\s\S]*?<\/button>/,
  buttonInjection
);

// 3. Add Modal
const modalInjection = `
      {/* Pathfinder Mode Control Center & Novelty Radar Modal */}
`;

const modalContent = `
      {/* Viewport Raster Cache Modal */}
      {isViewportCacheModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => viewportCacheStatus !== 'downloading' && setIsViewportCacheModalOpen(false)} />
          <div className={\`relative w-full max-w-sm p-5 rounded-3xl shadow-2xl border animate-in fade-in zoom-in-95 duration-200 \${
            isNightMode ? 'bg-[#141E12] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/30'
          }\`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={\`p-2 rounded-xl \${isNightMode ? 'bg-[#2A9D8F]/20 text-[#2A9D8F]' : 'bg-[#2A9D8F]/10 text-[#2A9D8F]'}\`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={\`font-bold text-sm \${isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'}\`}>
                    Salvesta Rasterkaardi Vaateväli
                  </h3>
                  <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                    Puhverda aktiivne piirkond Wi-Fi kaudu
                  </p>
                </div>
              </div>
              {viewportCacheStatus !== 'downloading' && (
                <button
                  type="button"
                  onClick={() => setIsViewportCacheModalOpen(false)}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="w-4 h-4 text-[#637062]" />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {viewportCacheStatus === 'estimating' ? (
                <div className="py-6 text-center text-[#637062] dark:text-[#A8BDA5]">
                  <div className="inline-block w-5 h-5 border-2 border-[#2A9D8F] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Arvutan kaardipaanide mahtu...</p>
                </div>
              ) : viewportCacheStatus === 'downloading' ? (
                <div className="py-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                    <span>Laadin alla ({viewportCacheProgress.downloaded} / {viewportCacheProgress.total})</span>
                    <span>{Math.round((viewportCacheProgress.downloaded / Math.max(1, viewportCacheProgress.total)) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-[#2A9D8F] transition-all duration-300" 
                      style={{ width: \`\${(viewportCacheProgress.downloaded / Math.max(1, viewportCacheProgress.total)) * 100}%\` }} 
                    />
                  </div>
                  <p className="text-[10px] text-center text-[#637062] dark:text-[#A8BDA5]">
                    Palun oota, allalaadimine käib (ära sulge rakendust)
                  </p>
                </div>
              ) : viewportCacheStatus === 'done' ? (
                <div className="py-6 text-center">
                  <div className="inline-flex p-3 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#203A2A] dark:text-[#F0F5EE]">Allalaaditud!</p>
                </div>
              ) : (
                <>
                  <div className={\`p-3 rounded-2xl border flex items-center gap-3 \${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'}\`}>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE]">Paanide hulk</p>
                      <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Kõik suumitasemed (Z12-Z15)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#2A9D8F]">{viewportCacheCount.toLocaleString()}</p>
                      <p className="text-[10px] text-[#637062]">Hinnanguline maht: ~{Math.ceil(viewportCacheCount * 0.02)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={handleStartViewportCache}
                    disabled={viewportCacheCount === 0}
                    className="w-full py-3 rounded-2xl bg-[#2A9D8F] text-white font-bold text-sm hover:bg-[#238276] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Alusta Allalaadimist</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pathfinder Mode Control Center & Novelty Radar Modal */}
`;

content = content.replace(
  /      \{\/\* Pathfinder Mode Control Center & Novelty Radar Modal \*\/\}/,
  modalContent
);

fs.writeFileSync('src/components/MapViewTab.tsx', content, 'utf-8');
console.log('Patched MapViewTab.tsx');
