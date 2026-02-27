const scanBtn = document.getElementById("scanBtn");
const statusEl = document.getElementById("status");

// Simple helper to log from popup with a consistent prefix
function logPopup(level, message, data) {
  const prefix = "[CampusShield popup]";
  if (level === "error") {
    console.error(prefix, message, data || "");
  } else if (level === "warn") {
    console.warn(prefix, message, data || "");
  } else {
    console.debug(prefix, message, data || "");
  }
}

function setStatus(text, color) {
  statusEl.innerText = text;
  statusEl.style.color = color || "";
}

function isSupportedEmailUrl(url) {
  if (!url) return false;
  if (url.includes("mock_email.html")) return true;
  if (url.includes("mail.google.com")) return true;
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return true;
  return false;
}

function probeContentScript(tab) {
  return new Promise((resolve) => {
    logPopup("debug", "Probing content script", { tabId: tab.id, url: tab.url });
    chrome.tabs.sendMessage(
      tab.id,
      { type: "PROBE" },
      (response) => {
        if (chrome.runtime.lastError) {
          logPopup("warn", "Probe failed", { error: chrome.runtime.lastError.message });
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        logPopup("debug", "Probe response", { response });
        resolve({ ok: !!(response && response.ok), response });
      }
    );
  });
}

function injectContentScript(tab) {
  return new Promise((resolve) => {
    if (!chrome.scripting) {
      logPopup("error", "chrome.scripting API not available");
      resolve({ ok: false, error: "scripting_not_available" });
      return;
    }

    logPopup("debug", "Injecting content script", { tabId: tab.id });
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["content/content_script.js"]
      },
      (results) => {
        if (chrome.runtime.lastError) {
          logPopup("error", "Injection failed", { error: chrome.runtime.lastError.message });
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        logPopup("debug", "Injection complete", { results });
        resolve({ ok: true });
      }
    );
  });
}

function requestScan(tab) {
  return new Promise((resolve) => {
    logPopup("debug", "Sending REQUEST_SCAN", { tabId: tab.id });
    chrome.tabs.sendMessage(
      tab.id,
      { type: "REQUEST_SCAN" },
      (response) => {
        if (chrome.runtime.lastError) {
          logPopup("error", "REQUEST_SCAN failed", { error: chrome.runtime.lastError.message });
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        logPopup("debug", "REQUEST_SCAN response", { response });
        resolve(response || { ok: true });
      }
    );
  });
}

scanBtn.addEventListener("click", async () => {
  // Disable button to prevent double-clicks
  scanBtn.disabled = true;
  setStatus("Scanning...", "");

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs || tabs.length === 0) {
      logPopup("error", "No active tab found");
      setStatus("Error: No active tab", "red");
      scanBtn.disabled = false;
      return;
    }

    const tab = tabs[0];
    const url = tab.url || "";
    const supported = isSupportedEmailUrl(url);

    logPopup("debug", "Scan requested", { tabId: tab.id, url, supported });

    // Step 1: probe
    let probeResult = await probeContentScript(tab);

    // If probe failed because content script isn't injected, try injection once
    if (!probeResult.ok && probeResult.error && probeResult.error.includes("Could not establish connection")) {
      if (!supported) {
        setStatus("Not an email page. Open an email to scan.", "orange");
        scanBtn.disabled = false;
        return;
      }

      setStatus("Initializing...", "orange");
      const injectResult = await injectContentScript(tab);
      if (!injectResult.ok) {
        setStatus("Failed to initialize on this page.", "red");
        scanBtn.disabled = false;
        return;
      }

      // Small delay to allow script to run, then probe again
      await new Promise(r => setTimeout(r, 400));
      probeResult = await probeContentScript(tab);
    }

    if (!probeResult.ok) {
      // Content script not responsive even after injection
      if (supported) {
        setStatus("Initializing... Please try again.", "orange");
      } else {
        setStatus("Not an email page. Open an email to scan.", "orange");
      }
      scanBtn.disabled = false;
      return;
    }

    // Step 2: send REQUEST_SCAN
    const scanResponse = await requestScan(tab);

    scanBtn.disabled = false;

    if (!scanResponse || scanResponse.ok === false) {
      const msg = scanResponse && scanResponse.error
        ? scanResponse.error
        : "Scan failed";
      setStatus("Error: " + msg, "red");
      return;
    }

    setStatus("Scan requested. Check the panel on the page.", "green");

    // Reset after 3 seconds
    setTimeout(() => {
      setStatus("", "");
    }, 3000);
  });
});