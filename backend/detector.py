"""
Phishing detection module with rule-based analysis.
Privacy-first: no raw email content is stored or logged.
"""

import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict


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
            masked_local = local[0] + '*' * max(1, len(local) - 2) + (local[-1] if len(local) > 1 else '')
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
        text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+', lambda m: PIIMasker.mask_email(m.group()), text)
        # Mask phone numbers
        text = re.sub(r'\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b', 
                     lambda m: PIIMasker.mask_phone(m.group()), text)
        return text


class PhishingDetector:
    """Rule-based phishing detection engine."""

    def __init__(self):
        """Initialize detection rules and patterns."""
        self.rules = self._init_rules()

    def _init_rules(self) -> List[Dict]:
        """
        Define all detection rules with scoring weights.
        Each rule contains: pattern, weight, rule_id, explanation.
        """
        return [
            # Urgency indicators
            {
                'id': 'urgency_pressure',
                'patterns': [r'\burge?nt(?!ly|\sasync)', r'\bact\snow\b', r'\bimmediate(?:ly)?\b', r'\bASAP\b'],
                'weight': 0.15,
                'explanation': 'Email uses high-pressure urgency language.',
            },
            # Account verification requests
            {
                'id': 'verify_account',
                'patterns': [r'\bverif(?:y|ication)\s+(?:your\s+)?(?:account|identity|info)', 
                           r'\bconfirm\s+(?:your\s+)?(?:account|identity|info)',
                           r'\bre-?verify\b'],
                'weight': 0.20,
                'explanation': 'Email requests verification of account credentials.',
            },
            # Account suspension threats
            {
                'id': 'account_suspension',
                'patterns': [r'\bsuspend(?:ed)?\b', r'\blocked?\b', r'\brestricted?\b'],
                'weight': 0.18,
                'explanation': 'Email threatens account suspension or lockout.',
            },
            # Password/login requests
            {
                'id': 'password_request',
                'patterns': [r'\b(?:reset|change|update|confirm)\s+(?:your\s+)?password\b',
                           r'\blogin\s+(?:again|now)\b', r'\bre-?authenticate\b'],
                'weight': 0.20,
                'explanation': 'Email requests password or login information.',
            },
            # Fake urgency with links
            {
                'id': 'click_link_urgency',
                'patterns': [r'(?:click|tap|open|visit).*(?:link|here|button)'],
                'weight': 0.12,
                'explanation': 'Email urges clicking a link or button.',
            },
            # Payment/billing claims
            {
                'id': 'payment_claim',
                'patterns': [r'\b(?:billing|payment|invoice|charge|subscription)\s+(?:issue|problem|due|failed)',
                           r'\bupdate\s+(?:billing|payment)\s+(?:info|method)',
                           r'\b(?:paypal|venmo|stripe|credit\s+card)\b'],
                'weight': 0.13,
                'explanation': 'Email claims billing or payment issues.',
            },
            # Lottery/prize claims
            {
                'id': 'prize_claim',
                'patterns': [r'\b(?:congratulations|win|won|claim|prize|reward)\b'],
                'weight': 0.10,
                'explanation': 'Email claims prize or reward.',
            },
            # Misspellings of known brands
            {
                'id': 'misspelled_brand',
                'patterns': [r'\b(?:gmai|gmial|gogle|amazn|micorsoft)\b'],
                'weight': 0.08,
                'explanation': 'Email contains misspelled brand names.',
            },
        ]

    def detect_urls(self, text: str) -> List[str]:
        """Extract URLs from text."""
        url_pattern = r'https?://[^\s)>\'"]+|www\.[^\s)>\'"]+\.[a-z]+'
        return re.findall(url_pattern, text, re.IGNORECASE)

    def analyze_urls(self, urls: List[str], sender: str) -> Tuple[List[str], float]:
        """
        Analyze URLs for suspicious characteristics.
        Returns: (suspicious_urls, score_contribution)
        """
        suspicious = []
        suspicious_score = 0.0

        for url in urls:
            url_lower = url.lower()
            
            # Check for IP addresses instead of domain names
            if re.search(r'https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', url):
                suspicious.append(url)
                suspicious_score += 0.15
                continue
            
            # Check for very long URLs (often used for obfuscation)
            if len(url) > 100:
                suspicious.append(url)
                suspicious_score += 0.10
                continue
            
            # Check for multiple redirects (many slashes)
            if url.count('/') > 5:
                suspicious.append(url)
                suspicious_score += 0.10
                continue
            
            # Check for suspicious TLDs
            suspicious_tlds = ['.tk', '.ml', '.ga', '.cf']
            if any(url_lower.endswith(tld) for tld in suspicious_tlds):
                suspicious.append(url)
                suspicious_score += 0.12
                continue
        
        return suspicious, min(suspicious_score, 0.30)  # Cap at 0.30

    def check_rules(self, text: str) -> Tuple[List[str], float]:
        """
        Check text against all detection rules.
        Returns: (matched_rule_ids, score_contribution)
        """
        text_lower = text.lower()
        matched_rules = []
        total_score = 0.0

        for rule in self.rules:
            for pattern in rule['patterns']:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    matched_rules.append(rule['id'])
                    total_score += rule['weight']
                    break  # Only count each rule once

        return matched_rules, min(total_score, 0.99)  # Cap to avoid exceeding 1.0

    def get_explanations(self, matched_rule_ids: List[str]) -> List[str]:
        """Get human-readable explanations for matched rules."""
        explanations = []
        rule_map = {rule['id']: rule['explanation'] for rule in self.rules}
        
        for rule_id in matched_rule_ids:
            if rule_id in rule_map:
                explanations.append(rule_map[rule_id])
        
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
        # Combine text for analysis
        full_text = f"{subject} {body}"

        # Extract URLs
        urls = self.detect_urls(full_text)

        # Check rules
        matched_rules, rule_score = self.check_rules(full_text)

        # Analyze URLs
        suspicious_urls, url_score = self.analyze_urls(urls, sender)

        # Calculate confidence score
        confidence_score = min(rule_score + url_score, 1.0)

        # Determine risk level
        if confidence_score >= 0.70:
            risk_level = "High"
        elif confidence_score >= 0.40:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        # Get explanations
        explanations = self.get_explanations(matched_rules)

        # Add URL-based explanations if suspicious links found
        if suspicious_urls:
            explanations.append(f"Email contains {len(suspicious_urls)} suspicious link(s).")

        return DetectionResult(
            risk_level=risk_level,
            confidence_score=round(confidence_score, 2),
            reasons=matched_rules + (['suspicious_urls'] if suspicious_urls else []),
            explanations=explanations,
            suspicious_links=suspicious_urls,
        )
