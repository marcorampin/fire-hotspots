// ============================================================
// CONFIGURATION
// ============================================================
const GEOJSON_PATH = "output/thinned_fires.geojson";

// ============================================================
// MAP INITIALIZATION
// ============================================================
const map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
}).setView([20, 0], 2);

// Terrain base map (OpenTopoMap)
L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        'SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
}).addTo(map);

// Optional: add a semi-transparent satellite overlay as alternative.
// Uncomment to enable (uses Esri World Imagery, no key required).
// L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
//     attribution: "Tiles &copy; Esri",
//     maxZoom: 19,
// }).addTo(map);

// ============================================================
// HELPERS
// ============================================================
function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function markerColor(conf) {
    return conf === "high" ? "#d73027" : "#fc8d59";
}

// ============================================================
// LOAD AND RENDER DATA
// ============================================================
const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    disableClusteringAtZoom: 7,
});

fetch(GEOJSON_PATH)
    .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${GEOJSON_PATH}`);
        return res.json();
    })
    .then((geojson) => {
        const layer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) =>
                L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: markerColor(feature.properties.conf_h),
                    color: "#333",
                    weight: 0.5,
                    fillOpacity: 0.8,
                }),
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const html = `
                    <div>
                        <b>${formatDate(p.acq_datetime)}</b><br>
                        Lat: ${p.latitude.toFixed(4)}<br>
                        Lon: ${p.longitude.toFixed(4)}<br>
                        Confidence: <b>${p.conf_h}</b><br>
                        Sensors: ${p.source}<br>
                        Raw detections merged: ${p.n_raw}
                    </div>
                `;
                layer.bindPopup(html);
            },
        });

        clusterGroup.addLayer(layer);
        map.addLayer(clusterGroup);

        // Stats
        const n = geojson.features.length;
        const multi = geojson.features.filter(
            (f) => (f.properties.n_sensors || 1) > 1
        ).length;
        document.getElementById("stats").innerHTML =
            `<b>${n.toLocaleString()}</b> fire points<br>` +
            `<b>${multi.toLocaleString()}</b> confirmed by &gt;1 sensor`;
    })
    .catch((err) => {
        console.error(err);
        document.getElementById("stats").textContent =
            "Failed to load data. Check console.";
    });

// ============================================================
// SCALE BAR
// ============================================================
L.control.scale({ imperial: false }).addTo(map);
