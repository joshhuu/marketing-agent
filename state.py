"""
State schema for the LangGraph multi-agent system
Defines the TypedDict that flows through all nodes
"""
from typing import TypedDict, List, Optional, Dict, Any


class AgentState(TypedDict):
    """
    State object that flows through the entire graph
    Each node reads from and writes to this state
    """
    # User input
    user_prompt: str
    
    # Input Parser outputs
    time: Optional[str]
    location: Optional[str]
    business_behavior: Optional[str]
    user_intent: Optional[str]
    sender_name: Optional[str]  # Name of the person sending the campaign (defaults to "Joshua")
    
    # Agent 1 (Classifier) outputs
    category: Optional[str]
    confidence: Optional[float]
    
    # Strategy outputs
    tone: Optional[str]
    cta_type: Optional[str]
    urgency_level: Optional[str]
    
    # Agent 2 (ICP Matcher) outputs
    top_prospects: Optional[List[Dict[str, Any]]]
    target_archetype: Optional[str]
    target_audience: Optional[str]
    
    # Engagement Analyzer outputs (NEW)
    prospects_filtered_count: Optional[int]  # How many prospects filtered due to recent contact
    
    # Agent 3 (Platform Decision) outputs
    selected_channel: Optional[str]
    channel_reasoning: Optional[str]
    
    # Agent 4 (Content Generator) outputs
    # Personalized content for each prospect
    personalized_content: Optional[List[Dict[str, Any]]]  # List of {prospect_id, prospect_name, linkedin_message, email_message, call_script}
    
    # Legacy fields (for backward compatibility)
    linkedin_message: Optional[str]
    email_message: Optional[Dict[str, str]]  # {subject: str, body: str}
    call_script: Optional[Dict[str, Any]]    # {opener: str, objections: list, close: str}
