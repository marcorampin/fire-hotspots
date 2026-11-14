# 🔥 IGNIS HARMONIZE | The Burning Activity Calendar

> **NASA International Space Apps Challenge**  
> **Challenge:** Harmonization of MODIS and VIIRS Hot Spots  
> **Mission:** Bridge two decades of Earth observation data to provide a unified, continuous historical record for fire managers, scientists, and disaster responders.

---

## 📌 Executive Summary & Scientific Problem

For more than two decades, NASA satellites have monitored Earth's active fire hotspots:
- **MODIS (Terra & Aqua)**: Operating since 2000 (Terra) and 2002 (Aqua) with a **1 km** spatial pixel footprint. Terra and Aqua are nearing decommissioning.
- **VIIRS (Suomi-NPP, NOAA-20, NOAA-21)**: Operating since 2012 (Suomi-NPP) and 2018 (NOAA-20) with a **375 m** spatial resolution.

### The Sensor Discrepancy Problem ("The Sensor Jump")
A single 1 km MODIS pixel ($\approx 1{,}000{,}000\text{ m}^2$) covers the surface area of $\approx 7.1$ VIIRS 375 m pixels ($\approx 140{,}625\text{ m}^2$). In addition, VIIRS detects smaller, lower-intensity fires ($\text{FRP} \ge 0.1\text{ MW}$) that fall below MODIS detection limits ($\text{FRP} \ge 5\text{–}10\text{ MW}$).

**If a user plots raw hotspot counts from 2000 to 2026, there is an artificial 300%–500% jump starting in 2012!** Land managers cannot tell whether fire activity genuinely intensified or if satellite sensitivity simply improved.

**IGNIS HARMONIZE** resolves this discrepancy by implementing an empirical cross-sensor transfer function, establishing a 21-year historical baseline (2000–2020), and translating millions of detections into an intuitive **Burning Activity Calendar**.

---

## 🌟 Key Features

### 1. The Burning Activity Calendar (The Core Deliverable)
- **Multi-Decadal Matrix**: Displays 2000 through 2026 (26 rows, one per year) across 52 weeks (Jan–Dec).
- **Interactive Color Ramps**:
  - **Harmonized Fire Activity**: Normalized continuous fire frequency or Fire Radiative Power (MW).
  - **Standardized Anomaly ($Z$-Score)**: Climatological deviations ($+2\sigma$ severe, $+3\sigma$ catastrophic).
  - **Sensor Era Comparison**: Distinguishes the MODIS-only baseline period from the dual-sensor era.
- **Hover Inspection**: Instant breakdown showing raw MODIS count, raw VIIRS count, harmonized count, FRP energy, and historical $Z$-score.

### 2. Cumulative Fire Trajectory & Seasonality Envelope
- Plots **Day of Year (1–365) Cumulative Fire Load**.
- Displays the **2000–2020 Historical Min-Max Envelope** and median ($p50$) baseline.
- Overlays the selected year's trajectory, enabling fire managers to anticipate containment demands weeks in advance.

### 3. Interactive Spatial Distribution Map
- Interactive bounding box display for custom or preset Areas of Interest (AOIs).
- Point-level hotspot visualization with color-coded Fire Radiative Power (MW).
- **NASA GIBS Layer Integration**: Overlays MODIS/VIIRS Corrected Reflectance (True Color) satellite tiles.

### 4. Dynamic Harmonization Controls & Presets
- Pre-configured with prominent wildfire zones:
  - **Amazon Rainforest** (Tropical Deforestation Arc)
  - **California Chaparral & Forests** (Canopy Wildfire Zone)
  - **Pantanal Tropical Wetlands** (Historic 2020/2024 Drought Fires)
  - **Southeastern Australia** (Black Summer Zone)
  - **Canadian Boreal Forests** (Record 2023 Mega-Fires)
- **Live Transfer Multiplier ($\beta$)**: Fine-tune cross-sensor regression directly in the UI.

### 5. 1-Click Data Exporter
- Download normalized multi-decadal CSV files containing daily raw counts, harmonized indices, baseline stats, and $Z$-scores for any chosen AOI.

---

## 📐 Mathematical Harmonization Architecture

### 1. Cross-Sensor Scaling Function ($\beta$ Transfer)
Using the concurrent observation period (2012–2024):
$$\beta_{\text{biome}} = \frac{\sum N_{\text{VIIRS}}}{\sum N_{\text{MODIS}}}$$
$$N_{\text{Harmonized}}(t) = \begin{cases}
  \text{Round}(N_{\text{MODIS}} \times \beta_{\text{biome}}) & \text{for } t < 2012 \\
  \text{Round}\big(0.85 \cdot N_{\text{VIIRS}} + 0.15 \cdot (N_{\text{MODIS}} \times \beta_{\text{biome}})\big) & \text{for } t \ge 2012
\end{cases}$$

### 2. Climatological Baseline Normalization (2000–2020)
For each week $w \in [1, 52]$:
$$\mu(w) = \frac{1}{K}\sum_{y=2000}^{2020} N_{\text{Harmonized}}(y, w), \quad \sigma(w) = \sqrt{\frac{1}{K}\sum_{y=2000}^{2020} (N_{\text{Harmonized}}(y, w) - \mu(w))^2}$$

### 3. Standardized Fire Anomaly ($Z$-Score)
$$Z(y, w) = \frac{N_{\text{Harmonized}}(y, w) - \mu(w)}{\sigma(w)}$$
- $Z \ge +2.0\sigma$: Severe historical anomaly (top 2.3% of observations).
- $Z \ge +3.0\sigma$: Catastrophic, unprecedented fire emergency.

---

## 🚀 Quick Start / How to Run

### Option A: Instant Run (Zero dependencies, Python standard library)
Run the built-in development server:
```bash
python3 python/serve.py
```
Open **[http://localhost:8080](http://localhost:8080)** in any modern web browser.

### Option B: Direct File Open
You can also open `index.html` directly in your browser:
```bash
open index.html
```

### Option C: React + TypeScript + Vite Setup (For Node.js environments)
```bash
# 1. Install dependencies
npm install

# 2. Start Vite dev server
npm run dev

# 3. Build for production
npm run build
```

---

## 📁 Repository Structure

```
├── index.html                   # Turnkey standalone web application (MapLibre + React + Tailwind)
├── package.json                 # Modern React 18 + TypeScript + Vite build config
├── tsconfig.json                # TypeScript strict configuration
├── vite.config.ts               # Vite bundler setup
├── tailwind.config.js           # NASA dark-space theme configuration
├── src/
│   ├── main.tsx                 # Application entrypoint
│   ├── App.tsx                  # Main orchestration & state controller
│   ├── components/
│   │   ├── BurningCalendar.tsx  # 26-year x 52-week Burning Activity Matrix
│   │   ├── MapView.tsx          # Spatiotemporal hotspot map + NASA GIBS integration
│   │   ├── SeasonalityChart.tsx # Cumulative trajectory (DOY 1-365) vs Climatology Envelope
│   │   ├── AnomalyMetrics.tsx   # Dynamic fire load & anomaly gauges
│   │   ├── FilterControls.tsx   # AOI selector, mode toggles, & transfer slider
│   │   └── Header.tsx           # Application navigation and export bar
│   ├── services/
│   │   ├── harmonization.ts     # Core statistical harmonization engine
│   │   ├── syntheticData.ts     # Multi-decadal calibration datasets & hotspot generator
│   │   └── firmsApi.ts          # NASA FIRMS REST API & GIBS WMTS client
│   └── types/
│       └── fire.ts              # Full TypeScript schemas
├── public/
│   └── data/
│       └── sample_regions.json  # Metadata for global wildfire zones
└── python/
    ├── serve.py                 # Lightweight local server with CORS support
    └── harmonize_duckdb.py      # High-speed DuckDB backend harmonization pipeline
```

---

## 🛰️ NASA Data Integrations
- **NASA FIRMS** (Fire Information for Resource Management System): NRT and archive active fire detections.
- **NASA GIBS** (Global Imagery Browse Services): True color reflectance base layers from MODIS Terra and VIIRS Suomi-NPP.
- **NASA EONET** (Earth Observatory Natural Event Tracker): Wildfire event classification and temporal tracking.

---

*Developed for the NASA International Space Apps Challenge.*
