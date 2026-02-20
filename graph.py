"""
LangGraph setup for Multi-Agent Marketing System
Defines the workflow graph connecting all agents
UPDATED: Now includes engagement analysis, email validation, and email sending
"""
import logging
from langgraph.graph import StateGraph, END

from state import AgentState
from nodes.input_parser import parse_input
from nodes.classifier import classify_task
from nodes.strategy import generate_strategy
from nodes.icp_matcher import match_icp
from nodes.engagement_analyzer import analyze_engagement
from nodes.platform_decision import decide_platform
from nodes.content_generator import generate_content
from nodes.email_validator import validate_email
from nodes.email_sender import send_emails

# Configure logging
logger = logging.getLogger(__name__)


def should_proceed_after_engagement(state: AgentState) -> str:
    """
    Conditional routing after engagement analysis
    
    Checks if we have enough prospects remaining after filtering.
    If all prospects were filtered (contacted too recently), we need to handle it.
    
    Returns:
        "platform_decision" if we have prospects
        "END" if no prospects (will be caught by server)
    """
    prospects = state.get("top_prospects", [])
    
    if not prospects or len(prospects) == 0:
        filtered_count = state.get("prospects_filtered_count", 0)
        logger.warning(
            f"No prospects available after engagement analysis. "
            f"{filtered_count} were filtered due to recent contact."
        )
        # In production, this could route to:
        # - "expand_search" node to find more prospects
        # - "notify_user" node to ask for different criteria
        # For now, we'll continue to platform_decision which will handle empty list
        return "platform_decision"
    
    logger.info(f"Proceeding with {len(prospects)} prospects after engagement analysis")
    return "platform_decision"


def should_validate_emails(state: AgentState) -> str:
    """
    Conditional routing after content generation
    
    Only validate emails if the selected channel is email.
    
    Returns:
        "email_validator" if channel is email
        "END" for other channels
    """
    selected_channel = state.get("selected_channel", "email")
    
    if selected_channel == "email":
        logger.info("Channel is email - proceeding to email validation")
        return "email_validator"
    else:
        logger.info(f"Channel is {selected_channel} - skipping email validation")
        return "END"


def should_send_emails(state: AgentState) -> str:
    """
    Conditional routing after email validation
    
    Only send emails if they passed validation.
    
    Returns:
        "email_sender" if emails are approved
        "END" if emails failed validation
    """
    emails_approved = state.get("emails_approved", False)
    
    if emails_approved:
        logger.info("Emails approved - proceeding to email sender")
        return "email_sender"
    else:
        logger.warning("Emails not approved - cannot send")
        return "END"


def build_graph():
    """
    Constructs the LangGraph StateGraph for the multi-agent system
    
    Flow:
        START 
        -> input_parser 
        -> classifier 
        -> strategy 
        -> icp_matcher 
        -> engagement_analyzer
        -> (conditional check)
        -> platform_decision 
        -> content_generator 
        -> (conditional check - is email?)
        -> email_validator (if email)
        -> (conditional check - passed validation?)
        -> email_sender (if approved)
        -> END
    
    IMPROVEMENTS:
    - Added engagement_analyzer to prevent over-contacting prospects
    - Added email_validator to check for spam and professionalism
    - Added email_sender to send approved emails to hardcoded test addresses
    - Added conditional routing to handle different channels and validation results
    
    Returns:
        Compiled graph ready to invoke with initial state
    """
    logger.info("Building agent workflow graph")
    
    # Create StateGraph with AgentState schema
    graph = StateGraph(AgentState)
    
    # Add nodes (agents)
    graph.add_node("input_parser", parse_input)
    graph.add_node("classifier", classify_task)
    graph.add_node("strategy", generate_strategy)
    graph.add_node("icp_matcher", match_icp)
    graph.add_node("engagement_analyzer", analyze_engagement)
    graph.add_node("platform_decision", decide_platform)
    graph.add_node("content_generator", generate_content)
    graph.add_node("email_validator", validate_email)
    graph.add_node("email_sender", send_emails)
    
    # Add edges (define sequential flow with conditional routing)
    graph.add_edge("input_parser", "classifier")
    graph.add_edge("classifier", "strategy")
    graph.add_edge("strategy", "icp_matcher")
    graph.add_edge("icp_matcher", "engagement_analyzer")
    
    # Conditional routing after engagement analysis
    # This ensures we handle cases where all prospects are filtered
    graph.add_conditional_edges(
        "engagement_analyzer",
        should_proceed_after_engagement,
        {
            "platform_decision": "platform_decision",
            "END": END
        }
    )
    
    # Continue with existing flow
    graph.add_edge("platform_decision", "content_generator")
    
    # Conditional routing after content generation
    # Only validate emails if channel is email
    graph.add_conditional_edges(
        "content_generator",
        should_validate_emails,
        {
            "email_validator": "email_validator",
            "END": END
        }
    )
    
    # Conditional routing after email validation
    # Only send emails if they passed validation
    graph.add_conditional_edges(
        "email_validator",
        should_send_emails,
        {
            "email_sender": "email_sender",
            "END": END
        }
    )
    
    # Email sender goes to END
    graph.add_edge("email_sender", END)
    
    # Set entry point
    graph.set_entry_point("input_parser")
    
    logger.info("Graph construction complete with email validation and sending")
    
    # Compile and return
    return graph.compile()

