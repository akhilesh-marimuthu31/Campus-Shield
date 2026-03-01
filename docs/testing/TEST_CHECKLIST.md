# Quick Test Checklist - Gmail Extraction Fix

**Start here** to verify the Gmail email body extraction fix is working.

---

## ⚡ 5-Minute Test

### Step 1: Backend Running (30 sec)
```bash
cd backend
python app.py
# Check for: "Running on http://127.0.0.1:5000" ✓
```

### Step 2: Extension Loaded (30 sec)
```
1. chrome://extensions/
2. Find "Campus Shield"
3. Toggle ON (should be blue)
```

### Step 3: Mock Email Test (1 min)
```
1. Open: file:///C:/Users/marim/Campus-Shield/extension/mock_email.html
2. F12 → Console tab
3. Click "Scan" button
4. Look for: ✅ Email extraction successful
5. Look for: 🎯 Backend analysis complete
6. Expected panel: Shows risk level + confidence + explanations ✓
```

### Step 4: Gmail Inbox Test (1 min)
```
1. Open: Gmail.com → Inbox
2. Console should be clear (no auto-scan logs yet)
3. Click extension icon
4. Look for in popup: "📧 Open an email to scan content" ✓
5. No false scan of subject line ✓
```

### Step 5: Gmail Auto-Scan Test (1.5 min) ⭐ CRITICAL TEST
```
1. Still in Gmail Inbox
2. Click on ANY email to open it
3. Watch console for 2-3 seconds
4. Look for:
   ✅ "🚀 autoScanOpenEmail started"
   ✅ "📄 Body extraction: found: true, charCount: [large#]"
   ✅ "✅ Email extraction SUCCESS"
   ✅ "🎯 Backend analysis complete"
5. Look for in panel: Results appear automatically (NO BUTTON CLICK!) ✓
6. Expected panel shows: Risk level, confidence score, explanations ✓
```

---

## If Test 5 Failed ❌

### Debug Step A: Check if body element exists
Open Gmail with email, then in console:
```javascript
document.querySelector("div.a3s")
// Should return: <div class="a3s">...</div>
// If null: Gmail DOM might have changed
```

### Debug Step B: Check if body has content
```javascript
document.querySelector("div.a3s").textContent.length
// Should return: [number] (typically > 100)
// If < 10: Element exists but content not loaded yet
```

### Debug Step C: Check if MutationObserver fired
Console should have logged:
```
Email body state changed { bodyLoaded: true }
```
If missing: MutationObserver not detecting element

### Debug Step D: Manually trigger extraction
```javascript
const data = extractFullEmailData();
console.log(data);
// Check: 
//   success: true,
//   body.length: [large number],
//   links.length: [number, typically 0-5]
```

### Debug Step E: Check backend logs
Look at backend terminal:
```
POST /scan
Form data: sender, subject, body, links
```
If body is empty: Extraction function failing

---

## What Each Test Verifies

| Test | What It Checks | Pass Condition |
|------|-----------------|---|
| Mock Email | Baseline extraction works | Panel shows results |
| Inbox View | Doesn't false-scan inbox | Shows "Open an email..." message |
| Email-Open **⭐** | Auto-scan triggers automatically | Panel appears without clicking "Scan" |
| Console Logs | Extraction produced data | Shows "✅ SUCCESS" with body extraction details |
| Backend Response | Phishing detector runs | Panel shows risk level & confidence |

---

## 🎯 Expected Console Output (Successful Auto-Scan)

When opening a Gmail email, console should show:

```
🚀 autoScanOpenEmail started
📬 Calling extractFullEmailData()...
✉️ Subject extraction: found: true, selector: h2[data-thread-perm-id]
👤 Sender extraction: found: true, selector: [data-email]
📄 Body extraction: found: true, selector: div.a3s, charCount: 2847
🔗 Link extraction: count: 5
✅ Email extraction SUCCESS
📤 Sending to backend /scan:
   senderLen: 20
   subjectLen: 45
   bodyLen: 2847
   linkCount: 5
🎯 Backend analysis complete
   risk_level: High
   confidence: 0.87
```

---

## 🔴 Critical Issue - Auto-Scan Not Triggering

Check these (in order):

1. **Is div.a3s present?**
   - Open Gmail email
   - F12 → Inspector
   - Ctrl+F → search for "div.a3s"
   - Should find the element ✓

2. **Is div.a3s visible?**
   - Some Gmail emails might load in different container
   - Look for alternative: `div.ii`, `[role="main"] div`
   - Report new selector in logs

3. **Is MutationObserver working?**
   - Console should show: "Email body state changed" when opening email
   - If missing: Background observer might not be attached
   - Check: `window.__campusshield_mutation_observer` exists

4. **Is autoScanOpenEmail() function defined?**
   ```javascript
   typeof autoScanOpenEmail === 'function'
   // Should return: "function"
   ```

5. **Is there an error preventing execution?**
   - Look for 💥 error logs
   - Might be: TypeError, ReferenceError, CORS error, etc.

---

## 📊 Sanity Checks

Run these in browser console to verify:

```javascript
// Check 1: Extraction function exists
typeof extractFullEmailData === 'function'
// → "function" ✓

// Check 2: Auto-scan function exists
typeof autoScanOpenEmail === 'function'
// → "function" ✓

// Check 3: Body element exists
document.querySelector("div.a3s") !== null
// → true (when email open) ✓

// Check 4: Body has content
document.querySelector("div.a3s").textContent.length > 10
// → true ✓

// Check 5: Backend reachable
fetch('http://localhost:5000/').then(r => r.status).catch(e => "Error: " + e)
// → 404 or 200 (both mean server is reachable) ✓
```

---

## ✅ Passing All Tests Means

✔️ Gmail extraction working perfectly  
✔️ Auto-scan triggers automatically  
✔️ Body content being retrieved  
✔️ Links being found  
✔️ Backend receiving data  
✔️ Phishing detection active  
✔️ Results displaying in panel  

**→ Gmail phishing detection is FIXED** 🎉

---

## 📝 Test Results Template

Save results here:

```
Test Date: ___________
Backend Running: [ ] Yes [ ] No
Extension Loaded: [ ] Yes [ ] No

Test 1 - Mock Email: [ ] Pass [ ] Fail
  Issue: ___________

Test 2 - Gmail Inbox: [ ] Pass [ ] Fail
  Issue: ___________

Test 3 - Gmail Auto-Scan: [ ] Pass [ ] Fail ⭐ CRITICAL
  Issue: ___________

Console Shows Body Extraction: [ ] Yes [ ] No
Backend Receives Body: [ ] Yes [ ] No

Overall Status: [ ] Working [ ] Needs Debug
```

---

## 🚀 If All Tests Pass

🎉 Congratulations! Gmail phishing detection is operational.

Now test in production with:
- Real phishing emails (if available)
- Legitimate emails (verify no false positives)
- Different Gmail layouts (newer/older UI versions)
- Different email content types (plain text, HTML, mixed)

Next steps:
1. Test on 5-10 real Gmail emails
2. Monitor console for any extraction failures
3. If failures occur, note the selector issue and update fallback chain
4. Run final integration test with full email workflows
