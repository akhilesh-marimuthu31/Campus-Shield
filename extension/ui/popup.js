document.getElementById("scanBtn").addEventListener("click", () => {
  document.getElementById("status").innerText = "Scanning...";

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, { type: "REQUEST_SCAN" }, () => {
      document.getElementById("status").innerText = "Scan requested.";
    });
  });
});