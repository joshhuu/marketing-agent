"""
Prompt template for strategy generation
"""


def get_strategy_prompt(category: str) -> str:
    """
    Generate prompt for creating outreach strategy
    
    Args:
        category: Task category from classifier
        
    Returns:
        Formatted prompt string
    """
    return f"""You are a B2B SaaS sales strategist. Based on the task category, determine the optimal communication strategy for selling software products and services.

TASK CATEGORY: {category}

Your task is to determine:
1. TONE - The communication style that will resonate best
2. CTA_TYPE - The type of call-to-action that drives conversion
3. URGENCY_LEVEL - How time-sensitive the message should feel

TONE OPTIONS:
- formal: Professional and corporate (for C-suite, legal, finance, compliance-focused)
- persuasive: ROI-focused and compelling (for budget holders, sales-driven industries)
- conversational: Friendly and approachable (for creative, startup cultures, tech teams)
- solution_focused: Problem-solving and value-driven (for technical evaluators, operational roles)

CTA_TYPE OPTIONS:
- book_demo: Schedule a personalized product demonstration (best for complex SaaS)
- start_trial: Begin free trial or pilot program (best for self-serve products)
- schedule_call: Book a consultation call to discuss needs (best for high-touch sales)
- join_event: Register for webinar, workshop, or product launch (best for education + lead gen)
- reply_to_discuss: Simple reply to start conversation (best for cold outreach, relationship building)

URGENCY_LEVEL OPTIONS:
- high: Time-sensitive offers, limited availability, urgent problem-solving, security threats
- medium: Opportunity-focused, competitive advantage, steady interest building
- low: Relationship-building, long-term value, educational nurture

INSTRUCTIONS:
1. Consider what stage of the buyer journey this category typically represents
2. Match tone to the formality and decision-making style expected
3. Choose CTA based on what action best drives pipeline for SaaS sales
4. Set urgency based on typical sales cycles and pain intensity
5. Focus on SELLING products/services, NOT giving away free resources
6. Return ONLY valid JSON with NO explanation

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "tone": "selected_tone",
    "cta_type": "selected_cta",
    "urgency_level": "selected_urgency"
}}

Return ONLY the JSON object, nothing else."""
