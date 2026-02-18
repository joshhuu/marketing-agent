"""
Prompt template for content generation
"""


def get_content_prompt(
    tone: str,
    cta_type: str,
    urgency_level: str,
    target_archetype: str,
    product_info: dict,
    prospect_sample: dict
) -> str:
    """
    Generate prompt for creating personalized outreach content
    
    Args:
        tone: Communication tone from strategy
        cta_type: Call-to-action type from strategy
        urgency_level: Urgency level from strategy
        target_archetype: Target archetype from ICP matcher
        product_info: Product information from database
        prospect_sample: Sample prospect for personalization
        
    Returns:
        Formatted prompt string
    """
    return f"""You are an expert B2B copywriter. Generate personalized outreach content across multiple channels.

STRATEGY PARAMETERS:
- Tone: {tone}
- Call-to-Action: {cta_type}
- Urgency Level: {urgency_level}
- Target Archetype: {target_archetype}

PRODUCT INFORMATION:
- Name: {product_info.get('name', 'Our Solution')}
- Value Proposition: {product_info.get('value_proposition', 'N/A')}
- Key Benefits: {product_info.get('key_benefits', 'N/A')}
- Primary CTA: {product_info.get('cta_primary', 'Learn More')}
- Secondary CTA: {product_info.get('cta_secondary', 'Contact Us')}

SAMPLE PROSPECT (for personalization context):
- Name: {prospect_sample.get('name', 'Prospect')}
- Job Title: {prospect_sample.get('job_title', 'Decision Maker')}
- Company: {prospect_sample.get('company_name', 'Company')}
- Pain Points: {prospect_sample.get('pain_points', 'Common industry challenges')}

CONTENT REQUIREMENTS:

1. LINKEDIN MESSAGE (150-200 words):
   - Start with personalized hook related to their role/company
   - Clearly state value proposition
   - Include ONE specific benefit relevant to their pain point
   - End with clear call-to-action
   - Professional but {tone} tone
   - Use line breaks for readability

2. EMAIL (Subject + Body):
   - Subject line: 40-60 characters, compelling and relevant
   - Body: 200-250 words maximum
   - Structure: Hook → Value Prop → Social Proof/Benefit → CTA
   - Include prospect's name and company for personalization
   - {tone} tone throughout
   - Clear CTA button text

3. CALL SCRIPT:
   - Opener: 2-3 sentences to build rapport and state purpose
   - Objections: List 3 common objections with responses
   - Close: 2-3 sentences with clear next step
   - {tone} language, conversational flow

INSTRUCTIONS:
1. Personalize content using prospect details (name, company, pain points)
2. Match the specified tone: {tone}
3. Incorporate urgency level: {urgency_level}
4. Make CTA align with: {cta_type}
5. Keep messaging benefit-focused, not feature-focused
6. Return ONLY valid JSON with NO additional commentary

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "linkedin_message": "Full LinkedIn message text here...",
    "email_message": {{
        "subject": "Email subject line",
        "body": "Full email body text here..."
    }},
    "call_script": {{
        "opener": "Opening lines for the call...",
        "objections": ["Objection 1 response", "Objection 2 response", "Objection 3 response"],
        "close": "Closing statement with clear next steps..."
    }}
}}

Return ONLY the JSON object, nothing else."""
