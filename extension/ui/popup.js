document.getElementById("scanBtn").addEventListener("click", () => {
  document.getElementById("status").innerText = "Scanning...";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "REQUEST_SCAN"
    });
  });
});