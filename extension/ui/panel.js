console.log("✅ CampusShield panel loaded");

// Queue for messages that arrive before DOM is ready
let pendingResult = null;
let isScanning = false;

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
    riskEl.style.color = ""; // Reset to default
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
    // Also handle mouseup to ensure click fires
    closeBtn.addEventListener("mouseup", (e) => {
      e.preventDefault();
      e.stopPropagation();
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
  
  if (!header || !panel) return;
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  
  // Make header cursor indicate draggable
  header.style.cursor = "move";
  header.style.userSelect = "none";
  
  // Prevent text selection while dragging
  header.addEventListener("selectstart", (e) => e.preventDefault());
  
  header.addEventListener("mousedown", (e) => {
    // Don't start drag if clicking the close button
    if (e.target.id === "cs-close" || e.target.closest("#cs-close")) {
      return;
    }
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Notify parent window of drag start
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "CS_PANEL_DRAG_START",
        clientX: e.clientX,
        clientY: e.clientY
      }, "*");
    }
    
    e.preventDefault();
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    // Notify parent window of drag move
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "CS_PANEL_DRAG_MOVE",
        clientX: e.clientX,
        clientY: e.clientY
      }, "*");
    }
    
    e.preventDefault();
  });
  
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      
      // Notify parent window of drag end
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "CS_PANEL_DRAG_END"
        }, "*");
      }
    }
  });
}

// Initialize dismiss buttons and dragging when DOM is ready
function initializePanel() {
  setupDismissButtons();
  setupDragging();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePanel);
} else {
  initializePanel();
}

window.addEventListener("message", (event) => {
  // Handle scan start message - show loading state
  if (event.data?.type === "CS_SCAN_START") {
    renderScanning();
    return;
  }

  // Handle scan result message
  if (event.data?.type !== "CS_SCAN_RESULT") return;

  // Safely handle undefined/null payload
  const result = event.data?.payload;
  if (result) {
    renderResult(result);
  } else {
    console.warn("⚠️ CampusShield: Received CS_SCAN_RESULT with no payload");
    renderError("Invalid response from backend");
  }
});
