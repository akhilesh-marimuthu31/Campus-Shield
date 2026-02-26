// extension/background/service_worker.js

const BACKEND_URL = "http://127.0.0.1:5000/scan";
const REQUEST_TIMEOUT_MS = 5000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "scanEmail") {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Track if sendResponse has been called to prevent double-calling
  let responseSent = false;
  const safeSendResponse = (response) => {
    if (!responseSent) {
      responseSent = true;
      try {
        sendResponse(response);
      } catch (err) {
        console.error("CampusShield: Error sending response:", err);
      }
    }
  };

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
      safeSendResponse({ ok: true, result: data });
    })
    .catch(err => {
      console.error("CampusShield scan failed:", err);
      safeSendResponse({
        ok: false,
        error: err.name === "AbortError"
          ? "Backend timeout"
          : err.message
      });
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  // IMPORTANT: return true to keep message channel open for async response
  return true;
});