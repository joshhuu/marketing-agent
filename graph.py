"""
LangGraph setup for Multi-Agent Marketing System
Defines the workflow graph connecting all agents
"""
import logging
from langgraph.graph import StateGraph, END

from state import AgentState
from nodes.input_parser import parse_input
from nodes.classifier import classify_task
from nodes.strategy import generate_strategy
from nodes.icp_matcher import match_icp
from nodes.platform_decision import decide_platform
from nodes.content_generator import generate_content

# Configure logging
logger = logging.getLogger(__name__)


def build_graph():
    """
    Constructs the LangGraph StateGraph for the multi-agent system
    
    Flow:
        START 
        → input_parser 
        → classifier 
        → strategy 
        → icp_matcher 
        → platform_decision 
        → content_generator 
        → END
    
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
    graph.add_node("platform_decision", decide_platform)
    graph.add_node("content_generator", generate_content)
    
    # Add edges (define sequential flow)
    graph.add_edge("input_parser", "classifier")
    graph.add_edge("classifier", "strategy")
    graph.add_edge("strategy", "icp_matcher")
    graph.add_edge("icp_matcher", "platform_decision")
    graph.add_edge("platform_decision", "content_generator")
    graph.add_edge("content_generator", END)
    
    # Set entry point
    graph.set_entry_point("input_parser")
    
    logger.info("Graph construction complete")
    
    # Compile and return
    return graph.compile()
