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
from database import get_db
from utils.db_queries import update_classification_strategy

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
    user_intent = state.get("user_intent", "")
    time = state.get("time", "")
    business_behavior = state.get("business_behavior", "")
    user_prompt = state.get("user_prompt", "")
    
    logger.info(f"Generating strategy for category: {category}")
    
    # PRE-DETECT URGENCY from user language
    urgency_override = None
    # Check both extracted fields AND original prompt for urgency keywords
    combined_text = f"{user_intent} {time} {business_behavior} {user_prompt}".lower()
    
    HIGH_URGENCY_KEYWORDS = [
        "urgent", "asap", "immediately", "critical", "emergency", "deadline",
        "time-sensitive", "quick", "fast", "now", "today", "this week",
        "q1", "q2", "q3", "q4", "quarter", "month-end", "year-end"
    ]
    
    LOW_URGENCY_KEYWORDS = [
        "explore", "research", "learn", "eventually", "someday", 
        "long-term", "future", "considering"
    ]
    
    if any(kw in combined_text for kw in HIGH_URGENCY_KEYWORDS):
        urgency_override = "high"
        logger.info(f"Detected HIGH urgency from keywords in user input")
    elif any(kw in combined_text for kw in LOW_URGENCY_KEYWORDS):
        urgency_override = "low"
        logger.info(f"Detected LOW urgency from keywords in user input")
    
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
        
        tone = strategy_data.get("tone", "solution_focused")
        cta_type = strategy_data.get("cta_type", "book_demo")
        urgency_level = urgency_override or strategy_data.get("urgency_level", "medium")
        
        # Override urgency if we detected it from user language
        if urgency_override:
            logger.info(f"Overriding LLM urgency with detected urgency: {urgency_override}")
        
        logger.info(f"Strategy: tone={tone}, cta={cta_type}, urgency={urgency_level}")
        
        # Save strategy to database (update classification)
        try:
            db = get_db()
            update_classification_strategy(
                db=db,
                tone=tone,
                cta_type=cta_type,
                urgency_level=urgency_level
            )
            db.close()
            logger.info("Strategy saved to classification in database")
        except Exception as db_error:
            logger.error(f"Failed to update classification with strategy: {db_error}")
            # Continue execution even if DB save fails
        
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
            "tone": "solution_focused",
            "cta_type": "book_demo",
            "urgency_level": urgency_override or "medium",
        }
    except Exception as e:
        logger.error(f"Error in strategy generation: {e}")
        return {
            **state,
            "tone": "solution_focused",
            "cta_type": "book_demo",
            "urgency_level": urgency_override or "medium",
        }
