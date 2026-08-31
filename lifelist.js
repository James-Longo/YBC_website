// Renders the Club Life List page: every species from public/stats.json, with the
// date and outing it was first recorded on, in eBird's life-list style.
import { esc } from './outings.js';

let lifeList = [];

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function row(species, number) {
  return `
    <li class="life-row">
      <span class="life-num">${number}</span>
      <span class="life-species">
        <a href="https://ebird.org/species/${esc(species.code)}" target="_blank" rel="noopener">
          <span class="life-name">${esc(species.name)}</span>
        </a>
      </span>
      <span class="life-date">${esc(formatDate(species.date))}</span>
      <span class="life-outing">
        <a href="https://ebird.org/tripreport/${esc(species.tripId)}" target="_blank" rel="noopener">${esc(species.outing)}</a>
      </span>
    </li>`;
}

function render(sortMode) {
  const list = document.getElementById('life-list');
  if (!list) return;

  // The scraper emits the list in first-seen order, so "oldest" is the natural
  // order and the row number is each species' position on the club list.
  const numbered = lifeList.map((species, index) => ({ species, number: index + 1 }));
  if (sortMode === 'newest') numbered.reverse();
  if (sortMode === 'alphabetic') numbered.sort((a, b) => a.species.name.localeCompare(b.species.name));

  list.innerHTML = numbered.map(({ species, number }) => row(species, number)).join('');
}

async function load() {
  const list = document.getElementById('life-list');
  const count = document.getElementById('life-count');
  const sortSelect = document.getElementById('life-sort-select');
  if (!list) return;

  try {
    const stats = await fetch('/stats.json').then((r) => {
      if (!r.ok) throw new Error('Failed to fetch stats');
      return r.json();
    });
    lifeList = stats.lifeList || [];
    if (count) count.textContent = lifeList.length.toLocaleString('en-US');
    render(sortSelect?.value || 'newest');
    sortSelect?.addEventListener('change', () => render(sortSelect.value));
  } catch (error) {
    console.error('Life list loading error:', error);
    list.innerHTML = '<li class="reports-loading">Check back soon for the club life list.</li>';
  }
}

document.addEventListener('DOMContentLoaded', load);
