# Quick Test Guide - CampusShield Implementations

**Last Updated:** March 1, 2026  
**Implementations:** Inbox scanner, Email extraction, Panel dragging, Backend graceful handling

---

## Test 1: Gmail Inbox Scanner 🔍

**Objective:** Verify inbox-level phishing detection works correctly

### Step 1: Setup
```bash
# Terminal 1: Start backend
cd c:\Users\marim\Campus-Shield
python backend/app.py
# Expected: Running on http://127.0.0.1:5000
```

### Step 2: Test Gmail detection
```
1. Open Gmail.com in Chrome
2. Open DevTools (F12)
3. Go to Console tab
4. Manually trigger inbox scan:

chrome.tabs.query({active: true}, tab => {
  chrome.tabs.sendMessage(tab[0].id, {type: "REQUEST_SCAN_INBOX"}, r => {
    console.log("Inbox scan result:", r);
  });
});

5. Expected result:
   {
     ok: true,
     candidates: [
       {
         subject: "...",
         snippet: "...",
         sender: "...",
         score: 0.65,
         riskLevel: "Medium",
         keywords: ["urgency"]
       }
     ]
   }
```

### Step 3: Verify selectors used
```
Check console for logs like:
✅ inboxLightScan: scanning 25 inbox rows (Gmail: true)
✅ Subject extraction: found: true, selector: "span.bog"
✅ Sender extraction: found: true, selector: "span.yX"
✅ Snippet extraction: found: true, selector: "span.y2"
```

### Step 4: Verify highlighting
```
1. In Gmail inbox, rows with high risk should show:
   - "SUSPICIOUS" badge (red)
   - Additional highlighting (if implemented)
2. Check that only rows matching heuristics are highlighted
```

---

## Test 2: Email Extraction with Fallbacks 📧

**Objective:** Verify email body extraction works and tries fallbacks

### Step 1: Setup (same backend)

### Step 2: Test div.gmail_quote fallback
```
1. Open any email in Gmail
2. Wait 2 seconds for auto-scan to trigger
3. Check console for logs:
   ✅ Email extraction successful
   📄 Body extraction: found: true, selector: "div.a3s"

4. If body is quoted/forwarded, might see:
   📄 Body extraction: found: true, selector: "div.gmail_quote"
```

### Step 3: Verify partial extraction works
```
1. Open an email with minimal content
2. Check console for:
   ✅ Email extraction SUCCESS (shows partial data)
   📬 Sending to backend:
      senderLen: 20
      subjectLen: 45
      bodyLen: 150        ← Partial body OK
      linkCount: 0

3. Panel should still display result (not error)
```

### Step 4: Test extraction debugging
```
In console, run:
const data = extractFullEmailData();
console.log("Extraction debug:", {
  success: data.success,
  selectorUsed: data.debug.bodySelector,
  bodyChars: data.debug.bodyCharCount,
  linksFound: data.debug.linkCount
});

Expected output:
{
  success: true,
  selectorUsed: "div.gmail_quote",  ← Might be .gmail_quote fallback
  bodyChars: 2847,
  linksFound: 3
}
```

---

## Test 3: Backend Graceful Partial Payloads ⚙️

**Objective:** Verify backend accepts partial data without 400 errors

### Step 1: Test with curl
```bash
# Terminal 2 (different from backend)
cd c:\Users\marim\Campus-Shield

# Test 1: Empty JSON
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d "{}"
# Expected: 200 OK with risk_level: "Unknown"

# Test 2: Only body field
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{"body": "Click here to verify your account"}'
# Expected: 200 OK with analysis result

# Test 3: Missing body field (subject + sender only)
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{"sender": "attacker@phishing.com", "subject": "Urgent: Verify account"}'
# Expected: 200 OK with result (might be low confidence)

# Test 4: All fields present
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{"sender": "attacker@phishing.com", "subject": "Verify now!", "body": "Click link immediately"}'
# Expected: 200 OK with high confidence result
```

### Step 2: Expected responses
```javascript
// For empty or insufficient data:
{
  "risk_level": "Unknown",
  "confidence_score": 0.0,
  "reasons": [],
  "explanations": ["Insufficient data to analyze"],
  "suspicious_links": [],
  "status": "success"
}

// For partial/complete data:
{
  "risk_level": "High",
  "confidence_score": 0.85,
  "reasons": ["verify_account", "urgency_pressure"],
  "explanations": ["Email requests verification...", "..."],
  "suspicious_links": [],
  "status": "success"
}

// NEVER got: HTTP 400 or 500 errors
```

### Step 3: Verify no 400 errors
```bash
# Check that we never get HTTP 400
while true; do
  curl -s -w "\n%{http_code}\n" -X POST http://localhost:5000/scan \
    -H "Content-Type: application/json" \
    -d '{}' | tail -1
  # Should always be 200, never 400
done
```

---

## Test 4: Panel Dragging 🖱️

**Objective:** Verify panel can be dragged and position persists

### Step 1: Open panel
```
1. Open Gmail and any email
2. Wait for auto-scan (panel should appear)
3. Or manually click extension → Scan on any email
```

### Step 2: Test dragging
```
1. Position mouse on blue header ("CampusShield")
2. Cursor should change to "move" cursor
3. Click and drag header to new position
4. Panel should move smoothly
5. Panel should NOT move off-screen (bounds checked)
```

### Step 3: Test saving position
```
1. Drag panel to specific spot (e.g., bottom-right)
2. Release mouse
3. Check DevTools:
   ✅ Panel position saved: {top: 500, left: 800, width: 350, height: 500}
4. Reload page
5. Panel should reappear at same position
```

### Step 4: Test edge cases
```
1. Drag to top-left corner (0,0)
   - Panel should snap to (0,0), not go negative
2. Drag to bottom-right (window edge)
   - Panel edges should align with window, not go off-screen
3. Try dragging from close button (×)
   - Should NOT start drag, should close panel instead
```

### Step 5: Test mouse events (not pointer)
```
In browser console, verify makePanelDraggable uses mouse events:
// Open DevTools → Sources → Set breakpoint on "mousedown"
// Drag panel header
// Breakpoint should hit mousedown listener

If breakpoint doesn't hit: pointer events are being used instead
```

---

## Verification Checklist

### Inbox Scanner
- [ ] `tr.zA` selector correctly identifies Gmail inbox rows
- [ ] `.bog`, `.y2`, `.yX` selectors extract subject/snippet/sender
- [ ] Heuristic scoring classifies emails correctly
- [ ] Suspicious emails highlighted with badge
- [ ] No scanning of full page text

### Email Extraction
- [ ] `div.a3s` still primary selector
- [ ] `div.gmail_quote` fallback works for quoted messages
- [ ] Partial extraction doesn't throw errors
- [ ] Debug logging shows which selector was used
- [ ] All 6 fallback paths tried in order

### Backend
- [ ] Empty JSON returns HTTP 200 with "Unknown"
- [ ] Missing fields returns HTTP 200 (no 400)
- [ ] Invalid email format handled gracefully
- [ ] Always returns valid JSON response
- [ ] Never returns 400/500 status codes

### Panel Dragging
- [ ] Mouse events (mousedown/mousemove/mouseup) work
- [ ] Pointer events not used (compatibility improved)
- [ ] Position saved to `chrome.storage.local`
- [ ] Position restored on page reload
- [ ] Bounds enforced (no off-screen dragging)
- [ ] Close button still works while dragging

---

## Troubleshooting

### Issue: Inbox scanner finds no candidates
**Check:**
1. Are you in Gmail #inbox view? (Check URL hash)
2. Do rows exist? Open inspector → Ctrl+F search for "tr.za" (case-insensitive)
3. Are .bog/.y2/.yX selectors present? If not, Gmail DOM may have changed
4. Check console for "inboxLightScan: scanning 0 rows"

**Fix:**
- Update selector to match actual Gmail DOM
- Check with generic `[role="row"]` fallback

### Issue: Email body not extracting
**Check:**
1. Is email actually open? (See div.a3s in inspector)
2. Check console for "📄 Body extraction:" logs
3. If showing `charCount: 0`, element found but empty
4. If not finding div.a3s, check for div.gmail_quote

**Fix:**
- Verify email is fully loaded (wait 2-3 secs)
- Check which fallback selector actually has content

### Issue: Backend returning 400 errors (old behavior)
**Check:**
1. Are you running the updated app.py?
2. Check backend logs for validation errors
3. Verify changes were saved to app.py

**Fix:**
```bash
# Restart backend
python backend/app.py
```

### Issue: Panel position not saving
**Check:**
1. Chrome DevTools → Application → Storage → Local Storage
2. Should see entry with key "panelPosition"
3. Check for console errors: "Panel position saved"

**Fix:**
- Clear browser cache
- Verify chrome.storage.local permission in manifest

---

## Success Criteria

✅ **All tests pass when:**
1. Gmail inbox scanning finds and classifies suspicious emails
2. Email extraction tries all 6 fallback paths, uses .gmail_quote when needed
3. Backend accepts all payloads (empty/partial/complete) and returns HTTP 200
4. Panel can be dragged via mouse events and position persists across reloads

---

## Quick Debug Commands

```javascript
// In browser console:

// Check if we're in inbox view
location.hash.includes("#inbox")

// Check if inbox rows exist
document.querySelectorAll('tr.zA').length
document.querySelectorAll('[role="row"]').length

// Check Gmail selectors
document.querySelector('span.bog')?.textContent          // Subject
document.querySelector('span.y2')?.textContent          // Snippet
document.querySelector('span.yX')?.textContent          // Sender

// Check email body
document.querySelector('div.a3s')?.textContent?.length  // Primary
document.querySelector('div.gmail_quote')?.textContent?.length  // Fallback

// Check panel position storage
chrome.storage.local.get(['panelPosition'], console.log)

// Manually test extraction
extractFullEmailData()
```

---

**Ready to test!** 🚀
