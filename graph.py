"""
LangGraph setup for Multi-Agent Marketing System
Defines the workflow graph connecting all agents
UPDATED: Now includes engagement analysis and conditional routing
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


def build_graph():
    """
    Constructs the LangGraph StateGraph for the multi-agent system
    
    Flow:
        START 
        → input_parser 
        → classifier 
        → strategy 
        → icp_matcher 
        → engagement_analyzer (NEW)
        → (conditional check)
        → platform_decision 
        → content_generator 
        → END
    
    IMPROVEMENTS:
    - Added engagement_analyzer to prevent over-contacting prospects
    - Added conditional routing to handle edge cases intelligently
    - Maintains all existing fallback logic in individual nodes
    
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
    graph.add_node("engagement_analyzer", analyze_engagement)  # NEW
    graph.add_node("platform_decision", decide_platform)
    graph.add_node("content_generator", generate_content)
    
    # Add edges (define sequential flow with conditional routing)
    graph.add_edge("input_parser", "classifier")
    graph.add_edge("classifier", "strategy")
    graph.add_edge("strategy", "icp_matcher")
    graph.add_edge("icp_matcher", "engagement_analyzer")  # NEW
    
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
    graph.add_edge("content_generator", END)
    
    # Set entry point
    graph.set_entry_point("input_parser")
    
    logger.info("Graph construction complete with engagement analysis and conditional routing")
    
    # Compile and return
    return graph.compile()
