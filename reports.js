// Renders the Trip Reports page: every past outing, newest first, in eBird's
// "My Trip Reports" list style, with per-report numbers from public/stats.json.
import { getOutings, esc, parseDate } from './outings.js';

function formatListDate(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tripIdFrom(url) {
  const match = /ebird\.org\/tripreport\/(\d+)/.exec(url || '');
  return match ? match[1] : null;
}

function reportRow(outing, reportStats) {
  const tripId = tripIdFrom(outing.tripReportUrl);
  const stats = tripId && reportStats[tripId];
  const badge = stats
    ? `<span class="report-badge">${esc(String(stats.species))} species · ${esc(String(stats.checklists))} ${stats.checklists === 1 ? 'checklist' : 'checklists'}</span>`
    : outing.tripReportUrl
      ? '<span class="report-badge">eBird checklist</span>'
      : '<span class="report-badge report-badge--pending">Report coming soon</span>';

  const title = outing.tripReportUrl
    ? `<a href="${esc(outing.tripReportUrl)}" target="_blank" rel="noopener">${esc(outing.title)}</a>`
    : `<span class="report-title-pending">${esc(outing.title)}</span>`;

  return `
    <li>
      <div class="report-row">
        <h2 class="report-title">${title}</h2>
        <time class="report-time" datetime="${esc(outing.date)}">${esc(formatListDate(outing.date))}</time>
        ${badge}
      </div>
    </li>`;
}

async function loadReports() {
  const list = document.getElementById('reports-list');
  const count = document.getElementById('reports-count');
  if (!list) return;

  try {
    const [{ past }, reportStats] = await Promise.all([
      getOutings(),
      fetch('/stats.json').then((r) => (r.ok ? r.json() : {})).then((s) => s.reports || {}).catch(() => ({})),
    ]);

    if (count) count.textContent = past.length.toLocaleString('en-US');
    list.innerHTML = past.length
      ? past.map((o) => reportRow(o, reportStats)).join('')
      : '<li class="reports-loading">No trip reports yet — check back after our first outing!</li>';
  } catch (error) {
    console.error('Trip reports loading error:', error);
    list.innerHTML = '<li class="reports-loading">Check back soon for trip reports.</li>';
  }
}

document.addEventListener('DOMContentLoaded', loadReports);
