// Shared data layer for the "Upcoming Outings" page (with RSVPs) and the Trip Reports
// page. Both read from the same Google Sheet.
//
// How a page load works (see loadOutings below):
//   1. Render right away from the newest of two snapshots: public/outings.json, which the
//      deploy workflow rebuilds from the sheet (fetch_outings.py), or the last live response
//      this browser saw (localStorage).
//   2. Ask the Apps Script web app for the live sheet and re-render with fresh attendees.
//      Apps Script takes 2–5 s on a good day and roughly one request in four hangs 30 s+
//      and fails, which is why step 1 exists.
//
// To go live: deploy the Google Apps Script in apps-script/Code.gs (see RSVP-SETUP.md)
// and paste its web app URL here. While this is empty, the site runs in DEMO MODE:
// sample outings are shown and RSVPs are saved only in this browser's localStorage.
const RSVP_API_URL = 'https://script.google.com/macros/s/AKfycbwb7HEwab7JcERXQbQBcy0LHWShs_GuThpOnniHDzRAeG9ZNNmRV3nF5LUteFwkVW39eA/exec';

export const isDemoMode = !RSVP_API_URL;

const DEMO_RSVP_KEY = 'ybc-demo-rsvps';
export const MY_RSVP_KEY = 'ybc-my-rsvps';

/* ---------------- Demo data (local prototyping only) ---------------- */

// Real past outings, so the timeline looks right locally — including the two that
// don't fit in a single day (Birdathon's 24 hours, owl banding running to midnight).
const DEMO_PAST = [
  { id: 'demo-p1', date: '2026-08-22', time: '7:00 AM – 12:00 PM', title: 'YBC 54: CEDWs feat. Fall Warblers', tripReportUrl: 'https://ebird.org/tripreport/563668' },
  { id: 'demo-p2', date: '2026-08-18', time: '7:00 AM – 12:00 PM', title: 'YBC 53: Tuesdays with Birdmaster Zach', tripReportUrl: 'https://ebird.org/tripreport/561886' },
  { id: 'demo-p3', date: '2026-08-09', time: '7:00 AM – 12:00 PM', title: 'YBC 52: Shorebirding', tripReportUrl: 'https://ebird.org/tripreport/561885' },
  { id: 'demo-p4', date: '2026-07-11', time: '3:00 PM – 8:00 PM', title: 'YBC 49: Fried Pickles', tripReportUrl: 'https://ebird.org/tripreport/549923' },
  { id: 'demo-p5', date: '2026-05-23', time: '4:35 AM – 4:35 AM (24 hours)', title: 'YBC 44: Birdathon 2026', tripReportUrl: 'https://ebird.org/tripreport/528253' },
  { id: 'demo-p6', date: '2025-10-18', time: '6:30 PM – 12:00 AM', title: 'YBC 16', tripReportUrl: 'https://ebird.org/tripreport/424734' },
];

function demoUpcoming() {
  const day = 24 * 60 * 60 * 1000;
  const future = (days) => new Date(Date.now() + days * day).toISOString().slice(0, 10);
  return [
    {
      id: 'demo-1',
      date: future(6),
      time: '8:00 AM – 12:00 PM',
      title: 'Fall Warbler Walk',
      location: 'Ship Harbor Trail, Acadia',
      description: 'Catch the first wave of fall migrants moving down the coast. Loaner binoculars available!',
    },
    {
      id: 'demo-2',
      date: future(16),
      time: '7:30 AM – 1:00 PM',
      title: 'Hawk Watch on Cadillac',
      location: 'Cadillac Mountain Summit',
      description: 'Join the official hawk watch crew to count kestrels, sharpies, and maybe an eagle or two.',
    },
    {
      id: 'demo-3',
      date: future(27),
      time: '9:00 AM – 2:00 PM',
      title: 'Shorebird Scoping',
      location: 'Hadley Point Beach',
      description: 'Low-tide mudflat birding. Scopes provided — great chance to practice plover vs. sandpiper ID.',
    },
  ];
}

// In demo mode the full past-outings list comes from stats.json (which the scraper
// builds from the real sheet), so the Trip Reports page looks complete locally.
async function demoPast() {
  try {
    const stats = await fetch('/stats.json').then((r) => (r.ok ? r.json() : null));
    const reports = stats?.reportList;
    if (Array.isArray(reports) && reports.length) {
      return reports.map((r) => ({
        id: `demo-${r.tripId}`,
        date: r.date,
        title: r.title,
        tripReportUrl: `https://ebird.org/tripreport/${r.tripId}`,
      })).sort((a, b) => (a.date > b.date ? -1 : 1));
    }
  } catch {
    /* fall through to the small built-in list */
  }
  return DEMO_PAST;
}

/* ---------------- Local storage ---------------- */

export function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing — RSVP just won't persist */
  }
}

/* ---------------- Data fetching ---------------- */

const SNAPSHOT_URL = '/outings.json';
const LIVE_CACHE_KEY = 'ybc-outings-cache';
const LIVE_TIMEOUT_MS = 20000;
const LIVE_ATTEMPTS = 2;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Split a flat outing list into { upcoming, past }. Today's outing stays upcoming all day. */
function splitOutings(outings) {
  const today = todayLocal();
  return {
    upcoming: outings.filter((o) => o.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)),
    past: outings.filter((o) => o.date < today).sort((a, b) => (a.date > b.date ? -1 : 1)),
  };
}

function isSnapshot(value) {
  return value && Array.isArray(value.outings) && value.outings.length > 0;
}

/** The newest of the built snapshot and this browser's last live response, or null. */
async function readSnapshot() {
  let built = null;
  try {
    const response = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
    if (response.ok) built = await response.json();
  } catch {
    /* no snapshot deployed yet */
  }
  const candidates = [readStore(LIVE_CACHE_KEY), built].filter(isSnapshot);
  if (!candidates.length) return null;
  candidates.sort((a, b) => ((b.fetchedAt || '') > (a.fetchedAt || '') ? 1 : -1));
  return candidates[0].outings;
}

function writeLiveCache(outings) {
  writeStore(LIVE_CACHE_KEY, { fetchedAt: new Date().toISOString(), outings });
}

async function fetchLiveOnce() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = await fetch(RSVP_API_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Outings request failed (${response.status})`);
    const data = await response.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Failed to fetch outings');
    return [...(data.upcoming || []), ...(data.past || [])];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLive() {
  if (isDemoMode) {
    const saved = readStore(DEMO_RSVP_KEY);
    return [...demoUpcoming(), ...(await demoPast())].map((o) => ({ ...o, attendees: saved[o.id] || [] }));
  }
  let lastError;
  for (let attempt = 0; attempt < LIVE_ATTEMPTS; attempt++) {
    try {
      const outings = await fetchLiveOnce();
      writeLiveCache(outings);
      return outings;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Load outings for a page. `render({ upcoming, past }, { live })` is called once with
 * the fastest data available (a snapshot, live: false) and again when the live sheet
 * answers (live: true). Resolves with the last data rendered; rejects only if nothing
 * at all could be loaded.
 */
export async function loadOutings(render) {
  let shown = null;
  if (!isDemoMode) {
    const snapshot = await readSnapshot();
    if (snapshot) {
      shown = splitOutings(snapshot);
      render(shown, { live: false });
    }
  }
  try {
    const live = splitOutings(await fetchLive());
    render(live, { live: true });
    return live;
  } catch (error) {
    if (!shown) throw error;
    console.warn('Live outings unavailable, showing the last known list:', error);
    return shown;
  }
}

/**
 * Record an RSVP change in this browser's cached copy, so the page can show it
 * immediately even if the next live fetch fails. The sheet itself was already updated
 * by sendRsvp.
 */
export function applyLocalRsvp(action, outingId, name) {
  const cached = readStore(LIVE_CACHE_KEY);
  if (!isSnapshot(cached)) return;
  const outings = cached.outings.map((o) => {
    if (o.id !== outingId) return o;
    const attendees = (o.attendees || []).filter((n) => n !== name);
    if (action === 'rsvp') attendees.push(name);
    return { ...o, attendees };
  });
  writeLiveCache(outings);
}

export async function sendRsvp(action, outingId, name) {
  if (isDemoMode) {
    const saved = readStore(DEMO_RSVP_KEY);
    const list = saved[outingId] || [];
    if (action === 'rsvp' && !list.includes(name)) list.push(name);
    saved[outingId] = action === 'cancel' ? list.filter((n) => n !== name) : list;
    writeStore(DEMO_RSVP_KEY, saved);
    return;
  }
  // Content-Type text/plain keeps the request "simple" so Apps Script
  // accepts it without a CORS preflight. Apps Script fails transiently, and an RSVP
  // is idempotent (names are deduplicated in the sheet), so a failed attempt is retried.
  let lastError;
  for (let attempt = 0; attempt < LIVE_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    try {
      const response = await fetch(RSVP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, outingId, name }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`RSVP request failed (${response.status})`);
      const data = await response.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Failed to save RSVP');
      return;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/* ---------------- Shared helpers ---------------- */

export function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Parse a YYYY-MM-DD sheet date as local noon, so no timezone can shift the day. */
export function parseDate(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return isNaN(date) ? null : date;
}

export function formatDateParts(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return { month: '', day: '', weekday: '' };
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.toLocaleDateString('en-US', { day: 'numeric' }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

export function formatShortDate(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
