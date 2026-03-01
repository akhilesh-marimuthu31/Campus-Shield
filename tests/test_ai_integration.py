#!/usr/bin/env python3
"""
Test script for AI decision layer integration.
Demonstrates signal extraction and AI decision flow.
"""

import json
import sys
sys.path.append('backend')

from detector import PhishingDetector
from llm_decision import extract_json_from_response, validate_ai_response

def test_signal_extraction():
    """Test signal extraction from emails"""
    print("\n=== TEST 1: Signal Extraction ===\n")
    
    detector = PhishingDetector()
    
    # Test 1a: Legitimate hackathon email
    print("1a. Legitimate hackathon email:")
    signals = detector.extract_signals(
        sender="organizer@hackathon.edu",
        subject="Internship Hackathon - Register Now!",
        body="Join our internship hackathon on GitHub. Create your profile and verify your email.",
        links=["https://hackathon.edu/register", "https://github.com/org/hackathon"]
    )
    
    print(json.dumps(signals, indent=2))
    assert signals['sender_domain'] == 'hackathon.edu', "Sender domain extraction failed"
    assert 'hackathon.edu' in signals['link_domains'], "Link domain extraction failed"
    print("✓ PASS: Signal extraction works for legitimate email\n")
    
    # Test 1b: Phishing email
    print("1b. Phishing email:")
    signals = detector.extract_signals(
        sender="verification@paypal-secure.com",
        subject="URGENT: Verify Your PayPal Account NOW",
        body="Your account will be suspended immediately. Click here to verify your password right now!",
        links=["http://paypal-verify.xyz/verify"]
    )
    
    print(json.dumps(signals, indent=2))
    assert signals['urgency_detected'] == True, "Urgency detection failed"
    assert signals['verification_request'] == True, "Verification detection failed"
    assert signals['domain_mismatch'] == True, "Domain mismatch detection failed"
    print("✓ PASS: Signal extraction detects phishing indicators\n")
    
    # Test 1c: Newsletter with unsubscribe
    print("1c. Newsletter with unsubscribe:")
    signals = detector.extract_signals(
        sender="news@example.com",
        subject="Weekly Tech News",
        body="Check out our latest articles. © 2026 TechNews. To unsubscribe: https://example.com/unsub",
        links=["https://example.com/articles", "https://example.com/unsub"]
    )
    
    print(json.dumps(signals, indent=2))
    assert signals['unsubscribe_present'] == True, "Unsubscribe detection failed"
    assert signals['urgency_detected'] == False, "False urgency positive"
    print("✓ PASS: Signal extraction detects legitimate indicators\n")


def test_json_extraction():
    """Test JSON extraction from LLM-like responses"""
    print("=== TEST 2: JSON Extraction from Response ===\n")
    
    # Test 2a: Direct JSON
    print("2a. Direct JSON response:")
    response = '{"classification": "Legitimate", "risk_level": "Low", "confidence": 5, "explanation": "This is safe"}'
    result = extract_json_from_response(response)
    assert result is not None, "Failed to extract direct JSON"
    assert result['classification'] == 'Legitimate', "Extraction failed"
    print("✓ PASS: Extracts direct JSON\n")
    
    # Test 2b: JSON in markdown code block
    print("2b. JSON in markdown code block:")
    response = '''```json
{
  "classification": "Phishing",
  "risk_level": "High",
  "confidence": 95,
  "explanation": "This is clearly phishing"
}
```'''
    result = extract_json_from_response(response)
    assert result is not None, "Failed to extract JSON from markdown"
    assert result['classification'] == 'Phishing', "Extraction failed"
    print("✓ PASS: Extracts JSON from markdown\n")
    
    # Test 2c: JSON with explanation text
    print("2c. JSON with surrounding text:")
    response = "Let me analyze this email. Based on the signals, here's my assessment:\n\n" + \
               '{"classification": "Suspicious", "risk_level": "Medium", "confidence": 42, "explanation": "Unknown sender"}' + \
               "\n\nBe cautious with this email."
    result = extract_json_from_response(response)
    assert result is not None, "Failed to extract JSON with text"
    assert result['confidence'] == 42, "Extraction failed"
    print("✓ PASS: Extracts JSON from text\n")


def test_ai_response_validation():
    """Test AI response validation"""
    print("=== TEST 3: AI Response Validation ===\n")
    
    # Test 3a: Valid response
    print("3a. Valid AI response:")
    valid = {
        'classification': 'Legitimate',
        'risk_level': 'Low',
        'confidence': 5,
        'explanation': 'This email appears safe'
    }
    assert validate_ai_response(valid) == True, "Valid response failed validation"
    print("✓ PASS: Accepts valid response\n")
    
    # Test 3b: Invalid classification
    print("3b. Invalid classification:")
    invalid = {
        'classification': 'Safe',  # Not in allowed values
        'risk_level': 'Low',
        'confidence': 5,
        'explanation': 'This email appears safe'
    }
    assert validate_ai_response(invalid) == False, "Should reject invalid classification"
    print("✓ PASS: Rejects invalid classification\n")
    
    # Test 3c: Confidence out of range
    print("3c. Confidence out of range:")
    invalid = {
        'classification': 'Legitimate',
        'risk_level': 'Low',
        'confidence': 150,  # Out of 0-100 range
        'explanation': 'This email appears safe'
    }
    assert validate_ai_response(invalid) == False, "Should reject confidence > 100"
    print("✓ PASS: Rejects invalid confidence\n")
    
    # Test 3d: Missing explanation
    print("3d. Missing explanation:")
    invalid = {
        'classification': 'Legitimate',
        'risk_level': 'Low',
        'confidence': 5,
        # Missing 'explanation'
    }
    assert validate_ai_response(invalid) == False, "Should reject missing fields"
    print("✓ PASS: Rejects missing fields\n")


def test_signal_content():
    """Test signal structure and content"""
    print("=== TEST 4: Signal Content Validation ===\n")
    
    detector = PhishingDetector()
    
    signals = detector.extract_signals(
        sender="admin@company.com",
        subject="Please change your password",
        body="For security, please change your password. Click here.",
        links=["https://company.com/security"]
    )
    
    # Validate signals structure
    required_fields = [
        'sender_domain', 'link_domains', 'urgency_detected',
        'verification_request', 'reward_language', 'suspension_threat',
        'domain_mismatch', 'unsubscribe_present', 'known_sender',
        'sender_link_match', 'email_context'
    ]
    
    for field in required_fields:
        assert field in signals, f"Missing signal field: {field}"
    
    print("Signal fields present:")
    for field in required_fields:
        print(f"  ✓ {field}: {signals[field]}")
    
    print("\n✓ PASS: All signal fields present and valid\n")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("AI Decision Layer - Integration Tests")
    print("="*60)
    
    try:
        test_signal_extraction()
        test_json_extraction()
        test_ai_response_validation()
        test_signal_content()
        
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
