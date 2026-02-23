"""
Prompt template for task classification
"""


def get_classifier_prompt(time: str, location: str, business_behavior: str, user_intent: str) -> str:
    """
    Generate prompt for classifying user's task

    Args:
        time: Time context from input parser
        location: Location from input parser
        business_behavior: Business behavior from input parser
        user_intent: User intent from input parser

    Returns:
        Formatted prompt string
    """
    return f"""You are a B2B sales/marketing task classifier with deep contextual intelligence. Analyze ALL four input signals and classify the task into ONE category.

INPUT SIGNALS:
- Time Context: {time}
- Location/Market: {location}
- Business Behavior: {business_behavior}
- User Intent: {user_intent}

CLASSIFICATION CATEGORIES:
1. B2B_lead_gen         - Generating new leads for a product/service
2. B2B_reengagement     - Re-engaging prospects who didn't respond previously
3. product_launch       - Announcing a new product or feature
4. event_promotion      - Promoting webinars, conferences, or events
5. partnership_outreach - Seeking partnerships or collaborations
6. thought_leadership   - Building brand authority through content
7. account_expansion    - Upselling/cross-selling to existing customers
8. customer_retention   - Preventing churn, keeping customers engaged

CONTEXTUAL INTELLIGENCE RULES:
- Time signals: "end of quarter" / "Q4" → urgency is HIGH (B2B_lead_gen or account_expansion likely)
- "Monday/Tuesday morning" → optimal send window, email channel preferred
- "Friday afternoon" → low engagement expected; deprioritize cold outreach
- "event next week" / "conference" → event_promotion likely
- Location: "APAC" / "US East" / "UK" → tailor urgency and formality expectations
- "re-engage" / "follow up" / "cold prospects" → B2B_reengagement
- "new feature" / "launch" / "release" → product_launch
- "upsell" / "expand" / "existing customers" → account_expansion

INSTRUCTIONS:
1. Analyze ALL four signals together holistically
2. Select the MOST appropriate category
3. Provide a confidence score (0.0 to 1.0)
4. Write a context_reasoning field (1-2 sentences) explaining how time/location signals shaped this classification
5. Return ONLY valid JSON — no markdown, no explanation, no extra text

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "category": "exact_category_name_from_list",
    "confidence": 0.85,
    "context_reasoning": "The Q4 quarter-end time context and APAC location suggest moderate urgency with a preference for email outreach; the user intent clearly maps to generating new B2B leads for a SaaS product."
}}

Return ONLY the JSON object, nothing else."""
