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
    return f"""You are a B2B marketing strategist. Based on the task category, determine the optimal communication strategy.

TASK CATEGORY: {category}

Your task is to determine:
1. TONE - The communication style that will resonate best
2. CTA_TYPE - The type of call-to-action that drives conversion
3. URGENCY_LEVEL - How time-sensitive the message should feel

TONE OPTIONS:
- formal: Professional and corporate (for C-suite, legal, finance)
- persuasive: Benefits-focused and compelling (for sales-driven industries)
- conversational: Friendly and approachable (for creative, startup cultures)
- educational: Informative and value-driven (for thought leadership)

CTA_TYPE OPTIONS:
- book_demo: Schedule a product demonstration
- start_trial: Begin free trial or pilot program
- download_resource: Get whitepaper, case study, or guide
- join_event: Register for webinar or event
- schedule_call: Book a consultation call
- reply_to_discuss: Simple reply to start conversation

URGENCY_LEVEL OPTIONS:
- high: Time-sensitive offers, limited availability, urgent problem-solving
- medium: Opportunity-focused, steady interest building
- low: Educational, relationship-building, long-term nurture

INSTRUCTIONS:
1. Consider what stage of the buyer journey this category typically represents
2. Match tone to the formality expected in that context
3. Choose CTA based on what action best serves this category
4. Set urgency based on typical decision timeframes
5. Return ONLY valid JSON with NO explanation

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "tone": "selected_tone",
    "cta_type": "selected_cta",
    "urgency_level": "selected_urgency"
}}

Return ONLY the JSON object, nothing else."""
