"""
Prompt template for platform/channel decision
"""


def get_platform_prompt(
    channel_performance: dict,
    urgency_level: str,
    time_context: str,
    target_archetype: str
) -> str:
    """
    Generate prompt for selecting best communication channel
    
    Args:
        channel_performance: Performance metrics per channel
        urgency_level: Urgency from strategy
        time_context: Time information from input parser
        target_archetype: Target archetype from ICP matcher
        
    Returns:
        Formatted prompt string
    """
    # Format performance data
    perf_text = []
    for channel, metrics in channel_performance.items():
        perf_text.append(
            f"- {channel.upper()}: Open Rate={metrics.get('open_rate', 0):.1f}%, "
            f"Reply Rate={metrics.get('reply_rate', 0):.1f}%, "
            f"Sample Size={metrics.get('count', 0)} engagements"
        )
    
    performance_summary = "\n".join(perf_text) if perf_text else "No historical data available"
    
    return f"""You are a B2B channel optimization expert. Select the best communication channel based on data and context.

CHANNEL PERFORMANCE DATA FOR SIMILAR PROSPECTS:
{performance_summary}

CONTEXT:
- Target Archetype: {target_archetype}
- Urgency Level: {urgency_level}
- Time Context: {time_context}

AVAILABLE CHANNELS:
1. linkedin - Professional networking platform, good for B2B, requires connection/InMail
2. email - Direct inbox access, scalable, requires good subject lines
3. call - High-touch, personal, best for high-value or urgent outreach

DECISION FACTORS TO CONSIDER:
1. Historical performance (open rate and reply rate)
2. Urgency level (high urgency may favor calls, low urgency may favor email nurture)
3. Target archetype (C-suite may prefer calls, individual contributors may prefer LinkedIn)
4. Time of day (calls during business hours, email/LinkedIn can be asynchronous)
5. Sample size (trust data with higher sample sizes)

INSTRUCTIONS:
1. Analyze the performance data for each channel
2. Consider the urgency and archetype fit
3. Select the SINGLE best channel
4. Provide brief reasoning (1-2 sentences)
5. Return ONLY valid JSON with NO additional commentary

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "selected_channel": "linkedin|email|call",
    "channel_reasoning": "Brief explanation of why this channel is optimal"
}}

Return ONLY the JSON object, nothing else."""
