// extension/background/service_worker.js

const BACKEND_URL = "http://127.0.0.1:5000/scan";
const REQUEST_TIMEOUT_MS = 5000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle scanEmail messages from content scripts
  if (message.type !== "scanEmail") {
    // Respond to unknown message types to prevent port from hanging
    sendResponse({ error: "Unknown message type" });
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
        // Port may already be closed - this is expected if service worker was terminated
        console.error("CampusShield: Error sending response:", err);
      }
    }
  };

  // Safety timeout: ensure sendResponse is called even if fetch hangs
  const safetyTimeout = setTimeout(() => {
    if (!responseSent) {
      console.error("CampusShield: Safety timeout - sending error response");

      safeSendResponse({
        ok: false,
        error: "Request timeout"
      });
    }
  }, REQUEST_TIMEOUT_MS + 1000);

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
      clearTimeout(safetyTimeout);
      safeSendResponse({ ok: true, result: data });
    })
    .catch(err => {
      clearTimeout(safetyTimeout);
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
  // This tells Chrome to keep the port open until sendResponse is called
  return true;
});