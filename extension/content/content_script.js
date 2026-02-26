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
      console.log("[DEBUG] Panel iframe already exists");
      // If iframe already exists, check if it's loaded
      if (existing.contentWindow) {
        resolve(existing);
      } else {
        existing.addEventListener("load", () => resolve(existing), { once: true });
      }
      return;
    }

    console.log("[DEBUG] Creating panel iframe");
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

    iframe.addEventListener("load", () => {
      console.log("[DEBUG] Panel iframe loaded");
      resolve(iframe);
    }, { once: true });

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
  console.log("[DEBUG] requestScan() called");
  
  injectPanel().then((iframe) => {
    console.log("[DEBUG] Panel ready, extracting email data");
    const payload = extractEmail();
    console.log("[DEBUG] Email extracted", { 
      sender: payload.sender, 
      subject: payload.subject,
      bodyLength: payload.body.length,
      linksCount: payload.links.length
    });

    console.log("[DEBUG] Sending scanEmail message to background");
    chrome.runtime.sendMessage(
      { type: "scanEmail", payload },
      (res) => {
        console.log("[DEBUG] Received response from background", { 
          ok: res?.ok,
          hasResult: !!res?.result
        });

        const safeResult = res?.ok
          ? res.result
          : {
              risk_level: "Unknown",
              confidence_score: 0,
              explanations: ["Backend not reachable"],
              suspicious_links: []
            };

        console.log("[DEBUG] Posting result to panel iframe", {
          riskLevel: safeResult.risk_level,
          confidenceScore: safeResult.confidence_score,
          explanationsCount: safeResult.explanations?.length || 0
        });

        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: "CS_SCAN_RESULT", payload: safeResult },
            "*"
          );
          console.log("[DEBUG] Result posted to panel");
        } else {
          console.error("[ERROR] Panel iframe or contentWindow not available");
        }

        const body = document.querySelector(".body") || document.body;
        highlight(body, safeResult.suspicious_links || []);
        console.log("[DEBUG] Highlighting complete");
      }
    );
  }).catch((err) => {
    console.error("[ERROR] Failed to inject panel:", err);
  });
}

// Legacy function name for backward compatibility
function scanEmail() {
  console.log("[DEBUG] scanEmail() called (legacy, redirecting to requestScan)");
  requestScan();
}

/* ---------------- LISTENER ---------------- */

chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type === "REQUEST_SCAN") scanEmail();
});

console.log("✅ CampusShield content script initialized");