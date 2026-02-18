"""
Prompt template for ICP archetype extraction
"""


def get_icp_archetype_prompt(prospects: list) -> str:
    """
    Generate prompt for extracting common archetype from prospects
    
    Args:
        prospects: List of prospect dictionaries
        
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
    
    return f"""You are an ICP (Ideal Customer Profile) analyst. Based on the top prospects selected, identify the common archetype.

TOP PROSPECTS:
{prospects_text}

Your task is to extract a concise archetype label that captures:
1. The common job role/seniority level
2. The industry or sector
3. The typical company size or type

The archetype should be a short descriptive phrase (3-7 words) that could be used to segment similar prospects.

EXAMPLES OF GOOD ARCHETYPES:
- "HR Directors at Mid-Market Tech Companies"
- "CFOs in Healthcare Organizations"
- "Operations Managers at Manufacturing SMBs"
- "Marketing Leaders at B2B SaaS Startups"
- "IT Decision Makers in Financial Services"

INSTRUCTIONS:
1. Identify the most common patterns in job titles, industries, and company sizes
2. Create a concise archetype label
3. Return ONLY valid JSON with NO explanation

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "target_archetype": "descriptive archetype label"
}}

Return ONLY the JSON object, nothing else."""
