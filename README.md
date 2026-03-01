# CampusShield

> An AI-powered phishing detection browser extension protecting students from email-based attacks with low false positives.

---

## The Problem

Students are prime targets for phishing attacks. Email-based phishing causes 90% of data breaches, with attackers impersonating universities, tech platforms, and job opportunities to harvest credentials. Traditional detection methods generate excessive false positives, training users to ignore warnings—making them more vulnerable.

**CampusShield solves this** with intelligent classification using domain reputation + AI decision-making to catch real threats while trusting legitimate sources.

---

## What is CampusShield?

A **Chrome browser extension + Python backend** that:

- ✅ Scans emails in Gmail and other platforms in real-time
- ✅ Classifies emails using rule-based detection + AI decision layer
- ✅ Operates with **LOW false positives** by prioritizing sender reputation
- ✅ Displays actionable risk levels (Low, Medium, High) with confidence scores
- ✅ Masks PII and operates with **privacy-first architecture**
- ✅ Works locally (backend runs on user's machine or network)

---

## User Flow

```
1. User opens an email (Gmail inbox or message)
   ↓
2. Clicks "Scan Email" button in CampusShield extension
   ↓
3. Content script extracts: sender, subject, body, links
   ↓
4. Request sent to backend: /scan endpoint
   ↓
5. Backend analyzes with:
   • Rule-based detection engine (domain reputation, urgency patterns, credential requests)
   • AI decision layer (contextual classification with low false-positive logic)
   ↓
6. Response includes: risk_level, confidence_score, reasoning, suspicious_links
   ↓
7. Results display in floating panel:
   • Risk level with color coding (🟢 Low / 🟡 Medium / 🔴 High)
   • Confidence percentage
   • Clear explanation in plain language
   • List of suspicious links (if any)
```

---

## AI Decision Layer (Implemented)

CampusShield uses a sophisticated AI-driven classification system that **reduces false positives** by prioritizing domain reputation and contextual signals:

### ✅ Trusted/Safe Signals (Strongly Reduce Risk)
- Sender domain from: Google, Microsoft, Amazon, universities (.edu, .ac.in), hackathon platforms (hack2skill.com, unstop.com, hackerearth.com)
- Email type: Event reminders, deadline notifications, hackathon updates, application confirmations
- Links redirect to: Known platforms with HTTPS, consistent with sender branding

### 🚨 High-Risk Signals (Flagged Only if 2+ Present)
- Newly registered or suspicious sender domain
- Domain mimics known brand (e.g., `goog1e.com`)
- Requests credentials, OTP, passwords, or bank details
- URL shorteners hiding destination
- Mismatch between sender name and actual domain
- Grammar errors + urgency + unknown sender combined
- Porn/random domain sending career offers

### 🟡 Medium-Risk Indicators (Warning Only)
- Legitimate-looking email with external links
- High urgency from unknown/new sender
- Limited sender history but no credential request

### 🟢 Default: Low Risk
- Official sender domain (trusted list or .edu/.ac.in)
- Branded content consistent with sender
- No credential requests
- No suspicious links

**Key Innovation:** Urgency alone is NOT phishing. The AI respects that universities, hackathons, and tech companies legitimately send urgent emails.

---

## System Architecture

### Extension Layer (Chrome)
```
content_script.js     → Extracts email data, runs on web pages
service_worker.js     → Routes messages & API calls
panel.js + panel.html → Displays risk assessment results (draggable)
popup.js              → "Scan Email" button in toolbar
emailParser.js        → Helper utilities for extraction
privacyGuard.js       → Sanitization before sending to backend
```

### Backend Layer (Flask + Python)
```
app.py                → REST API (/scan endpoint with CORS)
detector.py           → Rule-based phishing detection engine
llm_decision.py       → AI decision layer with Ollama/OpenAI support
```

### Full Message Flow
```
User clicks "Scan" 
  → Content Script extracts email
  → Service Worker sends POST /scan
  → Backend: Rule detector generates signals
  → Backend: AI decision layer classifies
  → Response with risk_level + reasoning
  → Panel renders results (draggable, dismissible)
```

---

## AMD Relevance

CampusShield leverages AMD's security and computing infrastructure:
- **Privacy-first architecture** aligned with secure computing principles
- **Local processing** option (backend runs on user's device/network) reduces cloud dependency
- **Efficient ML inference** with pattern matching optimized for real-time performance
- **Extensible to AMD's security platforms** for broader campus deployments

---

## Quick Start (5 minutes)

### Prerequisites
- Python 3.9+
- Chrome browser
- Terminal access

### Step 1: Start the Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

✓ Backend available at `http://127.0.0.1:5000/scan`

### Step 2: Start Mock Email Server (Optional Testing)

Open a **new terminal**:

```bash
cd extension
python -m http.server 8080
```

✓ Mock email page at `http://localhost:8080/mock_email.html`

### Step 3: Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. CampusShield extension should appear in your toolbar

### Step 4: Run a Scan

**Test on Mock Page:**
- Open `http://localhost:8080/mock_email.html`
- Click CampusShield icon → "Scan Email"
- Panel appears with risk assessment

**Test on Gmail:**
- Open any email in Gmail
- Click CampusShield icon → "Scan Email"
- Results display in floating panel

---

## Demo: Example Classifications

### Example 1: Legitimate Hackathon Email ✅
```
From: hack2skill.com
Subject: 72 hours left: Submit your hackathon project
Body: Final submission deadline is March 1st at 11:59 PM. Click here to submit.

Result: RISK = LOW (95% confidence)
Reason: Trusted hackathon platform. Urgency is expected for deadline notifications.
```

### Example 2: Credential Phishing Attack 🔴
```
From: amazon-security@suspicious-domain.net
Subject: URGENT: Verify Your Amazon Account Now
Body: Click below to verify your credentials before your account is suspended.

Result: RISK = HIGH (88% confidence)
Reason: (1) Domain doesn't match amazon.com, (2) Requests credentials + urgency + suspension threat
         = 3 high-risk signals from untrusted domain
```

### Example 3: External Link Warning 🟡
```
From: hiring@techcompany.com (known domain)
Subject: Congratulations! Job offer inside
Body: We're excited to offer you a position. See PDF attachment.

Result: RISK = MEDIUM (65% confidence)
Reason: Trusted domain but contains external links. User should verify directly with company.
```

---

## Code Structure

```
Campus-Shield/
├── README.md                           # This file
├── backend/
│   ├── app.py                         # Flask server with /scan endpoint
│   ├── detector.py                    # Rule-based detection engine
│   ├── llm_decision.py                # AI decision layer (Ollama/OpenAI)
│   └── requirements.txt
├── extension/
│   ├── manifest.json                  # Chrome extension config
│   ├── mock_email.html                # Test email page
│   ├── background/
│   │   └── service_worker.js          # Message orchestration
│   ├── content/
│   │   └── content_script.js          # Email extraction & injection
│   ├── ui/
│   │   ├── panel.html / panel.js / panel.css    # Results display
│   │   ├── popup.html / popup.js                # Toolbar button
│   │   └── styles.css
│   └── utils/
│       ├── emailParser.js             # Email field extraction
│       ├── privacyGuard.js            # PII masking
│       └── explainFormatter.js        # Result formatting
└── demo_emails/                       # Sample emails for testing
```

---

## Features

| Feature | Implementation |
|---------|-----------------|
| Real-time scanning | ✅ Click-to-scan with async backend calls |
| Gmail integration | ✅ Content script extracts emails from inbox |
| Domain reputation | ✅ Trusted domain allowlist (Google, Microsoft, universities, hackathon platforms) |
| AI decision layer | ✅ LLM-based classification with rule fallback |
| Low false positives | ✅ Multiple signals required for HIGH risk (~2/7 risk factors needed) |
| Privacy-first | ✅ PII masking before backend processing |
| Draggable results panel | ✅ Non-blocking UI, user-friendly |
| Confidence scoring | ✅ 0-100% confidence in each assessment |
| Suspicious link detection | ✅ URL analysis and shortener detection |

---

## Testing

### Automated Testing

```bash
# Run AI integration tests
python test_ai_integration.py

# Test detector logic
python test_trust_scoring.py

# Test mock AI scenario
python test_ai_mock.py
```

### Manual Testing Checklist

- [ ] Backend running on `http://127.0.0.1:5000`
- [ ] Extension loaded in Chrome DevTools
- [ ] Mock server running on `http://localhost:8080`
- [ ] Can open `mock_email.html` without 404
- [ ] Click "Scan Email" shows "Scanning..." state
- [ ] Results panel appears with risk level + confidence
- [ ] Can drag panel by header
- [ ] Can close with X button
- [ ] Can dismiss with "Dismiss" button
- [ ] Page operates normally during/after scan (non-blocking)

---

## Configuration

### AI Decision Layer Options

Set environment variables to control LLM backend:

```bash
# Use Ollama (default - runs locally)
export OLLAMA_ENDPOINT=http://localhost:11434/api/generate

# Use OpenAI API
export OPENAI_API_KEY=sk-...

# Backend detects availability in priority order: Ollama → OpenAI → Fallback
```

If no LLM is available, the system gracefully falls back to rule-based detection.

---

## Development Notes

### Extending Detection Rules

Edit `backend/detector.py`:
- Add rules in `_init_rules()` method
- Each rule has: `id`, `patterns`, `weight`, `explanation`
- Test with: `python -m pytest backend/detector.py -v`

### Testing on Different Domains

Modify `PhishingDetector.TRUSTED_DOMAINS` to add your organization's domain.

### Debug Logging

- Browser console: `F12` on page → Console tab
- Service worker: Open Chrome DevTools → Extensions page → Click "service worker" link
- Backend: Flask logs print to terminal

---

## Limitations & Future Considerations

- Extension works on Gmail and pages with standard email DOM structures
- Requires backend running locally or on network
- AI layer needs Ollama/OpenAI (rule-based detection still works without it)
- Currently detects phishing; spam detection is out of scope

---

## Team & Attribution

Built for AMD Slingshot Hackathon 2026.

Designed to solve real security problems for students with production-grade code and thoughtful AI decision-making.

---

## License

[Add your license here]

---

## Documentation Structure

All detailed documentation is organized in `/docs` for easy navigation:

- **`/docs/architecture`** – System design, overview, and architecture  
  - [INDEX.md](docs/architecture/INDEX.md) – Project overview
  - [IMPLEMENTATION_SUMMARY.md](docs/architecture/IMPLEMENTATION_SUMMARY.md) – Technical architecture
  - [DELIVERABLES.md](docs/architecture/DELIVERABLES.md) – Project scope and deliverables

- **`/docs/phases`** – Implementation phases and development timeline  
  - All PHASE1, PHASE2, and PHASE3 documentation with quick references and verification checklists

- **`/docs/ai`** – AI decision layer and trust scoring  
  - [AI_DECISION_LAYER_GUIDE.md](docs/ai/AI_DECISION_LAYER_GUIDE.md) – AI logic and classification rules
  - [QUICK_START_AI.md](docs/ai/QUICK_START_AI.md) – Setting up LLM backends
  - [TRUST_SCORING_IMPLEMENTATION.md](docs/ai/TRUST_SCORING_IMPLEMENTATION.md) – Trust scoring details

- **`/docs/testing`** – Testing guides and debugging  
  - [QUICK_TEST_GUIDE.md](docs/testing/QUICK_TEST_GUIDE.md) – Quick testing reference
  - [TEST_CHECKLIST.md](docs/testing/TEST_CHECKLIST.md) – Comprehensive test checklist
  - [GMAIL_EXTRACTION_DEBUG_GUIDE.md](docs/testing/GMAIL_EXTRACTION_DEBUG_GUIDE.md) – Gmail integration troubleshooting

- **`/tests`** – Test scripts  
  - `quick_test.py`, `test_ai_integration.py`, `test_ai_mock.py`, `test_trust_scoring.py`