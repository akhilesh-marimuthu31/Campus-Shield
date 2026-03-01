# Phase 2 Message Flow Reference

## Message Protocol

### Stage A: Inbox Scan Request

```
┌─────────────┐
│   popup.js  │
└──────┬──────┘
       │ chrome.tabs.sendMessage()
       │ type: "REQUEST_SCAN_INBOX"
       ▼
┌──────────────────────┐
│ content_script.js    │
│ Handler: Receive     │
└──────┬───────────────┘
       │ Call inboxLightScan()
       │ Query [role="row"] elements
       │ Score each with 0.40 threshold
       ▼
┌──────────────────────┐
│ inboxLightScan()     │
│ Returns: {          │
│   ok: true,         │
│   candidates: [      │
│     {subject,        │
│      sender,         │
│      snippet,        │
│      score,          │
│      riskLevel,      │
│      keywords}       │
│   ]                  │
│ }                    │
└──────┬───────────────┘
       │ sendResponse()
       ▼
┌─────────────┐
│   popup.js  │
└─────────────┘
```

### Stage A Result: Candidates Found

```
┌──────────────┐
│   popup.js   │ if candidates.length > 0:
└──────┬───────┘
       │ Show: "Found X suspicious email(s)"
       │ chrome.tabs.sendMessage()
       │ type: "SHOW_CANDIDATES"
       │ candidates: response.candidates
       ▼
┌─────────────────────┐
│ content_script.js   │
│ Handler: Receive    │
└──────┬──────────────┘
       │ Call injectPanel()
       │ Panel creates iframe
       ▼
┌────────────────────┐
│  Panel iframe      │
│  postMessage()     │
│  type: "CS_INBOX_  │
│  SCAN_RESULT"      │
│  candidates: []    │
└──────┬─────────────┘
       │
       ▼
┌──────────────────┐
│ panel.js         │
│ event listener   │
│ showCandidates() │
│ Map score to     │
│ riskLevel        │
│ renderResult()   │
└──────────────────┘
```

### Stage B: Deep Scan (No Inbox Candidates)

```
┌─────────────┐
│   popup.js  │ if no candidates:
└──────┬──────┘
       │ setStatus("Analyzing email...")
       │ chrome.tabs.sendMessage()
       │ type: "REQUEST_DEEP_SCAN"
       ▼
┌──────────────────────┐
│ content_script.js    │
│ Handler: Receive     │
└──────┬───────────────┘
       │ Call extractFullEmailData()
       │ Find div.a3s (body)
       │ Find h2[data-thread-perm-id] (subject)
       │ Find [data-email] (sender)
       │ Extract <a> links from body
       ▼
┌──────────────────────┐
│extractFullEmailData()│
│Returns: {           │
│  ok: true,          │
│  emailData: {        │
│    sender,          │
│    subject,         │
│    body,            │
│    links: [],       │
│    success: true    │
│  }                  │
│}                    │
└──────┬───────────────┘
       │ sendResponse()
       ▼
┌─────────────┐
│   popup.js  │ if emailData.success:
└──────┬──────┘
       │ callBackendScan(emailData)
       │ fetch("localhost:5000/scan", POST)
       │ body: JSON.stringify(emailData)
       ▼
┌────────────────┐
│ Backend Flask  │
│ POST /scan     │
└──────┬─────────┘
       │ Analyze email
       │ Run detector
       │ Return results
       ▼
┌────────────────────────┐
│ Backend Response:      │
│ {                      │
│   risk_level: "High",  │
│   confidence_score:    │
│     0.87,              │
│   reasons: [],         │
│   explanations: [],    │
│   suspicious_links: [] │
│ }                      │
└──────┬─────────────────┘
       │ Received by popup.js
       │ setStatus()
       │ chrome.tabs.sendMessage()
       │ type: "SHOW_RESULT"
       │ result: backend response
       ▼
┌──────────────────────┐
│ content_script.js    │
│ Handler: Receive     │
└──────┬───────────────┘
       │ Call injectPanel()
       │ Panel creates iframe
       ▼
┌────────────────────┐
│  Panel iframe      │
│  postMessage()     │
│  type: "CS_SCAN_   │
│  RESULT"           │
│  payload: result   │
└──────┬─────────────┘
       │
       ▼
┌──────────────────┐
│ panel.js         │
│ event listener   │
│ renderResult()   │
│ Display:         │
│ • Risk level     │
│ • Confidence %   │
│ • Explanations   │
│ • Suspicious     │
│   links          │
└──────────────────┘
```

---

## Key Functions Reference

### popup.js Functions

```javascript
// Stage A: Lightweight inbox scan
requestInboxScan(tab)
  → Returns: {ok: boolean, candidates: array}

// Stage B: Extract raw email data
requestDeepScan(tab)
  → Returns: {ok: boolean, emailData: {sender, subject, body, links, success}}

// Backend: Send to /scan endpoint
callBackendScan(emailData)
  → Returns: {ok: boolean, result: {risk_level, confidence_score, ...}}
```

### content_script.js Functions

```javascript
// Stage A: Heuristic scan on [role="row"]
inboxLightScan()
  → Returns: [{subject, snippet, sender, score, riskLevel, keywords}]

// Stage B: Extract email components
extractFullEmailData()
  → Returns: {sender, subject, body, links, success: boolean}
```

### panel.js Functions

```javascript
// Rendering functions
renderScanning()          // "Analyzing email..."
renderError(msg)          // Red error text
renderResult(result)      // Backend response display
showCandidates(array)     // Map scores, show first
showNoResults()           // "Clean" status

// Drag & persistence
makePanelDraggable(el, handle)
restorePanelPosition(el)
```

---

## Error Handling Flow

```
┌────────────────┐
│ Content script │
│ not injected   │
└────┬───────────┘
     │
     ▼
┌──────────────────┐
│ popup.js catches │
│ "Could not       │
│  establish       │
│  connection"     │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Inject script    │
│ Wait 400ms       │
│ Retry probe      │
└────┬─────────────┘
     │
     ├─ Success → Continue to scan
     │
     └─ Failure → Show error
           "Initializing... try again."
```

---

## Selector Fallback Chains

### Subject Extraction
```
Try 1: h2[data-thread-perm-id]
  └─ Try 2: span[data-subject-perm-id]
    └─ Try 3: h2
      └─ Fallback: "Unknown"
```

### Sender Extraction
```
Try 1: [data-email]
  └─ Try 2: .gVNoLb span
    └─ Try 3: [role="main"] span
      └─ Fallback: "unknown"
```

### Body Extraction
```
Try 1: div.a3s (PRIMARY - Gmail standard)
  └─ Try 2: div[aria-label*="Message body"]
    └─ Try 3: div.ii
      └─ Try 4: [role="main"] div
        └─ Fallback: "" (empty)
```

### Links Extraction
```
All <a href> tags inside body element
  └─ If no body found: empty array
    └─ If body found: Extract all links
```

---

## Status Messages

### Popup Status Lifecycle

| Status | Color | Meaning |
|--------|-------|---------|
| "Scanning..." | default | Initial scan phase |
| "Initializing..." | orange | Injecting content script |
| "Analyzing inbox..." | default | Running Stage A |
| "Analyzing email..." | default | Running Stage B |
| "Found X suspicious..." | orange | Candidates detected |
| "⚠️ High/Medium risk..." | orange | Backend returned High/Medium |
| "No suspicious..." | green | All scans clean |
| "Error: ..." | red | Scan failed |
| "Not an email page..." | orange | Unsupported URL |
| "" | default | Cleared after 3 seconds |

### Panel Display Modes

| State | Content |
|-------|---------|
| Scanning | "Analyzing email..." |
| Error | Red error message |
| High Risk | "High" (red), 87%, explanations, suspicious links |
| Medium Risk | "Medium" (orange), 45%, explanations, maybe links |
| Low Risk | "Low" (gray), 15%, explanations |
| Clean | "Clean" (gray), 0%, "No suspicious indicators detected." |

---

## Configuration & Endpoints

### Backend Endpoint
```
Method: POST
URL: http://localhost:5000/scan
Content-Type: application/json

Request Body:
{
  "sender": "noreply@bank.com",
  "subject": "Verify Your Account",
  "body": "Click here to verify...",
  "links": ["http://phish.evil.com"]
}

Response:
{
  "risk_level": "High",
  "confidence_score": 0.87,
  "reasons": ["verified_account_request"],
  "explanations": ["Requests verification..."],
  "suspicious_links": ["http://phish.evil.com"]
}
```

### Thresholds
- **Inbox Heuristic Threshold**: 0.40 (Medium risk minimum)
- **High Risk**: Score ≥ 0.70
- **Medium Risk**: Score 0.40-0.69
- **Low Risk**: Score < 0.40

### Gmail Selectors
- Inbox rows: `[role="row"]`
- Subject (open): `h2[data-thread-perm-id]`
- Sender: `[data-email]`
- Body: `div.a3s`
- Links: `a[href]` inside body
