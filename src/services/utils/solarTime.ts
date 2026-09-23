/**
 * HÕIMU Solar & Astronomical Twilight Calculation Service
 * 
 * Accurately determines local sunrise, sunset, and solar elevation angle
 * given GPS coordinates and current timestamp.
 * 
 * Used for:
 * - Intelligent AUTO Day/Night theme switching (GPS + astronomical solar elevation)
 * - Solarpunk solar panel energy harvesting forecasting
 * - Daylight window planning during field emergency operations
 */

export interface SolarTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  isDaytime: boolean;
  solarElevationDeg: number;
  source: 'gps_astronomical' | 'system_preference' | 'civil_twilight_fallback';
}

/**
 * Calculates solar position and sunrise/sunset using standard NOAA solar calculations.
 */
export function calculateSolarTimes(
  lat = 59.437,
  lng = 24.7535,
  date = new Date()
): SolarTimes {
  const dayOfYear = getDayOfYear(date);
  const nowHours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  // Fractional year in radians
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (nowHours - 12) / 24);

  // Equation of time in minutes
  const eqtime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );

  // Solar declination angle in radians
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  // Solar noon in minutes UTC
  const solarNoonUtcMinutes = 720 - 4 * lng - eqtime;
  const timezoneOffsetMinutes = -date.getTimezoneOffset(); // local offset in minutes
  const solarNoonLocalMinutes = solarNoonUtcMinutes + timezoneOffsetMinutes;

  // Hour angle for sunrise/sunset (zenith = 90.833° for atmospheric refraction)
  const latRad = (lat * Math.PI) / 180;
  const zenithRad = (90.833 * Math.PI) / 180;

  const cosHourAngle =
    (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));

  let sunriseLocalMinutes = 6 * 60; // fallback 06:00
  let sunsetLocalMinutes = 21 * 60;  // fallback 21:00

  if (cosHourAngle >= 1) {
    // Polar night (sun never rises)
    sunriseLocalMinutes = -1;
    sunsetLocalMinutes = -1;
  } else if (cosHourAngle <= -1) {
    // Midnight sun (sun never sets)
    sunriseLocalMinutes = 0;
    sunsetLocalMinutes = 24 * 60;
  } else {
    const hourAngleDeg = (Math.acos(cosHourAngle) * 180) / Math.PI;
    const halfDayMinutes = hourAngleDeg * 4;
    sunriseLocalMinutes = solarNoonLocalMinutes - halfDayMinutes;
    sunsetLocalMinutes = solarNoonLocalMinutes + halfDayMinutes;
  }

  // Calculate current solar elevation angle (degrees)
  const trueSolarTimeMinutes = (nowHours * 60 + eqtime + 4 * lng) % 1440;
  const hourAngleCurrentDeg = (trueSolarTimeMinutes / 4) - 180;
  const hourAngleCurrentRad = (hourAngleCurrentDeg * Math.PI) / 180;

  const sinElevation =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngleCurrentRad);
  const solarElevationDeg = (Math.asin(Math.max(-1, Math.min(1, sinElevation))) * 180) / Math.PI;

  const nowMinutes = nowHours * 60;
  const isDaytime = solarElevationDeg > -0.833; // Sun above horizon

  const sunriseDate = new Date(date);
  sunriseDate.setHours(0, 0, 0, 0);
  if (sunriseLocalMinutes >= 0) {
    sunriseDate.setMinutes(Math.round(sunriseLocalMinutes));
  }

  const sunsetDate = new Date(date);
  sunsetDate.setHours(0, 0, 0, 0);
  if (sunsetLocalMinutes >= 0) {
    sunsetDate.setMinutes(Math.round(sunsetLocalMinutes));
  }

  const solarNoonDate = new Date(date);
  solarNoonDate.setHours(0, 0, 0, 0);
  solarNoonDate.setMinutes(Math.round(solarNoonLocalMinutes));

  return {
    sunrise: sunriseDate,
    sunset: sunsetDate,
    solarNoon: solarNoonDate,
    isDaytime,
    solarElevationDeg: Math.round(solarElevationDeg * 10) / 10,
    source: 'gps_astronomical',
  };
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}
