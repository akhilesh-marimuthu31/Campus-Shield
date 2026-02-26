console.log("✅ CampusShield panel loaded");

// Queue for messages that arrive before DOM is ready
let pendingResult = null;

function renderResult(result) {
  if (!result) {
    console.warn("⚠️ CampusShield: renderResult called with no result");
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
  } else {
    console.warn("⚠️ CampusShield: Element #cs-risk not found");
  }

  // Safely access confidence_score
  const scoreEl = document.getElementById("cs-confidence");
  if (scoreEl) {
    const score = result.confidence_score != null ? Math.round(result.confidence_score * 100) : 0;
    scoreEl.innerText = score + "%";
  } else {
    console.warn("⚠️ CampusShield: Element #cs-confidence not found");
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
  } else {
    console.warn("⚠️ CampusShield: Element #cs-explain not found");
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
  } else {
    console.warn("⚠️ CampusShield: Element #cs-links-list not found");
  }
}

// Handle DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (pendingResult) {
      renderResult(pendingResult);
      pendingResult = null;
    }
  });
} else {
  // DOM already ready
  if (pendingResult) {
    renderResult(pendingResult);
    pendingResult = null;
  }
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
    closeBtn.addEventListener("click", removePanel);
  }
  if (dismissBtn) {
    dismissBtn.addEventListener("click", removePanel);
  }
}

// Initialize dismiss buttons when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDismissButtons);
} else {
  setupDismissButtons();
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "CS_SCAN_RESULT") return;

  // Safely handle undefined/null payload
  const result = event.data?.payload;
  if (result) {
    renderResult(result);
  } else {
    console.warn("⚠️ CampusShield: Received CS_SCAN_RESULT with no payload");
  }
});
