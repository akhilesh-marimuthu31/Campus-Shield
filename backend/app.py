"""
CampusShield Backend - Privacy-first phishing detection API.
Flask-based REST API with rule-based detection and structured responses.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from typing import Dict, Any, Tuple

from detector import PhishingDetector, PIIMasker
from llm_decision import ai_decision_with_fallback


def create_app() -> Flask:
    """Factory function to create and configure Flask app."""
    app = Flask(__name__)
    CORS(app)
    
    # Initialize detector
    detector = PhishingDetector()
    
    # ============================================================================
    # INPUT VALIDATION & SANITIZATION
    # ============================================================================
    
    def validate_email_input(data: Dict) -> Tuple[bool, Dict]:
        """
        Validate and sanitize email input.
        Accepts partial payloads - returns what's available.
        Returns: (has_data, sanitized_data)
        """
        sender = data.get('sender', '').strip() if data.get('sender') else ''
        subject = data.get('subject', '').strip() if data.get('subject') else ''
        body = data.get('body', '').strip() if data.get('body') else ''
        
        # Enforce field length limits to prevent DoS
        if len(sender) > 255:
            sender = sender[:255]
        if len(subject) > 1000:
            subject = subject[:1000]
        if len(body) > 50000:
            body = body[:50000]
        
        # Extract links array if provided (optional field)
        links = data.get('links', [])
        if not isinstance(links, list):
            links = []
        
        # Consider data present if any field is non-empty
        has_data = bool(sender or subject or body)
        
        return has_data, {
            'sender': sender,
            'subject': subject,
            'body': body,
            'links': links,
        }
    
    # ============================================================================
    # ROUTES
    # ============================================================================
    
    @app.route('/scan', methods=['POST'])
    def scan_email():
        """
        Scan an email for phishing indicators.
        
        Request JSON (all fields optional):
        {
            "sender": "user@example.com",
            "subject": "Verify your account",
            "body": "Click here to verify...",
            "links": ["http://example.com"]
        }
        
        Response JSON:
        {
            "risk_level": "High|Medium|Low|Unknown",
            "confidence_score": 0.0-1.0,
            "reasons": ["verify_account", "click_link_urgency"],
            "explanations": [
                "Email requests verification of account credentials.",
                "Email urges clicking a link or button."
            ],
            "suspicious_links": ["http://bit.ly/x"],
            "status": "success"
        }
        
        NOTE: Never returns 400/error status. Accepts partial payloads.
        """
        try:
            data = request.get_json()
            
            if not data:
                # Empty payload - return default response
                return jsonify({
                    'risk_level': 'Unknown',
                    'confidence_score': 0.0,
                    'reasons': [],
                    'explanations': ['Insufficient data to analyze'],
                    'suspicious_links': [],
                    'explanation': 'No email data provided for analysis.',
                    'status': 'success',
                }), 200
            
            # Validate and sanitize input (accepts partial payloads)
            has_data, sanitized = validate_email_input(data)
            
            if not has_data:
                # No email fields provided - return default response
                return jsonify({
                    'risk_level': 'Unknown',
                    'confidence_score': 0.0,
                    'reasons': [],
                    'explanations': ['Insufficient data to analyze'],
                    'suspicious_links': [],
                    'explanation': 'No email data provided for analysis.',
                    'status': 'success',
                }), 200
            
            # Perform detection on whatever data we have (rule-based)
            rule_result = detector.analyze(
                sender=sanitized['sender'],
                subject=sanitized['subject'],
                body=sanitized['body'],
                links=sanitized.get('links', []),
            )
            
            # Extract signals for AI decision
            signals = detector.extract_signals(
                sender=sanitized['sender'],
                subject=sanitized['subject'],
                body=sanitized['body'],
                links=sanitized.get('links', []),
            )
            
            # Try AI decision (falls back to rule-based if LLM unavailable)
            ai_decision = ai_decision_with_fallback(
                signals,
                {
                    'risk_level': rule_result.risk_level,
                    'confidence_score': rule_result.confidence_score,
                }
            )
            
            # Return AI classification + rule-based details
            return jsonify({
                'risk_level': ai_decision['risk_level'],
                'confidence_score': ai_decision['confidence_score'],
                'reasons': rule_result.reasons,
                'explanations': rule_result.explanations,
                'suspicious_links': rule_result.suspicious_links,
                'explanation': ai_decision['explanation'],
                'classification': ai_decision['classification'],
                'ai_used': ai_decision.get('ai_used', False),
                'status': 'success',
            }), 200
        
        except Exception as e:
            # Don't leak internal error details
            # Return graceful default response instead of 500 error
            return jsonify({
                'risk_level': 'Unknown',
                'confidence_score': 0.0,
                'reasons': [],
                'explanations': ['Unable to analyze at this time'],
                'suspicious_links': [],
                'explanation': 'An error occurred during analysis.',
                'status': 'success',
            }), 200
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint."""
        return jsonify({
            'status': 'healthy',
            'service': 'Campus-Shield-Backend',
        }), 200
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors."""
        return jsonify({
            'error': 'Endpoint not found',
            'status': 'error',
        }), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        """Handle 405 errors."""
        return jsonify({
            'error': 'Method not allowed',
            'status': 'error',
        }), 405
    
    return app


# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    app = create_app()
    # Development server - use production WSGI server (gunicorn) in production
    app.run(host='127.0.0.1', port=5000, debug=False)
