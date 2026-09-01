// Renders the "Upcoming Outings" section and handles RSVPs.
import {
  getOutings,
  sendRsvp,
  readStore,
  writeStore,
  esc,
  formatDateParts,
  MY_RSVP_KEY,
} from './outings.js';

function renderOutings(outings) {
  const list = document.getElementById('outings-list');
  if (!list) return;

  if (!outings.length) {
    list.innerHTML = '<p class="outings-empty">No outings on the calendar right now — check back soon!</p>';
    return;
  }

  const myRsvps = readStore(MY_RSVP_KEY);
  list.innerHTML = outings.map((outing) => outingCard(outing, myRsvps[outing.id])).join('');

  list.querySelectorAll('form.rsvp-form').forEach((form) => {
    form.addEventListener('submit', onRsvpSubmit);
  });
  list.querySelectorAll('.rsvp-cancel').forEach((btn) => {
    btn.addEventListener('click', onCancelClick);
  });
}

function outingCard(outing, myName) {
  const { month, day, weekday } = formatDateParts(outing.date);
  const attendees = outing.attendees || [];
  const going = myName && attendees.includes(myName);

  const chips = attendees.length
    ? `<div class="attendee-chips">${attendees.map((n) => `<span class="attendee-chip">🐦 ${esc(n)}</span>`).join('')}</div>`
    : '<p class="attendee-none">No one has signed up yet — be the first!</p>';

  const action = going
    ? `<div class="rsvp-done">
         <span>✓ You're signed up, ${esc(myName)}!</span>
         <button type="button" class="rsvp-cancel" data-outing="${esc(outing.id)}" data-name="${esc(myName)}">Can't make it anymore?</button>
       </div>`
    : `<form class="rsvp-form" data-outing="${esc(outing.id)}">
         <input type="text" name="name" placeholder="Name" maxlength="40" required />
         <button type="submit">I'm going!</button>
       </form>`;

  const meta = [weekday, outing.time, outing.location && `📍 ${outing.location}`]
    .filter(Boolean)
    .map(esc)
    .join(' · ');

  return `
    <article class="outing-card">
      <div class="outing-date" aria-hidden="true">
        <span class="outing-month">${esc(month)}</span>
        <span class="outing-day">${esc(day)}</span>
      </div>
      <div class="outing-body">
        <h3>${esc(outing.title)}</h3>
        <p class="outing-meta">${meta}</p>
        ${outing.description ? `<p class="outing-desc">${esc(outing.description)}</p>` : ''}
        <div class="outing-attendees">
          <span class="attendee-count">${attendees.length} going</span>
          ${chips}
        </div>
        ${action}
      </div>
    </article>`;
}

/* ---------------- Event handlers ---------------- */

async function onRsvpSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const outingId = form.dataset.outing;
  // Commas are stripped because names are stored comma-separated in the sheet.
  const name = form.elements.name.value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return;

  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Saving…';

  try {
    await sendRsvp('rsvp', outingId, name);
    const myRsvps = readStore(MY_RSVP_KEY);
    myRsvps[outingId] = name;
    writeStore(MY_RSVP_KEY, myRsvps);
    await loadUpcoming({ refresh: true });
  } catch (error) {
    console.error('RSVP error:', error);
    button.disabled = false;
    button.textContent = "I'm going!";
    alert("Sorry, we couldn't save your RSVP. Please try again.");
  }
}

async function onCancelClick(event) {
  const button = event.currentTarget;
  const { outing, name } = button.dataset;
  button.disabled = true;

  try {
    await sendRsvp('cancel', outing, name);
    const myRsvps = readStore(MY_RSVP_KEY);
    delete myRsvps[outing];
    writeStore(MY_RSVP_KEY, myRsvps);
    await loadUpcoming({ refresh: true });
  } catch (error) {
    console.error('Cancel error:', error);
    button.disabled = false;
  }
}

/* ---------------- Init ---------------- */

async function loadUpcoming(options) {
  const list = document.getElementById('outings-list');
  if (!list) return;
  try {
    const { upcoming } = await getOutings(options);
    renderOutings(upcoming);
  } catch (error) {
    console.error('Outings loading error:', error);
    list.innerHTML = '<p class="outings-empty">Check back soon for upcoming outings.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => loadUpcoming());
