import requests
import os
from datetime import datetime

# --- CONFIGURATION ---
# Replace with your actual NASA FIRMS MAP_KEY
MAP_KEY = "3a2f6039e034ced01e574745b06e4360"

# NASA FIRMS Area API Endpoint
BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Sources: MODIS_NRT for MODIS, VIIRS_SNPP_NRT for VIIRS (Suomi-NPP)
# You can also use VIIRS_NOAA20_NRT or VIIRS_NOAA21_NRT
SOURCES = ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]

# Area: "world" gets global data
AREA = "world"

# Day Range: 1 gets the most recent day (Today)
DAY_RANGE = 5

def download_fire_data():
    # Create a folder for today's data
    today_str = datetime.now().strftime("%Y-%m-%d")
    output_dir = f"data"
    os.makedirs(output_dir, exist_ok=True)

    for source in SOURCES:
        print(f"Fetching {source}...")
        
        # Construct the URL: /api/area/csv/[MAP_KEY]/[SOURCE]/[AREA]/[DAY_RANGE]
        url = f"{BASE_URL}/{MAP_KEY}/{source}/{AREA}/{DAY_RANGE}"
        
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()  # Check for HTTP errors
            
            # Check if the response is actually a CSV (sometimes errors return HTML/JSON)
            if "latitude" not in response.text[:200].lower() and response.text.strip():
                # NASA sometimes returns error messages with 200 OK
                print(f"Warning: Unexpected response for {source}. Content preview: {response.text[:200]}")
                continue

            if not response.text.strip():
                print(f"No data found for {source} today.")
                continue

            # Save to file
            filename = f"{output_dir}/{source}_live.csv"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(response.text)
            
            print(f"Successfully saved: {filename}")

        except requests.exceptions.RequestException as e:
            print(f"Error fetching {source}: {e}")

if __name__ == "__main__":
    download_fire_data()
