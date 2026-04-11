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
      reports.forEach((report, index) => {
        const node = document.createElement('div');
        node.className = `timeline-node ${index === 0 ? 'active' : ''}`;
        
        node.innerHTML = `
          <div class="node-card">
            <span class="node-date">${report.meta.date || 'Recent Visit'}</span>
            <h3>${report.Name}</h3>
          </div>
          <div class="dot"></div>
        `;
        
        node.addEventListener('click', () => {
          window.open(report.Link, '_blank');
        });
        
        timeline.appendChild(node);
      });
      
      // Setup focus observer
      setupFocusObserver();
    }
  } catch (error) {
    console.error('Error:', error);
    timeline.innerHTML = '<p>Check back soon for more reports.</p>';
  }
}

function setupFocusObserver() {
  const timeline = document.getElementById('timeline');
  const items = document.querySelectorAll('.timeline-node');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // Toggle 'active' class based on intersection with the center strip
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      } else {
        entry.target.classList.remove('active');
      }
    });
  }, {
    root: timeline,
    threshold: 0, 
    rootMargin: '0px -48% 0px -48%' // extremely tight center line for mobile precision
  });

  items.forEach(item => observer.observe(item));
}

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  
  // Horizontal scroll support for timeline
  const timeline = document.getElementById('timeline');
  if (timeline) {
    timeline.addEventListener('wheel', (evt) => {
      if (evt.deltaY !== 0) {
        evt.preventDefault();
        timeline.scrollLeft += evt.deltaY;
      }
    }, { passive: false });

    // Click-and-Hold Navigation
    const prevBtn = document.getElementById('scroll-prev');
    const nextBtn = document.getElementById('scroll-next');
    let scrollInterval;
    let mouseDownTime;

    const startContinuousScroll = (direction) => {
      stopScrolling();
      scrollInterval = setInterval(() => {
        timeline.scrollBy({ left: direction * 1, behavior: 'auto' });
      }, 16);
    };

    const stopScrolling = () => {
      clearInterval(scrollInterval);
      scrollInterval = null;
    };

    [prevBtn, nextBtn].forEach(btn => {
      const direction = btn.id === 'scroll-prev' ? -1 : 1;
      
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mouseDownTime = Date.now();
        // Delay continuous scroll start slightly
        setTimeout(() => {
          if (mouseDownTime) startContinuousScroll(direction);
        }, 200);
      });

      btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        const elapsed = Date.now() - mouseDownTime;
        mouseDownTime = null;
        stopScrolling();

        // If it was a quick tap, do a discrete jump
        if (elapsed < 200) {
          timeline.scrollBy({ left: direction * 210, behavior: 'smooth' });
        }
      });
      
      btn.addEventListener('mouseleave', () => {
        mouseDownTime = null;
        stopScrolling();
      });
    });
  }
});
