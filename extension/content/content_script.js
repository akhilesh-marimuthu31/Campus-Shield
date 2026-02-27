console.log("✅ CampusShield content script running:", location.href);

function logContent(level, message, data) {
  const prefix = "[CampusShield content]";
  if (level === "error") {
    console.error(prefix, message, data || "");
  } else if (level === "warn") {
    console.warn(prefix, message, data || "");
  } else {
    console.debug(prefix, message, data || "");
  }
}

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

/* ---------------- PAGE DETECTION & EXTRACT EMAIL ---------------- */

function isGmailHost() {
  return location.hostname.includes("mail.google.com");
}

function isMockEmailPage() {
  return location.href.includes("mock_email.html") || !!document.querySelector(".email-container");
}

function isLikelyEmailView() {
  if (isMockEmailPage()) {
    return true;
  }
  if (isGmailHost()) {
    // Gmail message view containers
    if (document.querySelector("div[role='main'] .adn")) return true;
    if (document.querySelector("div.ii")) return true;
    if (document.querySelector("div.a3s")) return true;
  }
  // Generic fallback: presence of typical email DOM
  if (document.querySelector(".sender") && document.querySelector(".subject")) return true;
  return false;
}

// Track when a likely email is visible (used by PROBE and logging)
window.__campusshield_page_ready = isLikelyEmailView();

const csMutationObserver = new MutationObserver(() => {
  const ready = isLikelyEmailView();
  if (ready !== window.__campusshield_page_ready) {
    window.__campusshield_page_ready = ready;
    logContent("debug", "Page readiness changed", { ready });
  }
});

if (document.body) {
  csMutationObserver.observe(document.body, { childList: true, subtree: true });
}

function extractEmail() {
  // Detect page type for better extraction
  const isMockEmail = isMockEmailPage();
  const isGmail = isGmailHost();
  
  let sender = "unknown";
  let subject = "";
  let body = "";
  
  if (isMockEmail) {
    // Mock email page uses .sender, .subject, .body classes
    sender = document.querySelector(".sender")?.innerText || "unknown";
    subject = document.querySelector(".subject")?.innerText || "";
    body = document.querySelector(".body")?.innerText || document.body.innerText;
  } else if (isGmail) {
    // Gmail-specific selectors (for opened email view)
    const gmailSender = document.querySelector("h2[data-thread-perm-id]") || 
                        document.querySelector("span[email]");
    const gmailSubject = document.querySelector("h2[data-thread-perm-id]")?.textContent ||
                         document.querySelector("h2")?.textContent || "";
    const gmailBody = document.querySelector("div[data-message-id]")?.innerText ||
                      document.querySelector(".ii.gt")?.innerText ||
                      document.querySelector(".a3s")?.innerText ||
                      document.body.innerText;
    
    sender = gmailSender?.textContent?.trim() || gmailSender?.getAttribute("email") || "unknown";
    subject = (gmailSubject || "").trim();
    body = gmailBody || document.body.innerText;
  } else {
    // Generic fallback: try common email selectors
    sender = document.querySelector(".sender")?.innerText ||
             document.querySelector("[data-sender]")?.textContent ||
             "unknown";
    subject = document.querySelector(".subject")?.innerText ||
              document.querySelector("[data-subject]")?.textContent ||
              document.querySelector("h1, h2")?.textContent ||
              "";
    body = document.querySelector(".body")?.innerText ||
           document.querySelector("[data-body]")?.innerText ||
           document.body.innerText;
  }
  
  const links = [...document.querySelectorAll("a")].map(a => a.href);
  logContent("debug", "Extracted email", {
    isMockEmail,
    isGmail,
    senderPreview: sender,
    subjectPreview: subject,
    bodyLength: body.length,
    linksCount: links.length
  });
  
  return {
    sender,
    subject,
    body,
    links
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

    // Restore position from localStorage if available
    const savedPos = localStorage.getItem("campusshield-panel-pos");
    let top = "90px";
    let right = "20px";
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        top = pos.top || top;
        right = pos.right || right;
      } catch (e) {
        // Invalid saved position, use defaults
      }
    }

    Object.assign(iframe.style, {
      position: "fixed",
      top: top,
      right: right,
      width: "360px",
      height: "420px",
      border: "none",
      borderRadius: "12px",
      zIndex: "2147483647",
      boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      cursor: "default"
    });

    // Make iframe draggable by handling drag on header
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startTop = 0;
    let startRight = 0;

    // Listen for drag messages from panel
    const dragHandler = (event) => {
      if (event.data?.type === "CS_PANEL_DRAG_START") {
        isDragging = true;
        const rect = iframe.getBoundingClientRect();
        dragStartX = event.data.clientX;
        dragStartY = event.data.clientY;
        startTop = rect.top;
        startRight = window.innerWidth - rect.right;
      } else if (event.data?.type === "CS_PANEL_DRAG_MOVE" && isDragging) {
        const rect = iframe.getBoundingClientRect();
        const deltaX = event.data.clientX - dragStartX;
        const deltaY = event.data.clientY - dragStartY;
        const newTop = Math.max(0, Math.min(window.innerHeight - rect.height, startTop + deltaY));
        const newRight = Math.max(0, Math.min(window.innerWidth - rect.width, startRight - deltaX));
        iframe.style.top = `${newTop}px`;
        iframe.style.right = `${newRight}px`;
      } else if (event.data?.type === "CS_PANEL_DRAG_END" && isDragging) {
        isDragging = false;
        // Save position to localStorage
        const rect = iframe.getBoundingClientRect();
        const pos = {
          top: `${rect.top}px`,
          right: `${window.innerWidth - rect.right}px`
        };
        localStorage.setItem("campusshield-panel-pos", JSON.stringify(pos));
      }
    };
    
    // Use a single listener that checks for our panel's messages
    window.addEventListener("message", dragHandler);

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

/* ---------------- SCAN (PROMISE-BASED) ---------------- */

function sendMessageToPanel(iframe, message) {
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(message, "*");
  }
}

function requestScan() {
  return injectPanel()
    .then((iframe) => {
      const payload = extractEmail();

      // Notify panel that scan is starting
      sendMessageToPanel(iframe, { type: "CS_SCAN_START" });

      // Use Promise-based messaging: wrap sendMessage callback in Promise
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error("CampusShield: Backend request timeout");
          sendMessageToPanel(iframe, {
            type: "CS_SCAN_RESULT",
            payload: {
              risk_level: "Error",
              confidence_score: 0,
              explanations: ["Request timeout - backend unreachable"],
              suspicious_links: []
            }
          });
          resolve();
        }, 8000);

        chrome.runtime.sendMessage(
          { type: "scanEmail", payload },
          (res) => {
            clearTimeout(timeout);

            // Handle chrome.runtime.lastError (message port closed, etc.)
            if (chrome.runtime.lastError) {
              console.error("CampusShield: Message error:", chrome.runtime.lastError.message);
              sendMessageToPanel(iframe, {
                type: "CS_SCAN_RESULT",
                payload: {
                  risk_level: "Error",
                  confidence_score: 0,
                  explanations: ["Failed to communicate: " + chrome.runtime.lastError.message],
                  suspicious_links: []
                }
              });
              resolve();
              return;
            }

            // Safely validate response structure
            let safeResult;
            if (res && res.ok && res.result) {
              safeResult = res.result;
            } else if (res && res.error) {
              safeResult = {
                risk_level: "Error",
                confidence_score: 0,
                explanations: [res.error],
                suspicious_links: []
              };
            } else {
              safeResult = {
                risk_level: "Error",
                confidence_score: 0,
                explanations: ["Backend not reachable or invalid response"],
                suspicious_links: []
              };
            }

            // Send result to panel
            sendMessageToPanel(iframe, {
              type: "CS_SCAN_RESULT",
              payload: safeResult
            });

            // Highlight suspicious links in the page
            const body = document.querySelector(".body") || document.body;
            highlight(body, safeResult.suspicious_links || []);

            resolve();
          }
        );
      });
    })
    .catch((err) => {
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

// Message handler for popup and background messages
// Pattern: Return true for async handlers, always call sendResponse
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) {
    return false;
  }

  if (msg.type === "PROBE") {
    // Lightweight health check so popup can decide whether to inject
    const ready = window.__campusshield_page_ready === true;
    logContent("debug", "Received PROBE", { ready });
    sendResponse({ ok: true, pageReady: ready });
    return false;
  }

  if (msg?.type === "REQUEST_SCAN") {
    // Async scan operation initiated from popup
    // Return true to keep the message port open until sendResponse is called
    // This prevents "message port closed" errors on async operations
    requestScan().finally(() => {
      // Always call sendResponse when async operation completes
      // This ensures the popup callback fires and the port closes cleanly
      sendResponse({ ok: true, status: "scan_initiated" });
    });
    return true;  // CRITICAL: Keep port open for async sendResponse
  }
  
  if (msg?.type === "REMOVE_PANEL") {
    removePanel();
    sendResponse({ success: true });
    return false;  // Synchronous - port closes after sendResponse
  }
  
  // Unknown message type - respond with error to prevent hanging
  sendResponse({ error: "Unknown message type" });
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