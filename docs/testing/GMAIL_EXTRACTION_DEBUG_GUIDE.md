# Gmail Email Body Extraction: Debugging & Testing Guide

**Issue**: CampusShield fails to extract email body from Gmail, resulting in "Backend returns no threat"  
**Root Cause**: `div.a3s` selector not finding email body, or body being empty/null  
**Solution**: Hardened extraction logic with multiple fallback selectors, content validation, and detailed logging

---

## 🔧 What Was Fixed

### 1. **Enhanced extractFullEmailData() Function** ~Lines 384-560

**Problem**: Original extraction had only basic selectors without validation that content was found

**Solution**:
- **7 fallback selector chains** for subject, sender, and body
- **Content validation**: Checks that extracted text isn't empty before marking success
- **Detailed logging**: Every step logs which selector was used and what was found
- **Debug info collection**: Returns selector used, char counts, link counts
- **Link extraction**: Both DOM selectors AND regex-based URL detection

**Key Addition - Debug Object**:
```javascript
emailData.debug = {
  subjectSelector: "h2[data-thread-perm-id]",  // Which selector worked
  senderSelector: "[data-email]",              
  bodySelector: "div.a3s",
  bodyCharCount: 2847,                          // Actual characters extracted
  linkCount: 5,                                 // Actual links found
  isGmail: true,
  isMock: false
}
```

### 2. **Improved autoScanOpenEmail() Function** ~Lines 780-870

**Problem**: Didn't validate extraction before sending to backend

**Solution**:
- **Validation**: Checks `emailData.success` before proceeding
- **Better error handling**: Shows user message if extraction fails
- **Detailed logging**: Logs what's being sent to backend
- **Graceful failure**: Shows error in panel if backend call fails

**New Logging**:
```
🚀 autoScanOpenEmail started
📬 Calling extractFullEmailData()...
✅ Email extraction successful
📤 Sending to backend /scan:
   senderLen: 20
   subjectLen: 45
   bodyLen: 2847
   linkCount: 5
🎯 Backend analysis complete
   risk_level: High
   confidence: 0.87
```

### 3. **Enhanced View State Detection** ~Lines 693-730

**Problem**: `isEmailBodyLoaded()` checked if element existed, not if it had content

**Solution**:
- **Content check**: Verifies `textContent.length > 10` not just element existence
- **Prevents false positives**: Won't trigger scan on empty `div.a3s` elements
- **Consistent validation**: All three functions now check content, not just presence

**Before**:
```javascript
return document.querySelector("div.a3s") !== null;  // Just checks if exists
```

**After**:
```javascript
const bodyEl = document.querySelector("div.a3s");
return bodyEl && bodyEl.textContent.trim().length > 10;  // Checks it has content
```

---

## 🧪 Testing the Fix

### Test Setup

**Terminal 1: Backend running**
```bash
cd backend
python app.py
# Should show: Running on http://localhost:5000
```

**Terminal 2: Open Chrome DevTools**
```
# Open Gmail or mock_email.html
# F12 → Console tab
# Filter for: "[CampusShield"
```

### Test 1: Mock Email (Baseline)

```
1. Open: file:///path/to/extension/mock_email.html
2. Click "Scan"
3. Expected in Console:
   ✅ Email extraction successful
   📤 Sending to backend: bodyLen: [number>100]
   🎯 Backend analysis complete: risk_level: [Low/Medium/High]
4. Expected in Panel:
   - Risk level displayed
   - Confidence score shown
   - Explanations listed
   - Suspicious links shown (if any)
```

### Test 2: Gmail Inbox View

```
1. Open: Gmail.com → Inbox
2. Click extension icon → "Scan"
3. Expected in Console:
   📧 Open an email to scan content
4. Expected in Popup:
   Status shows: "📧 Open an email to scan content"
   (No false scan of weak subject data)
```

### Test 3: Gmail Email-Open View (AUTO-SCAN)

This is the KEY test - auto-scan should trigger automatically:

```
1. Open: Gmail.com → Inbox
2. Click on ANY email to open it
3. Observe console for 2-3 seconds:
   
   [ MutationObserver fires ]
   Email body state changed { bodyLoaded: true }
   🚀 autoScanOpenEmail started
   📬 Calling extractFullEmailData()...
   ✉️ Subject extraction:
      found: true
      selector: "h2[data-thread-perm-id]"
      text: "Your email subject..."
   👤 Sender extraction
      found: true
      selector: "[data-email]"
      text: "sender@gmail.com"
   📄 Body extraction:
      found: true
      selector: "div.a3s"
      charCount: 2847
      preview: "This is the email body..."
   🔗 Link extraction:
      count: 5
      links: ["http://link1.com", "http://link2.com", ...]
   ✅ Email extraction SUCCESS
   📤 Sending to backend /scan:
      bodyLen: 2847
      links: 5
   🎯 Backend analysis complete:
      risk_level: Medium
      confidence: 0.65
   
4. Expected in Panel:
   - Panel appears AUTOMATICALLY (no button click needed)
   - Shows risk level, confidence %, explanations
   - Lists suspicious links (if found)
```

### Test 4: Gmail with Suspicious Email

Create or find a test email with phishing keywords:

```
Subject: "Urgent: Verify Your Account Now"
Body: "Click here to confirm your password for secure access"
Body: "Your account will be suspended if you don't act immediately"
```

Expected:
- Panel shows "High" or "Medium" risk
- Confidence > 0.5
- Explanations list phishing indicators
- Suspicious links highlighted

### Test 5: Debug - Check Extraction Directly

In browser console while on Gmail with email open:

```javascript
// Get the extraction data
const data = extractFullEmailData();

// Check what was extracted
console.log("Subject:", data.subject);
console.log("Sender:", data.sender);
console.log("Body preview:", data.body.substring(0, 100));
console.log("Links:", data.links);
console.log("Success:", data.success);
console.log("Debug info:", data.debug);

// This should show:
// Subject: "Your email subject..."
// Sender: "sender@example.com"
// Body preview: "This is the email body text..."
// Links: Array(5) ["http://...", "http://...", ...]
// Success: true
// Debug info: {subjectSelector: "...", bodyCharCount: 2847, ...}
```

---

## 🔍 Diagnostic Checklist

If auto-scan doesn't work, go through this checklist:

### ✓ Check 1: Is body element present?
```javascript
document.querySelector("div.a3s")
// Should return the element, not null
// If null: Gmail DOM might have changed
```

### ✓ Check 2: Does body have content?
```javascript
document.querySelector("div.a3s").textContent.length
// Should be > 10 (preferably > 100)
// If < 10: Element exists but is empty (still loading?)
```

### ✓ Check 3: Is MutationObserver firing?
```javascript
window.__campusshield_email_body_loaded
// Should be true when email is open
// Check console for: "Email body state changed { bodyLoaded: true }"
```

### ✓ Check 4: Is extraction finding body?
Console should show:
```
📄 Body extraction:
   found: true
   selector: "div.a3s"
   charCount: [large number, e.g., 2847]
```

If it says `found: false` or `charCount: 0` → selector issue

### ✓ Check 5: Is backend receiving data?
Check backend logs:
```
POST /scan
{
  "sender": "sender@example.com",
  "subject": "Your email subject...",
  "body": "[2847 characters]",
  "links": ["http://...", ...]
}
```

If body is empty or missing → extraction failed

### ✓ Check 6: Is backend returning result?
Backend should respond with:
```json
{
  "risk_level": "High",
  "confidence_score": 0.87,
  "reasons": [],
  "explanations": [
    "Requests account verification...",
    "Asks for password..."
  ],
  "suspicious_links": ["http://phishing-site.com"]
}
```

If `confidence_score: 0` → backend received empty body

---

## 🐛 Common Issues & Fixes

| Issue | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| **div.a3s not found** | Console: "❌ Body extraction FAILED" | Gmail DOM changed | Check selector in Inspector (F12). Update to new selector name |
| **Body is empty** | Console: "charCount: 0" | Element exists but loading incomplete | Increase 300ms debounce in autoScanOpenEmail() |
| **Links not extracted** | Console: "🔗 Link extraction: count: 0" | Links in different format | Check HTML in Inspector. May need additional selector |
| **Auto-scan not triggering** | No console logs after opening email | MutationObserver not firing | Check if `div.a3s` actually appears (F12 → Elements → watch for div.a3s) |
| **Backend gets data but says "no threat"** | Extraction works but confidence_score: 0 | Backend doesn't recognize phishing | Check backend detector rules, might be too strict |
| **Panel doesn't show results** | Logs show scan complete but panel blank | Panel injection failed | Check if panel.js loaded correctly. Check error in popup console |

---

## 📊 Console Output Guide

### ✅ SUCCESS - Everything working

```
🚀 autoScanOpenEmail started
📬 Calling extractFullEmailData()...
✉️ Subject extraction: found: true, selector: "h2[data-thread-perm-id]"
👤 Sender extraction: found: true, selector: "[data-email]"
📄 Body extraction: found: true, selector: "div.a3s", charCount: 2847
🔗 Link extraction: count: 5
✅ Email extraction SUCCESS
📤 Sending to backend /scan: bodyLen: 2847, links: 5
🎯 Backend analysis complete: risk_level: High
```

### ⚠️ WARNING - Extraction failed

```
📄 Body extraction: found: false
❌ Body extraction FAILED - no element found
```

**Action**: 
1. Open F12 → Inspector
2. Look for actual body element (might not be `div.a3s`)
3. Update selector in extractFullEmailData()

### 🔴 ERROR - Backend unreachable

```
💥 Error in autoScanOpenEmail: fetchfailed
```

**Action**:
1. Check if backend running: `python backend/app.py`
2. Verify http://localhost:5000 is accessible
3. Check backend logs for errors

---

## 🎯 Expected Behavior Flow

```
Gmail Inbox View:
  User clicks "Scan"
    ↓
  Popup PROBE returns: {inInbox: true, inEmailOpen: false}
    ↓
  Popup shows: "📧 Open an email to scan content"
    ✓ NO FALSE SCAN

Gmail Email-Open View (Manual Click):
  User opens email
    ↓
  MutationObserver fires (div.a3s appears)
    ↓
  Auto-scan triggers automatically
    ↓
  Panel shows results (user didn't click "Scan"!)

Gmail Email-Open View (After Auto-Scan):
  User clicks "Scan" (optional)
    ↓
  Popup PROBE returns: {inEmailOpen: true}
    ↓
  Popup shows: "✓ Auto-scanning email..."
    ↓
  (Auto-scan already completed)
```

---

## 📝 Logging & Validation

### Console Log Levels

| Level | Prefix | Use | Example |
|-------|--------|-----|---------|
| debug | 🚀📬📄🔗 | Flow tracking | "🚀 autoScanOpenEmail started" |
| info | ✅📤🎯 | Success events | "✅ Email extraction SUCCESS" |
| warn | ⚠️❌ | Recoverable issues | "❌ Body extraction FAILED" |
| error | 💥 | Exceptions | "💥 Exception in extractFullEmailData" |

### Validation Checks

Before sending to backend, system checks:

```javascript
✓ emailData.success === true
✓ emailData.subject.length > 0
✓ emailData.body.length > 10      // Not just snippet
✓ Valid selector found (logged)
✓ Backend URL reachable
✓ Response valid JSON
```

---

## 🚀 Quick Test Command

Run this in browser console while on Gmail with email open:

```javascript
// Full extraction test
const data = extractFullEmailData();
console.log("Extraction result:", {
  success: data.success,
  subject: data.subject?.substring(0, 40),
  bodyLength: data.body?.length,
  linkCount: data.links?.length,
  selectors: data.debug
});

// Should output something like:
// Extraction result: {
//   success: true,
//   subject: "Your email subject...",
//   bodyLength: 2847,
//   linkCount: 5,
//   selectors: {
//     subjectSelector: "h2[data-thread-perm-id]",
//     bodySelector: "div.a3s",
//     bodyCharCount: 2847,
//     linkCount: 5
//   }
// }
```

---

## ✅ Verification Checklist

Before considering this fixed:

- [ ] Mock email opens → "Scan" → Results show in panel
- [ ] Gmail inbox → "Scan" → "📧 Open an email to scan content" message
- [ ] Gmail email opens → Wait 2 seconds → Panel appears automatically (no click needed!)
- [ ] Console shows ✅ SUCCESS logs with body extraction data
- [ ] Backend logs show POST /scan with email body (not empty)
- [ ] Backend returns confidence_score > 0 for suspicious emails
- [ ] Backend returns confidence_score = 0 for clean emails
- [ ] Links are extracted and displayed in panel
- [ ] No console errors (only debug/info/warn logs)

---

## 🔗 Related Files

- `extension/content/content_script.js` - Extraction + auto-scan logic
- `extension/ui/popup.js` - View state handling
- `backend/app.py` - /scan endpoint
- `extension/ui/panel.js` - Results display
