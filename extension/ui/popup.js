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

/**
 * Request inbox scan: sends REQUEST_SCAN_INBOX to content script
 * Returns array of candidates if found
 */
function requestInboxScan(tab) {
  return new Promise((resolve) => {
    logPopup("debug", "Sending REQUEST_SCAN_INBOX", { tabId: tab.id });
    chrome.tabs.sendMessage(
      tab.id,
      { type: "REQUEST_SCAN_INBOX" },
      (response) => {
        if (chrome.runtime.lastError) {
          logPopup("error", "REQUEST_SCAN_INBOX failed", { error: chrome.runtime.lastError.message });
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        logPopup("debug", "REQUEST_SCAN_INBOX response", { response });
        resolve(response || { ok: false });
      }
    );
  });
}

/**
 * Request deep email scan: sends REQUEST_DEEP_SCAN to content script
 * Returns raw email data (sender, subject, body, links)
 */
function requestDeepScan(tab) {
  return new Promise((resolve) => {
    logPopup("debug", "Sending REQUEST_DEEP_SCAN", { tabId: tab.id });
    chrome.tabs.sendMessage(
      tab.id,
      { type: "REQUEST_DEEP_SCAN" },
      (response) => {
        if (chrome.runtime.lastError) {
          logPopup("error", "REQUEST_DEEP_SCAN failed", { error: chrome.runtime.lastError.message });
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        logPopup("debug", "REQUEST_DEEP_SCAN response", { response });
        resolve(response || { ok: false });
      }
    );
  });
}

/**
 * Call backend /scan endpoint with email data
 * @param {object} emailData - { sender, subject, body, links }
 * @returns {object} - Backend response with { risk_level, confidence_score, reasons, explanations, suspicious_links }
 */
function callBackendScan(emailData) {
  return new Promise((resolve) => {
    logPopup("debug", "Calling backend /scan endpoint", { 
      hasBody: emailData.body && emailData.body.length > 0,
      hasLinks: emailData.links && emailData.links.length > 0
    });

    fetch("http://localhost:5000/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailData)
    })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return resp.json();
    })
    .then(data => {
      logPopup("debug", "Backend /scan response", { risk_level: data.risk_level });
      resolve({ ok: true, result: data });
    })
    .catch(err => {
      logPopup("error", "Backend /scan call failed", { error: err.message });
      resolve({ ok: false, error: err.message });
    });
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
      if (supported && url.includes("mail.google.com")) {
        setStatus("Initializing... try again.", "orange");
      } else if (supported) {
        setStatus("Initializing... try again.", "orange");
      } else {
        setStatus("Not an email page. Open an email to scan.", "orange");
      }
      scanBtn.disabled = false;
      return;
    }

    // ===== CHECK GMAIL VIEW STATE =====
    const probeResponse = probeResult.response || {};
    const isGmailInbox = probeResponse.inInbox;
    const isGmailEmailOpen = probeResponse.inEmailOpen;
    
    logPopup("debug", "Probe response details", { 
      isGmailInbox,
      isGmailEmailOpen,
      bodyLoaded: probeResponse.bodyLoaded,
      isGmail: probeResponse.isGmail
    });

    // ===== GMAIL INBOX VIEW: Show instruction =====
    if (isGmailInbox && !isGmailEmailOpen) {
      setStatus("📧 Open an email to scan content", "orange");
      logPopup("debug", "Gmail inbox view detected - no email open");
      
      // Still run inbox heuristic to flag suspicious subjects
      logPopup("debug", "Running inbox heuristic scan...");
      let inboxResponse = await requestInboxScan(tab);
      
      if (inboxResponse.ok && inboxResponse.candidates && inboxResponse.candidates.length > 0) {
        // Found suspicious subjects in inbox list
        logPopup("debug", "Inbox heuristic found suspicious subjects", { 
          count: inboxResponse.candidates.length 
        });
        setStatus(
          `📧 ${inboxResponse.candidates.length} suspicious subject(s) detected. Open one to scan.`, 
          "orange"
        );
        
        // Optionally show badges on suspicious rows
        chrome.tabs.sendMessage(tab.id, 
          { type: "SHOW_CANDIDATES", candidates: inboxResponse.candidates },
          () => {
            if (chrome.runtime.lastError) {
              logPopup("debug", "Message to show candidates failed");
            }
          }
        );
      } else {
        setStatus("📧 Open an email to scan content", "orange");
      }
      
      scanBtn.disabled = false;
      setTimeout(() => setStatus("", ""), 4000);
      return;
    }

    // ===== GMAIL EMAIL-OPEN VIEW: Auto-scan triggered by content script =====
    // When email body is open (div.a3s present), the content script auto-scans
    // The scan result is displayed in the panel
    // We just need to wait and show a message
    if (isGmailEmailOpen) {
      setStatus("✓ Auto-scanning email...", "");
      logPopup("debug", "Gmail email view detected - auto-scan triggered by content script");
      
      // The content script will automatically:
      // 1. Extract email data
      // 2. Call backend /scan
      // 3. Display result in panel
      // Just wait a bit then clear status
      
      await new Promise(r => setTimeout(r, 2000));
      setStatus("✓ Scan started (results in panel)", "green");
      scanBtn.disabled = false;
      setTimeout(() => setStatus("", ""), 3000);
      return;
    }

    // ===== FALLBACK: Non-Gmail email page (mock or other) =====
    // Original two-stage flow
    
    // STAGE A: Try inbox scan first (lightweight heuristic on [role="row"] only)
    setStatus("Analyzing inbox...", "");
    let scanResponse = await requestInboxScan(tab);
    
    if (scanResponse.ok && scanResponse.candidates && scanResponse.candidates.length > 0) {
      // Found suspicious candidates in inbox
      logPopup("debug", "Inbox scan found candidates", { count: scanResponse.candidates.length });
      setStatus(`Found ${scanResponse.candidates.length} suspicious email(s). Check the panel.`, "orange");
      
      // Tell content script to show candidates in panel
      chrome.tabs.sendMessage(tab.id, 
        { type: "SHOW_CANDIDATES", candidates: scanResponse.candidates },
        () => {
          if (chrome.runtime.lastError) {
            logPopup("debug", "Message to show candidates failed (panel may not be visible yet)");
          }
        }
      );
      
      scanBtn.disabled = false;
      setTimeout(() => setStatus("", ""), 3000);
      return;
    }
    
    // STAGE B: No inbox candidates - try deep scan on open message
    if (scanResponse.ok) {
      setStatus("Analyzing email...", "");
      
      // Extract raw email data
      const deepResponse = await requestDeepScan(tab);
      
      if (deepResponse.ok && deepResponse.emailData && deepResponse.emailData.success) {
        // We have email data - now call backend for deep analysis
        logPopup("debug", "Deep scan successful, calling backend", { 
          subject: deepResponse.emailData.subject.substring(0, 30) 
        });
        
        const backendResponse = await callBackendScan(deepResponse.emailData);
        
        if (backendResponse.ok && backendResponse.result) {
          // Backend analysis complete
          const result = backendResponse.result;
          logPopup("debug", "Backend analysis complete", { risk_level: result.risk_level });
          
          if (result.risk_level === "High" || result.risk_level === "Medium") {
            setStatus(`⚠️ ${result.risk_level} risk detected. Check the panel.`, "orange");
          } else {
            setStatus("No suspicious indicators found.", "green");
          }
          
          // Show result in panel
          chrome.tabs.sendMessage(tab.id, 
            { type: "SHOW_RESULT", result },
            () => {
              if (chrome.runtime.lastError) {
                logPopup("debug", "Message to show result failed");
              }
            }
          );
          
          scanBtn.disabled = false;
          setTimeout(() => setStatus("", ""), 3000);
          return;
        } else {
          // Backend call failed - show heuristic result or error
          logPopup("warn", "Backend analysis failed", { error: backendResponse.error });
          setStatus("Backend analysis failed. Please try again.", "red");
        }
      } else {
        // Deep scan failed or email not valid
        logPopup("debug", "Deep scan failed or no valid email", { 
          deepOk: deepResponse.ok,
          hasSender: deepResponse.emailData && deepResponse.emailData.sender
        });
        setStatus("Could not analyze this email. Try on an open email view.", "orange");
      }
    }
    
    // Fallback: No results from any scan
    setStatus("No suspicious emails found.", "green");
    scanBtn.disabled = false;
    setTimeout(() => setStatus("", ""), 3000);
  });
});