#!/usr/bin/env python3
"""Quick validation of AI decision layer"""
import sys
sys.path.append('backend')

from detector import PhishingDetector
from llm_decision import ai_decision_with_fallback

detector = PhishingDetector()
signals = detector.extract_signals('test@gmail.com', 'Test', 'Body', ['https://test.com'])
result = ai_decision_with_fallback(signals, None)

print('✓ AI Decision Layer Working!')
print(f'  Classification: {result["classification"]}')
print(f'  Risk level: {result["risk_level"]}')
print(f'  Confidence: {result["confidence_score"]*100:.0f}%')
print(f'  AI used: {result["ai_used"]}')
