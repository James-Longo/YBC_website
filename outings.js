// Shared data layer for both outings sections: "Upcoming Outings" (with RSVPs)
// and the "Past Outings" timeline. Both read from the same Google Sheet.
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

// Both sections render from one request; the second caller reuses this promise.
let pending = null;

export function getOutings({ refresh = false } = {}) {
  if (refresh) pending = null;
  if (!pending) {
    pending = fetchOutings().catch((error) => {
      pending = null; // let a later call retry
      throw error;
    });
  }
  return pending;
}

async function fetchOutings() {
  if (isDemoMode) {
    const saved = readStore(DEMO_RSVP_KEY);
    return {
      upcoming: demoUpcoming().map((o) => ({ ...o, attendees: saved[o.id] || [] })),
      past: (await demoPast()).map((o) => ({ ...o, attendees: saved[o.id] || [] })),
    };
  }
  const response = await fetch(RSVP_API_URL);
  if (!response.ok) throw new Error('Failed to fetch outings');
  const data = await response.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Failed to fetch outings');
  return { upcoming: data.upcoming || [], past: data.past || [] };
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
  // accepts it without a CORS preflight.
  const response = await fetch(RSVP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, outingId, name }),
  });
  if (!response.ok) throw new Error('Failed to save RSVP');
  const data = await response.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Failed to save RSVP');
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
