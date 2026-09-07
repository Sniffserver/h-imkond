import React, { useState } from 'react';
import { CITY_MAPS } from '../data/cityMaps';
import { CityMapData } from '../types';
import { convertOsmGeoJsonToHoimu, fetchLiveOsmData } from '../utils/osmParser';
import {
  X,
  MapPin,
  Building,
  Check,
  Globe,
  HardDrive,
  Compass,
  Navigation,
  ShieldCheck,
  Download,
  FileCode,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface CitySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  isNightMode?: boolean;
}

export const CitySelectionModal: React.FC<CitySelectionModalProps> = ({
  isOpen,
  onClose,
  selectedCityId,
  onSelectCity,
  isNightMode = false,
}) => {
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importName, setImportName] = useState('Minu Biopiirkond');
  const [importLat, setImportLat] = useState('58.3780'); // Tartu default
  const [importLon, setImportLon] = useState('26.7290');
  const [rawGeoJsonText, setRawGeoJsonText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const citiesList = Object.values(CITY_MAPS);

  const handleFetchOsm = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const lat = parseFloat(importLat);
    const lon = parseFloat(importLon);

    if (isNaN(lat) || isNaN(lon)) {
      setErrorMessage('Vigased koordinaadid! Palun sisesta numbrid.');
      setIsLoading(false);
      return;
    }

    try {
      console.log(`[OSM Import] Fetching Overpass data for lat: ${lat}, lon: ${lon}`);
      const geoJson = await fetchLiveOsmData(lat, lon);
      
      const newMap = convertOsmGeoJsonToHoimu(geoJson, importName, lat, lon);

      // Save custom map to memory and localStorage
      CITY_MAPS[newMap.id] = newMap;
      
      const rawCustom = localStorage.getItem('hoimu_custom_city_maps');
      const customMaps = rawCustom ? JSON.parse(rawCustom) : {};
      customMaps[newMap.id] = newMap;
      localStorage.setItem('hoimu_custom_city_maps', JSON.stringify(customMaps));

      setSuccessMessage(`Kaart "${newMap.cityName}" edukalt laetud ja teisendatud!`);
      setTimeout(() => {
        onSelectCity(newMap.id);
        onClose();
        // Reset form
        setShowImportPanel(false);
        setSuccessMessage(null);
      }, 1500);

    } catch (err: any) {
      console.error('[OSM Import] Error fetching Overpass API:', err);
      setErrorMessage(`Viga OSM andmete laadimisel: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportGeoJson = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const lat = parseFloat(importLat);
    const lon = parseFloat(importLon);

    if (isNaN(lat) || isNaN(lon)) {
      setErrorMessage('Koordinaadid on vajalikud kaardi keskpunkti määramiseks.');
      return;
    }

    if (!rawGeoJsonText.trim()) {
      setErrorMessage('Palun kopeeri siia mõni GeoJSON tekst.');
      return;
    }

    try {
      const geoJson = JSON.parse(rawGeoJsonText.trim());
      const newMap = convertOsmGeoJsonToHoimu(geoJson, importName, lat, lon);

      CITY_MAPS[newMap.id] = newMap;

      const rawCustom = localStorage.getItem('hoimu_custom_city_maps');
      const customMaps = rawCustom ? JSON.parse(rawCustom) : {};
      customMaps[newMap.id] = newMap;
      localStorage.setItem('hoimu_custom_city_maps', JSON.stringify(customMaps));

      setSuccessMessage(`GeoJSON "${newMap.cityName}" edukalt imporditud!`);
      setTimeout(() => {
        onSelectCity(newMap.id);
        onClose();
        setShowImportPanel(false);
        setSuccessMessage(null);
        setRawGeoJsonText('');
      }, 1500);

    } catch (err: any) {
      setErrorMessage('Vigane GeoJSON! Palun kontrolli kopeeritud teksti vormingut.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 max-h-[90vh] flex flex-col ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer z-10 ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-[#588157]/20 border border-[#87A878]/40 flex items-center justify-center text-[#588157]">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl">Offline Bioregional City Maps</h3>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              HÕIMU võrguühenduseta vektor-topograafia ja tänavakaardid.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mb-4 flex gap-2 shrink-0">
          <button
            onClick={() => setShowImportPanel(false)}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              !showImportPanel
                ? 'bg-[#588157] text-white border-[#588157]'
                : isNightMode
                ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                : 'bg-white text-[#637062] border-[#87A878]/30'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Kogukonna Kaardid</span>
          </button>
          <button
            onClick={() => setShowImportPanel(true)}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              showImportPanel
                ? 'bg-[#E76F51] text-white border-[#E76F51]'
                : isNightMode
                ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                : 'bg-white text-[#637062] border-[#87A878]/30'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>OpenStreetMap Import</span>
          </button>
        </div>

        {/* Error / Success Notifications */}
        {(errorMessage || successMessage) && (
          <div className="mb-4 shrink-0">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-500 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 animate-bounce" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {showImportPanel ? (
            <div className={`p-4 rounded-2xl border flex flex-col gap-3.5 ${
              isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/20'
            }`}>
              <div className="flex items-center gap-2 text-xs text-[#E76F51] font-bold uppercase tracking-wider">
                <Activity className="w-4 h-4 animate-pulse" />
                <span>Uue asukoha import otse OSM-ist</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase">Kaardi nimi</label>
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    className="p-2 text-xs rounded-xl border border-current/10 bg-transparent focus:outline-none focus:border-[#E76F51]"
                    placeholder="nt Elva keskus"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase font-mono">Laiuskraad (Lat)</label>
                  <input
                    type="text"
                    value={importLat}
                    onChange={(e) => setImportLat(e.target.value)}
                    className="p-2 text-xs rounded-xl border border-current/10 bg-transparent font-mono focus:outline-none focus:border-[#E76F51]"
                    placeholder="58.3780"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase font-mono">Pikkuskraad (Lon)</label>
                  <input
                    type="text"
                    value={importLon}
                    onChange={(e) => setImportLon(e.target.value)}
                    className="p-2 text-xs rounded-xl border border-current/10 bg-transparent font-mono focus:outline-none focus:border-[#E76F51]"
                    placeholder="26.7290"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleFetchOsm}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E76F51] hover:bg-[#d65f42] text-white font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Päritakse OpenStreetMap API-t...' : 'Laadi otse üle veebi (Overpass)'}</span>
              </button>

              <div className="relative my-1 text-center shrink-0">
                <hr className="border-current/10" />
                <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-[10px] uppercase font-bold text-[#637062] dark:text-[#A8BDA5] ${
                  isNightMode ? 'bg-[#121A10]' : 'bg-white'
                }`}>või offline GeoJSON</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase">Kleebi GeoJSON tekst</label>
                <textarea
                  value={rawGeoJsonText}
                  onChange={(e) => setRawGeoJsonText(e.target.value)}
                  rows={4}
                  className="p-2 text-[11px] font-mono rounded-xl border border-current/10 bg-transparent focus:outline-none focus:border-[#E76F51] resize-none"
                  placeholder='{"type": "FeatureCollection", "features": [...]}'
                />
              </div>

              <button
                type="button"
                onClick={handleImportGeoJson}
                className="w-full py-2 px-4 rounded-xl border border-[#E76F51]/30 hover:bg-[#E76F51]/10 text-[#E76F51] font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCode className="w-4 h-4" />
                <span>Impordi GeoJSON-ina</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {citiesList.map((city) => {
                const isSelected = city.id === selectedCityId;

                return (
                  <div
                    key={city.id}
                    onClick={() => {
                      onSelectCity(city.id);
                      onClose();
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#588157]/15 border-[#588157] shadow-sm'
                        : isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] hover:border-[#87A878]/40'
                        : 'bg-white border-[#87A878]/30 hover:border-[#87A878]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className={`w-4 h-4 ${isSelected ? 'text-[#588157]' : 'text-[#2A9D8F]'}`} />
                        <h4 className="font-display font-bold text-base text-[#203A2A] dark:text-[#F0F5EE]">
                          {city.cityName}, {city.country}
                        </h4>
                      </div>

                      {isSelected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157] text-white flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#588157] hover:underline">Select</span>
                      )}
                    </div>

                    <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                      {city.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-current/10 text-[11px] font-mono">
                      <span className="text-[#588157] font-semibold">📍 {city.centerCoordsText}</span>
                      <span className="text-[#637062] dark:text-[#A8BDA5]">
                        {city.streets.length} Streets • {city.landmarks.length} Landmarks
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
