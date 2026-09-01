"""
Snapshot the outings sheet to public/outings.json.

The website renders this file instantly, then asks the Apps Script web app for the live
sheet in the background (see outings.js). Apps Script takes 2–5 s on a good day and
hangs for 30 s+ then fails roughly one request in four, so the snapshot is what keeps
the Upcoming Outings and Trip Reports pages from showing a blank list.

The deploy workflow runs this before every build; the committed copy is the fallback
when Apps Script is down at build time. Run by hand with:

    python3 fetch_outings.py
"""

import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

OUT = 'public/outings.json'
ATTEMPTS = 5
TIMEOUT = 90  # a failing Apps Script request hangs ~30–70 s before answering


def api_url():
    source = open('outings.js').read()
    match = re.search(r"RSVP_API_URL = '([^']+)'", source)
    if not match or not match.group(1):
        sys.exit('RSVP_API_URL is not set in outings.js')
    return match.group(1)


def fetch(url):
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main():
    url = api_url()
    last_error = None
    for attempt in range(1, ATTEMPTS + 1):
        started = time.time()
        try:
            data = fetch(url)
            if data.get('status') != 'ok':
                raise ValueError(data.get('message') or 'Apps Script returned an error')
            outings = list(data.get('upcoming') or []) + list(data.get('past') or [])
            if not outings:
                raise ValueError('Apps Script returned no outings')
            break
        except Exception as e:  # noqa: BLE001 — Apps Script fails transiently; retry anything
            last_error = e
            print(f'attempt {attempt} failed after {time.time() - started:.0f}s: {e}', file=sys.stderr)
            time.sleep(3)
    else:
        sys.exit(f'Could not fetch outings after {ATTEMPTS} attempts: {last_error}')

    snapshot = {
        'fetchedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'outings': outings,
    }
    with open(OUT, 'w') as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
        f.write('\n')
    upcoming = len(data.get('upcoming') or [])
    print(f'Wrote {OUT}: {len(outings)} outings ({upcoming} upcoming) in {time.time() - started:.1f}s')


if __name__ == '__main__':
    main()
