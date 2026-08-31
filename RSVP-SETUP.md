# Outings — how it works & how to go live

One Google Sheet now powers both outings sections of the website:

- **Upcoming Outings** — cards with an "I'm going!" RSVP form and the list of who's coming.
- **Trip Reports** (`/trip-reports/`) — every past outing, linking to its eBird trip report.

An outing moves from one section to the other automatically the day after its date
(today's outing stays under Upcoming through the end of the day).

## Files

| File | What it does |
|---|---|
| `outings.js` | Shared data layer — holds `RSVP_API_URL`, fetches once for both sections |
| `rsvp.js` | Renders Upcoming Outings + RSVP handling |
| `reports.js` + `trip-reports/index.html` | The Trip Reports page (`/trip-reports/`), every past outing in eBird's list style |
| `apps-script/Code.gs` | The Google Apps Script backend (paste into the sheet) |
| `stats.js` + `public/stats.json` | The "Club Stats" panel; regenerate the JSON with `python3 scrape_ebird.py` after adding a trip report |

**Live since 2026-08-31.** `RSVP_API_URL` in `outings.js` points at the deployed Apps
Script, so the site reads the "YBC outing planner (Responses)" sheet on every page load.
(Set it to `''` to fall back to demo mode: sample outings, RSVPs saved only in the browser.)

## The workflow once live

- **Create an outing**: submit your Google Form (date, start/end time, title, location,
  description). It appears under Upcoming Outings automatically.
- **RSVPs**: signups land in that row's `attending` cell, comma-separated — open the sheet
  to see at a glance who's coming to what. Canceling on the site removes the name.
- **After the outing**: it moves to the Past Outings timeline on its own. Add the
  `trip report link` whenever it's ready; until then the card shows "Report coming soon"
  and isn't clickable.
- **Editing**: you can freely edit an outing's title, date, times, etc. — see the note on
  IDs below. To remove an outing entirely, delete its row.

## Going live (~5 minutes, no server)

1. In the responses spreadsheet: **Extensions → Apps Script**. Delete the sample code and
   paste in the contents of `apps-script/Code.gs` (your spreadsheet ID is already set).

2. **Deploy → New deployment** → gear icon → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, authorize when prompted, and copy the URL ending in `/exec`.

3. Paste that URL into `RSVP_API_URL` at the top of `outings.js`, then build and push.

If you later edit the script, use Deploy → **Manage deployments** → pencil icon →
new version. (A brand-new deployment would change the URL.)

## How outings are identified

RSVPs attach to an outing by ID, which comes from one of two places:

- **Form-created outings** use the submission `Timestamp`. It never changes, so you can
  rename or reschedule the outing freely without losing RSVPs — just don't edit the
  Timestamp cell itself.
- **Hand-pasted rows** (like the 54 historical outings, which have no Timestamp) fall back
  to date + title. Editing either of those on such a row detaches its RSVPs — harmless for
  past outings, which have none, but worth knowing if you ever hand-add a *future* outing
  instead of using the form.

## Odd schedules

The backend handles the outings that don't fit neatly in one day:

| In the sheet | On the site |
|---|---|
| `4:35 AM` → `4:35 AM` | `4:35 AM – 4:35 AM (24 hours)` — the Birdathon |
| `6:30 PM` → `12:00 AM` | `6:30 PM – 12:00 AM` — owl banding ending at midnight |
| `6:30 PM` → `1:30 AM` | `6:30 PM – 1:30 AM (next day)` |
| end time left blank | just the start time |

Times are read in the **spreadsheet's** timezone, and a plain-text date like `6/23/2025`
is normalized the same as a real date value — so neither a stray cell format nor a
timezone mismatch can shift an outing to the wrong day.

## Notes

- **Privacy**: attendee names are publicly visible on the site. The form asks for
  "First name + last initial" to keep it friendly for a youth club — worth confirming
  that's what you want before going live.
- **Abuse**: anyone can submit a name (no accounts). For a small club that's usually fine;
  edit the `attending` cell directly to remove anything junky.
- Commas are stripped from submitted names (they'd break the comma-separated list), names
  are deduplicated per outing, and the script takes a lock while writing so simultaneous
  signups can't clobber each other.
- The sheet is currently **editable by anyone with the link**. The site doesn't need that
  — the script reads the sheet as you — so consider setting sharing back to restricted.
