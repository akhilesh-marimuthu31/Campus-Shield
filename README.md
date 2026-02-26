# CampusShield - Phishing Detection Extension

A Chrome Extension + Flask backend demo for detecting phishing emails with real-time analysis and user education.

## Quick Start

### 1. Start the Backend Flask Server

```bash
cd backend
python -m pip install -r requirements.txt
python app.py
```

The backend will be available at `http://127.0.0.1:5000/scan`

### 2. Start the Mock Email Server

Open a **new terminal** and run:

```bash
# IMPORTANT: Must run from the extension/ directory so mock_email.html is served correctly
cd extension
python -m http.server 8080
```

Then open: `http://localhost:8080/mock_email.html`

### 3. Load the Extension in Chrome

1. Open Chrome DevTools: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The CampusShield extension should appear in your extension list

### 4. Test the Extension

**Option A: Mock Email Page**
- Open `http://localhost:8080/mock_email.html`
- Click the CampusShield icon in the toolbar
- Click "Scan Email"
- Watch the panel appear on the right side with results

**Option B: Gmail**
- Open an email in Gmail
- Click the CampusShield icon
- Click "Scan Email"
- Results appear in a floating panel

## Architecture

### Extension Files

- **`content/content_script.js`** - Runs on web pages, extracts emails, sends to backend
- **`background/service_worker.js`** - Handles messaging between content script and backend API
- **`ui/panel.js`** - Shows scan results in a draggable, dismissible panel
- **`ui/popup.js`** - Popup UI to trigger scans
- **`utils/emailParser.js`** - Email extraction helpers
- **`manifest.json`** - Extension configuration

### Backend Files

- **`backend/app.py`** - Flask API server with `/scan` endpoint
- **`backend/detector.py`** - Phishing detection logic
- **`backend/requirements.txt`** - Python dependencies

## How It Works

1. User opens an email (Gmail or mock page)
2. Content script extracts: sender, subject, body, links
3. Content script sends to: `POST http://127.0.0.1:5000/scan`
4. Backend returns: `{ risk_level, confidence_score, explanations, suspicious_links }`
5. Floating panel shows results with dismissal and dragging capabilities

## Messaging Flow (Architecture)

```
Browser Page
    ↓
Content Script (content_script.js)
    ↓ chrome.runtime.sendMessage()
Service Worker (service_worker.js)
    ↓ fetch()
Backend API (app.py:5000/scan)
    ↓ response
Service Worker
    ↓ sendResponse()
Content Script
    ↓ postMessage() to iframe
Panel (panel.js in iframe)
    ↓ renders results
User
```

## Key Features Fixed

✅ **Robust messaging** - Promise-based with proper error handling  
✅ **Scanning state** - Panel shows "Scanning..." while fetching  
✅ **Error displays** - All errors shown in red in the panel  
✅ **Button disabled** - Popup button disabled during scan (prevents spam)  
✅ **Timeout handling** - 8-second timeout on backend request  
✅ **Panel management** - Draggable, dismissible, non-blocking to page  
✅ **Mock server docs** - Clear instructions for running http.server from correct directory  

## Troubleshooting

### "Message port closed" Error
- **Cause**: Backend request timeout or service worker crash
- **Fix**: Ensure backend is running at `http://127.0.0.1:5000`
- Check Flask logs for errors

### "Not an email page" Error
- **Cause**: Content script not injected on current page
- **Fix**: Only works on Gmail or pages with email elements
- Use mock_email.html for testing

### Mock server returns 404
- **Cause**: Running http.server from wrong directory
- **Fix**: Must run from `extension/` folder: `cd extension && python -m http.server 8080`

### Panel doesn't appear
- **Cause**: Extension not loaded or disabled
- **Fix**: Check `chrome://extensions/` - CampusShield should be enabled
- Reload the page after loading extension

## Development

### Modifying the Extension

After editing any files:
1. Go to `chrome://extensions/`
2. Find CampusShield
3. Click the refresh (↻) icon
4. Reload the tested page

### Debug Logs

Open DevTools with `F12`:
- **Content Script Console**: Web page's DevTools
- **Service Worker Console**: Click "service worker" link on extensions page
- **Panel Console**: Right-click panel iframe and "Inspect"

## Project Structure

```
Campus-Shield/
├── README.md
├── backend/
│   ├── app.py              # Flask server (http://127.0.0.1:5000)
│   ├── detector.py         # Detection engine
│   └── requirements.txt     # Python dependencies
├── extension/
│   ├── manifest.json       # Chrome extension config
│   ├── mock_email.html     # Test email page
│   ├── background/
│   │   └── service_worker.js       # Message relay to backend
│   ├── content/
│   │   └── content_script.js       # Runs on pages, extracts email
│   ├── ui/
│   │   ├── panel.html       # Results panel UI
│   │   ├── panel.js         # Results panel logic
│   │   ├── panel.css        # Results panel styling
│   │   ├── popup.html       # Extension popup UI
│   │   ├── popup.js         # Popup button handler
│   │   └── styles.css       # Popup styling
│   └── utils/
│       ├── emailParser.js
│       ├── privacyGuard.js
│       └── explainFormatter.js
└── demo_emails/             # Test email samples
```

## Testing Checklist

- [ ] Backend is running (`python app.py`)
- [ ] Mock server is running (`python -m http.server 8080` from `extension/`)
- [ ] Extension is loaded in Chrome (`chrome://extensions/`)
- [ ] Can open mock_email.html without 404
- [ ] Can click "Scan Email" button
- [ ] Panel appears with "Scanning..." state
- [ ] Results display (risk level, confidence, explanations)
- [ ] Can drag panel by header
- [ ] Can close panel with X button
- [ ] Can dismiss with "Dismiss" button
- [ ] Page is not blocked/locked during scan