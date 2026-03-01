console.log("✅ CampusShield panel loaded");

// Mark panel origin for easier debugging/integration
const rootPanel = document.getElementById("cs-panel");
if (rootPanel) {
  rootPanel.dataset.origin = "campusshield";
  rootPanel.classList.add("campusshield-panel");
}

// Queue for messages that arrive before DOM is ready
let pendingResult = null;
let isScanning = false;

/* ================== DRAGGING & PERSISTENCE ================== */
/**
 * Make panel draggable and persist position to chrome.storage.local
 * Uses mousedown/mousemove/mouseup events (not pointer events)
 * @param {element} panelEl - The main panel element
 * @param {element} handleEl - The header element (drag handle)
 */
function makePanelDraggable(panelEl, handleEl) {
  if (!panelEl || !handleEl) return;
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startTop = 0;
  let startLeft = 0;
  
  handleEl.style.cursor = "move";
  handleEl.style.userSelect = "none";
  
  handleEl.addEventListener("selectstart", (e) => e.preventDefault());
  
  // Mouse down: initiate drag
  handleEl.addEventListener("mousedown", (e) => {
    // Don't start drag if clicking the close button
    if (e.target.id === "cs-close" || e.target.closest("#cs-close")) {
      return;
    }
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panelEl.getBoundingClientRect();
    startTop = rect.top;
    startLeft = rect.left;
    
    e.preventDefault();
  });
  
  // Mouse move: drag panel
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newTop = Math.max(0, Math.min(window.innerHeight - panelEl.offsetHeight, startTop + deltaY));
    const newLeft = Math.max(0, Math.min(window.innerWidth - panelEl.offsetWidth, startLeft + deltaX));
    
    panelEl.style.top = `${newTop}px`;
    panelEl.style.left = `${newLeft}px`;
    
    e.preventDefault();
  });
  
  // Mouse up: end drag and save position
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      
      // Save position to chrome.storage.local
      const rect = panelEl.getBoundingClientRect();
      const pos = {
        top: rect.top,
        left: rect.left,
        width: panelEl.offsetWidth,
        height: panelEl.offsetHeight
      };
      
      chrome.storage.local.set({ panelPosition: pos }, () => {
        console.log("✅ Panel position saved:", pos);
      });
    }
  });
}

/**
 * Restore panel position from chrome.storage.local
 * @param {element} panelEl - The main panel element
 */
function restorePanelPosition(panelEl) {
  if (!panelEl) return;
  
  chrome.storage.local.get(['panelPosition'], (result) => {
    if (result.panelPosition) {
      const pos = result.panelPosition;
      // Ensure position is within viewport bounds
      const top = Math.max(0, Math.min(window.innerHeight - (pos.height || 200), pos.top));
      const left = Math.max(0, Math.min(window.innerWidth - (pos.width || 300), pos.left));
      
      panelEl.style.top = `${top}px`;
      panelEl.style.left = `${left}px`;
      console.log("✅ Panel position restored:", { top, left });
    }
  });
}

/* ================== RENDERING ================== */

function renderScanning() {
  isScanning = true;
  
  const riskEl = document.getElementById("cs-risk");
  if (riskEl) {
    riskEl.innerText = "Scanning...";
    riskEl.style.color = "var(--muted)";
  }

  const scoreEl = document.getElementById("cs-confidence");
  if (scoreEl) {
    scoreEl.innerText = "—";
  }

  const explainSection = document.getElementById("cs-explain");
  if (explainSection) {
    let list = explainSection.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      explainSection.appendChild(list);
    }
    list.innerHTML = "<li style='color: var(--muted);'>Analyzing email...</li>";
  }

  const linksList = document.getElementById("cs-links-list");
  if (linksList) {
    linksList.innerHTML = "<li style='color: var(--muted);'>Checking links...</li>";
  }
}

function renderError(errorMessage) {
  isScanning = false;
  
  const riskEl = document.getElementById("cs-risk");
  if (riskEl) {
    riskEl.innerText = "Error";
    riskEl.style.color = "var(--danger)";
  }

  const scoreEl = document.getElementById("cs-confidence");
  if (scoreEl) {
    scoreEl.innerText = "—";
  }

  const explainSection = document.getElementById("cs-explain");
  if (explainSection) {
    let list = explainSection.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      explainSection.appendChild(list);
    }
    list.innerHTML = `<li style='color: var(--danger);'>${errorMessage || "Scan failed"}</li>`;
  }

  const linksList = document.getElementById("cs-links-list");
  if (linksList) {
    linksList.innerHTML = "<li style='color: var(--muted);'>—</li>";
  }
}

/**
 * Display a single email result
 * @param {object} result - Detection result with riskLevel, explanations, links, etc.
 */
function renderResult(result) {
  isScanning = false;
  
  if (!result) {
    console.warn("⚠️ CampusShield: renderResult called with no result");
    renderError("No result received");
    return;
  }

  // Ensure DOM is ready before accessing elements
  if (document.readyState === 'loading') {
    pendingResult = result;
    return;
  }

  // Safely access risk_level
  const riskEl = document.getElementById("cs-risk");
  if (riskEl) {
    riskEl.innerText = result.risk_level || "Unknown";
    riskEl.style.color = "";
  }

  // Safely access confidence_score
  const scoreEl = document.getElementById("cs-confidence");
  if (scoreEl) {
    const score = result.confidence_score != null ? Math.round(result.confidence_score * 100) : 0;
    scoreEl.innerText = score + "%";
  }

  // Safely access explanations
  const explainSection = document.getElementById("cs-explain");
  if (explainSection) {
    let list = explainSection.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      explainSection.appendChild(list);
    }
    list.innerHTML = "";
    (result.explanations || []).forEach(e => {
      const li = document.createElement("li");
      li.textContent = e;
      list.appendChild(li);
    });
  }

  // Safely access suspicious_links (ensure array; backend must return a list)
  const linksList = document.getElementById("cs-links-list");
  if (linksList) {
    linksList.innerHTML = "";
    const suspiciousLinks = Array.isArray(result.suspicious_links) ? result.suspicious_links : [];
    if (suspiciousLinks.length > 0) {
      suspiciousLinks.forEach(link => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = link;
        a.textContent = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.appendChild(a);
        linksList.appendChild(li);
      });
    } else {
      // Show "None detected" if no suspicious links
      const li = document.createElement("li");
      li.textContent = "None detected";
      li.style.color = "var(--muted)";
      linksList.appendChild(li);
    }
  }
}

/**
 * Display multiple candidates from inbox scan
 * @param {array} candidates - Array of { subject, sender, score, explanations, links }
 */
function showCandidates(candidates) {
  isScanning = false;
  
  if (!candidates || candidates.length === 0) {
    showNoResults();
    return;
  }
  
  // PHASE 1: Show first candidate (for demo/MVP)
  // TODO: Later, show list view with ability to select
  const firstCandidate = candidates[0];
  
  // Map score to risk level
  let riskLevel = "Low";
  if (firstCandidate.score >= 0.70) riskLevel = "High";
  else if (firstCandidate.score >= 0.40) riskLevel = "Medium";
  
  // Render as result
  renderResult({
    risk_level: riskLevel,
    confidence_score: firstCandidate.score,
    explanations: firstCandidate.explanations || [],
    suspicious_links: firstCandidate.links || []
  });
  
  // Log for debugging
  console.log(`✅ CampusShield: Displaying ${candidates.length} candidate(s)`, candidates);
}

/**
 * Display "no suspicious emails" message
 */
function showNoResults() {
  isScanning = false;
  
  const riskEl = document.getElementById("cs-risk");
  if (riskEl) {
    riskEl.innerText = "Clean";
    riskEl.style.color = "var(--muted)";
  }

  const scoreEl = document.getElementById("cs-confidence");
  if (scoreEl) {
    scoreEl.innerText = "0%";
  }

  const explainSection = document.getElementById("cs-explain");
  if (explainSection) {
    let list = explainSection.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      explainSection.appendChild(list);
    }
    list.innerHTML = "<li style='color: var(--muted);'>No suspicious indicators detected.</li>";
  }

  const linksList = document.getElementById("cs-links-list");
  if (linksList) {
    linksList.innerHTML = "<li style='color: var(--muted);'>None</li>";
  }
}

// Handle DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (pendingResult) {
      renderResult(pendingResult);
      pendingResult = null;
    }
    initializePanel();
  });
} else {
  // DOM already ready
  if (pendingResult) {
    renderResult(pendingResult);
    pendingResult = null;
  }
  initializePanel();
}

// Handle dismiss/close buttons
function setupDismissButtons() {
  const closeBtn = document.getElementById("cs-close");
  const dismissBtn = document.getElementById("cs-dismiss");

  function removePanel() {
    // Send message to parent window (content script) to remove the iframe
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "CS_REMOVE_PANEL" }, "*");
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removePanel();
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removePanel();
    });
  }
}

// Make panel header draggable
function setupDragging() {
  const header = document.querySelector(".cs-header");
  const panel = document.getElementById("cs-panel");
  
  if (panel && header) {
    // Restore position first
    restorePanelPosition(panel);
    
    // Make draggable
    makePanelDraggable(panel, header);
  }
}

// Initialize dismiss buttons and dragging when DOM is ready
function initializePanel() {
  setupDismissButtons();
  setupDragging();
}

window.addEventListener("message", (event) => {
  // Handle scan start message - show loading state
  if (event.data?.type === "CS_SCAN_START") {
    renderScanning();
    return;
  }

  // Handle scan result message
  if (event.data?.type === "CS_SCAN_RESULT") {
    const result = event.data?.payload;
    if (result) {
      renderResult(result);
    } else {
      console.warn("⚠️ CampusShield: Received CS_SCAN_RESULT with no payload");
      renderError("Invalid response from backend");
    }
    return;
  }
  
  // Handle inbox scan results (Phase 1)
  if (event.data?.type === "CS_INBOX_SCAN_RESULT") {
    const candidates = event.data?.candidates;
    if (candidates) {
      showCandidates(candidates);
    }
    return;
  }
});
