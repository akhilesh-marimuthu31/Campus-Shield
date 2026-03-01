"""
backend/detector.py

Phishing detection module with rule-based analysis.
Privacy-first: no raw email content is stored or logged.

Returns a DetectionResult dataclass which can be converted to JSON by the API layer.
"""

import re
from dataclasses import dataclass
from typing import List, Tuple, Dict
from urllib.parse import urlparse


@dataclass
class DetectionResult:
    """Structured result from phishing detection analysis."""
    risk_level: str  # "Low", "Medium", "High"
    confidence_score: float  # 0.0 - 1.0
    reasons: List[str]  # Machine-readable rule violations
    explanations: List[str]  # Human-readable descriptions
    suspicious_links: List[str]  # Detected URLs
    explanation: str = ""  # Natural language summary of why classified this way


class PIIMasker:
    """Masks personally identifiable information for privacy."""

    @staticmethod
    def mask_email(email: str) -> str:
        """Mask email address, keeping domain."""
        match = re.match(r'([^@]+)@(.+)', email)
        if match:
            local, domain = match.groups()
            if len(local) == 1:
                masked_local = local[0]
            elif len(local) == 2:
                masked_local = local[0] + '*'
            else:
                masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
            return f"{masked_local}@{domain}"
        return "***@***"

    @staticmethod
    def mask_phone(phone: str) -> str:
        """Mask phone number."""
        digits = re.sub(r'\D', '', phone)
        if len(digits) >= 4:
            return '*' * (len(digits) - 4) + digits[-4:]
        return '*' * len(digits)

    @staticmethod
    def mask_sensitive_data(text: str) -> str:
        """Mask emails and phone numbers in text."""
        # Mask email addresses
        text = re.sub(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)', lambda m: PIIMasker.mask_email(m.group()), text)
        # Mask phone numbers (US-centric pattern but OK for demo)
        text = re.sub(r'\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
                      lambda m: PIIMasker.mask_phone(m.group()), text)
        return text


class PhishingDetector:
    """Rule-based phishing detection engine."""

    # Hardcoded allowlist of trusted domains (domain reputation)
    TRUSTED_DOMAINS = {
        'google.com', 'gmail.com', 'mail.google.com',
        'github.com', 'amd.com', 'unstop.com',
        'stanford.edu', 'harvard.edu', 'mit.edu',
        'microsoft.com', 'apple.com', 'amazon.com'
    }

    def __init__(self):
        """Initialize detection rules and patterns."""
        self.rules = self._init_rules()

    def _init_rules(self):
        """Return list of rule definitions with id, patterns, weight and explanation."""
        return [
            {
                'id': 'urgency_pressure',
                'patterns': [r'\burgent\b', r'\bact now\b', r'\bimmediately\b', r'\bASAP\b', r'\bnow or you\b'],
                'weight': 0.15,
                'explanation': 'Email uses high-pressure urgency language.'
            },
            {
                'id': 'verify_account',
                'patterns': [r'\bverify (?:your )?(?:account|identity|info)\b', r'\bconfirm (?:your )?(?:account|identity|info)\b'],
                'weight': 0.20,
                'explanation': 'Email requests verification of account credentials.'
            },
            {
                'id': 'account_suspension',
                'patterns': [r'\bsuspend(?:ed|ion)?\b', r'\blocked\b', r'\brestricted\b', r'\bwill be closed\b'],
                'weight': 0.18,
                'explanation': 'Email threatens account suspension or lockout.'
            },
            {
                'id': 'password_request',
                'patterns': [r'\breset (?:your )?password\b', r'\bupdate (?:your )?password\b', r'\bprovide (?:your )?password\b'],
                'weight': 0.20,
                'explanation': 'Email requests password or login information.'
            },
            {
                'id': 'click_link_urgency',
                'patterns': [r'(?:click|tap|open|visit)\s+(?:the\s+)?(?:link|here|button)\b', r'\bclick here\b'],
                'weight': 0.12,
                'explanation': 'Email urges clicking a link or button.'
            },
            {
                'id': 'payment_claim',
                'patterns': [r'\bbilling\b', r'\binvoice\b', r'\bpayment (?:failed|due)\b', r'\bupdate (?:billing|payment)\b'],
                'weight': 0.13,
                'explanation': 'Email claims billing or payment issues.'
            },
            {
                'id': 'prize_claim',
                'patterns': [r'\bcongratulations\b', r'\bclaim your prize\b', r'\byou won\b'],
                'weight': 0.10,
                'explanation': 'Email claims a prize or reward.'
            },
            {
                'id': 'misspelled_brand',
                'patterns': [r'\bgmai\b', r'\bgmial\b', r'\bgogle\b', r'\bamazn\b', r'\bmicorsoft\b'],
                'weight': 0.08,
                'explanation': 'Email contains misspelled brand names.'
            },
        ]

    def detect_urls(self, text: str) -> List[str]:
        """Extract URLs from text."""
        # capture http/https and www links
        url_pattern = r'https?://[^\s)>\'"]+|www\.[^\s)>\'"]+\.[a-z]{2,}'
        return re.findall(url_pattern, text, flags=re.IGNORECASE)

    def _extract_domain(self, url: str) -> str:
        """Return hostname (domain) part of a URL, or empty string on parse failure."""
        try:
            parsed = urlparse(url if url.startswith('http') else f'http://{url}')
            return parsed.hostname or ''
        except Exception:
            return ''

    def analyze_urls(self, urls: List[str], sender: str) -> Tuple[List[str], float]:
        """
        Analyze URLs for suspicious characteristics.
        Returns a tuple: (list_of_suspicious_urls, score_contribution)
        """
        suspicious = []
        score = 0.0

        # Known shorteners commonly abused
        shorteners = {'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly'}

        # suspicious TLDs
        suspicious_tlds = {'.tk', '.ml', '.ga', '.cf', '.gq'}

        # sender domain for simple mismatch check
        sender_domain = ''
        try:
            sender_domain = sender.split('@', 1)[1].lower() if '@' in sender else ''
        except Exception:
            sender_domain = ''

        for url in urls:
            u = url.strip()
            u_lower = u.lower()

            # IP-based URL
            if re.search(r'https?://\d{1,3}(?:\.\d{1,3}){3}', u_lower):
                suspicious.append(u)
                score += 0.18
                continue

            # Missing https (non-secure)
            if not u_lower.startswith('https://'):
                suspicious.append(u)
                score += 0.12
                # keep checking other signals (don't continue)

            # Shorteners
            domain = self._extract_domain(u_lower)
            if domain and domain in shorteners:
                if u not in suspicious:
                    suspicious.append(u)
                score += 0.15

            # Long/obfuscated URL
            if len(u) > 100:
                if u not in suspicious:
                    suspicious.append(u)
                score += 0.10

            # Many path segments (possible redirect chain)
            if u.count('/') > 5:
                if u not in suspicious:
                    suspicious.append(u)
                score += 0.08

            # Suspicious TLD
            if any(u_lower.endswith(tld) for tld in suspicious_tlds):
                if u not in suspicious:
                    suspicious.append(u)
                score += 0.12

            # Keyword-based heuristics inside URL
            if any(k in u_lower for k in ('login', 'signin', 'verify', 'account', 'secure')):
                if u not in suspicious:
                    suspicious.append(u)
                score += 0.10

            # Simple sender vs link domain mismatch (low weight; many legit emails differ)
            link_domain = domain
            if sender_domain and link_domain and sender_domain not in link_domain:
                # don't mark solely on domain mismatch, but add small suspicion
                score += 0.05

        # cap URL score reasonably so it doesn't dominate rules
        return list(dict.fromkeys(suspicious)), min(score, 0.40)

    def check_rules(self, text: str) -> Tuple[List[str], float]:
        """
        Check text against all detection rules.
        Returns: (matched_rule_ids, total_score_contribution)
        """
        text_lower = text.lower()
        matched = []
        total = 0.0

        for rule in self.rules:
            for pattern in rule['patterns']:
                if re.search(pattern, text_lower, flags=re.IGNORECASE):
                    matched.append(rule['id'])
                    total += rule['weight']
                    break  # count each rule at most once

        return list(dict.fromkeys(matched)), min(total, 0.99)

    def get_explanations(self, matched_rule_ids: List[str]) -> List[str]:
        """Get human-readable explanations for matched rules."""
        explanations = []
        rule_map = {rule['id']: rule['explanation'] for rule in self.rules}
        for rid in matched_rule_ids:
            if rid in rule_map:
                explanations.append(rule_map[rid])
        return explanations

    def _extract_base_domain(self, domain: str) -> str:
        """Extract base domain from full domain (e.g., 'mail.google.com' -> 'google.com')."""
        if not domain:
            return ''
        parts = domain.lower().split('.')
        # For domains with 2 parts (like google.com), use as-is
        # For 3+ parts (subdomains), use last 2 parts
        if len(parts) >= 2:
            return '.'.join(parts[-2:])
        return domain.lower()

    def _is_trusted_domain(self, domain: str) -> bool:
        """Check if domain is in trusted allowlist."""
        if not domain:
            return False
        base_domain = self._extract_base_domain(domain)
        return base_domain in self.TRUSTED_DOMAINS

    def _check_unsubscribe_or_footer(self, text: str, urls: List[str]) -> bool:
        """
        Check if email contains legitimate footer indicators:
        - Unsubscribe link/text
        - Company address/contact info
        - Marketing footer patterns
        """
        text_lower = text.lower() if text else ''
        
        # Unsubscribe indicators
        if any(pattern in text_lower for pattern in [
            'unsubscribe', 'opt out', 'manage preferences',
            'manage subscriptions', 'email preferences'
        ]):
            return True
        
        # Check if any URL is marked as unsubscribe
        for url in (urls or []):
            if any(keyword in url.lower() for keyword in ['unsubscribe', 'opt-out', 'manage']):
                return True
        
        # Company footer patterns
        if any(pattern in text_lower for pattern in [
            '©', '(c)', 'all rights reserved',
            'contact us', 'follow us on',
            'powered by', 'terms of service'
        ]):
            return True
        
        return False

    def _sender_domain_matches_link_domain(self, sender: str, links: List[str]) -> bool:
        """
        Check if sender's domain appears in the links.
        E.g., email from sender@google.com with link to google.com/auth
        """
        if not sender or '@' not in sender or not links:
            return False
        
        try:
            sender_domain = self._extract_base_domain(sender.split('@')[1])
        except Exception:
            return False
        
        for link in links:
            try:
                link_domain = self._extract_domain(link)
                if link_domain:
                    link_base = self._extract_base_domain(link_domain)
                    if link_base == sender_domain:
                        return True
            except Exception:
                continue
        
        return False

    def _has_urgency_and_verification_links(self, matched_rules: List[str], urls: List[str]) -> bool:
        """
        Check if email has BOTH urgency language AND links that look like verification/login.
        This combination is a strong phishing signal.
        """
        has_urgency = 'urgency_pressure' in matched_rules
        
        if not has_urgency or not urls:
            return False
        
        # Check if any URL looks like verification/login
        verification_keywords = ['verify', 'login', 'signin', 'auth', 'confirm', 'account']
        for url in urls:
            if any(kw in url.lower() for kw in verification_keywords):
                return True
        
        return False

    def _should_amplify_risk(self, matched_rules: List[str], sender: str, urls: List[str]) -> float:
        """
        Risk amplification: increase score when multiple high-suspicion signals coexist.
        Returns additional score to add (0 to amplify).
        """
        amplification = 0.0
        
        # Urgency + verification links = strong phishing signal
        if self._has_urgency_and_verification_links(matched_rules, urls):
            amplification += 0.15
        
        # Prize/reward + unknown sender (not trusted domain)
        if 'prize_claim' in matched_rules:
            sender_domain = sender.split('@')[1] if sender and '@' in sender else ''
            if sender_domain and not self._is_trusted_domain(sender_domain):
                amplification += 0.10
        
        # Account suspension + urgency (classic phishing combo)
        if 'account_suspension' in matched_rules and 'urgency_pressure' in matched_rules:
            # Already counted in individual weights, but this combo deserves attention
            # However, we already added both weights, so don't double-count
            pass
        
        return amplification

    def _generate_explanation(self, risk_level: str, confidence: float, matched_rules: List[str], 
                           suspicious_urls: List[str], sender: str, links: List[str],
                           trust_signals: dict) -> str:
        """
        Generate a natural-language explanation of the classification.
        
        Args:
            risk_level: High/Medium/Low
            confidence: confidence score
            matched_rules: matched rule IDs
            suspicious_urls: detected suspicious URLs
            sender: email sender
            links: all links in email
            trust_signals: dict with trust signal booleans
        
        Returns:
            Natural language explanation string
        """
        parts = []
        
        # Start with base classification
        if risk_level == 'High':
            parts.append('This email has HIGH phishing risk.')
        elif risk_level == 'Medium':
            parts.append('This email has MEDIUM phishing risk.')
        else:
            parts.append('This email appears SAFE.')
        
        parts.append(f'Confidence: {int(confidence * 100)}%.')
        
        # Add threat signals detected
        threat_details = []
        if 'urgency_pressure' in matched_rules:
            threat_details.append('high-pressure urgency language')
        if 'verify_account' in matched_rules:
            threat_details.append('requests for account verification')
        if 'account_suspension' in matched_rules:
            threat_details.append('threats of account suspension')
        if 'password_request' in matched_rules:
            threat_details.append('requests for password')
        if 'payment_claim' in matched_rules:
            threat_details.append('billing/payment claims')
        if 'prize_claim' in matched_rules:
            threat_details.append('prize/reward claims')
        
        if threat_details:
            parts.append('Detected: ' + ', '.join(threat_details) + '.')
        
        # Add suspicious URLs info
        if suspicious_urls:
            parts.append(f'Found {len(suspicious_urls)} suspicious link(s).')
        
        # Add trust signal info
        if trust_signals.get('is_trusted_sender'):
            parts.append('✓ Sender is from a trusted domain.')
        
        if trust_signals.get('has_unsubscribe'):
            parts.append('✓ Email has legitimate footer/unsubscribe link.')
        
        if trust_signals.get('sender_link_match'):
            parts.append('✓ Links match sender domain (legitimate).')
        
        # Recommendation
        if risk_level == 'High':
            parts.append('⚠ Do not click links or provide information. Report as spam.')
        elif risk_level == 'Medium':
            parts.append('⚠ Be cautious. Verify sender independently before acting.')
        else:
            parts.append('This appears to be a legitimate email.')
        
        return ' '.join(parts)

    def analyze(self, sender: str, subject: str, body: str, links: List[str] = None) -> DetectionResult:
        """
        Perform comprehensive phishing analysis with trust-based scoring.

        Strategy:
        1. Check rule matches on text
        2. Analyze URLs for suspicious characteristics
        3. Apply trust signals (reduce risk if legitimate)
        4. Apply risk amplification (increase risk if dangerous combo)
        5. Cap final score and determine risk level
        6. Generate natural language explanation

        Args:
            sender: Email sender address
            subject: Email subject line
            body: Email body content
            links: List of URLs extracted from email

        Returns:
            DetectionResult with risk assessment
        """
        # Combine text for analysis
        full_text = f"{subject or ''} {body or ''}"

        # Extract URLs from subject+body text AND from provided links array
        urls_from_text = self.detect_urls(full_text)
        urls_from_links = links if links else []
        # Combine and deduplicate URLs
        all_urls = list(dict.fromkeys(urls_from_text + urls_from_links))

        # =====================================================================
        # THREAT SCORING
        # =====================================================================
        
        # Rule-based matches and score
        matched_rules, rule_score = self.check_rules(full_text)

        # URL analysis and URL-based score
        suspicious_urls, url_score = self.analyze_urls(all_urls, sender or "")

        # Base threat score (before trust adjustments)
        threat_score = min(rule_score + url_score, 1.0)

        # =====================================================================
        # TRUST SIGNALS (reduce risk)
        # =====================================================================
        
        trust_signals = {
            'is_trusted_sender': False,
            'has_unsubscribe': False,
            'sender_link_match': False
        }

        trust_reduction = 0.0

        # Signal 1: Sender from trusted domain
        sender_domain = sender.split('@')[1] if sender and '@' in sender else ''
        if sender_domain and self._is_trusted_domain(sender_domain):
            trust_signals['is_trusted_sender'] = True
            trust_reduction += 0.25  # Significant reduction for known-good domains

        # Signal 2: Email has unsubscribe/footer (legitimate business email)
        if self._check_unsubscribe_or_footer(full_text, all_urls):
            trust_signals['has_unsubscribe'] = True
            trust_reduction += 0.10

        # Signal 3: Sender domain matches link domain (not trying to spoof)
        if self._sender_domain_matches_link_domain(sender, all_urls):
            trust_signals['sender_link_match'] = True
            trust_reduction += 0.15

        # Apply trust reduction to threat score
        adjusted_score = max(0.0, threat_score - trust_reduction)

        # =====================================================================
        # RISK AMPLIFICATION (increase risk when dangerous combos coexist)
        # =====================================================================
        
        amplification = self._should_amplify_risk(matched_rules, sender, all_urls)
        final_score = min(adjusted_score + amplification, 1.0)

        # =====================================================================
        # RISK LEVEL DETERMINATION
        # =====================================================================
        
        if final_score >= 0.70:
            risk = "High"
        elif final_score >= 0.40:
            risk = "Medium"
        else:
            risk = "Low"

        # =====================================================================
        # EXPLANATIONS
        # =====================================================================
        
        # Bullet-point explanations of matched rules
        explanations = self.get_explanations(matched_rules)
        if suspicious_urls:
            explanations.append(f"Email contains {len(suspicious_urls)} suspicious link(s).")

        # Natural language summary
        explanation = self._generate_explanation(
            risk, final_score, matched_rules, suspicious_urls, sender, all_urls, trust_signals
        )

        # =====================================================================
        # REASONS (machine-readable)
        # =====================================================================
        
        reasons = matched_rules[:]
        if suspicious_urls:
            reasons.append('suspicious_link')
        if final_score >= 0.70:
            reasons.append('high_risk_classification')
        elif final_score >= 0.40:
            reasons.append('medium_risk_classification')

        # Ensure uniqueness
        reasons = list(dict.fromkeys(reasons))

        return DetectionResult(
            risk_level=risk,
            confidence_score=round(final_score, 2),
            reasons=reasons,
            explanations=explanations,
            suspicious_links=suspicious_urls,
            explanation=explanation,
        )

    def extract_signals(self, sender: str, subject: str, body: str, links: List[str] = None) -> Dict:
        """
        Build structured signals for AI decision layer.
        
        Args:
            sender: Email sender address
            subject: Email subject line
            body: Email body content
            links: List of URLs from email
        
        Returns:
            Dict with structured signals for LLM classification
        """
        full_text = f"{subject or ''} {body or ''}"
        all_urls = list(dict.fromkeys(
            self.detect_urls(full_text) + (links if links else [])
        ))
        
        # Extract domains
        sender_domain = ''
        try:
            sender_domain = self._extract_base_domain(sender.split('@')[1]) if sender and '@' in sender else ''
        except Exception:
            pass
        
        link_domains = []
        for url in all_urls:
            try:
                domain = self._extract_domain(url)
                if domain:
                    base_domain = self._extract_base_domain(domain)
                    if base_domain and base_domain not in link_domains:
                        link_domains.append(base_domain)
            except Exception:
                pass
        
        # Check for threat patterns
        text_lower = full_text.lower()
        
        urgency_detected = bool(re.search(r'\b(urgent|act now|immediately|asap)\b', text_lower))
        verification_request = bool(re.search(r'\b(verify|confirm).*(account|identity|login|password)\b', text_lower))
        reward_language = bool(re.search(r'\b(congratulations|claim.*prize|you won|you have been selected)\b', text_lower))
        suspension_threat = bool(re.search(r'\b(suspend|lock|restrict|will be closed)\b', text_lower))
        
        # Check trust signals
        known_sender = sender_domain and self._is_trusted_domain(sender_domain)
        sender_link_match = sender_domain and sender_domain in link_domains
        domain_mismatch = bool(sender_domain and link_domains and sender_domain not in link_domains)
        unsubscribe_present = self._check_unsubscribe_or_footer(full_text, all_urls)
        
        # Create email context (first 2-3 lines of body)
        email_context = ''
        if body:
            lines = body.split('\n')
            email_context = ' '.join(lines[:2]).strip()[:150]
        elif subject:
            email_context = subject[:150]
        
        return {
            'sender_domain': sender_domain or 'unknown',
            'link_domains': link_domains,
            'urgency_detected': urgency_detected,
            'verification_request': verification_request,
            'reward_language': reward_language,
            'suspension_threat': suspension_threat,
            'domain_mismatch': domain_mismatch,
            'unsubscribe_present': unsubscribe_present,
            'known_sender': known_sender,
            'sender_link_match': sender_link_match,
            'email_context': email_context,
            'threat_indicators': {
                'urgency_pressure': 'urgency_pressure' in [r['id'] for r in self.rules],
                'verify_account': 'verify_account' in [r['id'] for r in self.rules],
                'account_suspension': 'account_suspension' in [r['id'] for r in self.rules],
            }
        }