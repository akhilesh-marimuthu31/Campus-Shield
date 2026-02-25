"""
CampusShield Backend - Privacy-first phishing detection API.
Flask-based REST API with rule-based detection and structured responses.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from typing import Dict, Any, Tuple

from detector import PhishingDetector, PIIMasker


def create_app() -> Flask:
    """Factory function to create and configure Flask app."""
    app = Flask(__name__)
    CORS(app)
    
    # Initialize detector
    detector = PhishingDetector()
    
    # ============================================================================
    # INPUT VALIDATION & SANITIZATION
    # ============================================================================
    
    def validate_email_input(data: Dict) -> Tuple[bool, str, Dict]:
        """
        Validate and sanitize email input.
        Returns: (is_valid, error_message, sanitized_data)
        """
        required_fields = ['sender', 'subject', 'body']
        
        # Check required fields
        for field in required_fields:
            if field not in data:
                return False, f"Missing required field: {field}", {}
        
        sender = data.get('sender', '').strip()
        subject = data.get('subject', '').strip()
        body = data.get('body', '').strip()
        
        # Validate non-empty
        if not sender or not subject or not body:
            return False, "All fields (sender, subject, body) must be non-empty", {}
        
        # Validate field lengths (prevent DOS)
        if len(sender) > 255:
            return False, "Sender field too long (max 255 chars)", {}
        if len(subject) > 1000:
            return False, "Subject field too long (max 1000 chars)", {}
        if len(body) > 50000:
            return False, "Body field too long (max 50000 chars)", {}
        
        # Basic email format validation
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, sender):
            return False, "Invalid sender email format", {}
        
        return True, "", {
            'sender': sender,
            'subject': subject,
            'body': body,
        }
    
    # ============================================================================
    # ROUTES
    # ============================================================================
    
    @app.route('/scan', methods=['POST'])
    def scan_email():
        """
        Scan an email for phishing indicators.
        
        Request JSON:
        {
            "sender": "user@example.com",
            "subject": "Verify your account",
            "body": "Click here to verify..."
        }
        
        Response JSON:
        {
            "risk_level": "High",
            "confidence_score": 0.85,
            "reasons": ["verify_account", "click_link_urgency"],
            "explanations": [
                "Email requests verification of account credentials.",
                "Email urges clicking a link or button."
            ],
            "suspicious_links": ["http://bit.ly/x"],
            "timestamp": "2026-02-25T10:30:00Z"
        }
        """
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'error': 'Request body must be valid JSON',
                    'status': 'error',
                }), 400
            
            # Validate and sanitize input
            is_valid, error_msg, sanitized = validate_email_input(data)
            if not is_valid:
                return jsonify({
                    'error': error_msg,
                    'status': 'error',
                }), 400
            
            # Perform detection
            result = detector.analyze(
                sender=sanitized['sender'],
                subject=sanitized['subject'],
                body=sanitized['body'],
            )
            
            # Return structured response (no raw email content logged)
            return jsonify({
                'risk_level': result.risk_level,
                'confidence_score': result.confidence_score,
                'reasons': result.reasons,
                'explanations': result.explanations,
                'suspicious_links': result.suspicious_links,
                'status': 'success',
            }), 200
        
        except Exception as e:
            # Don't leak internal error details
            return jsonify({
                'error': 'An unexpected error occurred during analysis',
                'status': 'error',
            }), 500
    
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
