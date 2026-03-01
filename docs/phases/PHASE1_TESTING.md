# CampusShield Phase 1 - Testing Guide

## Overview
Phase 1 implements a lightweight JS-based phishing detector for Gmail inbox and message views. The detector scans visible inbox rows and open messages using rule-based analysis with no backend dependency (for basic functionality).

---

## Prerequisites

### System Requirements
- Windows 10+
- Chrome/Chromium browser (v90+)
- Python 3.8+
- Node.js/npm (for simple-http-server, or use Python's http.server)

### Repository Structure
```
Campus-Shield/
├── backend/
│   ├── app.py
│   ├── detector.py
│   └── requirements.txt
├── extension/
│   ├── manifest.json
│   ├── ui/
│   │   ├── panel.html
│   │   ├── panel.js
│   │   ├── popup.html
│   │   └── popup.js
│   ├── content/
│   │   └── content_script.js
│   └── background/
│       └── service_worker.js
└── demo_emails/
    └── (demo HTML files for testing)
```

---

## Setup Steps

### 1. Configure Python Environment (Backend)

```powershell
# Open PowerShell at the backend/ directory
cd c:\Users\marim\Campus-Shield\backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 2. Run Flask Backend (Optional - only needed if testing with backend integration)

```powershell
# In the backend directory with venv activated
python app.py

# Expected output:
# * Running on http://127.0.0.1:5000
```

The Flask backend will be available at `http://localhost:5000`.

### 3. Start Static File Server for Demo Page

You need to serve the mock email page via HTTP. Choose one option:

#### Option A: Using Python (Recommended - no setup)
```powershell
# In the extension/ directory
cd c:\Users\marim\Campus-Shield\extension

# Start Python HTTP server on port 8000
python -m http.server 8000

# Expected output:
# Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/)
```

Access the mock page at: `http://localhost:8000/mock_email.html`

#### Option B: Using Node.js
```powershell
# Install simple-http-server globally (one-time)
npm install -g simple-http-server

# In the extension/ directory
cd c:\Users\marim\Campus-Shield\extension
simple-http-server
```

Access the mock page at: `http://localhost:8000/mock_email.html`

### 4. Load Extension into Chrome

1. **Open Chrome Extensions Page**
   - Navigate to: `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Select the `extension/` folder: `c:\Users\marim\Campus-Shield\extension`
   - Extension should appear in the list as "CampusShield"

3. **Verify Installation**
   - Icon should appear in Chrome toolbar
   - Check console for: `✅ CampusShield content script running`

---

## Testing Scenarios

### Test 1: Mock Email Page (Easiest Entry Point)

**Goal**: Verify detector works on local HTML demo page

**Steps**:
1. Open `http://localhost:8000/mock_email.html`
2. Verify the page loads (should show email with sender, subject, body)
3. Click the **CampusShield icon** in the toolbar
4. Click **"Scan"** button in popup
5. **Expected Result**:
   - Popup shows status: "Scan requested..."
   - Panel appears on page showing:
     - **Risk Level** (Low/Medium/High based on content)
     - **Confidence %** 
     - Suspicious phrases detected (explanations)
     - Suspicious links (if any)
   - Panel is draggable by the header

**Test Emails Included**:
- The mock page contains a demo email with phishing indicators (urgency, account verification request, etc.)

### Test 2: Gmail Inbox View

**Goal**: Verify detector works on real Gmail interface

**Prerequisites**:
- Must be logged into Gmail at `mail.google.com`
- Must have visible emails in inbox

**Steps**:
1. Open **Gmail** in a tab
2. Wait for inbox to load (make sure sidebar shows inbox list)
3. Click **CampusShield icon** in toolbar
4. Click **"Scan"** button
5. **Expected Result**:
   - Popup shows: "Found X suspicious email(s). Check the panel."
   - Panel appears showing the first suspicious candidate detected
   - If no suspicious emails: "No suspicious emails found."
   - Panel can be dragged; position is saved to `chrome.storage.local`

**Gmail Selectors Used** (may need tuning for UI changes):
- Inbox rows: `tr.zA` or `[role="row"]`
- Sender: `[data-email]`, `[email]`, `.yW span`
- Subject: `.y6 [data-tooltip]`
- Preview: `.FHCB`

### Test 3: Gmail Open Message View

**Goal**: Verify detector works when user opens a single email

**Steps**:
1. Open **Gmail** and **open an email** (click to expand)
2. Click **CampusShield icon**
3. Click **"Scan"** button
4. **Expected Result**:
   - Popup shows risk level (Low/Medium/High) and status
   - Panel displays full message analysis:
     - Extracted subject and body
     - Phishing rule matches and explanations
     - Suspicious links detected

**Gmail Selectors Used**:
- Message body: `div.a3s` or `div.ii.gt` or `[role="main"] .adn`
- Subject: `h2[data-thread-perm-id]`
- Sender: `span[data-email]` or `.gVNoLb span`

### Test 4: Panel Persistence & Dragging

**Goal**: Verify panel position is saved across refreshes

**Steps**:
1. Open mock email or Gmail
2. Scan an email (panel appears)
3. **Drag the panel** to a new position by the header
4. **Refresh the page** (F5)
5. Scan again
6. **Expected Result**:
   - Panel appears in the **same position** as before refresh
   - Position stored in `chrome.storage.local` under key `panelPosition`

**Debug**: Check Chrome DevTools > Application > Local Storage

### Test 5: Error Handling

**Goal**: Verify graceful handling of connection issues

**Scenario A: Content script not injected on unsupported page**
1. Open a non-email page (e.g., `google.com`)
2. Click CampusShield icon > Scan
3. **Expected Result**:
   - Popup shows: "Not an email page. Open an email to scan."
   - Button remains enabled for retry

**Scenario B: Gmail initialization message**
1. Just after opening Gmail tab, click Scan immediately
2. **Expected Result**:
   - Popup shows: "Initializing... try again."
   - User can retry after a moment

**Scenario C: Probe and auto-injection**
1. Click Scan on a supported page for first time
2. If content script isn't injected, it should auto-inject and retry
3. **Expected Result**: Automatic retry with friendly message

---

## Detector Rules Reference

The Phase 1 detector checks for 8 phishing indicators:

| Rule ID | Patterns | Weight | Example |
|---------|----------|--------|---------|
| `urgency_pressure` | "urgent", "act now", "immediately" | 0.15 | "Act now to secure your account" |
| `verify_account` | "verify your account", "confirm identity" | 0.20 | "Please verify your account" |
| `account_suspension` | "suspended", "locked", "restricted" | 0.18 | "Your account has been suspended" |
| `password_request` | "reset password", "provide password" | 0.20 | "Update your password now" |
| `click_link_urgency` | "click here", "click the link" | 0.12 | "Click here to proceed" |
| `payment_claim` | "billing", "invoice", "payment failed" | 0.13 | "Your payment failed. Update billing." |
| `prize_claim` | "congratulations", "claim prize", "you won" | 0.10 | "Congratulations! You won!" |
| `misspelled_brand` | "gmai", "gogle", "micorsoft" | 0.08 | "From: support@gmai.com" |

**Risk Level Thresholds**:
- **High**: Score ≥ 0.70
- **Medium**: Score ≥ 0.40
- **Low**: Score < 0.40

**URL Analysis** also adds to score (max +0.40):
- IP-based URLs: +0.18
- Missing HTTPS: +0.12
- URL shorteners (bit.ly, t.co, etc.): +0.15
- Long URLs (>100 chars): +0.10
- Many path segments (>5): +0.08
- Suspicious TLDs (.tk, .ml, .ga, .cf, .gq): +0.12
- URLs with keywords (login, verify, etc.): +0.10

---

## Debugging Tips

### 1. Check Console Logs

**Popup Console**:
```
Right-click extension icon → Inspect popup
```
Look for: `[CampusShield popup]` prefix

**Content Script Console**:
```
On Gmail/mock page: F12 → Console
```
Look for: `[CampusShield content]` prefix

**Panel Console** (inside iframe):
```
F12 → find iframe for campusshield-panel
```
Or right-click inside panel and "Inspect"

### 2. Check Storage

**Panel Position Storage**:
```
F12 → Application → Local Storage → http://localhost:8000
Look for: panelPosition
```

### 3. Reload Extension

After making code changes:
1. Go to `chrome://extensions/`
2. Click the **refresh icon** on CampusShield
3. Reload the email page (Ctrl+R)
4. Re-test

### 4. Common Issues

**Issue**: Panel doesn't appear
- Solution: Check console for errors. Verify iframe is being injected. Check z-index (should be 2147483647).

**Issue**: Selectors not finding elements
- Solution: Gmail UI changes frequently. Use DevTools to inspect actual DOM and update selectors in code (see comments).

**Issue**: "Could not establish connection" message keeps appearing
- Solution: Ensure content script injected. Clear extension cache (reload at `chrome://extensions/`).

**Issue**: Position not being saved
- Solution: Check if `chrome.storage.local` is accessible. Verify extension has `storage` permission in manifest.json.

---

## Files Modified in Phase 1

### Content Script
- **File**: `extension/content/content_script.js`
- **New Features**:
  - Detector module with RULES array
  - `detectFromText()` - rule-based text analysis
  - `detectLinksInText()` - URL extraction
  - `analyzeUrlsSuspicion()` - URL analysis
  - `scanVisibleInbox()` - inbox row scanning
  - `extractOpenMessageText()` - open message extraction
  - `addCandidateBadge()` - row highlighting (future)
  - Message handlers: `REQUEST_SCAN_INBOX`, `REQUEST_SCAN_MESSAGE`, `SHOW_CANDIDATES`, `SHOW_RESULT`
  - `gmailNavigationObserver` - navigation detection (500ms debounce)

### Panel JS
- **File**: `extension/ui/panel.js`
- **New Features**:
  - `makePanelDraggable()` - pointer event-based dragging
  - `restorePanelPosition()` - restore from chrome.storage.local
  - `showCandidates()` - display inbox scan results
  - `showNoResults()` - display "clean" status
  - Pointer event handling (more modern than mouse events)

### Popup JS
- **File**: `extension/ui/popup.js`
- **New Features**:
  - `requestInboxScan()` - REQUEST_SCAN_INBOX messaging
  - `requestMessageScan()` - REQUEST_SCAN_MESSAGE messaging
  - Fallback logic: try inbox scan, then message scan
  - "Initializing... try again" message for Gmail
  - Candidate count display (`Found X suspicious email(s)`)

### Manifest (No changes needed)
- Already has required permissions: `storage`, `scripting`, `host_permissions`

---

## Performance Notes

- **Inbox scan**: O(n) where n = visible rows (usually <50)
- **Message extraction**: Single DOM query pass
- **Detector rules**: Regex matching on combined text (400ms for ~1000 rule patterns on typical email)
- **Total scan time**: Usually < 1 second

---

## Next Steps (Phase 2 Roadmap)

1. **List View**: Show all suspicious candidates in panel, not just first
2. **Backend Integration**: Use `scanEmail` endpoint for more advanced analysis
3. **User Feedback**: Learn from user actions to improve rules
4. **Performance**: Cache results, lazy-load panel
5. **Admin Features**: Manage whitelist, tune rules

---

## Support

For issues or questions:
1. Check console logs (see Debugging Tips above)
2. Test on mock email page first (simplest to debug)
3. Verify all files were updated
4. Reload extension at `chrome://extensions/`
5. Hard refresh page (Ctrl+Shift+R)
