// ui/panel.js
// Responsible for showing/hiding the explanation panel and filling it with scan results.

// Load panel HTML if not already inserted
async function ensurePanelElement() {
  let panel = document.getElementById('cs-panel');
  if (panel) return panel;

  // fetch the markup and append to body
  try {
    const resp = await fetch(chrome.runtime.getURL('ui/panel.html'));
    const text = await resp.text();
    const container = document.createElement('div');
    container.innerHTML = text;
    document.body.appendChild(container);
    panel = document.getElementById('cs-panel');
    bindClose(panel);
    return panel;
  } catch (err) {
    console.error('Failed to load panel.html', err);
    return null;
  }
}

function bindClose(panel) {
  const btn = panel.querySelector('#closeBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      closePanel();
    });
  }
}

function setRiskLabel(panel, risk) {
  const span = panel.querySelector('#riskLabel');
  if (!span) return;
  span.textContent = risk || '';
  span.className = '';
  if (risk) {
    span.classList.add(`risk-${risk.toLowerCase()}`);
  }
}

function populateExplanation(panel, reasons) {
  const div = panel.querySelector('#explanation');
  if (!div) return;
  div.innerHTML = '';
  if (Array.isArray(reasons) && reasons.length) {
    const formatted = typeof window.formatExplanation === 'function'
      ? window.formatExplanation(reasons)
      : reasons;
    formatted.forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      div.appendChild(p);
    });
  }
}

function populateLinks(panel, links) {
  const div = panel.querySelector('#links');
  if (!div) return;
  div.innerHTML = '';
  if (Array.isArray(links) && links.length) {
    const list = document.createElement('ul');
    links.forEach(l => {
      const li = document.createElement('li');
      li.textContent = l;
      list.appendChild(li);
    });
    const header = document.createElement('strong');
    header.textContent = 'Suspicious links:';
    div.appendChild(header);
    div.appendChild(list);
  }
}

async function renderPanel(result) {
  if (!result) return;
  const panel = await ensurePanelElement();
  if (!panel) return;

  setRiskLabel(panel, result.risk);
  populateExplanation(panel, result.reasons);
  populateLinks(panel, result.links);

  panel.style.display = 'block';
}

function closePanel() {
  const panel = document.getElementById('cs-panel');
  if (panel) {
    panel.style.display = 'none';
  }
  if (typeof window.clearHighlights === 'function') {
    window.clearHighlights();
  }
}

// Expose renderPanel globally so content scripts can call it without imports.
window.renderPanel = renderPanel;
