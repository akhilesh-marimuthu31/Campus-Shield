// extension/background/service_worker.js

const BACKEND_URL = "http://127.0.0.1:5000/scan";
const REQUEST_TIMEOUT_MS = 5000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "scanEmail") return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message.payload),
    signal: controller.signal
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      sendResponse({ ok: true, result: data });
    })
    .catch(err => {
      console.error("CampusShield scan failed:", err);
      sendResponse({
        ok: false,
        error: err.name === "AbortError"
          ? "Backend timeout"
          : err.message
      });
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  // IMPORTANT: keep message channel open for async response
  return true;
});