import { extractEmailData } from "../utils/emailParser.js";

const HIGHLIGHT_PHRASES = [
  "urgent",
  "act now",
  "immediately",
  "verify your",
  "confirm your",
  "account suspended",
  "login",
  "reset password"
];

function highlightRiskyText(container) {
  if (!container) return;

  let html = container.innerHTML;

  HIGHLIGHT_PHRASES.forEach(phrase => {
    const regex = new RegExp(phrase, 'gi');
    html = html.replace(
      regex,
      `<span class="cs-highlight-text">$&</span>`
    );
  });

  container.innerHTML = html;
}

function clearHighlights() {
  document.querySelectorAll('.cs-highlight-text').forEach(el => {
    el.replaceWith(el.textContent);
  });
  document.querySelectorAll('.cs-highlight-link').forEach(el => {
    el.classList.remove('cs-highlight-link', 'cs-link-warning');
  });
}

function highlightSuspiciousLinks(links = []) {
  if (!links || !links.length) return;
  links.forEach(l => {
    // highlight any anchor whose href contains the suspicious string
    document.querySelectorAll(`a[href*="${l}"]`).forEach(a => {
      a.classList.add('cs-highlight-link', 'cs-link-warning');
    });
  });
}

function injectStyles() {
  if (document.getElementById('campusshield-styles')) return;
  const link = document.createElement('link');
  link.id = 'campusshield-styles';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('ui/styles.css');
  document.head.appendChild(link);
}

function extractEmailFields() {
  return {
    sender: document.querySelector('.sender')?.innerText || '',
    subject: document.querySelector('.subject')?.innerText || '',
    body: document.querySelector('.body')?.innerText || ''
  };
}

function requestScan() {
  const payload = extractEmailData();

  chrome.runtime.sendMessage(
    { type: "scanEmail", payload },
    (response) => {
      if (!response?.ok) {
        console.error("Scan failed:", response?.error);
        renderPanel({
          risk_level: "Unknown",
          confidence_score: 0,
          explanations: ["Scan failed. Backend not reachable."],
          suspicious_links: []
        });
        return;
      }

      renderPanel(response.result);
    }
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'triggerScan') {
    requestScan();
  }
});

// initial run for mock page
injectStyles();
const emailBody = document.querySelector('.body');
highlightRiskyText(emailBody);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REQUEST_SCAN") {
    requestScan();
  }
});