"""
backend/detector.py

Phishing detection module with rule-based analysis.
Privacy-first: no raw email content is stored or logged.

Returns a DetectionResult dataclass which can be converted to JSON by the API layer.
"""

import re
from dataclasses import dataclass
from typing import List, Tuple
from urllib.parse import urlparse


@dataclass
class DetectionResult:
    """Structured result from phishing detection analysis."""
    risk_level: str  # "Low", "Medium", "High"
    confidence_score: float  # 0.0 - 1.0
    reasons: List[str]  # Machine-readable rule violations
    explanations: List[str]  # Human-readable descriptions
    suspicious_links: List[str]  # Detected URLs


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

    def analyze(self, sender: str, subject: str, body: str) -> DetectionResult:
        """
        Perform comprehensive phishing analysis.

        Args:
            sender: Email sender address
            subject: Email subject line
            body: Email body content

        Returns:
            DetectionResult with risk assessment
        """
        # Combine text for analysis; mask PII in returned explanations if needed (we avoid storing raw text)
        full_text = f"{subject or ''} {body or ''}"

        # Extract URLs from subject+body
        urls = self.detect_urls(full_text)

        # Rule-based matches and score
        matched_rules, rule_score = self.check_rules(full_text)

        # URL analysis and URL-based score
        suspicious_urls, url_score = self.analyze_urls(urls, sender or "")

        # Compose base confidence from rules + urls
        confidence = min(rule_score + url_score, 1.0)

        # Decide risk level by thresholds
        if confidence >= 0.70:
            risk = "High"
        elif confidence >= 0.40:
            risk = "Medium"
        else:
            risk = "Low"

        # Explanations
        explanations = self.get_explanations(matched_rules)
        if suspicious_urls:
            explanations.append(f"Email contains {len(suspicious_urls)} suspicious link(s).")

        # Reasons: combine matched rules + url-based reason id (if any)
        reasons = matched_rules[:]
        if suspicious_urls:
            reasons.append('suspicious_link')

        # Ensure uniqueness
        reasons = list(dict.fromkeys(reasons))

        return DetectionResult(
            risk_level=risk,
            confidence_score=round(confidence, 2),
            reasons=reasons,
            explanations=explanations,
            suspicious_links=suspicious_urls,
        )