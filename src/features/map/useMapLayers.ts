import { useState, useCallback } from 'react';

export function useMapLayers() {
  const [filterOnlyNewMap, setFilterOnlyNewMap] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Tallinn');

  const toggleFilterOnlyNew = useCallback(() => {
    setFilterOnlyNewMap((prev) => !prev);
  }, []);

  return {
    filterOnlyNewMap,
    setFilterOnlyNewMap,
    selectedCity,
    setSelectedCity,
    toggleFilterOnlyNew,
  };
}
