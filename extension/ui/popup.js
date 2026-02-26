document.getElementById("scanBtn").addEventListener("click", () => {
  const statusEl = document.getElementById("status");
  statusEl.innerText = "Scanning...";
  statusEl.style.color = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("[ERROR] No active tab found");
      statusEl.innerText = "Error: No active tab";
      statusEl.style.color = "red";
      return;
    }

    const tab = tabs[0];

    chrome.tabs.sendMessage(
      tab.id,
      { type: "REQUEST_SCAN" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[ERROR] Failed to send message:", chrome.runtime.lastError.message);
          // Check if it's because content script isn't injected (not an email page)
          if (chrome.runtime.lastError.message.includes("Could not establish connection")) {
            statusEl.innerText = "Not an email page. Open an email to scan.";
            statusEl.style.color = "orange";
          } else {
            statusEl.innerText = "Error: " + chrome.runtime.lastError.message;
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