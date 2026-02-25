/**
 * CampusShield Content Script
 * Responsibilities:
 * - Extract email content from page
 * - Trigger phishing scan via background
 * - Inject & render in-page result panel (iframe)
 * - Highlight risky text and suspicious links
 */
console.log("✅ CampusShield content script running on:", window.location.href);
import { extractEmailData } from "../utils/emailParser.js";

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
   STYLE INJECTION (for highlights)
============================================================ */

function injectHighlightStyles() {
  if (document.getElementById("campusshield-styles")) return;

  const style = document.createElement("style");
  style.id = "campusshield-styles";
  style.textContent = `
    .cs-highlight-text {
      background: linear-gradient(
        90deg,
        rgba(255, 230, 150, 0.35),
        rgba(255, 230, 150, 0.15)
      );
      padding: 1px 3px;
      border-radius: 3px;
    }

    .cs-highlight-link {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
      border-radius: 4px;
      padding: 2px 4px;
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   HIGHLIGHTING LOGIC
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
  if (!links.length) return;

  links.forEach(link => {
    document.querySelectorAll(`a[href*="${link}"]`).forEach(a => {
      a.classList.add("cs-highlight-link");
      a.title = "Marked suspicious by CampusShield";
    });
  });
}

/* ============================================================
   PANEL (IFRAME) INJECTION
============================================================ */

function injectPanelIframe() {
  let iframe = document.getElementById("campusshield-panel-iframe");
  if (iframe) return iframe;

  iframe = document.createElement("iframe");
  iframe.id = "campusshield-panel-iframe";
  iframe.src = chrome.runtime.getURL("ui/panel.html");

  Object.assign(iframe.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    width: "320px",
    height: "420px",
    border: "none",
    zIndex: "2147483647",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    borderRadius: "10px"
  });

  document.body.appendChild(iframe);

  // Listen for close events from panel
  window.addEventListener("message", (event) => {
    if (event?.data?.type === "cs-close") {
      iframe.remove();
    }
  });

  return iframe;
}

function renderPanel(result) {
  const iframe = injectPanelIframe();

  const payload = {
    ...result,
    // optional: pass body for teach-back
    body: document.querySelector(".body")?.innerText || ""
  };

  // Send once iframe is ready
  iframe.addEventListener(
    "load",
    () => {
      iframe.contentWindow.postMessage(
        { type: "cs-result", payload },
        "*"
      );
    },
    { once: true }
  );

  // If already loaded
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: "cs-result", payload },
      "*"
    );
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
        console.error("CampusShield scan failed:", response?.error);
        renderPanel({
          risk_level: "Unknown",
          confidence_score: 0,
          explanations: ["Scan failed. Backend not reachable."],
          suspicious_links: []
        });
        return;
      }

      const result = response.result;

      // Highlight page content
      const bodyNode = document.querySelector(".body") || document.body;
      highlightRiskyText(bodyNode);
      highlightSuspiciousLinks(result.suspicious_links);

      renderPanel(result);
    }
  );
}

/* ============================================================
   MESSAGE LISTENERS (from popup / background)
============================================================ */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "REQUEST_SCAN" || msg?.type === "triggerScan") {
    requestScan();
  }
});

/* ============================================================
   INITIALIZATION (mock page support)
============================================================ */

injectHighlightStyles();

// Optional auto-highlight for demo visibility
const emailBody = document.querySelector(".body");
if (emailBody) {
  highlightRiskyText(emailBody);
}