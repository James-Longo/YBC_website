import requests
import re
import json
import csv
from io import StringIO
import time

SHEET_ID = '1oamD7Oe2jOW4THfBWxeTIfK25MN7CdXxZhLn6ebmlJQ'
CSV_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv'

def scrape_ebird(url):
    print(f"Scraping {url}...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
        
        html = response.text
        
        # Extract species count
        # Look for: class="StatsIcon-stat-count"> 36 <!----></span>
        species_match = re.search(r'class="StatsIcon-stat-count">\s*(\d+)', html)
        species = f"{species_match.group(1)} Species" if species_match else ""
        
        # Extract date from og:description
        # Usually: <meta property="og:description" content="20 Jun, 2024 – 24 Jun, 2024...">
        date_match = re.search(r'property="og:description"\s+content="([^"]*)"', html)
        date = ""
        if date_match:
            desc = date_match.group(1)
            # Take the part before the first dot
            date = desc.split('. ')[0] if '. ' in desc else desc
            
        return {"species": species, "date": date}
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

def main():
    # 1. Fetch CSV
    print("Fetching CSV...")
    resp = requests.get(CSV_URL)
    if resp.status_code != 200:
        print("Failed to fetch CSV")
        return
    
    csv_data = csv.DictReader(StringIO(resp.text))
    metadata = {}
    
    # 2. Scrape each link
    # To be fast, we only scrape a few for testing or all if they want
    for row in csv_data:
        name = row.get('Name')
        link = row.get('Link')
        if name and link and 'ebird.org' in link and '#Social' not in name:
            info = scrape_ebird(link)
            if info:
                metadata[link] = info
                print(f"  Result: {info}")
            time.sleep(1) # Be nice to eBird
            
    # 3. Save to JSON
    with open('ebird_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print("Saved to ebird_metadata.json")

if __name__ == "__main__":
    main()
