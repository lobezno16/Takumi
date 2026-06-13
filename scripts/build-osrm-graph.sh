#!/bin/bash
# Build the OSRM routing graph for Koto-ku, Tokyo.
# Usage: ./scripts/build-osrm-graph.sh
#
# This script:
# 1. Downloads a Koto-ku OSM extract via Overpass API
# 2. Processes it with OSRM tools (extract → partition → customize)
# 3. Outputs the graph files to data/osm/
#
# Prerequisites: Docker must be running.
set -euo pipefail

DATA_DIR="$(cd "$(dirname "$0")/../data/osm" && pwd)"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v26.6.5"
PBF_FILE="$DATA_DIR/koto.osm.pbf"

# Koto-ku bounding box (south,west,north,east)
BBOX_S=35.634
BBOX_W=139.792
BBOX_N=35.694
BBOX_E=139.832

echo "=== OSRM Graph Builder for Koto-ku, Tokyo ==="
echo "Data directory: $DATA_DIR"
mkdir -p "$DATA_DIR"

# Step 1: Download OSM extract if not present
if [ ! -f "$PBF_FILE" ]; then
    echo ""
    echo "--- Step 1: Downloading Koto-ku OSM extract via Overpass API ---"
    OVERPASS_QUERY="[out:xml][timeout:120];(way[\"highway\"](${BBOX_S},${BBOX_W},${BBOX_N},${BBOX_E});>;);out body;"
    OVERPASS_URL="https://overpass-api.de/api/interpreter"

    # Download as OSM XML first
    OSM_FILE="$DATA_DIR/koto.osm"
    echo "Querying Overpass API for highway data in bbox [$BBOX_S,$BBOX_W,$BBOX_N,$BBOX_E]..."
    curl -sS --max-time 300 \
        -d "data=${OVERPASS_QUERY}" \
        "$OVERPASS_URL" \
        -o "$OSM_FILE"

    if [ ! -s "$OSM_FILE" ]; then
        echo "ERROR: Downloaded file is empty. Overpass API may be overloaded."
        exit 1
    fi

    echo "Downloaded $(wc -c < "$OSM_FILE") bytes of OSM data."

    # Convert to PBF using osmium (via Docker)
    echo "Converting OSM XML to PBF..."
    docker run --rm -v "$DATA_DIR:/data" \
        ghcr.io/project-osrm/osrm-backend:v26.6.5 \
        osmium cat /data/koto.osm -o /data/koto.osm.pbf --overwrite 2>/dev/null \
    || {
        # If osmium isn't in the OSRM image, try direct osrm-extract on .osm
        echo "osmium not available, using .osm directly with osrm-extract..."
        cp "$OSM_FILE" "$PBF_FILE"  # OSRM can read .osm XML too
    }

    echo "OSM extract ready."
else
    echo "--- Step 1: Using existing OSM extract: $PBF_FILE ---"
fi

# Step 2: OSRM Extract
echo ""
echo "--- Step 2: osrm-extract ---"
docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
    osrm-extract -p /opt/car.lua /data/koto.osm.pbf

# Step 3: OSRM Partition
echo ""
echo "--- Step 3: osrm-partition ---"
docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
    osrm-partition /data/koto.osrm

# Step 4: OSRM Customize
echo ""
echo "--- Step 4: osrm-customize ---"
docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
    osrm-customize /data/koto.osrm

echo ""
echo "=== OSRM graph built successfully! ==="
echo "Files in $DATA_DIR:"
ls -lh "$DATA_DIR"/koto.osrm*
echo ""
echo "You can now start OSRM with:"
echo "  docker compose --profile routing up -d"
