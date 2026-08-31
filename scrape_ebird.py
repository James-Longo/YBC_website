"""
Build public/stats.json — the club-wide numbers shown in the homepage "Club Stats" panel.

Reads every trip report link from the outings Google Sheet, pulls each report's data from
eBird's trip-report API, and aggregates. Run it whenever a new trip report has been added:

    python3 scrape_ebird.py

eBird's trip report pages bounce through a login "gateway" redirect that sets a session
cookie before serving the page, so requests go through a cookie-aware opener.
"""

import csv
import http.cookiejar
import json
import re
import sys
import time
import urllib.request
from datetime import datetime
from io import StringIO

SHEET_ID = '13B3nwUtvuE6ULHSFEBleg7KUbScN-BvdoqLQwfBvPLk'
CSV_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv'
API = 'https://ebird.org/tripreport-internal/v1/'
OUT = 'public/stats.json'
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders = [('User-Agent', USER_AGENT), ('Accept', 'application/json, text/html')]


def get(url, retries=3):
    for attempt in range(retries):
        try:
            with opener.open(url, timeout=20) as resp:
                return resp.read().decode('utf-8')
        except Exception as e:  # noqa: BLE001 — retry anything transient
            if attempt == retries - 1:
                raise
            print(f'    retry {attempt + 1} after error: {e}', file=sys.stderr)
            time.sleep(2)


def get_json(path):
    return json.loads(get(API + path))


def parse_time(text):
    for fmt in ('%I:%M:%S %p', '%I:%M %p', '%H:%M:%S', '%H:%M'):
        try:
            return datetime.strptime(text.strip(), fmt)
        except ValueError:
            pass
    return None


def outing_hours(start, end):
    s, e = parse_time(start or ''), parse_time(end or '')
    if not s or not e:
        return 0
    hours = (e - s).total_seconds() / 3600
    # Same start and end is a 24-hour Birdathon; an end before the start ran past midnight.
    if hours <= 0:
        hours += 24
    return hours


def main():
    print('Fetching outings sheet...')
    rows = list(csv.DictReader(StringIO(get(CSV_URL))))
    rows = [r for r in rows if r.get('title') and r.get('date')]
    print(f'  {len(rows)} outings')

    # First page load establishes the eBird session cookie; API calls need it.
    get('https://ebird.org/tripreport')

    species = {}        # speciesCode -> {commonName, checklists, photos, audio}
    people = set()
    locations = set()
    checklists = photos = audio = individuals = 0
    reports_scraped = 0
    hours = 0.0
    per_report = []

    for row in rows:
        hours += outing_hours(row.get('start time'), row.get('end time'))
        link = row.get('trip report link', '')
        match = re.search(r'ebird\.org/tripreport/(\d+)', link)
        if not match:
            print(f'  skip (not a trip report): {row["title"]}')
            continue
        trip_id = match.group(1)
        print(f'  {row["title"]} ({trip_id})')

        taxa = get_json(f'taxon-list/{trip_id}')
        num_checklists = get_json(f'num-checklists/{trip_id}')
        trip_people = get_json(f'people/{trip_id}')
        trip_locs = get_json(f'locations/{trip_id}')

        report_species = 0
        for t in taxa:
            if t.get('category') != 'species':
                continue
            report_species += 1
            entry = species.setdefault(t['speciesCode'], {
                'commonName': t['commonName'], 'checklists': 0, 'photos': 0, 'audio': 0, 'outings': 0,
            })
            entry['checklists'] += t.get('numChecklists', 0)
            entry['photos'] += t.get('numPhotos', 0)
            entry['audio'] += t.get('numAudio', 0)
            entry['outings'] += 1
            individuals += t.get('numIndividuals', 0) or 0
            photos += t.get('numPhotos', 0)
            audio += t.get('numAudio', 0)

        checklists += int(num_checklists)
        people.update(p['userId'] for p in trip_people if p.get('role') != 'invited')
        locations.update(loc['locId'] for loc in trip_locs)
        reports_scraped += 1
        per_report.append({'tripId': trip_id, 'title': row['title'],
                           'date': datetime.strptime(row['date'], '%m/%d/%Y').strftime('%Y-%m-%d'),
                           'species': report_species, 'checklists': int(num_checklists)})
        time.sleep(0.5)  # be nice to eBird

    most_seen = sorted(species.values(), key=lambda s: s['outings'], reverse=True)[:5]
    best_outing = max(per_report, key=lambda r: r['species']) if per_report else None
    first_date = min(datetime.strptime(r['date'], '%m/%d/%Y') for r in rows)

    stats = {
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'since': first_date.strftime('%Y-%m-%d'),
        'outings': len(rows),
        'reportsScraped': reports_scraped,
        'species': len(species),
        'checklists': checklists,
        'individuals': individuals,
        'photos': photos,
        'speciesWithPhotos': sum(1 for s in species.values() if s['photos']),
        'audio': audio,
        'speciesWithAudio': sum(1 for s in species.values() if s['audio']),
        'birders': len(people),
        'locations': len(locations),
        'hoursInField': round(hours),
        'mostSeen': [{'name': s['commonName'], 'outings': s['outings']} for s in most_seen],
        'bestOuting': best_outing,
        # Per-report numbers, keyed by trip report ID, for the Trip Reports page.
        'reports': {r['tripId']: {'species': r['species'], 'checklists': r['checklists']} for r in per_report},
        # Same data as a list (with titles/dates) — used as demo data before the sheet backend is live.
        'reportList': per_report,
    }

    with open(OUT, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f'\nWrote {OUT}:')
    print(json.dumps({k: v for k, v in stats.items() if k not in ('mostSeen', 'bestOuting')}, indent=2))
    print('most seen:', ', '.join(f"{s['commonName']} ({s['outings']})" for s in most_seen))
    print('best outing:', best_outing)


if __name__ == '__main__':
    main()
