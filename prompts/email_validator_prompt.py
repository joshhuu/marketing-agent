"""
Email Validator Prompt
Used to validate email content for spam triggers and professionalism
"""

def get_email_validator_prompt(email_subject: str, email_body: str) -> str:
    """
    Generate prompt for validating email content
    
    Args:
        email_subject: Email subject line
        email_body: Email body content
        
    Returns:
        Formatted prompt for validation
    """
    return f"""You are an expert email deliverability and professionalism consultant. Your task is to analyze the following email and determine:

1. **SPAM RISK**: Check for common spam triggers that could cause the email to land in spam folders
2. **PROFESSIONALISM**: Assess if the email maintains professional standards

EMAIL TO ANALYZE:
───────────────────
SUBJECT: {email_subject}

BODY:
{email_body}
───────────────────

SPAM FACTORS TO CHECK:
- Excessive capitalization or exclamation marks
- Spam trigger words (FREE, URGENT, ACT NOW, LIMITED TIME, etc.)
- Suspicious links or too many links
- Poor formatting or excessive emojis
- Misleading subject lines
- Overly salesy or pushy language
- All caps subject or content
- Too many dollar signs or money mentions

PROFESSIONALISM FACTORS TO CHECK:
- Appropriate tone for business communication
- Clear and concise messaging
- Proper grammar and spelling
- Respectful and courteous language
- No aggressive or manipulative tactics
- Appropriate use of personalization
- Professional email structure (greeting, body, signature)
- Value-focused messaging vs. self-serving pitches

OUTPUT REQUIREMENTS:
Return ONLY a valid JSON object with this exact structure:

{{
    "is_spam_free": true or false,
    "is_professional": true or false,
    "spam_score": 0-100 (0 is perfect, 100 is definitely spam),
    "professionalism_score": 0-100 (0 is unprofessional, 100 is perfectly professional),
    "spam_issues": ["issue1", "issue2"] or [] if none,
    "professionalism_issues": ["issue1", "issue2"] or [] if none,
    "recommendations": ["suggestion1", "suggestion2"] or [] if perfect,
    "overall_verdict": "PASS" or "FAIL",
    "summary": "brief explanation of the overall assessment"
}}

VERDICT CRITERIA:
- PASS: is_spam_free=true AND is_professional=true AND spam_score < 50 AND professionalism_score > 60
- FAIL: Any of the above conditions not met

Be fair and balanced in your assessment. Modern B2B sales emails are expected to be persuasive while remaining professional. The goal is to ensure deliverable emails that respect recipients while being effective."""
