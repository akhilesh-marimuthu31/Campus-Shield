# CampusShield Phase 1 - Manual Testing Checklist

## Pre-Test Setup

### Environment Preparation
- [ ] Python virtual environment activated (`.\venv\Scripts\Activate.ps1`)
- [ ] Flask backend running on `http://localhost:5000` (optional, not required for Phase 1)
- [ ] Static server running: `python -m http.server 8000` from `extension/` folder
- [ ] Extension loaded in Chrome from `chrome://extensions/` (Developer mode ON)
- [ ] Extension icon visible in Chrome toolbar

### Verification Steps
```powershell
# Terminal 1: Check Flask (optional)
cd c:\Users\marim\Campus-Shield\backend
python app.py
# Should output: Running on http://127.0.0.1:5000

# Terminal 2: Check Static Server
cd c:\Users\marim\Campus-Shield\extension
python -m http.server 8000
# Should output: Serving HTTP on 0.0.0.0 port 8000

# Browser: Verify extension loaded
chrome://extensions/  # Look for CampusShield
F12 on Gmail/mock page # Console should show: ✅ CampusShield content script running
```

---

## Test Suite 1: Mock Email Page

### T1.1 - Basic Scan (Mock Email)
**Goal**: Verify detector finds phishing indicators on local HTML page

**Setup**:
1. Open `http://localhost:8000/mock_email.html`
2. Verify page loads with email content visible

**Execute**:
- [ ] Click CampusShield icon in toolbar
- [ ] Popup appears with "Scan" button
- [ ] Click "Scan" button

**Expected Results**:
- [ ] Popup status changes to "Scanning..."
- [ ] Panel appears on page within 2-3 seconds
- [ ] Panel shows:
  - [ ] Risk Level: "High" or "Medium" (not Low)
  - [ ] Confidence Score: >40%
  - [ ] Explanations section with 2-4 bullet points
  - [ ] Suspicious Links section with detected URLs

**Debug if Failed**:
```
F12 → Console
Look for: 
- [CampusShield content] scanVisibleInbox called
- [CampusShield popup] REQUEST_SCAN_INBOX response
```

---

### T1.2 - Panel Dragging (Mock Email)
**Goal**: Verify panel is draggable and position persists

**Setup**: 
- Panel visible on page from T1.1

**Execute**:
- [ ] Position mouse on panel **header** (where "CampusShield" text is)
- [ ] Click and drag panel to different position (e.g., top-left)
- [ ] Release mouse

**Expected Results**:
- [ ] Panel moves smoothly during drag
- [ ] Panel stays within viewport bounds
- [ ] After release, panel remains in new position

**Continue**:
- [ ] Refresh page (F5)
- [ ] Scan again (click "Scan")

**Expected Results**:
- [ ] New panel appears in **same position** as before refresh
- [ ] Position persisted correctly

**Debug if Failed**:
```
F12 → Application → Local Storage → http://localhost:8000
Look for key: panelPosition
Expected value: { top: ..., left: ..., width: 360, height: 420 }
```

---

### T1.3 - Close Button (Mock Email)
**Goal**: Verify panel can be closed

**Setup**:
- Panel visible on page

**Execute**:
- [ ] Click the **X button** in top-right of panel header

**Expected Results**:
- [ ] Panel disappears immediately
- [ ] Console shows no errors

---

### T1.4 - Dismiss Button (Mock Email)
**Goal**: Verify dismiss button works

**Setup**:
- Scan again to show panel

**Execute**:
- [ ] Click "Dismiss" button at bottom of panel

**Expected Results**:
- [ ] Panel closes
- [ ] Can scan again and panel reappears

---

## Test Suite 2: Gmail Inbox View

### T2.1 - Gmail Inbox Scan
**Goal**: Verify detector finds suspicious emails in Gmail inbox list

**Setup**:
1. Open `https://mail.google.com/`
2. Wait for inbox to load (ensure you see email list)
3. Verify you have at least 5 visible emails

**Execute**:
- [ ] Click CampusShield icon
- [ ] Click "Scan" button

**Expected Results**:
- [ ] Status shows: "Found X suspicious email(s). Check the panel." OR "No suspicious emails found."
- [ ] If X > 0:
  - [ ] Panel appears with risk level
  - [ ] First candidate displayed with explanations
- [ ] If X = 0:
  - [ ] Panel shows "Clean" status with 0% score

**Debug if Failed**:
```
Console logs:
- [CampusShield content] scanVisibleInbox: found N visible rows
- [CampusShield popup] REQUEST_SCAN_INBOX response
```

---

### T2.2 - Gmail Inbox Persistence
**Goal**: Verify panel position saved in Gmail

**Setup**:
- Panel visible in Gmail inbox view

**Execute**:
- [ ] Drag panel to new position
- [ ] Click an email to open it
- [ ] Go back to inbox (click back or Gmail back button)
- [ ] Scan inbox again

**Expected Results**:
- [ ] Panel appears in **same saved position**

---

## Test Suite 3: Gmail Open Message View

### T3.1 - Single Message Scan
**Goal**: Verify detector works on opened email

**Setup**:
1. Open Gmail inbox
2. Click an email to open/expand it
3. Verify message body visible

**Execute**:
- [ ] Click CampusShield icon
- [ ] Click "Scan" button

**Expected Results**:
- [ ] Popup shows status (risk level or "No suspicious")
- [ ] Panel appears with analysis:
  - [ ] Risk Level (High/Medium/Low)
  - [ ] Confidence score
  - [ ] Extracted explanations
  - [ ] Any detected suspicious links

---

### T3.2 - Message Analysis Detail
**Goal**: Verify detector correctly analyzes message content

**Setup**:
- Open an email that contains phishing indicators (urgency, account verification requests, etc.)

**Execute**:
- [ ] Scan the message
- [ ] Check panel results

**Expected Results**:
- [ ] Explanations match visible email content
- [ ] If email has "verify your account": explanation shown
- [ ] If email has "urgent": explanation shown
- [ ] If email has links: shown in Suspicious Links section

---

## Test Suite 4: Error Handling

### T4.1 - Non-Email Page
**Goal**: Verify extension doesn't scan unsupported pages

**Setup**:
1. Open `https://www.google.com/` (or any non-email page)

**Execute**:
- [ ] Click CampusShield icon
- [ ] Click "Scan" button

**Expected Results**:
- [ ] Popup shows: "Not an email page. Open an email to scan."
- [ ] No panel created
- [ ] Button re-enabled for next attempt

---

### T4.2 - Gmail Initialization
**Goal**: Verify handling of immediate scan on Gmail

**Setup**:
1. Open `https://mail.google.com/`
2. **Do NOT wait** for inbox to fully load
3. Immediately click extension icon

**Execute**:
- [ ] Click "Scan" while Gmail still loading

**Expected Results**:
- [ ] Popup shows: "Initializing... try again." OR "Initializing..." message
- [ ] After 2-3 seconds, can click "Scan" again (auto-injected)

---

### T4.3 - Content Script Injection
**Goal**: Verify auto-injection of content script

**Setup**:
1. Open any supported email page (Gmail or mock)
2. Open DevTools (F12)

**Execute**:
- [ ] First time clicking "Scan" (script not yet injected)
- [ ] Watch console during execution

**Expected Results**:
- [ ] First attempt: Console shows injection message
- [ ] Second popup: Shows correct results
- [ ] No error messages in console

---

## Test Suite 5: Rule Detection

### T5.1 - Urgency Rule
**Goal**: Verify "urgent/act now" detection

**Test on Email With**: "Act now to secure your account"
- [ ] Scan email
- [ ] Expected Result: Explanation appears: "Email uses high-pressure urgency language."

---

### T5.2 - Account Verification Rule
**Goal**: Verify "verify account" detection

**Test on Email With**: "Please verify your account to continue"
- [ ] Scan email
- [ ] Expected Result: Explanation appears: "Email requests verification of account credentials."

---

### T5.3 - Account Suspension Rule
**Goal**: Verify "suspended/locked" detection

**Test on Email With**: "Your account has been suspended"
- [ ] Scan email
- [ ] Expected Result: Explanation appears: "Email threatens account suspension or lockout."

---

### T5.4 - Password Request Rule
**Goal**: Verify "password" detection

**Test on Email With**: "Click here to reset your password"
- [ ] Scan email
- [ ] Expected Result: Explanation appears: "Email requests password or login information."

---

### T5.5 - Click Link Urgency Rule
**Goal**: Verify "click here" detection

**Test on Email With**: "Click here to verify"
- [ ] Scan email
- [ ] Expected Result: Explanation appears: "Email urges clicking a link or button."

---

### T5.6 - URL Suspicion Detection
**Goal**: Verify URL analysis

**Test on Email With Multiple Links**:
- A short URL (bit.ly, t.co)
- A URL without HTTPS
- A long obfuscated URL

- [ ] Scan email
- [ ] Expected Result: 
  - [ ] Score increased beyond text rules
  - [ ] Suspicious links listed in panel
  - [ ] Suspicious links highlighted in page (if applicable)

---

## Test Suite 6: Regression Tests

### T6.1 - Multiple Scans
**Goal**: Verify repeated scanning works without issues

**Setup**:
- Open mock email or Gmail

**Execute**:
- [ ] Scan, close panel
- [ ] Scan again, check results
- [ ] Repeat 5 times

**Expected Results**:
- [ ] All scans complete successfully
- [ ] No memory leaks or slowdown
- [ ] Console shows no error accumulation

---

### T6.2 - Extension Reload
**Goal**: Verify extension works after reload

**Execute**:
- [ ] Go to `chrome://extensions/`
- [ ] Click refresh icon on CampusShield
- [ ] Return to Gmail/mock page
- [ ] Refresh page (F5)
- [ ] Scan

**Expected Results**:
- [ ] Scan completes successfully
- [ ] Console shows fresh initialization
- [ ] No lingering errors

---

### T6.3 - Long Email Content
**Goal**: Verify performance with large emails

**Setup**:
- Open an email with very long body (1000+ words)

**Execute**:
- [ ] Scan email
- [ ] Measure time in console

**Expected Results**:
- [ ] Scan completes in <3 seconds
- [ ] Console shows completion time
- [ ] No "hang" or frozen UI

---

## Test Suite 7: Console Logging

### T7.1 - Check Debug Output
**Goal**: Verify logging for troubleshooting

**Execute**:
1. Open page (mock email or Gmail)
2. Open DevTools (F12)
3. Click "Scan"
4. Watch console output

**Expected Results**:
You should see:
```
✅ CampusShield content script running: [URL]
[CampusShield popup] Probing content script...
[CampusShield popup] REQUEST_SCAN_INBOX response...
[CampusShield content] scanVisibleInbox: found N rows
✅ Panel position saved: {...}
```

---

## Edge Cases & Known Issues

### Known Gmail Selector Limitations
- **Issue**: Some Gmail versions use different DOM classes
- **Workaround**: Use DevTools to inspect actual structure and report
- **Selector that may need updating**: 
  - Inbox row: `tr.zA`
  - Sender extraction: `[data-email]`, `.yW span`
  - Subject extraction: `.y6 [data-tooltip]`
  - Message body: `div.a3s`

### Known Edge Cases
1. **Brand new Gmail tabs**: May show "Initializing" message (normal)
2. **Multiple extension instances**: Only one panel shown at a time (OK)
3. **Private/Incognito mode**: Extension not loaded by default; enable in settings
4. **Very long URLs**: May not display fully in panel (text-overflow handled via CSS)

---

## Pass/Fail Criteria

### Must Pass (Critical)
- [x] T1.1 - Mock email scan finds indicators
- [x] T2.1 - Gmail inbox scan works
- [x] T3.1 - Gmail message scan works
- [x] T4.1 - Error handling on non-email page
- [x] T5.1 through T5.6 - All rules detected
- [x] T6.1 - Multiple scans without errors

### Should Pass (High Priority)
- [x] T1.2 - Panel dragging and persistence
- [x] T2.2 - Position saved across navigation
- [x] T7.1 - Proper debug logging

### Nice to Have (Future)
- [ ] T6.3 - Performance optimization
- [ ] More advanced URL reputation checking
- [ ] Backend integration

---

## Bug Report Template

If you encounter issues, please document:

```
## Bug Report

**Title**: [Brief description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [...]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Environment**:
- Chrome version: [e.g., 120.0.6099.129]
- Extension version: 0.2
- Page: [Gmail/Mock/Other]
- Screenshots/Console logs:
```

---

## Success Criteria Summary

✅ **Phase 1 Complete When**:
- All Test Suite 1-5 tests pass
- No console errors
- Panel dragging works smoothly
- Detector finds correct phishing indicators
- Error messages are user-friendly
- Extension doesn't break existing Gmail functionality

**Estimated Test Time**: 30-45 minutes for full suite
