"""
Prompt template for ICP archetype extraction
"""


def get_icp_archetype_prompt(
    prospects: list,
    target_audience: str = None,
    industry: str = None,
    department: str = None,
    seniority: str = None
) -> str:
    """
    Generate prompt for extracting common archetype from prospects
    
    Args:
        prospects: List of prospect dictionaries
        target_audience: User's stated target audience (optional)
        industry: Extracted industry filter (optional)
        department: Extracted department filter (optional)
        seniority: Extracted seniority filter (optional)
        
    Returns:
        Formatted prompt string
    """
    # Format prospect summary
    prospect_summary = []
    for p in prospects[:10]:  # Use top 10
        prospect_summary.append(
            f"- {p.get('job_title', 'Unknown')} at {p.get('company_name', 'Unknown')} "
            f"({p.get('industry', 'Unknown')} industry, {p.get('company_size', 'Unknown')} size)"
        )
    
    prospects_text = "\n".join(prospect_summary)
    
    # Add context from user's targeting criteria
    context_parts = []
    if target_audience and target_audience.lower() != "any":
        context_parts.append(f"Target Audience: {target_audience}")
    if industry:
        context_parts.append(f"Industry Focus: {industry}")
    if department:
        context_parts.append(f"Department: {department}")
    if seniority:
        context_parts.append(f"Seniority Level: {seniority}")
    
    context_text = "\n".join(context_parts) if context_parts else "No specific targeting criteria provided"
    
    return f"""You are an ICP (Ideal Customer Profile) analyst. Based on the user's targeting criteria and the prospects selected, create a concise archetype label.

USER'S TARGETING CRITERIA:
{context_text}

TOP PROSPECTS FOUND:
{prospects_text}

Your task is to create a concise archetype label that captures:
1. The target audience's job role/seniority (use user's criteria if provided)
2. The industry or sector (prioritize user's criteria, then prospect patterns)
3. The typical company characteristics

The archetype should be a short descriptive phrase (3-7 words) that clearly identifies who you're targeting.

EXAMPLES OF GOOD ARCHETYPES:
- "CTOs at Financial Services Companies"
- "HR Directors at Mid-Market Tech Companies"
- "CFOs in Healthcare Organizations"
- "Operations Managers at Manufacturing SMBs"
- "Marketing Leaders at B2B SaaS Startups"
- "IT Decision Makers in Financial Services"

INSTRUCTIONS:
1. PRIORITIZE the user's stated target audience and criteria
2. Use prospect data to refine and validate the archetype
3. Create a concise, specific archetype label
4. Return ONLY valid JSON with NO explanation

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "target_archetype": "descriptive archetype label"
}}

Return ONLY the JSON object, nothing else."""
