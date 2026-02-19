"""
Improved prompt template for content generation
Adds industry context, anti-formula instructions, and benefit specificity
"""


def get_content_prompt(
    tone: str,
    cta_type: str,
    urgency_level: str,
    target_archetype: str,
    product_info: dict,
    prospect_sample: dict,
    sender_name: str = "Joshua"
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
        sender_name: Name of the person sending the outreach (defaults to "Joshua")
        
    Returns:
        Formatted prompt string
    """
    
    # Extract additional context
    industry = prospect_sample.get('industry', 'their industry')
    department = prospect_sample.get('department', 'their department')
    seniority = prospect_sample.get('seniority_level', 'professional')
    company_size = prospect_sample.get('company_size', 'mid-market')
    
    return f"""You are an expert B2B copywriter creating UNIQUE, personalized outreach content. Each message must feel custom-written, not template-generated.

STRATEGY PARAMETERS:
- Tone: {tone}
- Call-to-Action: {cta_type}
- Urgency Level: {urgency_level}
- Target Archetype: {target_archetype}

SENDER INFORMATION:
- Your Name: {sender_name}
- Representing: {product_info.get('name', 'Our Solution')}

PRODUCT INFORMATION:
- Name: {product_info.get('name', 'Our Solution')}
- Value Proposition: {product_info.get('value_proposition', 'N/A')}
- Key Benefits (use these SPECIFIC benefits, not generic claims): {product_info.get('key_benefits', 'N/A')}
- Primary CTA: {product_info.get('cta_primary', 'Learn More')}
- Secondary CTA: {product_info.get('cta_secondary', 'Contact Us')}
- Pricing Model: {product_info.get('pricing_tier', 'flexible')}

PROSPECT CONTEXT (personalize heavily):
- Name: {prospect_sample.get('name', 'Prospect')}
- Job Title: {prospect_sample.get('job_title', 'Decision Maker')}
- Seniority: {seniority}
- Department: {department}
- Company: {prospect_sample.get('company_name', 'Company')}
- Industry: {industry}
- Company Size: {company_size}
- Pain Points: {prospect_sample.get('pain_points', 'Common challenges')}

CRITICAL INSTRUCTIONS - READ CAREFULLY:

🚫 AVOID THESE CLICHÉS (do not use ANY of these phrases):
- "AI-driven insights"
- "X% more deals/revenue/efficiency" (unless it's in the actual product benefits)
- "Process inefficiencies" or "operational bottlenecks"
- "Supply chain disruptions"
- "Dynamic market conditions"
- "Leverage" or "unlock" as verbs
- "Game-changer" or "transform your business"
- Generic executive guides or whitepapers (be specific to their situation)

✅ INSTEAD, USE:
- SPECIFIC benefits from the Key Benefits list above
- Industry-specific language for {industry}
- Department-specific challenges for {department} teams
- Concrete examples relevant to {seniority} level professionals
- Company size-appropriate messaging for {company_size} companies
- Actual pain points mentioned: {prospect_sample.get('pain_points', '')}

CONTENT REQUIREMENTS:

1. LINKEDIN MESSAGE (150-200 words):
   - Hook: Reference something specific about their {industry}/{department} role, NOT generic business challenges
   - Value: State how {product_info.get('name')} helps {department} teams in {industry}, using ONE specific benefit from the list
   - Social proof: If urgency is high, mention time-sensitivity; if medium/low, share a relevant insight
   - CTA: Direct and aligned with {cta_type}
   - Tone: {tone} but authentic, not salesy
   - Vary structure: Don't always start with "Hi [name], I noticed..."

2. EMAIL (Subject + Body):
   - Subject: 40-60 chars, specific to their {department}/{industry}, avoid clickbait
   - Body: 200-250 words max
   - Opening: Connect to their specific role/company/industry context
   - Middle: Use 1-2 SPECIFIC benefits from the Key Benefits, explain HOW it helps
   - Social proof: If relevant, mention {company_size} companies or {industry} context
   - CTA: Clear action, use {product_info.get('cta_primary')}
   - Tone: {tone}, professional for {seniority} level

3. CALL SCRIPT:
   - Opener: 2-3 sentences, introduce yourself and explain why you're calling (be direct, relevant to {department})
   - Objections: 3 realistic objections for {seniority} {department} professionals with thoughtful responses
     * If they say "we're already using [competitor]"
     * If they say "not a priority right now"
     * If they say "send me information"
   - Close: Clear next step based on {cta_type}, respectful of {seniority} level
   - Language: {tone}, conversational but professional

PERSONALIZATION CHECKLIST (must include):
✓ Use {prospect_sample.get('name', 'their name')} naturally (not in every sentence)
✓ Reference {prospect_sample.get('company_name', 'their company')} specifically
✓ Connect to {industry} industry context
✓ Address {department} department challenges
✓ Match tone to {seniority} level (C-suite = concise, managers = detail-oriented)
✓ Use ACTUAL benefits from Key Benefits list, not invented claims

VARIATION STRATEGIES (pick ONE per channel to avoid repetition):
- LinkedIn: Start with an industry insight, a company observation, or a role-specific question
- Email: Lead with a pain point, a benefit, or a relevant trend in {industry}
- Call: Open with rapport (company observation) OR direct (here's why I'm calling)

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "linkedin_message": "Your unique LinkedIn message here - NO formulaic structure",
    "email_message": {{
        "subject": "Specific subject related to {department}/{industry}",
        "body": "Personalized email body using ACTUAL product benefits"
    }},
    "call_script": {{
        "opener": "Direct, relevant opener for {seniority} {department} professional",
        "objections": [
            "Response to 'we're already using X'",
            "Response to 'not a priority'",
            "Response to 'just send info'"
        ],
        "close": "Clear next step based on {cta_type}"
    }}
}}

FINAL REMINDER: Make this feel like it was written BY a {department} expert FOR a {department} expert. Use the SPECIFIC benefits provided. Avoid generic B2B templates. Return ONLY valid JSON."""