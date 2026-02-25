// background/service_worker.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scanEmail') {
    fetch('http://127.0.0.1:5000/scan', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(message.payload)
    })
    .then(r => r.json())
    .then(result => sendResponse({ ok: true, result }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
    // return true to indicate we'll respond asynchronously
    return true;
  }
});