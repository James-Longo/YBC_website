const SHEET_ID = '1oamD7Oe2jOW4THfBWxeTIfK25MN7CdXxZhLn6ebmlJQ';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
let ebirdCache = {};

async function loadCache() {
  try {
    const response = await fetch('./ebird_metadata.json');
    if (response.ok) {
      ebirdCache = await response.json();
    }
  } catch (e) {
    console.warn('Metadata cache not found.');
  }
}

async function fetchData() {
  await loadCache();
  const timeline = document.getElementById('timeline');
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const data = await response.text();
    const results = Papa.parse(data, { header: true, skipEmptyLines: true });
    
    // Enroll and sort (Newest first)
    const reports = results.data
      .filter(row => row.Name && !row.Name.includes('#Social'))
      .map(row => {
        const cacheEntry = ebirdCache[row.Link] || ebirdCache[row.Link.replace(/\/$/, '')] || { date: 'Recent' };
        return { ...row, meta: cacheEntry };
      })
      .sort((a, b) => {
        const dateA = new Date(a.meta.date);
        const dateB = new Date(b.meta.date);
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      });

    if (reports.length > 0) {
      timeline.innerHTML = '';
      reports.forEach(report => {
        const item = document.createElement('a');
        item.href = report.Link;
        item.target = '_blank';
        item.className = 'timeline-item';
        
        item.innerHTML = `
          <div class="timeline-date">${report.meta.date || 'Recent Visit'}</div>
          <div class="timeline-content">
            <h3>${report.Name}</h3>
            <p>View the field checklist and sightings from this trip on eBird.</p>
          </div>
        `;
        timeline.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    timeline.innerHTML = '<p>Check back soon for more reports.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  
  // Horizontal scroll support for timeline
  const timeline = document.getElementById('timeline');
  if (timeline) {
    timeline.addEventListener('wheel', (evt) => {
      evt.preventDefault();
      timeline.scrollLeft += evt.deltaY;
    });
  }
});
