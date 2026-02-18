"""
Strategy Node
Determines tone, CTA type, and urgency level based on category
"""
import logging
import json
from typing import Dict, Any

from state import AgentState
from utils.llm import get_llm
from config import TEMPERATURE_CONFIG
from prompts.strategy_prompt import get_strategy_prompt

# Configure logging
logger = logging.getLogger(__name__)


def generate_strategy(state: AgentState) -> Dict[str, Any]:
    """
    Generate communication strategy based on task category
    
    Args:
        state: Current agent state with category
        
    Returns:
        Updated state with: tone, cta_type, urgency_level
    """
    category = state.get("category", "B2B_lead_gen")
    
    logger.info(f"Generating strategy for category: {category}")
    
    # Generate prompt
    prompt = get_strategy_prompt(category)
    
    try:
        # Get LLM with medium temperature for balanced creativity
        llm = get_llm(temperature=TEMPERATURE_CONFIG["strategy"])
        
        # Invoke LLM
        response = llm.invoke(prompt)
        response_text = response.content.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        # Parse JSON response
        strategy_data = json.loads(response_text)
        
        tone = strategy_data.get("tone", "professional")
        cta_type = strategy_data.get("cta_type", "book_demo")
        urgency_level = strategy_data.get("urgency_level", "medium")
        
        logger.info(f"Strategy: tone={tone}, cta={cta_type}, urgency={urgency_level}")
        
        # Update state
        return {
            **state,
            "tone": tone,
            "cta_type": cta_type,
            "urgency_level": urgency_level,
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response was: {response_text}")
        # Fallback to defaults
        return {
            **state,
            "tone": "professional",
            "cta_type": "book_demo",
            "urgency_level": "medium",
        }
    except Exception as e:
        logger.error(f"Error in strategy generation: {e}")
        return {
            **state,
            "tone": "professional",
            "cta_type": "book_demo",
            "urgency_level": "medium",
        }
