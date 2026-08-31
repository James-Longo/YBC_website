/**
 * YBC Outings backend — Google Apps Script web app.
 *
 * Powers BOTH sections of the website from one sheet:
 *   - "Upcoming Outings" (with RSVPs)
 *   - "Past Outings" (the trip report timeline)
 *
 * Sheet columns:
 *   Timestamp | date | start time | end time | title | location | description
 *   | trip report link | attending
 *
 * - New outings are created by submitting the Google Form; past outings that were
 *   pasted in by hand (no Timestamp) work fine too — see outingIdFor below.
 * - RSVP names are written into the "attending" cell, comma-separated.
 * - An outing moves from Upcoming to Past automatically the day after its date.
 *
 * Deploy: Extensions > Apps Script > paste this file > Deploy > New deployment
 *   type "Web app", execute as Me, access "Anyone". Copy the /exec URL into
 *   RSVP_API_URL in outings.js. See RSVP-SETUP.md for the step-by-step.
 */

var SPREADSHEET_ID = '13B3nwUtvuE6ULHSFEBleg7KUbScN-BvdoqLQwfBvPLk';

function doGet() {
  var table = readTable();
  var today = Utilities.formatDate(new Date(), table.tz, 'yyyy-MM-dd');

  var all = table.rows
    .map(function (row) { return rowToOuting(row, table.col, table.tz); })
    .filter(Boolean);

  // Today's outing stays under "Upcoming" through the end of the day.
  var upcoming = all.filter(function (o) { return o.date >= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var past = all.filter(function (o) { return o.date < today; })
    .sort(function (a, b) { return a.date > b.date ? -1 : 1; });

  return jsonResponse({ status: 'ok', upcoming: upcoming, past: past });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var action = String(body.action || '');
    var outingId = String(body.outingId || '');
    // Names are stored comma-separated in one cell, so commas can't be allowed.
    var name = String(body.name || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

    if (!outingId || !name || (action !== 'rsvp' && action !== 'cancel')) {
      return jsonResponse({ status: 'error', message: 'Invalid request' });
    }

    var table = readTable();
    var rowIndex = -1;
    for (var i = 0; i < table.rows.length; i++) {
      var outing = rowToOuting(table.rows[i], table.col, table.tz);
      if (outing && outing.id === outingId) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) {
      return jsonResponse({ status: 'error', message: 'Outing not found' });
    }

    var names = parseAttending(table.rows[rowIndex][table.col('attending')]);
    if (action === 'rsvp' && names.indexOf(name) === -1) names.push(name);
    if (action === 'cancel') {
      names = names.filter(function (n) { return n !== name; });
    }

    // +2: one for the header row, one because ranges are 1-based.
    table.sheet.getRange(rowIndex + 2, table.col('attending') + 1).setValue(names.join(', '));

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Locate the form-responses tab by its headers and return rows + column lookup. */
function readTable() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var values = sheets[i].getDataRange().getValues();
    if (!values.length) continue;
    var headers = values[0].map(function (h) { return String(h).toLowerCase().trim(); });
    if (headers.indexOf('title') !== -1 && headers.indexOf('date') !== -1) {
      return {
        sheet: sheets[i],
        rows: values.slice(1),
        // Times come back in the spreadsheet's timezone, not the script's.
        tz: ss.getSpreadsheetTimeZone(),
        col: function (name) { return headers.indexOf(name); },
      };
    }
  }
  throw new Error('Could not find a tab with date and title columns');
}

function rowToOuting(row, col, tz) {
  var title = cell(row[col('title')]);
  var date = formatDate(row[col('date')], tz);
  if (!title || !date) return null;

  return {
    id: outingIdFor(row[col('timestamp')], date, title),
    date: date,
    time: formatTimeRange(formatTime(row[col('start time')], tz), formatTime(row[col('end time')], tz)),
    title: title,
    location: cell(row[col('location')]),
    description: cell(row[col('description')]),
    tripReportUrl: cell(row[col('trip report link')]),
    attendees: parseAttending(row[col('attending')]),
  };
}

/**
 * Stable per-outing ID that RSVPs hang off of.
 *
 * Form-created outings use the submission Timestamp, which never changes — so you
 * can rename or reschedule them freely. Rows pasted in by hand have no Timestamp,
 * so they fall back to date + title; editing either of those on such a row would
 * detach its RSVPs (fine for past outings, which have none).
 */
function outingIdFor(timestamp, date, title) {
  if (timestamp instanceof Date) return 't' + timestamp.getTime();
  var raw = cell(timestamp);
  if (raw) return 't' + raw;
  return 'd' + date + '|' + title;
}

function parseAttending(value) {
  return cell(value)
    .split(',')
    .map(function (n) { return n.trim(); })
    .filter(Boolean);
}

/** Null-safe cell read. Also handles a column that isn't in the sheet (index -1). */
function cell(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function formatDate(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  var text = cell(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // A date column formatted as plain text still has to reach the site as ISO —
  // past/upcoming is decided by comparing these strings.
  var parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (parts) return parts[3] + '-' + pad2(parts[1]) + '-' + pad2(parts[2]);
  return text;
}

function pad2(value) {
  return String(value).length < 2 ? '0' + value : String(value);
}

function formatTime(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'h:mm a');
  // A time-formatted cell can come back as a fraction of a day; midnight is 0,
  // which a plain truthiness check would throw away.
  if (typeof value === 'number') return formatMinutes(Math.round(value * 1440));
  // Sheets renders times as "6:30:00 PM"; drop the seconds.
  return cell(value).replace(/^(\d{1,2}):(\d{2}):\d{2}(\s*[AaPp][Mm])?$/, '$1:$2$3');
}

function formatMinutes(totalMinutes) {
  var mins = ((totalMinutes % 1440) + 1440) % 1440;
  var hour24 = Math.floor(mins / 60);
  var minute = mins % 60;
  var hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return hour12 + ':' + (minute < 10 ? '0' : '') + minute + ' ' + (hour24 < 12 ? 'AM' : 'PM');
}

/**
 * Build the display string, handling the outings that don't fit in one day:
 * a Birdathon runs a full 24 hours (same start and end), and owl banding runs
 * past midnight (end reads earlier than start).
 */
function formatTimeRange(start, end) {
  if (!start && !end) return '';
  if (!start) return end;
  if (!end) return start;
  if (start === end) return start + ' – ' + end + ' (24 hours)';
  if (crossesMidnight(start, end)) return start + ' – ' + end + ' (next day)';
  return start + ' – ' + end;
}

function crossesMidnight(start, end) {
  var startMins = parseMinutes(start);
  var endMins = parseMinutes(end);
  if (startMins === null || endMins === null) return false;
  // Midnight as an end time means the end of the same evening, not the next.
  if (endMins === 0) return false;
  return endMins < startMins;
}

function parseMinutes(text) {
  var match = /^(\d{1,2}):(\d{2})\s*([AaPp])?/.exec(String(text).trim());
  if (!match) return null;
  var hour = parseInt(match[1], 10) % 12;
  if (match[3] && match[3].toLowerCase() === 'p') hour += 12;
  return hour * 60 + parseInt(match[2], 10);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
