console.log("✅ CampusShield content script running:", location.href);

function logContent(level, message, data) {
  const prefix = "[CampusShield content]";
  if (level === "error") {
    console.error(prefix, message, data || "");
  } else if (level === "warn") {
    console.warn(prefix, message, data || "");
  } else {
    console.debug(prefix, message, data || "");
  }
}

/* ================== DETECTOR MODULE ================== */
/**
 * Phase 1: Lightweight JS-based phishing detector
 * Rules ported from backend/detector.py
 */

const DETECTOR_RULES = [
  {
    id: 'urgency_pressure',
    patterns: [/\burgent\b/, /\bact now\b/, /\bimmediately\b/, /\bASAP\b/, /\bnow or you\b/],
    weight: 0.15,
    explanation: 'Email uses high-pressure urgency language.'
  },
  {
    id: 'verify_account',
    patterns: [/\bverify (?:your )?(?:account|identity|info)\b/, /\bconfirm (?:your )?(?:account|identity|info)\b/],
    weight: 0.20,
    explanation: 'Email requests verification of account credentials.'
  },
  {
    id: 'account_suspension',
    patterns: [/\bsuspend(?:ed|ion)?\b/, /\blocked\b/, /\brestricted\b/, /\bwill be closed\b/],
    weight: 0.18,
    explanation: 'Email threatens account suspension or lockout.'
  },
  {
    id: 'password_request',
    patterns: [/\breset (?:your )?password\b/, /\bupdate (?:your )?password\b/, /\bprovide (?:your )?password\b/],
    weight: 0.20,
    explanation: 'Email requests password or login information.'
  },
  {
    id: 'click_link_urgency',
    patterns: [/(?:click|tap|open|visit)\s+(?:the\s+)?(?:link|here|button)\b/, /\bclick here\b/],
    weight: 0.12,
    explanation: 'Email urges clicking a link or button.'
  },
  {
    id: 'payment_claim',
    patterns: [/\bbilling\b/, /\binvoice\b/, /\bpayment (?:failed|due)\b/, /\bupdate (?:billing|payment)\b/],
    weight: 0.13,
    explanation: 'Email claims billing or payment issues.'
  },
  {
    id: 'prize_claim',
    patterns: [/\bcongratulations\b/, /\bclaim your prize\b/, /\byou won\b/],
    weight: 0.10,
    explanation: 'Email claims a prize or reward.'
  },
  {
    id: 'misspelled_brand',
    patterns: [/\bgmai\b/, /\bgmial\b/, /\bgogle\b/, /\bamazn\b/, /\bmicorsoft\b/],
    weight: 0.08,
    explanation: 'Email contains misspelled brand names.'
  }
];

/**
 * Detect phishing indicators in text using rules
 * @param {string} text - Text to scan (subject + body)
 * @returns {object} { score: 0-1, matchedIds: [], explanations: [] }
 */
function detectFromText(text) {
  if (!text) return { score: 0, matchedIds: [], explanations: [] };
  
  const textLower = text.toLowerCase();
  let totalScore = 0;
  const matchedIds = [];
  const explanations = [];
  
  for (const rule of DETECTOR_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(textLower)) {
        if (!matchedIds.includes(rule.id)) {
          matchedIds.push(rule.id);
          explanations.push(rule.explanation);
          totalScore += rule.weight;
        }
        break; // Count rule only once
      }
    }
  }
  
  return {
    score: Math.min(totalScore, 0.99),
    matchedIds,
    explanations
  };
}

/**
 * Extract URLs from text using regex
 * @param {string} text - Text to scan for URLs
 * @returns {array} Array of URL strings
 */
function detectLinksInText(text) {
  if (!text) return [];
  
  // Match http/https URLs and www links
  const urlPattern = /https?:\/\/[^\s)>'\"]+|www\.[^\s)>'\"]+\.[a-z]{2,}/gi;
  const matches = text.match(urlPattern) || [];
  
  // Deduplicate and return
  return [...new Set(matches)];
}

/**
 * Analyze URLs for suspicious characteristics
 * @param {array} urls - Array of URLs
 * @returns {object} { suspicious: [], score: 0-0.40 }
 */
function analyzeUrlsSuspicion(urls) {
  if (!urls || !Array.isArray(urls)) return { suspicious: [], score: 0 };
  
  const suspicious = new Set();
  let score = 0;
  
  const shorteners = new Set(['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly']);
  const suspiciousTlds = new Set(['.tk', '.ml', '.ga', '.cf', '.gq']);
  
  for (const url of urls) {
    const u = url.trim();
    const uLower = u.toLowerCase();
    
    // IP-based URL
    if (/https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(uLower)) {
      suspicious.add(u);
      score += 0.18;
      continue;
    }
    
    // Missing https
    if (!uLower.startsWith('https://')) {
      suspicious.add(u);
      score += 0.12;
    }
    
    // Extract domain
    try {
      const urlObj = new URL(u.startsWith('http') ? u : `http://${u}`);
      const domain = urlObj.hostname;
      
      // URL Shorteners
      if (domain && shorteners.has(domain)) {
        suspicious.add(u);
        score += 0.15;
      }
      
      // Long/obfuscated URL
      if (u.length > 100) {
        suspicious.add(u);
        score += 0.10;
      }
      
      // Many path segments
      if ((urlObj.pathname.match(/\//g) || []).length > 5) {
        suspicious.add(u);
        score += 0.08;
      }
      
      // Suspicious TLD
      if (suspiciousTlds.has(domain.substring(domain.lastIndexOf('.')))) {
        suspicious.add(u);
        score += 0.12;
      }
      
      // Keyword-based heuristics
      if (/login|signin|verify|account|secure/.test(uLower)) {
        suspicious.add(u);
        score += 0.10;
      }
    } catch (e) {
      // URL parsing failed, mark as suspicious
      suspicious.add(u);
      score += 0.15;
    }
  }
  
  return {
    suspicious: Array.from(suspicious),
    score: Math.min(score, 0.40)
  };
}

/* ================== CONFIG ================== */

const PHRASES = [
  "urgent",
  "act now",
  "immediately",
  "verify your",
  "confirm your",
  "suspended",
  "click the link"
];

/* ================== STYLES ================== */

(function injectStyles() {
  if (document.getElementById("cs-style")) return;

  const style = document.createElement("style");
  style.id = "cs-style";
  style.textContent = `
    .cs-highlight {
      background: rgba(255, 225, 130, 0.45);
      border-radius: 4px;
      padding: 2px 4px;
    }
    .cs-link {
      outline: 3px solid rgba(239, 68, 68, 0.7);
      border-radius: 4px;
    }
    .campus-badge {
      display: inline-block;
      background: #ef4444;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      margin-left: 8px;
      vertical-align: middle;
    }
  `;
  document.head.appendChild(style);
})();

/* ================== INBOX HEURISTIC SCAN (STAGE A) ================== */
/**
 * STAGE A: Lightweight heuristic scan of inbox rows
 * 
 * Purpose: Quick keyword-based detection on visible inbox rows
 * - Does NOT call backend
 * - Does NOT extract full email body
 * - Only scans subject + snippet from row preview
 * 
 * Gmail inbox structure (row):
 * <tr class="zA">                      [PRIMARY: Gmail row selector]
 *   <td>
 *     <span class="yX"> [sender]      [Gmail sender class]
 *     <span class="bog"> [subject]    [Gmail subject class]
 *     <span class="y2"> [snippet]     [Gmail snippet class]
 *
 * @returns {array} Array of candidates: { subject, snippet, sender, score, riskLevel }
 */
function inboxLightScan() {
  const candidates = [];
  
  // Check if we're in Gmail inbox view
  const inGmailInbox = location.hostname.includes("mail.google.com") && 
                       location.hash.includes("#inbox");
  
  // CRITICAL: Use Gmail-specific selectors when available, fallback to role="row"
  let rows = [];
  if (inGmailInbox) {
    // Try Gmail's tr.zA selector first (most reliable)
    rows = document.querySelectorAll('tr.zA');
    if (rows.length === 0) {
      // Fallback to role="row" if tr.zA not found
      rows = document.querySelectorAll('[role="row"]');
    }
  } else {
    // Non-Gmail pages - use role="row"
    rows = document.querySelectorAll('[role="row"]');
  }
  
  logContent("debug", `inboxLightScan: scanning ${rows.length} inbox rows (Gmail: ${inGmailInbox})`);
  
  // THRESHOLD: Only flag rows with score >= 0.40 (Medium risk or higher)
  const HEURISTIC_THRESHOLD = 0.40;
  
  for (const row of rows) {
    try {
      // === EXTRACT ROW DATA ===
      let sender = "unknown";
      let subject = "";
      let snippet = "";
      
      // Try Gmail-specific selectors first
      if (inGmailInbox) {
        // Subject: .bog class (Gmail standard)
        let subjectEl = row.querySelector('span.bog');
        if (subjectEl) {
          subject = subjectEl.textContent.trim();
        }
        
        // Snippet: .y2 class (Gmail standard)
        let snippetEl = row.querySelector('span.y2');
        if (snippetEl) {
          snippet = snippetEl.textContent.trim();
        }
        
        // Sender: .yX class (Gmail standard)
        let senderEl = row.querySelector('span.yX');
        if (senderEl) {
          sender = senderEl.textContent.trim();
        }
      }
      
      // Fallback: Generic selectors if Gmail-specific ones failed
      if (!subject || !snippet) {
        const ariaLabel = row.getAttribute('aria-label') || '';
        
        // Try to extract sender from aria-label or first span
        if (!sender || sender === "unknown") {
          if (ariaLabel) {
            sender = ariaLabel.split(',')[0].trim();
          } else {
            const firstSpan = row.querySelector('span');
            if (firstSpan) {
              sender = firstSpan.textContent.trim();
            }
          }
        }
        
        // Subject: Usually in a strong tag or data-tooltip span
        if (!subject) {
          const subjectEl = row.querySelector('span[data-tooltip], b, strong');
          if (subjectEl) {
            subject = subjectEl.textContent.trim();
          }
        }
        
        // Snippet: Text preview (usually last or after subject)
        if (!snippet) {
          const allSpans = row.querySelectorAll('span');
          if (allSpans.length >= 3) {
            snippet = allSpans[allSpans.length - 1].textContent.trim();
          }
        }
      }
      
      if (!subject && !snippet) {
        logContent("debug", "Skipping row: no subject or snippet");
        continue;
      }
      
      // === RUN LIGHTWEIGHT HEURISTIC ===
      // Only check key phishing keywords on subject + snippet
      // DO NOT check full page text
      const text = `${subject} ${snippet}`.toLowerCase();
      
      // Quick keyword scan
      let riskScore = 0;
      let matchedKeywords = [];
      
      // High-confidence phishing keywords
      if (/(?:verify|confirm).*(account|identity|login|payment)/i.test(text)) {
        riskScore += 0.35;
        matchedKeywords.push("verify_account");
      }
      if (/(?:urgent|act now|immediately|asap)/i.test(text)) {
        riskScore += 0.25;
        matchedKeywords.push("urgency");
      }
      if (/(?:suspend|lock|restrict|close).*(account|access|service)/i.test(text)) {
        riskScore += 0.30;
        matchedKeywords.push("suspension");
      }
      if (/(?:click|update|reset).*(password|login|secure)/i.test(text)) {
        riskScore += 0.25;
        matchedKeywords.push("password_request");
      }
      
      // Cap score at 1.0
      riskScore = Math.min(riskScore, 1.0);
      
      // Only include candidates that exceed threshold
      if (riskScore < HEURISTIC_THRESHOLD) {
        logContent("debug", `Row skipped (score ${riskScore} < threshold ${HEURISTIC_THRESHOLD})`);
        continue;
      }
      
      // Map score to risk level
      let riskLevel = "Low";
      if (riskScore >= 0.70) riskLevel = "High";
      else if (riskScore >= 0.40) riskLevel = "Medium";
      
      candidates.push({
        subject,
        snippet,
        sender,
        score: riskScore,
        riskLevel,
        keywords: matchedKeywords
      });
      
      logContent("debug", `Added candidate: ${subject.substring(0, 40)} (${riskLevel})`);
    } catch (e) {
      logContent("warn", "Error scanning row:", e.message);
    }
  }
  
  logContent("debug", `inboxLightScan complete: ${candidates.length} candidates found`);
  return candidates;
}

/**
 * STAGE B: Extract FULL email data for backend analysis
 * 
 * Purpose: When user clicks a candidate or opens an email, extract complete data
 * - Extracts: sender, subject, full body, all links
 * - Prepares data for backend /scan endpoint
 * - Does NOT perform detection here (backend does that)
 * 
 * Gmail open message structure:
 * Subject: <h2 [data-subject-perm-id], <span class="hP">, or in thread view
 * Sender: <span data-email>, class="gVNoLb", or in message header
 * Body: <div class="a3s" (MAIN), <div class="ii", or [role="main"]
 * Links: <a> tags inside body
 *
 * @returns {object} emailData: { sender, subject, body, links, success }
 */
function extractFullEmailData() {
  const emailData = {
    sender: "unknown",
    subject: "Unknown",
    body: "",
    links: [],
    success: false,
    debug: {
      subjectSelector: null,
      senderSelector: null,
      bodySelector: null,
      bodyCharCount: 0,
      linkCount: 0,
      isGmail: isGmailHost(),
      isMock: isMockEmailPage()
    }
  };
  
  try {
    // === STEP 1: GET SUBJECT ===
    // Gmail subject: [data-thread-perm-id] in h2 or span
    let subjectEl = null;
    
    // Try 1: h2[data-thread-perm-id] - Main Gmail thread subject
    subjectEl = document.querySelector('h2[data-thread-perm-id]');
    if (subjectEl) {
      emailData.debug.subjectSelector = "h2[data-thread-perm-id]";
    }
    
    // Try 2: span[data-subject-perm-id] - Subject in header
    if (!subjectEl) {
      subjectEl = document.querySelector('span[data-subject-perm-id]');
      if (subjectEl) {
        emailData.debug.subjectSelector = "span[data-subject-perm-id]";
      }
    }
    
    // Try 3: First h2 in [role="main"] - Fallback
    if (!subjectEl) {
      subjectEl = document.querySelector('[role="main"] h2');
      if (subjectEl) {
        emailData.debug.subjectSelector = "[role=\"main\"] h2";
      }
    }
    
    // Try 4: Any h2 (last resort)
    if (!subjectEl) {
      subjectEl = document.querySelector('h2');
      if (subjectEl) {
        emailData.debug.subjectSelector = "h2 (last resort)";
      }
    }
    
    if (subjectEl) {
      emailData.subject = subjectEl.textContent.trim();
    }
    
    logContent("debug", "✉️ Subject extraction:", {
      found: !!subjectEl,
      selector: emailData.debug.subjectSelector,
      text: emailData.subject.substring(0, 40)
    });
    
    // === STEP 2: GET SENDER ===
    let senderEl = null;
    
    // Try 1: [data-email] - Direct email attribute
    senderEl = document.querySelector('[data-email]');
    if (senderEl) {
      emailData.debug.senderSelector = "[data-email]";
    }
    
    // Try 2: .gVNoLb span - Gmail sender container
    if (!senderEl) {
      senderEl = document.querySelector('.gVNoLb span');
      if (senderEl) {
        emailData.debug.senderSelector = ".gVNoLb span";
      }
    }
    
    // Try 3: [data-hovercard-id] - Gmail profile hover
    if (!senderEl) {
      senderEl = document.querySelector('[data-hovercard-id]');
      if (senderEl) {
        emailData.debug.senderSelector = "[data-hovercard-id]";
      }
    }
    
    // Try 4: First email-like span
    if (!senderEl) {
      const spans = document.querySelectorAll('[role="main"] span');
      for (const span of spans) {
        const text = span.textContent;
        if (text.includes("@")) {
          senderEl = span;
          emailData.debug.senderSelector = "[role=\"main\"] span (email-like)";
          break;
        }
      }
    }
    
    if (senderEl) {
      const senderText = senderEl.textContent.trim();
      const emailMatch = senderText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      emailData.sender = emailMatch ? emailMatch[0] : senderText.substring(0, 50);
    }
    
    logContent("debug", "👤 Sender extraction:", {
      found: !!senderEl,
      selector: emailData.debug.senderSelector,
      text: emailData.sender
    });
    
    // === STEP 3: GET BODY ===
    // This is the CRITICAL part - Gmail email body is in div.a3s
    let bodyEl = null;
    
    // Try 1: div.a3s - Gmail's standard BODY container (MOST IMPORTANT)
    bodyEl = document.querySelector('div.a3s');
    if (bodyEl && bodyEl.textContent.length > 0) {
      emailData.debug.bodySelector = "div.a3s";
    }
    
    // Try 2: div.a3s with Gmail-specific classes
    if (!bodyEl || bodyEl.textContent.length === 0) {
      bodyEl = document.querySelector('div.a3s.aXjfqe');
      if (bodyEl && bodyEl.textContent.length > 0) {
        emailData.debug.bodySelector = "div.a3s.aXjfqe";
      }
    }
    
    // Try 3: div.gmail_quote - Gmail quoted/original message
    if (!bodyEl || bodyEl.textContent.length === 0) {
      bodyEl = document.querySelector('div.gmail_quote');
      if (bodyEl && bodyEl.textContent.length > 0) {
        emailData.debug.bodySelector = "div.gmail_quote";
      }
    }
    
    // Try 4: div.ii - Alternative Gmail body container
    if (!bodyEl || bodyEl.textContent.length === 0) {
      bodyEl = document.querySelector('div.ii');
      if (bodyEl && bodyEl.textContent.length > 0) {
        emailData.debug.bodySelector = "div.ii";
      }
    }
    
    // Try 5: [role="main"] > div with substantial content
    if (!bodyEl || bodyEl.textContent.length === 0) {
      const mainDiv = document.querySelector('[role="main"]');
      if (mainDiv) {
        const divs = mainDiv.querySelectorAll('div[data-message-id], div[role="article"]');
        for (const div of divs) {
          if (div.textContent.length > 50) {
            bodyEl = div;
            emailData.debug.bodySelector = "[role=\"main\"] div[data-message-id]";
            break;
          }
        }
      }
    }
    
    // Try 6: Generic div with message content
    if (!bodyEl || bodyEl.textContent.length === 0) {
      const allDivs = document.querySelectorAll('div');
      for (const div of allDivs) {
        const text = div.textContent;
        // Look for substantial text that's not a UI element
        if (text.length > 100 && !text.includes("Gmail") && !text.includes("Compose")) {
          const style = window.getComputedStyle(div);
          if (style.display !== "none" && style.visibility !== "hidden") {
            bodyEl = div;
            emailData.debug.bodySelector = "div (generic search)";
            break;
          }
        }
      }
    }
    
    if (bodyEl) {
      // Prefer innerText (respects visibility) over textContent
      emailData.body = (bodyEl.innerText || bodyEl.textContent || "").trim();
      emailData.debug.bodyCharCount = emailData.body.length;
      logContent("debug", "📄 Body extraction:", {
        found: true,
        selector: emailData.debug.bodySelector,
        charCount: emailData.body.length,
        preview: emailData.body.substring(0, 80)
      });
    } else {
      logContent("warn", "❌ Body extraction FAILED - no element found");
      logContent("debug", "Gmail DOM structure:", {
        hasA3s: !!document.querySelector("div.a3s"),
        hasII: !!document.querySelector("div.ii"),
        hasMainRole: !!document.querySelector("[role=\"main\"]"),
        divCount: document.querySelectorAll("div").length
      });
    }
    
    // === STEP 4: GET LINKS ===
    // Extract all href attributes from the email body
    const linkSet = new Set();
    
    if (bodyEl) {
      // Get direct links in body
      const linkEls = bodyEl.querySelectorAll('a[href]');
      for (const link of linkEls) {
        let href = link.getAttribute('href');
        if (href) {
          // Clean up Gmail's URL encoding if needed
          if (href.includes("q=") || href.includes("?url=")) {
            const urlMatch = href.match(/(?:q=|url=)([^&]+)/);
            if (urlMatch) {
              try {
                href = decodeURIComponent(urlMatch[1]);
              } catch (e) {
                // Keep original if decode fails
              }
            }
          }
          linkSet.add(href);
        }
      }
    }
    
    // Also search for any URLs in the body text
    if (emailData.body) {
      const urlRegex = /https?:\/\/[^\s<>"\)]+/gi;
      const matches = emailData.body.match(urlRegex);
      if (matches) {
        matches.forEach(url => linkSet.add(url));
      }
    }
    
    emailData.links = Array.from(linkSet);
    emailData.debug.linkCount = emailData.links.length;
    
    logContent("debug", "🔗 Link extraction:", {
      count: emailData.links.length,
      links: emailData.links.slice(0, 3) // Show first 3
    });
    
    // === VALIDATION ===
    // Email must have subject AND meaningful body
    const hasMinimalContent = emailData.subject && emailData.body && emailData.body.length > 10;
    
    if (hasMinimalContent) {
      emailData.success = true;
      logContent("debug", "✅ Email extraction SUCCESS", {
        subject: emailData.subject.substring(0, 40),
        bodyLen: emailData.body.length,
        links: emailData.links.length
      });
    } else {
      logContent("warn", "❌ Email extraction INCOMPLETE or empty:", {
        hasSubject: !!emailData.subject,
        hasBody: !!emailData.body,
        bodyLength: emailData.body.length,
        hasLinks: emailData.links.length > 0
      });
    }
    
  } catch (e) {
    logContent("error", "💥 Exception in extractFullEmailData:", {
      message: e.message,
      stack: e.stack
    });
  }
  
  return emailData;
}

/**
 * Highlight a row by adding a badge
 * @param {element} row - DOM element to badge
 */
function addCandidateBadge(row) {
  if (row.querySelector('.campus-badge')) return; // Already badged
  
  const badge = document.createElement('span');
  badge.className = 'campus-badge';
  badge.textContent = 'SUSPICIOUS';
  badge.title = 'CampusShield detected suspicious indicators';
  
  // Append to row (preferably at the end)
  row.appendChild(badge);
}

/* ================== PAGE DETECTION ================== */

function isGmailHost() {
  return location.hostname.includes("mail.google.com");
}

function isMockEmailPage() {
  return location.href.includes("mock_email.html") || !!document.querySelector(".email-container");
}

function isLikelyEmailView() {
  if (isMockEmailPage()) {
    return true;
  }
  if (isGmailHost()) {
    // Gmail message view containers
    if (document.querySelector("div[role='main'] .adn")) return true;
    if (document.querySelector("div.ii")) return true;
    if (document.querySelector("div.a3s")) return true;
  }
  // Generic fallback: presence of typical email DOM
  if (document.querySelector(".sender") && document.querySelector(".subject")) return true;
  return false;
}

/**
 * Check if email body is fully loaded (specifically div.a3s for Gmail)
 * This is the key signal that email content is available to scan
 */
function isEmailBodyLoaded() {
  // Mock emails
  if (isMockEmailPage()) {
    const bodyEl = document.querySelector(".email-body");
    return bodyEl && bodyEl.textContent.length > 10;
  }
  // Gmail: Check for message body div with content
  if (isGmailHost()) {
    const bodyEl = document.querySelector("div.a3s");
    // Must exist AND have meaningful content (not empty or loading state)
    return bodyEl && bodyEl.textContent.trim().length > 10;
  }
  return false;
}

/**
 * Check if we're in Gmail INBOX view (NOT email-open view)
 * This detects when user is looking at email list, not an open message
 */
function isGmailInboxView() {
  if (!isGmailHost()) return false;
  
  // Inbox view has [role="row"] elements for email list
  // But does NOT have div.a3s with content (message body)
  const hasRows = document.querySelectorAll('[role="row"]').length > 0;
  const bodyEl = document.querySelector("div.a3s");
  const hasBody = bodyEl && bodyEl.textContent.trim().length > 10;
  
  return hasRows && !hasBody;
}

/**
 * Check if we're in Gmail EMAIL-OPEN view
 * This detects when user has clicked to open a single email
 */
function isGmailEmailOpenView() {
  if (!isGmailHost()) return false;
  // Email-open view has div.a3s (message body container) with content
  const bodyEl = document.querySelector("div.a3s");
  return bodyEl && bodyEl.textContent.trim().length > 10;
}

// Track when a likely email is visible (used by PROBE and logging)
window.__campusshield_page_ready = isLikelyEmailView();
window.__campusshield_email_body_loaded = isEmailBodyLoaded();

// Track when a likely email is visible (used by PROBE and logging)
window.__campusshield_page_ready = isLikelyEmailView();
window.__campusshield_email_body_loaded = isEmailBodyLoaded();
window.__campusshield_last_auto_scan_time = 0;

/**
 * MutationObserver to track page state changes
 * Key: Detects when email body (div.a3s) appears/disappears
 */
const csMutationObserver = new MutationObserver(() => {
  const ready = isLikelyEmailView();
  const bodyLoaded = isEmailBodyLoaded();
  
  // Check if state changed
  if (ready !== window.__campusshield_page_ready) {
    window.__campusshield_page_ready = ready;
    logContent("debug", "Page readiness changed", { ready });
  }
  
  if (bodyLoaded !== window.__campusshield_email_body_loaded) {
    window.__campusshield_email_body_loaded = bodyLoaded;
    logContent("debug", "Email body state changed", { bodyLoaded });
    
    // ===== KEY: AUTO-TRIGGER SCAN WHEN EMAIL BODY APPEARS =====
    // When user opens an email in Gmail, div.a3s appears
    // Automatically extract and scan without waiting for popup request
    if (bodyLoaded && isGmailHost()) {
      const now = Date.now();
      // Debounce: Don't scan more than once per 1 second (avoid spam on DOM changes)
      if (now - window.__campusshield_last_auto_scan_time > 1000) {
        window.__campusshield_last_auto_scan_time = now;
        logContent("debug", "Email body appeared! Auto-triggering scan...");
        autoScanOpenEmail();
      }
    }
  }
});

if (document.body) {
  csMutationObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Auto-scan when an email is opened in Gmail
 * Called by MutationObserver when div.a3s appears
 */
async function autoScanOpenEmail() {
  try {
    logContent("debug", "🚀 autoScanOpenEmail started");
    
    // Wait for div.a3s to stabilize (small debounce)
    await new Promise(r => setTimeout(r, 300));
    
    // Extract email data
    logContent("debug", "📬 Calling extractFullEmailData()...");
    const emailData = extractFullEmailData();
    
    // CRITICAL: Validate we got real data
    if (!emailData.success) {
      logContent("warn", "❌ Extraction failed - no valid email data", { 
        subject: emailData.subject,
        bodyLen: emailData.body.length,
        links: emailData.links.length,
        debug: emailData.debug
      });
      
      // Inject panel and show error message
      try {
        const iframe = await injectPanel();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: "CS_SCAN_RESULT",
            payload: {
              risk_level: "Error",
              confidence_score: 0,
              explanations: [
                "Could not extract email body from Gmail.",
                "Try opening the email in a new tab or refreshing."
              ],
              reasons: [],
              suspicious_links: []
            }
          }, "*");
        }
      } catch (e) {
        logContent("error", "Failed to show extraction error in panel");
      }
      return;
    }
    
    logContent("info", "✅ Email extraction successful", {
      subject: emailData.subject.substring(0, 50),
      bodyLen: emailData.body.length,
      links: emailData.links.length,
      selectors: emailData.debug
    });
    
    // Inject panel
    const iframe = await injectPanel();
    if (!iframe || !iframe.contentWindow) {
      logContent("error", "Failed to inject panel for auto-scan");
      return;
    }
    
    // Show scanning state
    iframe.contentWindow.postMessage({ type: "CS_SCAN_START" }, "*");
    logContent("debug", "📊 Showing scan state in panel");
    
    // Prepare data for backend
    const backendPayload = {
      sender: emailData.sender,
      subject: emailData.subject,
      body: emailData.body,
      links: emailData.links
    };
    
    logContent("debug", "📤 Sending to backend /scan:", {
      senderLen: emailData.sender.length,
      subjectLen: emailData.subject.length,
      bodyLen: emailData.body.length,
      linkCount: emailData.links.length
    });
    
    // Call backend /scan endpoint
    const response = await fetch("http://localhost:5000/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendPayload)
    });
    
    if (!response.ok) {
      throw new Error(`Backend /scan returned ${response.status}`);
    }
    
    const result = await response.json();
    logContent("info", "🎯 Backend analysis complete", { 
      risk_level: result.risk_level,
      confidence: result.confidence_score,
      reasons: result.reasons || []
    });
    
    // Send result to panel
    iframe.contentWindow.postMessage({
      type: "CS_SCAN_RESULT",
      payload: result
    }, "*");
    
    logContent("debug", "📋 Result sent to panel");
    
  } catch (e) {
    logContent("error", "💥 Error in autoScanOpenEmail", { 
      error: e.message,
      stack: e.stack
    });
    
    // Try to show error in panel
    try {
      const iframe = await injectPanel();
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: "CS_SCAN_RESULT",
          payload: {
            risk_level: "Error",
            confidence_score: 0,
            explanations: ["Backend scan failed. Check browser logs for details."],
            reasons: [],
            suspicious_links: []
          }
        }, "*");
      }
    } catch (panelErr) {
      logContent("error", "Could not show error in panel:", panelErr.message);
    }
  }
}

function extractEmail() {
  // Detect page type for better extraction
  const isMockEmail = isMockEmailPage();
  const isGmail = isGmailHost();
  
  let sender = "unknown";
  let subject = "";
  let body = "";
  
  if (isMockEmail) {
    // Mock email page uses .sender, .subject, .body classes
    sender = document.querySelector(".sender")?.innerText || "unknown";
    subject = document.querySelector(".subject")?.innerText || "";
    body = document.querySelector(".body")?.innerText || document.body.innerText;
  } else if (isGmail) {
    // Gmail-specific selectors (for opened email view)
    const gmailSender = document.querySelector("h2[data-thread-perm-id]") || 
                        document.querySelector("span[email]");
    const gmailSubject = document.querySelector("h2[data-thread-perm-id]")?.textContent ||
                         document.querySelector("h2")?.textContent || "";
    const gmailBody = document.querySelector("div[data-message-id]")?.innerText ||
                      document.querySelector(".ii.gt")?.innerText ||
                      document.querySelector(".a3s")?.innerText ||
                      document.body.innerText;
    
    sender = gmailSender?.textContent?.trim() || gmailSender?.getAttribute("email") || "unknown";
    subject = (gmailSubject || "").trim();
    body = gmailBody || document.body.innerText;
  } else {
    // Generic fallback: try common email selectors
    sender = document.querySelector(".sender")?.innerText ||
             document.querySelector("[data-sender]")?.textContent ||
             "unknown";
    subject = document.querySelector(".subject")?.innerText ||
              document.querySelector("[data-subject]")?.textContent ||
              document.querySelector("h1, h2")?.textContent ||
              "";
    body = document.querySelector(".body")?.innerText ||
           document.querySelector("[data-body]")?.innerText ||
           document.body.innerText;
  }
  
  const links = [...document.querySelectorAll("a")].map(a => a.href);
  logContent("debug", "Extracted email", {
    isMockEmail,
    isGmail,
    senderPreview: sender,
    subjectPreview: subject,
    bodyLength: body.length,
    linksCount: links.length
  });
  
  return {
    sender,
    subject,
    body,
    links
  };
}

/* ---------------- PANEL ---------------- */

function injectPanel() {
  return new Promise((resolve) => {
    const existing = document.getElementById("campusshield-panel");
    if (existing) {
      // If iframe already exists, check if it's loaded
      if (existing.contentWindow) {
        resolve(existing);
      } else {
        existing.addEventListener("load", () => resolve(existing), { once: true });
      }
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.id = "campusshield-panel";
    iframe.src = chrome.runtime.getURL("ui/panel.html");

    // Restore position from localStorage if available
    const savedPos = localStorage.getItem("campusshield-panel-pos");
    let top = "90px";
    let right = "20px";
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        top = pos.top || top;
        right = pos.right || right;
      } catch (e) {
        // Invalid saved position, use defaults
      }
    }

    Object.assign(iframe.style, {
      position: "fixed",
      top: top,
      right: right,
      width: "360px",
      height: "420px",
      border: "none",
      borderRadius: "12px",
      zIndex: "2147483647",
      boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      cursor: "default"
    });

    // Make iframe draggable by handling drag on header
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startTop = 0;
    let startRight = 0;

    // Listen for drag messages from panel
    const dragHandler = (event) => {
      if (event.data?.type === "CS_PANEL_DRAG_START") {
        isDragging = true;
        const rect = iframe.getBoundingClientRect();
        dragStartX = event.data.clientX;
        dragStartY = event.data.clientY;
        startTop = rect.top;
        startRight = window.innerWidth - rect.right;
      } else if (event.data?.type === "CS_PANEL_DRAG_MOVE" && isDragging) {
        const rect = iframe.getBoundingClientRect();
        const deltaX = event.data.clientX - dragStartX;
        const deltaY = event.data.clientY - dragStartY;
        const newTop = Math.max(0, Math.min(window.innerHeight - rect.height, startTop + deltaY));
        const newRight = Math.max(0, Math.min(window.innerWidth - rect.width, startRight - deltaX));
        iframe.style.top = `${newTop}px`;
        iframe.style.right = `${newRight}px`;
      } else if (event.data?.type === "CS_PANEL_DRAG_END" && isDragging) {
        isDragging = false;
        // Save position to localStorage
        const rect = iframe.getBoundingClientRect();
        const pos = {
          top: `${rect.top}px`,
          right: `${window.innerWidth - rect.right}px`
        };
        localStorage.setItem("campusshield-panel-pos", JSON.stringify(pos));
      }
    };
    
    // Use a single listener that checks for our panel's messages
    window.addEventListener("message", dragHandler);

    iframe.addEventListener("load", () => resolve(iframe), { once: true });

    document.body.appendChild(iframe);
  });
}

/* ---------------- HIGHLIGHT ---------------- */

function highlight(body, links) {
  let html = body.innerHTML;
  PHRASES.forEach(p => {
    const r = new RegExp(`(${p})`, "gi");
    html = html.replace(r, `<span class="cs-highlight">$1</span>`);
  });
  body.innerHTML = html;

  links.forEach(l => {
    document.querySelectorAll(`a[href*="${l}"]`)
      .forEach(a => a.classList.add("cs-link"));
  });
}

/* ---------------- SCAN (PROMISE-BASED) ---------------- */

function sendMessageToPanel(iframe, message) {
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(message, "*");
  }
}

function requestScan() {
  return injectPanel()
    .then((iframe) => {
      const payload = extractEmail();

      // Notify panel that scan is starting
      sendMessageToPanel(iframe, { type: "CS_SCAN_START" });

      // Use Promise-based messaging: wrap sendMessage callback in Promise
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error("CampusShield: Backend request timeout");
          sendMessageToPanel(iframe, {
            type: "CS_SCAN_RESULT",
            payload: {
              risk_level: "Error",
              confidence_score: 0,
              explanations: ["Request timeout - backend unreachable"],
              suspicious_links: []
            }
          });
          resolve();
        }, 8000);

        chrome.runtime.sendMessage(
          { type: "scanEmail", payload },
          (res) => {
            clearTimeout(timeout);

            // Handle chrome.runtime.lastError (message port closed, etc.)
            if (chrome.runtime.lastError) {
              console.error("CampusShield: Message error:", chrome.runtime.lastError.message);
              sendMessageToPanel(iframe, {
                type: "CS_SCAN_RESULT",
                payload: {
                  risk_level: "Error",
                  confidence_score: 0,
                  explanations: ["Failed to communicate: " + chrome.runtime.lastError.message],
                  suspicious_links: []
                }
              });
              resolve();
              return;
            }

            // Safely validate response structure
            let safeResult;
            if (res && res.ok && res.result) {
              safeResult = res.result;
            } else if (res && res.error) {
              safeResult = {
                risk_level: "Error",
                confidence_score: 0,
                explanations: [res.error],
                suspicious_links: []
              };
            } else {
              safeResult = {
                risk_level: "Error",
                confidence_score: 0,
                explanations: ["Backend not reachable or invalid response"],
                suspicious_links: []
              };
            }

            // Send result to panel
            sendMessageToPanel(iframe, {
              type: "CS_SCAN_RESULT",
              payload: safeResult
            });

            // Highlight suspicious links in the page
            const body = document.querySelector(".body") || document.body;
            highlight(body, safeResult.suspicious_links || []);

            resolve();
          }
        );
      });
    })
    .catch((err) => {
      console.error("CampusShield: Failed to inject panel:", err);
    });
}

// Legacy function name for backward compatibility
function scanEmail() {
  requestScan();
}

/* ---------------- REMOVE PANEL ---------------- */

function removePanel() {
  const iframe = document.getElementById("campusshield-panel");
  if (iframe) {
    iframe.remove();
    console.log("✅ CampusShield: Panel removed");
  }
}

/* ================== GMAIL NAVIGATION DETECTION ================== */
/**
 * Watch for Gmail navigation to detect when user opens/closes messages
 * Uses 500ms debounce for performance
 */
let navigationDebounceTimer = null;

const gmailNavigationObserver = new MutationObserver(() => {
  // Debounce to avoid excessive checks
  clearTimeout(navigationDebounceTimer);
  navigationDebounceTimer = setTimeout(() => {
    const isOpenMessage = !!document.querySelector('div.a3s') || 
                          !!document.querySelector('[data-message-id]');
    logContent("debug", "Gmail navigation detected", { isOpenMessage });
  }, 500);
});

// Observe Gmail for navigation changes (if on Gmail)
if (isGmailHost() && document.body) {
  gmailNavigationObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

/* ================== MESSAGE HANDLERS ================== */

// Message handler for popup and background messages
// Pattern: Return true for async handlers, always call sendResponse
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) {
    return false;
  }

  if (msg.type === "PROBE") {
    // Lightweight health check so popup can decide whether to inject
    const ready = window.__campusshield_page_ready === true;
    const bodyLoaded = window.__campusshield_email_body_loaded === true;
    const inInbox = isGmailInboxView();
    const inEmailOpen = isGmailEmailOpenView();
    
    logContent("debug", "Received PROBE", { 
      ready, 
      bodyLoaded,
      inInbox,
      inEmailOpen,
      isGmail: isGmailHost(),
      isMock: isMockEmailPage()
    });
    
    sendResponse({ 
      ok: true, 
      pageReady: ready,
      bodyLoaded: bodyLoaded,
      inInbox: inInbox,
      inEmailOpen: inEmailOpen,
      isGmail: isGmailHost(),
      isMock: isMockEmailPage()
    });
    return false;
  }

  // STAGE A: Inbox heuristic scan (lightweight, no backend)
  if (msg.type === "REQUEST_SCAN_INBOX") {
    try {
      const candidates = inboxLightScan();
      logContent("debug", `REQUEST_SCAN_INBOX: found ${candidates.length} candidates`, {
        scores: candidates.map(c => c.score)
      });
      sendResponse({ ok: true, candidates });
    } catch (e) {
      logContent("error", "REQUEST_SCAN_INBOX error:", e.message);
      sendResponse({ ok: false, error: e.message });
    }
    return false;
  }

  // STAGE B: Deep email scan (extract data for backend)
  // This prepares data but does NOT call backend here
  // Backend call happens in popup/background
  if (msg.type === "REQUEST_DEEP_SCAN") {
    try {
      const emailData = extractFullEmailData();
      logContent("debug", `REQUEST_DEEP_SCAN: extracted email`, {
        sender: emailData.sender,
        subjectLen: emailData.subject.length,
        bodyLen: emailData.body.length,
        linkCount: emailData.links.length,
        success: emailData.success
      });
      sendResponse({ ok: true, emailData });
    } catch (e) {
      logContent("error", "REQUEST_DEEP_SCAN error:", e.message);
      sendResponse({ ok: false, error: e.message });
    }
    return false;
  }

  // Legacy: REQUEST_SCAN_MESSAGE (maps to REQUEST_DEEP_SCAN)
  if (msg.type === "REQUEST_SCAN_MESSAGE") {
    try {
      const emailData = extractFullEmailData();
      logContent("debug", "REQUEST_SCAN_MESSAGE: extracted email", { 
        sender: emailData.sender,
        success: emailData.success
      });
      sendResponse({ ok: true, emailData });
    } catch (e) {
      logContent("error", "REQUEST_SCAN_MESSAGE error:", e.message);
      sendResponse({ ok: false, error: e.message });
    }
    return false;
  }

  // PHASE 1: Show candidates in panel
  if (msg.type === "SHOW_CANDIDATES") {
    try {
      injectPanel().then((iframe) => {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: "CS_INBOX_SCAN_RESULT",
            candidates: msg.candidates
          }, "*");
        }
      });
      sendResponse({ ok: true });
    } catch (e) {
      logContent("error", "SHOW_CANDIDATES error:", e.message);
      sendResponse({ ok: false, error: e.message });
    }
    return false;
  }

  // PHASE 1: Show single message result in panel
  if (msg.type === "SHOW_RESULT") {
    try {
      injectPanel().then((iframe) => {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: "CS_SCAN_RESULT",
            payload: msg.result
          }, "*");
        }
      });
      sendResponse({ ok: true });
    } catch (e) {
      logContent("error", "SHOW_RESULT error:", e.message);
      sendResponse({ ok: false, error: e.message });
    }
    return false;
  }

  if (msg?.type === "REQUEST_SCAN") {
    // Legacy: Async scan operation initiated from popup
    // Return true to keep the message port open until sendResponse is called
    // This prevents "message port closed" errors on async operations
    requestScan().finally(() => {
      // Always call sendResponse when async operation completes
      // This ensures the popup callback fires and the port closes cleanly
      sendResponse({ ok: true, status: "scan_initiated" });
    });
    return true;  // CRITICAL: Keep port open for async sendResponse
  }
  
  if (msg?.type === "REMOVE_PANEL") {
    removePanel();
    sendResponse({ success: true });
    return false;  // Synchronous - port closes after sendResponse
  }
  
  // Unknown message type - respond with error to prevent hanging
  sendResponse({ error: "Unknown message type" });
  return false;
});

// Listen for postMessage from panel iframe to remove itself
window.addEventListener("message", (event) => {
  // Only accept messages from our extension origin
  if (event.data?.type === "CS_REMOVE_PANEL") {
    removePanel();
  }
});

console.log("✅ CampusShield content script initialized");