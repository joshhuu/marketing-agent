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
    return f"""You are a B2B sales/marketing task classifier. Analyze the following information and classify the task into ONE category.

INPUT INFORMATION:
- Time Context: {time}
- Location: {location}
- Business Behavior: {business_behavior}
- User Intent: {user_intent}

CLASSIFICATION CATEGORIES:
1. B2B_lead_gen - Generating new leads for a product/service
2. B2B_reengagement - Re-engaging prospects who didn't respond previously
3. product_launch - Announcing a new product or feature
4. event_promotion - Promoting webinars, conferences, or events
5. partnership_outreach - Seeking partnerships or collaborations
6. thought_leadership - Building brand authority through content
7. account_expansion - Upselling/cross-selling to existing customers
8. customer_retention - Preventing churn, keeping customers engaged

INSTRUCTIONS:
1. Analyze the user intent and business behavior
2. Select the MOST appropriate category from the list above
3. Provide a confidence score (0.0 to 1.0)
4. Return ONLY valid JSON with NO explanation or additional text

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "category": "exact_category_name_from_list",
    "confidence": 0.85
}}

Return ONLY the JSON object, nothing else."""
