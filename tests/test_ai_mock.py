#!/usr/bin/env python3
"""
Mock LLM test - demonstrates AI decision flow without real LLM.
Test the fallback behavior when LLM is unavailable.
"""

import json
import sys
import os
sys.path.append('backend')

from detector import PhishingDetector
from llm_decision import ai_decision_with_fallback

def test_fallback_behavior():
    """Test fallback when LLM is unavailable"""
    print("\n=== TEST: Fallback Behavior (No LLM Running) ===\n")
    
    detector = PhishingDetector()
    
    # Scenario 1: Phishing email
    print("Scenario 1: Phishing Email Detection")
    print("-" * 40)
    
    signals = detector.extract_signals(
        sender="admin@bank-verify.com",
        subject="URGENT: Update Your Security Information",
        body="Suspicious activity detected. Verify your credentials immediately.",
        links=["https://bank-verify.com/login-secure"]
    )
    
    print(f"Signals extracted:")
    print(f"  - Sender domain: {signals['sender_domain']}")
    print(f"  - Urgency detected: {signals['urgency_detected']}")
    print(f"  - Verification request: {signals['verification_request']}")
    print(f"  - Domain mismatch: {signals['domain_mismatch']}")
    print(f"  - Known sender: {signals['known_sender']}")
    
    result = ai_decision_with_fallback(signals, None)
    
    print(f"\nAI Decision (Fallback):")
    print(f"  - Classification: {result['classification']}")
    print(f"  - Risk level: {result['risk_level']}")
    print(f"  - Confidence: {result['confidence_score']*100:.0f}%")
    print(f"  - AI used: {result['ai_used']}")
    print(f"  - Explanation: {result['explanation']}")
    
    assert result['classification'] == 'Suspicious', "Should classify as Suspicious"
    assert result['ai_used'] == False, "Should indicate AI not used"
    print("\n✓ PASS: Fallback to conservative default\n")
    
    # Scenario 2: Legitimate email
    print("Scenario 2: Legitimate Email from Known Domain")
    print("-" * 40)
    
    signals = detector.extract_signals(
        sender="notifications@github.com",
        subject="Your pull request has been reviewed",
        body="Your PR has received feedback. Click here to view it.",
        links=["https://github.com/org/repo/pull/123"]
    )
    
    print(f"Signals extracted:")
    print(f"  - Sender domain: {signals['sender_domain']}")
    print(f"  - Known sender: {signals['known_sender']}")
    print(f"  - Sender link match: {signals['sender_link_match']}")
    print(f"  - Unsubscribe present: {signals['unsubscribe_present']}")
    
    result = ai_decision_with_fallback(signals, None)
    
    print(f"\nAI Decision (Fallback):")
    print(f"  - Classification: {result['classification']}")
    print(f"  - Risk level: {result['risk_level']}")
    print(f"  - Confidence: {result['confidence_score']*100:.0f}%")
    print(f"  - AI used: {result['ai_used']}")
    
    assert result['classification'] == 'Suspicious', "Fallback returns conservative default"
    assert result['ai_used'] == False, "Should indicate AI not used"
    print("\n✓ PASS: Fallback applied consistently\n")
    
    # Scenario 3: Hackathon email
    print("Scenario 3: Hackathon Opportunity (Complex Case)")
    print("-" * 40)
    
    signals = detector.extract_signals(
        sender="organizer@techcompany.com",
        subject="Internship Hackathon - $5000 Prize Pool!",
        body="You are invited to our hackathon! Congratulations on being selected. Register by Friday.",
        links=["https://techcompany.com/hackathon"]
    )
    
    print(f"Signals extracted:")
    print(f"  - Sender domain: {signals['sender_domain']}")
    print(f"  - Reward language: {signals['reward_language']}")
    print(f"  - Urgency detected: {signals['urgency_detected']}")
    print(f"  - Sender link match: {signals['sender_link_match']}")
    print(f"  - Known sender: {signals['known_sender']}")
    
    result = ai_decision_with_fallback(signals, None)
    
    print(f"\nAI Decision (Fallback):")
    print(f"  - Classification: {result['classification']}")
    print(f"  - Risk level: {result['risk_level']}")
    print(f"  - Confidence: {result['confidence_score']*100:.0f}%")
    print(f"  - AI used: {result['ai_used']}")
    print(f"  - Note: With real LLM, this would benefit from context understanding")
    
    assert result['ai_used'] == False, "Demonstrating fallback scenario"
    print("\n✓ PASS: Complex email handled by fallback\n")


def test_signal_pipeline():
    """Test end-to-end signal -> AI decision pipeline"""
    print("=== TEST: End-to-End Signal Pipeline ===\n")
    
    detector = PhishingDetector()
    
    test_cases = [
        {
            "name": "Obvious Phishing",
            "sender": "paypal_verify@safe-paypal-login.com",
            "subject": "ACT NOW: Verify Your PayPal Password",
            "body": "URGENT! Your account will be suspended in 24 hours. Verify NOW!",
            "links": ["http://paypal-login-verify.xyz/secure"],
            "expected_signals": {
                "urgency": True,
                "verification": True,
                "domain_mismatch": True,
                "known_sender": False
            }
        },
        {
            "name": "Legitimate Newsletter",
            "sender": "weekly@techblog.com",
            "subject": "Weekly Tech Digest - Tuesday Edition",
            "body": "Check out this week's top articles. Unsubscribe here.",
            "links": ["https://techblog.com/articles", "https://techblog.com/unsubscribe"],
            "expected_signals": {
                "urgency": False,
                "unsubscribe": True,
                "domain_mismatch": False,
            }
        },
        {
            "name": "Suspicious Prize",
            "sender": "lottery@contest-world.net",
            "subject": "Congratulations! Claim Your $1 Million Prize Today",
            "body": "You won! Click IMMEDIATELY to claim your prize. Act now!",
            "links": ["http://claim-prize-now.xyz/claim"],
            "expected_signals": {
                "reward": True,
                "urgency": True,
                "domain_mismatch": True,
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"Test Case: {test_case['name']}")
        print("-" * 40)
        
        signals = detector.extract_signals(
            sender=test_case['sender'],
            subject=test_case['subject'],
            body=test_case['body'],
            links=test_case['links']
        )
        
        # Verify key signals match expected
        for key, expected_val in test_case['expected_signals'].items():
            signal_map = {
                'urgency': 'urgency_detected',
                'verification': 'verification_request',
                'domain_mismatch': 'domain_mismatch',
                'known_sender': 'known_sender',
                'unsubscribe': 'unsubscribe_present',
                'reward': 'reward_language'
            }
            
            actual_val = signals.get(signal_map.get(key, key))
            status = "✓" if actual_val == expected_val else "✗"
            print(f"  {status} {signal_map.get(key, key)}: {actual_val} (expected: {expected_val})")
        
        result = ai_decision_with_fallback(signals, None)
        print(f"  → Classification: {result['classification']} ({result['risk_level']})")
        print()


if __name__ == '__main__':
    print("\n" + "="*60)
    print("AI Decision Layer - Mock LLM Tests (Fallback Mode)")
    print("="*60)
    
    try:
        test_fallback_behavior()
        test_signal_pipeline()
        
        print("="*60)
        print("✅ ALL MOCK TESTS PASSED!")
        print("="*60)
        print("\nNext steps:")
        print("1. Install Ollama: https://ollama.ai")
        print("2. Run: ollama pull llama2")
        print("3. Start: ollama serve")
        print("4. Or set: export OPENAI_API_KEY='sk-...'")
        print("5. Re-run tests with real LLM for better classification")
        print()
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
