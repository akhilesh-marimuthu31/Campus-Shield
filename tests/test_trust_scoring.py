#!/usr/bin/env python3
"""
Test script for improved phishing detection with trust-based scoring.
Tests domain reputation, trust signals, and risk amplification.
"""

import json
import sys
sys.path.append('backend')

from detector import PhishingDetector

def test_trusted_domain():
    """Test: Email from trusted domain should have reduced risk"""
    print("\n=== TEST 1: Trusted Domain Reduction ===")
    detector = PhishingDetector()
    
    # Legitimate email from Google with verification language
    result = detector.analyze(
        sender="security-alert@google.com",
        subject="Verify your Google account",
        body="Please verify your account. Visit https://google.com/verify",
        links=["https://google.com/verify"]
    )
    
    print(f"Risk Level: {result.risk_level}")
    print(f"Confidence: {result.confidence_score}")
    print(f"Explanation: {result.explanation}")
    
    # Should be LOW despite "verify account" because sender is trusted
    assert result.risk_level == "Low", f"Expected Low risk for trusted domain, got {result.risk_level}"
    assert result.confidence_score < 0.4, f"Expected score < 0.4 for trusted domain, got {result.confidence_score}"
    print("✓ PASS: Trusted domain reduces risk score\n")


def test_unknown_domain_with_urgency_verify():
    """Test: Unknown domain + urgency + verify links = HIGH risk (amplified)"""
    print("=== TEST 2: Risk Amplification (Urgency + Verify) ===")
    detector = PhishingDetector()
    
    # Phishing pattern: unknown domain + urgency + verification
    result = detector.analyze(
        sender="security@phishing-example.com",
        subject="URGENT: Verify your account NOW",
        body="Click here immediately to verify your account. Your account will be suspended.",
        links=["http://phishing-example.com/verify"]
    )
    
    print(f"Risk Level: {result.risk_level}")
    print(f"Confidence: {result.confidence_score}")
    print(f"Explanation: {result.explanation}")
    
    # Should be HIGH due to urgency + verification combination
    assert result.risk_level == "High", f"Expected High risk, got {result.risk_level}"
    assert result.confidence_score >= 0.7, f"Expected score >= 0.7 for phishing, got {result.confidence_score}"
    print("✓ PASS: Urgency + verify links triggers amplification\n")


def test_unsubscribe_footer():
    """Test: Email with unsubscribe link should have reduced risk"""
    print("=== TEST 3: Unsubscribe Footer Reduction ===")
    detector = PhishingDetector()
    
    # Email with verification language BUT has unsubscribe
    result = detector.analyze(
        sender="newsletter@example.com",
        subject="Verify your newsletter subscription",
        body="Please verify your subscription.\n\nTo unsubscribe: https://example.com/unsubscribe",
        links=["https://example.com/verify", "https://example.com/unsubscribe"]
    )
    
    print(f"Risk Level: {result.risk_level}")
    print(f"Confidence: {result.confidence_score}")
    print(f"Explanation: {result.explanation}")
    
    # Should be MEDIUM or LOW despite verification language (unsubscribe indicates legitimacy)
    assert result.risk_level in ["Low", "Medium"], f"Expected Low/Medium risk, got {result.risk_level}"
    print("✓ PASS: Unsubscribe footer reduces risk\n")


def test_sender_link_domain_match():
    """Test: Sender domain matching link domain should reduce risk"""
    print("=== TEST 4: Sender-Link Domain Match ===")
    detector = PhishingDetector()
    
    # Email from amd.com (trusted) with link to amd.com
    result = detector.analyze(
        sender="security@amd.com",
        subject="Verify your AMD account",
        body="Click to verify: https://amd.com/security",
        links=["https://amd.com/security"]
    )
    
    print(f"Risk Level: {result.risk_level}")
    print(f"Confidence: {result.confidence_score}")
    print(f"Explanation: {result.explanation}")
    
    # Should be LOW (trusted domain + sender/link match)
    assert result.risk_level == "Low", f"Expected Low risk, got {result.risk_level}"
    assert "✓ Links match sender domain" in result.explanation, "Expected mention of domain match"
    print("✓ PASS: Sender-link match reduces risk\n")


def test_prize_from_unknown():
    """Test: Prize/reward from unknown sender gets amplified"""
    print("=== TEST 5: Prize from Unknown Sender Amplification ===")
    detector = PhishingDetector()
    
    # Prize claim from unknown sender with MISMATCHED link domain
    result = detector.analyze(
        sender="lottery@random-domain.xyz",
        subject="Congratulations! You won!",
        body="Click to claim your prize now! Congratulations, you have won $1000000.",
        links=["http://claim-prize.net/verify"]  # Different domain = suspicious
    )
    
    print(f"Risk Level: {result.risk_level}")
    print(f"Confidence: {result.confidence_score}")
    print(f"Explanation: {result.explanation}")
    
    # Should be HIGH or MEDIUM (prize from unknown + domain mismatch = classic phishing)
    assert result.risk_level in ["High", "Medium"], f"Expected High/Medium risk, got {result.risk_level}"
    assert "prize/reward" in result.explanation.lower(), "Expected mention of prize/reward"
    print("✓ PASS: Prize from unknown sender gets amplified\n")


def test_natural_language_explanation():
    """Test: Natural language explanation is generated"""
    print("=== TEST 6: Natural Language Explanation ===")
    detector = PhishingDetector()
    
    result = detector.analyze(
        sender="hacker@evil.com",
        subject="Urgent: Confirm password",
        body="Please confirm your password immediately or your account will be closed.",
        links=["http://evil.com/confirm"]
    )
    
    print(f"Explanation: {result.explanation}")
    
    # Should have natural language explanation
    assert len(result.explanation) > 50, "Explanation too short"
    assert "High" in result.explanation or "phishing" in result.explanation.lower(), "Should mention risk level"
    assert "%" in result.explanation, "Should include confidence percentage"
    print("✓ PASS: Natural language explanation generated\n")


def test_clean_email_from_trusted():
    """Test: Clean email from trusted domain = LOW risk"""
    print("=== TEST 7: Clean Email from Trusted Domain ===")
    detector = PhishingDetector()
    
    result = detector.analyze(
        sender="team@github.com",
        subject="Repository activity notification",
        body="Your repository has new activity. Visit https://github.com/yourrepo to view.",
        links=["https://github.com/yourrepo"]
    )
    
    print(f"Risk Level: {result.risk_level}")
    print(f"Confidence: {result.confidence_score}")
    print(f"Explanation: {result.explanation}")
    
    # Should be LOW (clean content + trusted sender)
    assert result.risk_level == "Low", f"Expected Low risk, got {result.risk_level}"
    assert result.confidence_score < 0.3, f"Expected very low score, got {result.confidence_score}"
    assert "trusted" in result.explanation.lower(), "Should mention trusted domain"
    print("✓ PASS: Clean email from trusted domain is LOW risk\n")


def test_response_fields():
    """Test: Response includes all required fields"""
    print("=== TEST 8: Response Fields ===")
    detector = PhishingDetector()
    
    result = detector.analyze(
        sender="test@example.com",
        subject="Test",
        body="Test body with some content"
    )
    
    # Check all fields exist
    assert hasattr(result, 'risk_level'), "Missing risk_level"
    assert hasattr(result, 'confidence_score'), "Missing confidence_score"
    assert hasattr(result, 'reasons'), "Missing reasons"
    assert hasattr(result, 'explanations'), "Missing explanations"
    assert hasattr(result, 'suspicious_links'), "Missing suspicious_links"
    assert hasattr(result, 'explanation'), "Missing explanation"
    
    # Check field types
    assert isinstance(result.risk_level, str), "risk_level should be string"
    assert isinstance(result.confidence_score, float), "confidence_score should be float"
    assert isinstance(result.reasons, list), "reasons should be list"
    assert isinstance(result.explanations, list), "explanations should be list"
    assert isinstance(result.suspicious_links, list), "suspicious_links should be list"
    assert isinstance(result.explanation, str), "explanation should be string"
    
    print("✓ PASS: All response fields present and correct type\n")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("CampusShield Trust-Based Scoring Tests")
    print("="*60)
    
    try:
        test_trusted_domain()
        test_unknown_domain_with_urgency_verify()
        test_unsubscribe_footer()
        test_sender_link_domain_match()
        test_prize_from_unknown()
        test_natural_language_explanation()
        test_clean_email_from_trusted()
        test_response_fields()
        
        print("="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60 + "\n")
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
