/**
 * CampusShield – Content Script
 * Responsibilities:
 *  - Extract email content from page
 *  - Request scan via background service worker
 *  - Inject floating panel (iframe)
 *  - Highlight risky text + suspicious links
 */

console.log("✅ CampusShield content script running on:", window.location.href);

/* ============================================================
   CONFIG
============================================================ */

const HIGHLIGHT_PHRASES = [
  "urgent",
  "act now",
  "immediately",
  "verify your",
  "confirm your",
  "account suspended",
  "login",
  "reset password",
  "click the link"
];

/* ============================================================
   STYLE INJECTION
============================================================ */

function injectHighlightStyles() {
  if (document.getElementById("campusshield-styles")) return;

  const style = document.createElement("style");
  style.id = "campusshield-styles";
  style.textContent = `
    .cs-highlight-text {
      background: linear-gradient(
        90deg,
        rgba(255, 230, 150, 0.4),
        rgba(255, 230, 150, 0.15)
      );
      padding: 2px 4px;
      border-radius: 4px;
    }

    .cs-highlight-link {
      outline: 3px solid rgba(239, 68, 68, 0.6);
      border-radius: 4px;
      padding: 2px;
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   HIGHLIGHTING
============================================================ */

function clearHighlights() {
  document.querySelectorAll(".cs-highlight-text").forEach(el => {
    el.replaceWith(el.textContent);
  });

  document.querySelectorAll(".cs-highlight-link").forEach(el => {
    el.classList.remove("cs-highlight-link");
  });
}

function highlightRiskyText(container) {
  if (!container) return;

  let html = container.innerHTML;

  HIGHLIGHT_PHRASES.forEach(phrase => {
    const regex = new RegExp(`(${phrase})`, "gi");
    html = html.replace(regex, `<span class="cs-highlight-text">$1</span>`);
  });

  container.innerHTML = html;
}

function highlightSuspiciousLinks(links = []) {
  links.forEach(link => {
    document.querySelectorAll(`a[href*="${link}"]`).forEach(a => {
      a.classList.add("cs-highlight-link");
      a.title = "⚠️ Marked suspicious by CampusShield";
    });
  });
}

/* ============================================================
   EMAIL EXTRACTION (mock page compatible)
============================================================ */

function extractEmailData() {
  return {
    sender: document.querySelector(".sender")?.innerText || "unknown",
    subject: document.querySelector(".subject")?.innerText || "",
    body: document.querySelector(".body")?.innerText || "",
    links: Array.from(document.querySelectorAll("a")).map(a => a.href)
  };
}

/* ============================================================
   PANEL (IFRAME) INJECTION
============================================================ */

function injectPanel() {
  let iframe = document.getElementById("campusshield-panel");

  if (iframe) return iframe;

  iframe = document.createElement("iframe");
  iframe.id = "campusshield-panel";
  iframe.src = chrome.runtime.getURL("ui/panel.html");

  Object.assign(iframe.style, {
    position: "fixed",
    top: "80px",
    right: "24px",
    width: "340px",
    height: "420px",
    border: "none",
    borderRadius: "12px",
    zIndex: "2147483647",
    boxShadow: "0 20px 50px rgba(0,0,0,0.45)"
  });

  document.body.appendChild(iframe);

  // Close handler from panel
  window.addEventListener("message", (event) => {
    if (event?.data?.type === "CS_CLOSE_PANEL") {
      iframe.remove();
    }
  });

  return iframe;
}

function renderPanel(result) {
  const iframe = injectPanel();

  const sendResult = () => {
    iframe.contentWindow.postMessage(
      {
        type: "CS_SCAN_RESULT",
        payload: result
      },
      "*"
    );
  };

  if (iframe.contentWindow) {
    sendResult();
  } else {
    iframe.addEventListener("load", sendResult, { once: true });
  }
}

/* ============================================================
   SCAN FLOW
============================================================ */

function requestScan() {
  clearHighlights();

  const payload = extractEmailData();

  chrome.runtime.sendMessage(
    { type: "scanEmail", payload },
    (response) => {
      if (!response?.ok) {
        console.error("❌ Scan failed:", response?.error);
        renderPanel({
          risk_level: "Unknown",
          confidence_score: 0,
          explanations: ["Backend not reachable"],
          suspicious_links: []
        });
        return;
      }

      const result = response.result;

      const bodyNode = document.querySelector(".body") || document.body;
      highlightRiskyText(bodyNode);
      highlightSuspiciousLinks(result.suspicious_links || []);

      renderPanel(result);
    }
  );
}

/* ============================================================
   MESSAGE LISTENERS (popup / background)
============================================================ */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "REQUEST_SCAN") {
    requestScan();
  }
});

/* ============================================================
   INIT
============================================================ */

injectHighlightStyles();

// For demo visibility on mock page
const demoBody = document.querySelector(".body");
if (demoBody) {
  highlightRiskyText(demoBody);
}

console.log("✅ CampusShield content script initialized");