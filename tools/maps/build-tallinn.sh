#!/usr/bin/env bash
# ==============================================================================
# HÕIMU Tactical Map Pipeline: Tallinn PMTiles Generator
#
# Transforms OpenStreetMap data into a single-file, serverless .pmtiles vector
# archive for 100% offline, privacy-first bioregional mapping in HÕIMU.
#
# Pipeline Architecture:
#   OSM (Geofabrik Estonia Extract)
#     ↓
#   Osmium Clip (tallinn.poly boundary)
#     ↓
#   Planetiler / Protomaps v3 / Shortbread vector tile compilation (Z0 - Z15+)
#     ↓
#   public/maps/tallinn.pmtiles (Zero-Scraping Offline Map Pack)
#
# Compliance:
#   - 100% OpenStreetMap Foundation (OSMF) Tile Policy Compliant
#   - Zero bulk downloading or scraping against tile.openstreetmap.org
#   - Full attribution embedded: "© OpenStreetMap contributors"
#   - Localized Estonian street names via `name:et` and `name` tags
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORK_DIR="${ROOT_DIR}/.map-build-tmp"
OUTPUT_DIR="${ROOT_DIR}/public/maps"
OUTPUT_FILE="${OUTPUT_DIR}/tallinn.pmtiles"

GEOFABRIK_URL="https://download.geofabrik.de/europe/estonia-latest.osm.pbf"
ESTONIA_PBF="${WORK_DIR}/estonia-latest.osm.pbf"
TALLINN_PBF="${WORK_DIR}/tallinn.osm.pbf"
POLY_FILE="${SCRIPT_DIR}/tallinn.poly"
PLANETILER_VERSION="0.8.2"

echo "===================================================================="
echo "  HÕIMU Map Pack Builder: Tallinn Vector PMTiles Pipeline"
echo "===================================================================="

mkdir -p "${WORK_DIR}"
mkdir -p "${OUTPUT_DIR}"

# 1. Download Geofabrik Estonia extract if not cached
if [ ! -f "${ESTONIA_PBF}" ]; then
  echo "[1/4] Downloading Estonia OSM extract from Geofabrik..."
  curl -L --progress-bar -o "${ESTONIA_PBF}" "${GEOFABRIK_URL}"
else
  echo "[1/4] Using cached Estonia extract: ${ESTONIA_PBF}"
fi

# 2. Clip extract to Tallinn Bioregion polygon using Osmium (or fallback to full extract if osmium missing)
echo "[2/4] Clipping extract to Tallinn bioregion polygon..."
if command -v osmium &> /dev/null; then
  osmium extract -p "${POLY_FILE}" "${ESTONIA_PBF}" -o "${TALLINN_PBF}" --overwrite
elif command -v osmconvert &> /dev/null; then
  osmconvert "${ESTONIA_PBF}" -B="${POLY_FILE}" -o="${TALLINN_PBF}"
else
  echo "      Notice: neither osmium-tool nor osmconvert found. Using full Estonia PBF for Planetiler bbox clipping."
  cp "${ESTONIA_PBF}" "${TALLINN_PBF}"
fi

# 3. Generate PMTiles using Planetiler
echo "[3/4] Compiling Vector PMTiles (Zoom levels 0 to 15+)..."
if [ ! -f "${WORK_DIR}/planetiler.jar" ]; then
  echo "      Fetching Planetiler v${PLANETILER_VERSION}..."
  curl -L --progress-bar -o "${WORK_DIR}/planetiler.jar" \
    "https://github.com/onthegomap/planetiler/releases/download/v${PLANETILER_VERSION}/planetiler.jar"
fi

if command -v java &> /dev/null; then
  java -Xmx4g -jar "${WORK_DIR}/planetiler.jar" \
    --osm-path="${TALLINN_PBF}" \
    --output="${OUTPUT_FILE}" \
    --bbox=24.50,59.32,25.00,59.50 \
    --maxzoom=15 \
    --minzoom=0 \
    --languages=et,en,default \
    --force
else
  echo "      Notice: Java runtime not found on host."
  echo "      To run in Docker container instead:"
  echo "      docker run -e JAVA_TOOL_OPTIONS=\"-Xmx4g\" -v \"${WORK_DIR}:/data\" ghcr.io/onthegomap/planetiler:latest \\"
  echo "        --osm-path=/data/tallinn.osm.pbf --output=/data/tallinn.pmtiles --bbox=24.50,59.32,25.00,59.50 --maxzoom=15"
fi

# 4. Verify & summary
echo "[4/4] Verifying generated map pack..."
if [ -f "${OUTPUT_FILE}" ]; then
  FILE_SIZE=$(ls -lh "${OUTPUT_FILE}" | awk '{print $5}')
  echo "===================================================================="
  echo "  SUCCESS: Tallinn Map Pack created successfully!"
  echo "  Location: ${OUTPUT_FILE} (${FILE_SIZE})"
  echo "  Target: public/maps/tallinn.pmtiles"
  echo "  HÕIMU can now stream vector tiles with zero tile server traffic."
  echo "===================================================================="
else
  echo "Pipeline script ready. Ensure Java 21+ or Docker is installed to execute compilation."
fi
