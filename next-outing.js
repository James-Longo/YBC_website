// Fills the "next outing" card in the home page's stats panel. Falls back to the most
// recent trip report when nothing is on the calendar.
import { loadOutings, esc, formatDateParts } from './outings.js';

function render({ upcoming, past }) {
  const card = document.getElementById('next-outing');
  if (!card) return;

  const next = upcoming[0];
  const latest = past.find((o) => o.tripReportUrl);
  const outing = next || latest;
  if (!outing) {
    card.hidden = true;
    return;
  }

  const { month, day, weekday } = formatDateParts(outing.date);
  const metaLines = next
    ? [[weekday, outing.time], [outing.location && `📍 ${outing.location}`]]
    : [[weekday, 'See what we found →']];

  card.href = next ? '/rsvp/' : outing.tripReportUrl;
  if (next) {
    card.removeAttribute('target');
    card.removeAttribute('rel');
  } else {
    card.target = '_blank';
    card.rel = 'noopener';
  }
  card.innerHTML = `
    <div class="next-outing-date" aria-hidden="true">
      <span class="next-outing-month">${esc(month)}</span>
      <span class="next-outing-day">${esc(day)}</span>
    </div>
    <div class="next-outing-body">
      <div class="next-outing-label">${next ? 'Next Outing' : 'Latest Trip Report'}</div>
      <div class="next-outing-title">${esc(outing.title)}</div>
      ${metaLines
        .map((parts) => parts.filter(Boolean).map(esc).join(' · '))
        .filter(Boolean)
        .map((line) => `<div class="next-outing-meta">${line}</div>`)
        .join('')}
    </div>`;
  card.hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
  loadOutings(render).catch((error) => console.error('Next outing loading error:', error));
});
