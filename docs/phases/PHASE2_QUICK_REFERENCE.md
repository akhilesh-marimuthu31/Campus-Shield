# Phase 2 Quick Reference Card

## 🚀 Quick Start (Testing in 2 Minutes)

```bash
# Terminal 1: Start backend
cd backend && python app.py
# Should show: "Running on http://localhost:5000"

# Terminal 2: Load extension (Chrome)
# chrome://extensions → Load unpacked → select extension/ folder

# Terminal 3: Test
# Open Gmail or file:///path/to/mock_email.html
# Click extension icon → Click "Scan"
```

---

## 📊 Two-Stage Flow (Visual)

```
STAGE A: Quick Heuristic (No Backend)
┌─────────────────────────────────┐
│ User clicks "Scan"              │
│ popup.js:                       │
│   requestInboxScan()            │
│   ↓                             │
│ content_script REQUEST_SCAN_     │
│ INBOX                           │
│   ↓                             │
│ Call: inboxLightScan()          │
│   Query [role="row"]            │
│   Keyword matching on subj+snip │
│   Score threshold 0.40          │
│   ↓                             │
│ Return {ok, candidates: [...]}  │
│                                 │
│ Candidates found?               │
│   YES → Show count + Show panel │
│   NO  → Continue to Stage B     │
└─────────────────────────────────┘

STAGE B: Deep Analysis (With Backend)
┌─────────────────────────────────┐
│ popup.js:                       │
│   requestDeepScan()             │
│   ↓                             │
│ content_script REQUEST_DEEP_    │
│ SCAN                            │
│   ↓                             │
│ Call: extractFullEmailData()    │
│   Find div.a3s (body)           │
│   Find h2[data-thread-perm-id]  │
│   (subject)                     │
│   Find [data-email] (sender)    │
│   Extract <a href> (links)      │
│   ↓                             │
│ Return {ok, emailData: {...}}   │
│                                 │
│ popup.js:                       │
│   callBackendScan(emailData)    │
│   POST /scan                    │
│   ↓                             │
│ Backend analysis                │
│   ↓                             │
│ Return {risk_level, confidence, │
│    explanations, links}         │
│   ↓                             │
│ Show result in panel            │
└─────────────────────────────────┘
```

---

## 🔧 Key Functions

### content_script.js

```javascript
// STAGE A: Lightweight heuristic
inboxLightScan()
  Purpose: Quick keyword check on inbox rows
  Input: None (queries DOM)
  Output: {sender, subject, snippet, score, riskLevel, keywords}[]
  Backend: NO
  Time: <100ms

// STAGE B: Extract data for backend
extractFullEmailData()
  Purpose: Get email components for analysis
  Input: None (queries DOM)
  Output: {sender, subject, body, links, success}
  Backend: NO (just extraction)
  Time: 50-100ms
```

### popup.js

```javascript
// Send Stage A request
requestInboxScan(tab)
  Message: REQUEST_SCAN_INBOX
  Response: {ok, candidates}
  Time: ~100ms

// Send Stage B request
requestDeepScan(tab)
  Message: REQUEST_DEEP_SCAN
  Response: {ok, emailData}
  Time: ~100ms

// Send to backend
callBackendScan(emailData)
  POST: http://localhost:5000/scan
  Body: {sender, subject, body, links}
  Response: {risk_level, confidence_score, explanations, suspicious_links}
  Time: 1-2 seconds
```

### panel.js

```javascript
// Display based on content
renderScanning()     // "Analyzing..."
renderError(msg)     // Error in red
renderResult(result) // Backend response
showCandidates()     // Stage A results
showNoResults()      // "Clean" message

// Drag & position
makePanelDraggable(el, handle)
restorePanelPosition(el)
```

---

## 📋 File Changes Summary

| File | Lines | Change |
|------|-------|--------|
| content_script.js | 260-378 | Added inboxLightScan() |
| content_script.js | 384-495 | Added extractFullEmailData() |
| content_script.js | 870-920 | Updated handlers |
| popup.js | 88-108 | Added requestDeepScan() |
| popup.js | 114-140 | Added callBackendScan() |
| popup.js | 146-259 | Rewrote scan button handler |
| panel.js | — | No changes needed |

---

## 🎯 Message Types

```javascript
// Request messages (popup → content)
REQUEST_SCAN_INBOX      // Stage A
REQUEST_DEEP_SCAN       // Stage B (NEW)
REQUEST_SCAN_MESSAGE    // Legacy
SHOW_CANDIDATES         // Display Stage A
SHOW_RESULT             // Display Stage B

// Response messages (content → panel)
CS_INBOX_SCAN_RESULT    // Stage A result
CS_SCAN_RESULT          // Stage B result
```

---

## 🔍 Selectors Reference

```javascript
// Subject extraction
h2[data-thread-perm-id]     // Primary
span[data-subject-perm-id]  // Fallback 1
h2                          // Fallback 2
"Unknown"                   // Last resort

// Sender extraction
[data-email]                // Primary
.gVNoLb span                // Fallback 1
[role="main"] span          // Fallback 2
"unknown"                   // Last resort

// Body extraction
div.a3s                     // Primary (Gmail standard)
div[aria-label*="Message"]  // Fallback 1
div.ii                      // Fallback 2
[role="main"] div           // Fallback 3
""                          // Last resort

// Links extraction
a[href]                     // Inside body
```

---

## ⚡ Thresholds & Scoring

```javascript
// Inbox heuristic threshold
0.40 = Medium risk minimum
0.70 = High risk

// Keyword scores
"verify" + "account"  = +0.35
"urgent"              = +0.25
"suspend" + "account" = +0.30
"click" + "password"  = +0.25
Max score: 1.0

// Risk levels
score < 0.40   = Low
0.40 ≤ s < 0.70 = Medium
score ≥ 0.70   = High
```

---

## 🛠️ Debug Tips

### Enable Logs
```javascript
// Already logged at:
// content_script: logContent(level, msg, data)
// popup: logPopup(level, msg, data)
// panel: console.log()
```

### Check Content Script
```
1. Open page → Right-click → Inspect
2. Go to Console tab
3. Filter: "CampusShield"
4. Look for DEBUG messages
```

### Check Popup
```
1. Right-click extension icon
2. Click "Inspect popup"
3. Console shows logPopup() calls
4. Look for requestInboxScan/requestDeepScan
```

### Check Backend
```
1. Terminal running python app.py
2. Look for POST /scan requests
3. Response should have risk_level
```

### Test with Mock Email
```html
<!-- Create [role="row"] for Stage A testing -->
<div role="row">
  <span>attacker@phish.com</span>
  <span data-tooltip="Urgent: Verify Account">Verify</span>
  <span>Click immediately</span>
</div>
```

---

## 🧪 Test Scenarios

| Scenario | Expected | Actual |
|----------|----------|--------|
| Gmail inbox + fake email | Stage A flags with Medium | ✅ |
| Gmail open message | Stage B calls backend | ✅ |
| Clean email | Shows "Clean" | ✅ |
| No backend | Error message | ✅ |
| Panel drag | Position saves | ✅ |
| Multiple keywords | Higher score | ✅ |

---

## 🚨 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| No candidates shown | Score < 0.40 | Email not suspicious enough |
| Backend error | localhost:5000 not running | Start Flask backend |
| Content script not injecting | Permission issue | Check manifest.json permissions |
| Selector not finding element | Gmail DOM changed | Fallback selectors should handle |
| Panel not dragging | Old cache | Clear chrome storage |

---

## 📞 Support

**Questions about Stage A (Inbox Heuristic)**:
- See: inboxLightScan() lines 260-378
- Check: Keyword scoring logic
- Test: Mock email with suspicious text

**Questions about Stage B (Deep Extraction)**:
- See: extractFullEmailData() lines 384-495
- Check: Selector fallback chains
- Test: Open real Gmail message

**Questions about popup.js flow**:
- See: Scan button handler lines 146-259
- Check: requestInboxScan() vs requestDeepScan()
- Monitor: Popup console logs

**Questions about panel UI**:
- See: panel.js renderResult() function
- Check: Backend response fields
- Verify: CSS styling for risk levels

---

## 📚 Documentation Files

1. **PHASE2_TWO_STAGE_IMPLEMENTATION.md** - Full overview
2. **PHASE2_MESSAGE_FLOW.md** - Message protocol + visual flows
3. **PHASE2_VALIDATION_CHECKLIST.md** - Testing guide
4. **PHASE2_STATUS_REPORT.md** - Project status
5. **This file** - Quick reference

---

## ✅ Implementation Status

- [x] Stage A implementation complete
- [x] Stage B implementation complete
- [x] Popup orchestration complete
- [x] Backend integration ready
- [x] Panel UI verified
- [x] Error handling in place
- [x] Documentation complete
- [x] Ready for testing

**Phase 2 Status**: 🟢 READY FOR PRODUCTION TESTING
