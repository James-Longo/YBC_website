const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1oamD7Oe2jOW4THfBWxeTIfK25MN7CdXxZhLn6ebmlJQ/export?format=csv';

async function fetchData() {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const data = await response.text();
    
    Papa.parse(data, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const reports = results.data
          .filter(row => {
            const keys = Object.keys(row);
            const titleKey = keys.find(k => k.toLowerCase() === 'title' || k.toLowerCase() === 'name');
            const urlKey = keys.find(k => k.toLowerCase() === 'url' || k.toLowerCase() === 'link');
            return row[titleKey] && row[urlKey];
          })
          .map(row => {
            const keys = Object.keys(row);
            const titleKey = keys.find(k => k.toLowerCase() === 'title' || k.toLowerCase() === 'name');
            const urlKey = keys.find(k => k.toLowerCase() === 'url' || k.toLowerCase() === 'link');
            const dateKey = keys.find(k => k.toLowerCase() === 'date');
            
            return {
              title: row[titleKey],
              url: row[urlKey],
              date: row[dateKey] || 'Recent'
            };
          })
          .sort((a, b) => {
             const dateA = new Date(a.date);
             const dateB = new Date(b.date);
             if (isNaN(dateA)) return 1;
             if (isNaN(dateB)) return -1;
             return dateB - dateA;
          });
          
        renderTimeline(reports);
      }
    });
  } catch (error) {
    console.error('Data loading error:', error);
    timeline.innerHTML = '<p>Check back soon for latest reports.</p>';
  }
}

function renderTimeline(reports) {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';

  reports.forEach((report, index) => {
    const node = document.createElement('div');
    node.className = `timeline-node ${index === 0 ? 'active' : ''}`;
    
    node.innerHTML = `
      <div class="node-content">
        <a href="${report.url}" target="_blank" class="node-card">
          <span class="node-date">${report.date}</span>
          <h3>${report.title}</h3>
        </a>
        <div class="dot"></div>
      </div>
    `;
    timeline.appendChild(node);
  });

  setupFocusObserver();
}

function setupFocusObserver() {
  const timeline = document.getElementById('timeline');
  const items = document.querySelectorAll('.timeline-node');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      } else {
        entry.target.classList.remove('active');
      }
    });
  }, {
    root: timeline,
    threshold: 0,
    rootMargin: '0px -48% 0px -48%'
  });

  items.forEach(item => observer.observe(item));
}

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  
  const timeline = document.getElementById('timeline');
  if (timeline) {
    const prevBtn = document.getElementById('scroll-prev');
    const nextBtn = document.getElementById('scroll-next');
    
    let scrollInterval;
    const scrollSpeed = 5; 
    const jumpSize = 250;

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        timeline.scrollBy({ left: -210, behavior: 'smooth' });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        timeline.scrollBy({ left: 210, behavior: 'smooth' });
      });
    }
  }
});
