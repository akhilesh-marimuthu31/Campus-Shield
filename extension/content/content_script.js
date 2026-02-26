console.log("✅ CampusShield content script running:", location.href);

/* ---------------- CONFIG ---------------- */

const PHRASES = [
  "urgent",
  "act now",
  "immediately",
  "verify your",
  "confirm your",
  "suspended",
  "click the link"
];

/* ---------------- STYLES ---------------- */

(function injectStyles() {
  if (document.getElementById("cs-style")) return;

  const style = document.createElement("style");
  style.id = "cs-style";
  style.textContent = `
    .cs-highlight {
      background: rgba(255, 225, 130, 0.45);
      border-radius: 4px;
      padding: 2px 4px;
    }
    .cs-link {
      outline: 3px solid rgba(239, 68, 68, 0.7);
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);
})();

/* ---------------- EXTRACT EMAIL ---------------- */

function extractEmail() {
  return {
    sender: document.querySelector(".sender")?.innerText || "unknown",
    subject: document.querySelector(".subject")?.innerText || "",
    body: document.querySelector(".body")?.innerText || document.body.innerText,
    links: [...document.querySelectorAll("a")].map(a => a.href)
  };
}

/* ---------------- PANEL ---------------- */

function injectPanel() {
  return new Promise((resolve) => {
    const existing = document.getElementById("campusshield-panel");
    if (existing) {
      // If iframe already exists, check if it's loaded
      if (existing.contentWindow) {
        resolve(existing);
      } else {
        existing.addEventListener("load", () => resolve(existing), { once: true });
      }
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.id = "campusshield-panel";
    iframe.src = chrome.runtime.getURL("ui/panel.html");

    Object.assign(iframe.style, {
      position: "fixed",
      top: "90px",
      right: "20px",
      width: "360px",
      height: "420px",
      border: "none",
      borderRadius: "12px",
      zIndex: "2147483647",
      boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
    });

    iframe.addEventListener("load", () => resolve(iframe), { once: true });

    document.body.appendChild(iframe);
  });
}

/* ---------------- HIGHLIGHT ---------------- */

function highlight(body, links) {
  let html = body.innerHTML;
  PHRASES.forEach(p => {
    const r = new RegExp(`(${p})`, "gi");
    html = html.replace(r, `<span class="cs-highlight">$1</span>`);
  });
  body.innerHTML = html;

  links.forEach(l => {
    document.querySelectorAll(`a[href*="${l}"]`)
      .forEach(a => a.classList.add("cs-link"));
  });
}

/* ---------------- SCAN ---------------- */

function requestScan() {
  injectPanel().then((iframe) => {
    const payload = extractEmail();

    chrome.runtime.sendMessage(
      { type: "scanEmail", payload },
      (res) => {
        // Handle case where response callback might not be called (service worker died, etc.)
        if (chrome.runtime.lastError) {
          console.error("CampusShield: Message error:", chrome.runtime.lastError.message);
          const errorResult = {
            risk_level: "Unknown",
            confidence_score: 0,
            explanations: ["Failed to communicate with backend"],
            suspicious_links: []
          };
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              { type: "CS_SCAN_RESULT", payload: errorResult },
              "*"
            );
          }
          return;
        }

        // Safely handle undefined/null response
        const safeResult = (res && res.ok && res.result)
          ? res.result
          : {
              risk_level: "Unknown",
              confidence_score: 0,
              explanations: res?.error ? [res.error] : ["Backend not reachable"],
              suspicious_links: []
            };

        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: "CS_SCAN_RESULT", payload: safeResult },
            "*"
          );
        } else {
          console.error("CampusShield: Panel iframe or contentWindow not available");
        }

        const body = document.querySelector(".body") || document.body;
        highlight(body, safeResult.suspicious_links || []);
      }
    );
  }).catch((err) => {
    console.error("CampusShield: Failed to inject panel:", err);
  });
}

// Legacy function name for backward compatibility
function scanEmail() {
  requestScan();
}

/* ---------------- REMOVE PANEL ---------------- */

function removePanel() {
  const iframe = document.getElementById("campusshield-panel");
  if (iframe) {
    iframe.remove();
    console.log("✅ CampusShield: Panel removed");
  }
}

/* ---------------- LISTENER ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "REQUEST_SCAN") {
    scanEmail();
    // Synchronous handler, no need to return true
    return false;
  }
  if (msg?.type === "REMOVE_PANEL") {
    removePanel();
    sendResponse({ success: true });
    return false;
  }
  return false;
});

// Listen for postMessage from panel iframe to remove itself
window.addEventListener("message", (event) => {
  // Only accept messages from our extension origin
  if (event.data?.type === "CS_REMOVE_PANEL") {
    removePanel();
  }
});

console.log("✅ CampusShield content script initialized");