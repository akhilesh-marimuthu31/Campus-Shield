document.getElementById("scanBtn").addEventListener("click", () => {
  const scanBtn = document.getElementById("scanBtn");
  const statusEl = document.getElementById("status");
  
  // Disable button to prevent double-clicks
  scanBtn.disabled = true;
  statusEl.innerText = "Scanning...";
  statusEl.style.color = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("[ERROR] No active tab found");
      statusEl.innerText = "Error: No active tab";
      statusEl.style.color = "red";
      scanBtn.disabled = false;
      return;
    }

    const tab = tabs[0];

    chrome.tabs.sendMessage(
      tab.id,
      { type: "REQUEST_SCAN" },
      (response) => {
        // Re-enable button after response
        scanBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
          console.error("[ERROR] Failed to send message:", chrome.runtime.lastError.message);
          // Check if it's because content script isn't injected
          const errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes("Could not establish connection")) {
            // Content script may not be injected yet - check if it's a supported page
            const url = tab.url || "";
            const isSupported = url.includes("mock_email.html") || 
                               url.includes("mail.google.com") ||
                               url.startsWith("http://localhost") ||
                               url.startsWith("http://127.0.0.1");
            
            if (isSupported) {
              // Page is supported but script not injected yet - try again after delay
              statusEl.innerText = "Initializing... Please try again.";
              statusEl.style.color = "orange";
            } else {
              statusEl.innerText = "Not an email page. Open an email to scan.";
              statusEl.style.color = "orange";
            }
          } else {
            statusEl.innerText = "Error: " + errorMsg;
            statusEl.style.color = "red";
          }
          return;
        }

        // Content script will handle the scan, just show success message
        statusEl.innerText = "Scan requested. Check the panel on the page.";
        statusEl.style.color = "green";
        
        // Reset after 3 seconds
        setTimeout(() => {
          statusEl.innerText = "";
        }, 3000);
      }
    );
  });
});