# Quick Test Guide: Trust-Based Phishing Detection

**How to verify the improved scoring system works**

---

## Setup

### Terminal 1: Start Backend
```bash
cd c:\Users\marim\Campus-Shield
python backend/app.py
# Expected: Running on http://127.0.0.1:5000
```

### Terminal 2: Run Tests
```bash
cd c:\Users\marim\Campus-Shield
python test_trust_scoring.py
# Expected: ✅ ALL TESTS PASSED!
```

---

## API Testing with curl

### Test 1: Trusted Domain Email (Should be LOW)
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "security@google.com",
    "subject": "Verify your Google account",
    "body": "Please verify your account urgently. Click here to confirm.",
    "links": ["https://google.com/verify"]
  }' | jq .
```

**Expected:**
```json
{
  "risk_level": "Low",
  "confidence_score": 0.0,
  "explanation": "This email appears SAFE. ... ✓ Sender is from a trusted domain..."
}
```

---

### Test 2: Phishing Email (Should be HIGH)
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "alert@phishing.com",
    "subject": "URGENT: Verify your account NOW",
    "body": "Your account will be suspended immediately unless you verify now. Click the link.",
    "links": ["http://phishing.com/verify"]
  }' | jq .
```

**Expected:**
```json
{
  "risk_level": "High",
  "confidence_score": 0.85,
  "explanation": "This email has HIGH phishing risk... urgency + verification..."
}
```

---

### Test 3: Newsletter with Unsubscribe (Should be LOW)
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "news@example.com",
    "subject": "Weekly newsletter - Verify your subscription",
    "body": "Please verify your email subscription.\n\n© 2026 Example Corp\nTo unsubscribe: https://example.com/unsub",
    "links": ["https://example.com/verify", "https://example.com/unsub"]
  }' | jq .
```

**Expected:**
```json
{
  "risk_level": "Low",
  "confidence_score": 0.0,
  "explanation": "... ✓ Email has legitimate footer/unsubscribe link..."
}
```

---

### Test 4: Prize Scam (Should be MEDIUM-HIGH)
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "lottery@random-scam.com",
    "subject": "Congratulations! You won!",
    "body": "You have won $1,000,000! Claim your prize immediately: http://claim-prize.net/now",
    "links": ["http://claim-prize.net/now"]
  }' | jq .
```

**Expected:**
```json
{
  "risk_level": "Medium",
  "confidence_score": 0.47,
  "explanation": "... prize/reward claims... detected suspicious link..."
}
```

---

### Test 5: Trusted Domain with Domain Match (Should be LOW)
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "support@github.com",
    "subject": "GitHub repository activity",
    "body": "Your repository has activity. Visit https://github.com/repo to see details.",
    "links": ["https://github.com/repo"]
  }' | jq .
```

**Expected:**
```json
{
  "risk_level": "Low",
  "confidence_score": 0.0,
  "explanation": "... ✓ Sender is from a trusted domain... ✓ Links match sender domain..."
}
```

---

## Check Response Fields

All responses should include:
```json
{
  "risk_level": "High|Medium|Low|Unknown",
  "confidence_score": 0.XX,              // Float 0.0-1.0
  "reasons": [...],                      // Array of rule IDs
  "explanations": [...],                 // Array of bullet points
  "suspicious_links": [...],             // Array of URLs
  "explanation": "...",                  // NEW: Natural language summary
  "status": "success"
}
```

---

## Expected Confidence Scores

| Scenario | Score | Risk | Trust Signals |
|----------|-------|------|---------------|
| Clean email, trusted sender | 0.0 | Low | Trusted domain |
| Newsletter with unsubscribe | 0.0 | Low | Unsubscribe footer |
| Verify urgency, trusted sender | 0.0 | Low | Trusted + domain match |
| Urgency + verify links | 0.85+ | High | Amplified (combo) |
| Prize + domain mismatch | 0.40-0.50 | Medium | Amplified |
| Clean email, unknown sender | 0.0 | Low | No threats |
| Multiple threats, unknown | 0.70+ | High | All threats |

---

## Confidence vs. Risk Thresholds

```
0.00 - 0.39  →  Low Risk     ✓ Safe to interact
0.40 - 0.69  →  Medium Risk  ⚠ Be cautious
0.70 - 1.00  →  High Risk    ✗ Likely phishing
```

---

## Browser Testing

### Gmail Test
1. Open Gmail.com
2. Open any email
3. Extension auto-scans → Panel shows:
   - Risk level (Low/Medium/High)
   - Confidence score
   - Explanations (bullet list)
   - NEW: Natural language summary (if UI updated)
   - Suspicious links

### Mock Email Test
1. Open `extension/mock_email.html`
2. Click "Scan" button
3. Panel shows same fields as Gmail test

---

## Verify Trust Domain Allowlist

The extension trusts these domains by default:
```
google.com, gmail.com, mail.google.com
github.com
amd.com
unstop.com
stanford.edu, harvard.edu, mit.edu
microsoft.com, apple.com, amazon.com
```

**Test:** Send an email from any of these → Risk automatically reduced

---

## Verify Trust Signals

### Signal 1: Trusted Sender Domain
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "alert@microsoft.com",
    "subject": "Verify account",
    "body": "Please verify your account immediately",
    "links": []
  }' | jq .confidence_score
# Expected: MUCH lower than 0.5, often 0.0
```

### Signal 2: Unsubscribe Detection
```bash
# Include "unsubscribe" in body or URL
curl ... -d '{
  "sender": "news@unknown.com",
  "subject": "Newsletter",
  "body": "... To unsubscribe: http://example.com/unsub",
  "links": ["http://example.com/unsub"]
}' | jq .explanation
# Expected: Mentions "✓ Email has legitimate footer/unsubscribe link"
```

### Signal 3: Domain Alignment
```bash
# sender domain == link domain
curl ... -d '{
  "sender": "support@github.com",
  "subject": "Verify",
  "body": "Verify here: https://github.com/verify",
  "links": ["https://github.com/verify"]
}' | jq .explanation
# Expected: Mentions "✓ Links match sender domain"
```

---

## Verify Risk Amplification

### Amplification 1: Urgency + Verify
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "attacker@evil.com",
    "subject": "URGENT ACTION NEEDED",
    "body": "Click immediately to verify your login: http://evil.com/login",
    "links": ["http://evil.com/login"]
  }' | jq '.confidence_score, .explanation'
# Expected: Score ~0.85 (HIGH), mentions urgency AND verification combo
```

### Amplification 2: Prize + Unknown
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "prize@spam.com",
    "subject": "You won!",
    "body": "Congratulations! Claim your prize: http://other-domain.com/claim",
    "links": ["http://other-domain.com/claim"]
  }' | jq '.confidence_score, .risk_level'
# Expected: Score ~0.40-0.50 (MEDIUM), increased from base rule score
```

---

## Natural Language Explanation Examples

**LOW Risk (Trusted Sender):**
```
This email appears SAFE. Confidence: 0%.
✓ Sender is from a trusted domain.
✓ Links match sender domain (legitimate).
This appears to be a legitimate email.
```

**MEDIUM Risk (Prize Scam):**
```
This email has MEDIUM phishing risk. Confidence: 47%.
Detected: prize/reward claims.
Found 1 suspicious link(s).
⚠ Be cautious. Verify sender independently before acting.
```

**HIGH Risk (Phishing):**
```
This email has HIGH phishing risk. Confidence: 87%.
Detected: high-pressure urgency language, requests for account verification.
Found 1 suspicious link(s).
⚠ Do not click links or provide information. Report as spam.
```

---

## Troubleshooting

### Score still 0.0 for obvious phishing?
- Check if sender is in trusted domain allowlist
- If yes, that's correct behavior (trusted domains get big reduction)
- Reduce trust reduction weights if needed

### Score too high for legitimate emails?
- Check if email has unsubscribe footer
- Check if sender domain matches link domain
- Add more trust signals if needed

### Explanation field missing?
- Ensure backend running with updated code
- Check `/scan` endpoint response includes `explanation` field

### Different scores than expected?
- Order of operations matters (threat → reduce → amplify)
- Max/min capping may affect final score
- Use test suite to verify exact scoring

---

## Performance Notes

- Detection runs <50ms per email
- No external API calls
- No ML models (rule-based only)
- Lightweight: ~20KB Python code

---

**Ready to test!** 🚀
