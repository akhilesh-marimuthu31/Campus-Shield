# Implementation: Trust-Based Phishing Detection Scoring

**Date:** March 1, 2026  
**Status:** ✅ COMPLETE & TESTED

---

## Overview

Enhanced the phishing detection backend with a trust-based scoring system that:
1. **Balances threat signals with legitimacy signals**
2. **Implements domain reputation (hardcoded allowlist)**
3. **Applies risk reduction for trust indicators**
4. **Amplifies risk for dangerous combinations**
5. **Generates natural-language explanations**

---

## Key Changes

### 1. Domain Reputation System

**Trusted Domains Allowlist** (hardcoded in `TRUSTED_DOMAINS`):
```python
TRUSTED_DOMAINS = {
    'google.com', 'gmail.com', 'mail.google.com',
    'github.com', 'amd.com', 'unstop.com',
    'stanford.edu', 'harvard.edu', 'mit.edu',
    'microsoft.com', 'apple.com', 'amazon.com'
}
```

**Effect:** Email from trusted domain → risk reduced by 0.25

---

### 2. Trust Signals (Risk Reduction)

#### Signal 1: Trusted Sender Domain
- **Condition:** Sender's domain is in TRUSTED_DOMAINS
- **Reduction:** -0.25 confidence
- **Example:** `security@google.com` → Low risk even with "verify account" language

#### Signal 2: Unsubscribe/Footer Indicators
- **Condition:** Email contains unsubscribe link, company footer, or marketing footer patterns
- **Reduction:** -0.10 confidence
- **Detected patterns:**
  - Keywords: "unsubscribe", "opt out", "manage preferences"
  - URLs containing: "unsubscribe", "opt-out", "manage"
  - Footer patterns: "©", "all rights reserved", "contact us", "powered by"

#### Signal 3: Sender-Link Domain Match
- **Condition:** Sender's domain matches link destination domain
- **Reduction:** -0.15 confidence
- **Example:** Email from `admin@github.com` with link to `github.com/...` → legitimate

---

### 3. Risk Amplification (Risk Increase)

#### Amplification 1: Urgency + Verification Links Combo
- **Condition:** Email has BOTH urgency language AND links with "verify/login/signin/auth/confirm/account"
- **Amplification:** +0.15 confidence
- **Rationale:** Urgency alone is warning; urgency + verification combo is classic phishing

#### Amplification 2: Prize/Reward from Unknown Sender
- **Condition:** Email claims prize AND sender NOT from trusted domain
- **Amplification:** +0.10 confidence
- **Rationale:** Prize claims from unknown senders are nearly always phishing

---

### 4. Natural-Language Explanation

**New field:** `explanation` (string) - Single comprehensive summary

**Includes:**
- Risk classification (HIGH/MEDIUM/LOW with confidence %)
- Detected threats (urgent language, account verification requests, etc.)
- Detected suspicious links
- Trust signals found (trusted domain, unsubscribe, domain match)
- Actionable recommendation

**Example:**
```
This email has HIGH phishing risk. Confidence: 87%.
Detected: high-pressure urgency language, requests for account verification, threats of account suspension.
Found 1 suspicious link(s). 
⚠ Do not click links or provide information. Report as spam.
```

---

## Scoring Algorithm

```
1. Base Threat Score = Rule Matches + URL Analysis
   (max 1.0)

2. Apply Trust Reduction
   threat_reduction = 0
   if trusted_sender: threat_reduction += 0.25
   if unsubscribe_footer: threat_reduction += 0.10
   if sender_link_match: threat_reduction += 0.15
   
   adjusted_score = max(0, threat_score - trust_reduction)

3. Apply Risk Amplification
   if urgency + verify_links: amplification += 0.15
   if prize + unknown_sender: amplification += 0.10
   
   final_score = min(adjusted_score + amplification, 1.0)

4. Determine Risk Level
   if final_score >= 0.70: "High"
   elif final_score >= 0.40: "Medium"
   else: "Low"
```

---

## API Response Structure

**Endpoint:** `POST /scan`

**Request:**
```json
{
  "sender": "user@example.com",
  "subject": "Email subject",
  "body": "Email body content",
  "links": ["http://link1.com", "http://link2.com"]
}
```

**Response:**
```json
{
  "risk_level": "High|Medium|Low|Unknown",
  "confidence_score": 0.0-1.0,
  "reasons": ["urgency_pressure", "verify_account", "suspicious_link"],
  "explanations": [
    "Email uses high-pressure urgency language.",
    "Email requests verification of account credentials.",
    "Email contains 1 suspicious link(s)."
  ],
  "suspicious_links": ["http://bit.ly/x"],
  "explanation": "This email has HIGH phishing risk. Confidence: 87%...",
  "status": "success"
}
```

**New field:** `explanation` - Natural-language summary

---

## Files Modified

### 1. `backend/detector.py`
- Added `TRUSTED_DOMAINS` constant (hardcoded allowlist)
- Added `explanation` field to `DetectionResult` dataclass
- Added helper methods:
  - `_extract_base_domain()` - Extract base domain from subdomain
  - `_is_trusted_domain()` - Check domain reputation
  - `_check_unsubscribe_or_footer()` - Detect legitimacy indicators
  - `_sender_domain_matches_link_domain()` - Check domain alignment
  - `_has_urgency_and_verification_links()` - Detect phishing combo
  - `_should_amplify_risk()` - Calculate risk amplification
  - `_generate_explanation()` - Generate natural-language summary
- Rewrote `analyze()` method with trust-based scoring logic

### 2. `backend/app.py`
- Updated all `/scan` endpoint responses to include `explanation` field
- Maintains backward compatibility (no breaking changes)

---

## Test Coverage

**8 comprehensive tests pass:**
1. ✅ Trusted domain reduces risk for emails with "verify account"
2. ✅ Urgency + verification links trigger HIGH risk (amplification)
3. ✅ Unsubscribe footer reduces risk significantly
4. ✅ Sender-link domain match reduces risk
5. ✅ Prize from unknown sender with domain mismatch triggers MEDIUM risk
6. ✅ Natural language explanation is generated
7. ✅ Clean email from trusted domain = LOW risk (0% confidence)
8. ✅ All response fields present and correct types

---

## UI Compatibility

**No breaking changes to frontend:**
- Existing `explanations` array (bullet list) still present
- New `explanation` field (summary) is optional
- All existing panel.js rendering logic still works
- Future UI updates can display either/both fields

---

## Examples

### Example 1: Legitimate Google Email
```
Email: security@google.com → verify your account
Score: 0.0 (LOW risk)
Reason: Trusted domain reduces risk to 0%
```

### Example 2: Phishing Email
```
Email: attacker@phishing.com → URGENT verify NOW or suspended!
Score: 0.87 (HIGH risk)
Reason: Urgency + verification combo amplifies risk
```

### Example 3: Newsletter Unsubscribe
```
Email: newsletter@example.com → verify subscription [unsubscribe link]
Score: 0.0 (LOW risk)
Reason: Unsubscribe footer indicates legitimacy
```

### Example 4: Prize Scam
```
Email: lottery@random.com → You won! Claim prize!
Score: 0.47 (MEDIUM risk)
Reason: Prize claim + domain mismatch in links
```

---

## Improvements Over Original

| Aspect | Before | After |
|--------|--------|-------|
| Legitimate emails flagged | ✗ Yes (false positives) | ✓ Reduced (trusted domains excluded) |
| Phishing emails missed | ✗ Yes (confidence ~0.35) | ✓ Caught (confidence amplification) |
| Explains WHY classified? | ✗ Bullet list only | ✓ Natural language + bullets |
| Domain reputation | ✗ None | ✓ Trusted domain allowlist |
| Footer/unsubscribe check | ✗ No | ✓ Yes (-0.10 reduction) |
| Sender-link alignment | ✗ Minimal | ✓ -0.15 reduction |
| Dangerous combos? | ✗ No amplification | ✓ Urgency+verify, prize+unknown |
| Explainability | ✗ Rules only | ✓ Natural language + rules |

---

## Production Readiness

✅ **Syntax validated** - Both detector.py and app.py compile without errors  
✅ **Test suite passes** - All 8 tests pass, covering trust signals and amplification  
✅ **Backward compatible** - No breaking changes to frontend or existing fields  
✅ **Lightweight** - No ML models, only rule-based heuristics  
✅ **Explainable** - Every decision can be traced and understood  
✅ **Mock-friendly** - Works with both mock_email.html and Gmail  

---

## Next Steps (Optional)

1. **Expand trust domain allowlist** based on user feedback
2. **Add organization reputation** for enterprise domains
3. **Implement user feedback loop** to retrain domain list
4. **A/B test confidence thresholds** with real users
5. **Display natural language explanation** in UI panel

---

**Status: ✅ Ready for production testing**
