"""
backend/llm_decision.py

LLM-based decision layer for phishing classification.
Receives structured signals from rule-based detector.
Uses LLM to make final classification decision.
"""

import json
import os
import sys
from typing import Dict, Optional
import requests


def get_llm_endpoint() -> Optional[str]:
    """
    Detect available LLM endpoint.
    Priority: Ollama (local) > OpenAI API > None
    """
    # Check for Ollama locally
    ollama_endpoint = os.getenv('OLLAMA_ENDPOINT', 'http://localhost:11434/api/generate')
    try:
        # Quick check if Ollama is running
        response = requests.head(ollama_endpoint.replace('/api/generate', '/api/tags'), timeout=2)
        if response.status_code == 200:
            return ollama_endpoint
    except (requests.RequestException, Exception):
        pass
    
    # Check for OpenAI API key
    openai_key = os.getenv('OPENAI_API_KEY')
    if openai_key:
        return 'openai'
    
    return None


def call_ollama(prompt: str, system_prompt: str) -> Optional[str]:
    """
    Call Ollama LLM (default: llama2, but llama3/mistral if available)
    """
    try:
        endpoint = os.getenv('OLLAMA_ENDPOINT', 'http://localhost:11434/api/generate')
        
        payload = {
            'model': 'llama2',  # or mistral, neural-chat
            'prompt': f"{system_prompt}\n\n{prompt}",
            'stream': False,
            'temperature': 0.3,  # Low temperature for consistency
            'num_predict': 500,  # Limit response length
        }
        
        response = requests.post(endpoint, json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            return result.get('response', '').strip()
    except Exception as e:
        print(f"[LLM] Ollama call failed: {e}", file=sys.stderr)
    
    return None


def call_openai(prompt: str, system_prompt: str) -> Optional[str]:
    """
    Call OpenAI API (or compatible endpoint)
    """
    try:
        import openai
    except ImportError:
        print("[LLM] openai package not installed", file=sys.stderr)
        return None
    
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return None
        
        openai.api_key = api_key
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300,
        )
        
        return response['choices'][0]['message']['content'].strip()
    
    except Exception as e:
        print(f"[LLM] OpenAI call failed: {e}", file=sys.stderr)
    
    return None


def call_llm(prompt: str, system_prompt: str) -> Optional[str]:
    """
    Route to appropriate LLM backend.
    """
    endpoint = get_llm_endpoint()
    
    if endpoint == 'openai':
        return call_openai(prompt, system_prompt)
    elif endpoint and 'localhost:11434' in endpoint:
        return call_ollama(prompt, system_prompt)
    else:
        print("[LLM] No LLM endpoint available", file=sys.stderr)
        return None


def extract_json_from_response(response: str) -> Optional[Dict]:
    """
    Extract JSON from LLM response (may contain markdown code blocks)
    """
    if not response:
        return None
    
    # Try direct JSON parse
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass
    
    # Try extracting from markdown code block
    if '```json' in response:
        try:
            json_str = response.split('```json')[1].split('```')[0].strip()
            return json.loads(json_str)
        except (IndexError, json.JSONDecodeError):
            pass
    
    # Try extracting from any code block
    if '```' in response:
        try:
            json_str = response.split('```')[1].strip()
            if json_str.startswith('json'):
                json_str = json_str[4:].strip()
            return json.loads(json_str)
        except (IndexError, json.JSONDecodeError):
            pass
    
    # Last resort: try to find JSON object in response
    try:
        start = response.find('{')
        end = response.rfind('}') + 1
        if start >= 0 and end > start:
            json_str = response[start:end]
            return json.loads(json_str)
    except json.JSONDecodeError:
        pass
    
    return None


def validate_ai_response(result: Dict) -> bool:
    """
    Validate AI response has required fields
    """
    required = {'classification', 'risk_level', 'confidence', 'explanation'}
    if not all(k in result for k in required):
        return False
    
    # Validate values
    if result['classification'] not in ['Legitimate', 'Suspicious', 'Phishing']:
        return False
    if result['risk_level'] not in ['Low', 'Medium', 'High']:
        return False
    if not isinstance(result['confidence'], (int, float)) or not 0 <= result['confidence'] <= 100:
        return False
    if not isinstance(result['explanation'], str) or len(result['explanation']) < 10:
        return False
    
    return True


def ai_decision_core(signals: Dict) -> Optional[Dict]:
    """
    Use LLM to classify email based on structured signals.
    
    Args:
        signals: Dict with fields like sender_domain, urgency_detected, etc.
    
    Returns:
        {
            "classification": "Legitimate|Suspicious|Phishing",
            "risk_level": "Low|Medium|High",
            "confidence": 0-100,
            "explanation": "Human-readable explanation"
        }
        or None if LLM unavailable
    """
    
    system_prompt = """You are CampusShield AI, an email security intelligence engine designed to protect students from phishing attacks.

YOUR CORE OBJECTIVES:
- Classify emails ACCURATELY with LOW false positives
- DO NOT flag emails from reputed/verified organizations unless there is STRONG evidence of phishing
- PRIORITIZE domain reputation and sender authenticity over urgency language
- Assume that hackathons, universities, tech companies, and platforms send legitimate urgent emails

CRITICAL RULES:
1. Only flag HIGH RISK if 2+ independent risk factors exist
2. Urgency alone is NOT phishing
3. Output must be valid JSON with: classification, risk_level, confidence (0-100), explanation

═══════════════════════════════════════════════════════════════

✅ TRUSTED/SAFE SIGNALS (STRONGLY REDUCE RISK - make risk LOW if present):
• Sender domain: google.com, gmail.com, microsoft.com, amazon.com, hack2skill.com, unstop.com, hackerearth.com, .edu domains, .ac.in domains, known company domains
• Email type: Event reminders, deadline notifications, hackathon updates, application confirmations, official newsletters
• Links to: Known platforms, HTTPS secured domains, consistent branding with sender

🚨 HIGH-RISK SIGNALS (FLAG HIGH ONLY if 2+ are true):
• Sender domain is newly registered or suspicious
• Domain visually impersonates known brand (e.g., goog1e.com, amaz0n.com)
• Requests credentials, OTP, passwords, or bank details
• URL shorteners hiding destination
• Mismatch between sender name and domain
• Grammar errors + urgency + unknown sender
• Porn/random domain sending career offers

🟡 MEDIUM-RISK SIGNALS (Warning if present with legitimate sender):
• Legitimate-looking email but contains external links
• High urgency language from unknown/new sender
• Limited sender history
• No direct credential request
• Minor inconsistencies

🟢 LOW-RISK DEFAULT:
• Official sender domain
• Branded content consistent with sender
• No credential request
• Trusted domain or known organization

═══════════════════════════════════════════════════════════════

CLASSIFICATION LOGIC:
- LOW: Trusted domain OR multiple safe signals present → confidence 85-99
- MEDIUM: Legitimate-looking but external links/urgency OR 1 minor risk signal → confidence 40-70
- HIGH: 2+ high-risk signals AND not from trusted domain → confidence 70-95

Output strictly as JSON:
{
  "classification": "Legitimate|Suspicious|Phishing",
  "risk_level": "Low|Medium|High",
  "confidence": <0-100>,
  "explanation": "<factual 1-2 sentence explanation of key decision factors>"
}"""
    
    user_prompt = f"""Analyze this email for phishing risk based on these signals:

{json.dumps(signals, indent=2)}

Return a JSON response with classification, risk_level, confidence (0-100), and explanation."""
    
    # Call LLM
    response = call_llm(user_prompt, system_prompt)
    
    if not response:
        print("[LLM] No response from LLM backend", file=sys.stderr)
        return None
    
    # Parse response
    result = extract_json_from_response(response)
    
    if not result:
        print(f"[LLM] Failed to parse response: {response[:100]}", file=sys.stderr)
        return None
    
    # Validate response
    if not validate_ai_response(result):
        print(f"[LLM] Invalid response format: {result}", file=sys.stderr)
        return None
    
    return result


def ai_decision_with_fallback(signals: Dict, fallback_result: Dict) -> Dict:
    """
    Try to get AI decision, fall back to rule-based if needed.
    
    Args:
        signals: Structured signals from rule-based detector
        fallback_result: Dict to return if AI fails
    
    Returns:
        Dict with classification, risk_level, confidence, explanation
    """
    
    ai_result = ai_decision_core(signals)
    
    if ai_result:
        return {
            'classification': ai_result['classification'],
            'risk_level': ai_result['risk_level'],
            'confidence_score': ai_result['confidence'] / 100.0,  # Convert to 0.0-1.0
            'explanation': ai_result['explanation'],
            'ai_used': True
        }
    
    # Fallback to rule-based result
    if fallback_result is None:
        fallback_result = {}
    
    return {
        'classification': 'Suspicious',
        'risk_level': fallback_result.get('risk_level', 'Medium'),
        'confidence_score': fallback_result.get('confidence_score', 0.5),
        'explanation': 'Unable to fully verify this email. Please proceed with caution.',
        'ai_used': False
    }
