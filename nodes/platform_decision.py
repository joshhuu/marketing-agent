"""
Platform Decision Node (Agent 3)
Selects the best communication channel based on data
"""
import logging
import json
from typing import Dict, Any

from state import AgentState
from utils.llm import get_llm
from utils.db_queries import get_channel_performance
from database import get_db
from config import TEMPERATURE_CONFIG
from prompts.platform_prompt import get_platform_prompt

# Configure logging
logger = logging.getLogger(__name__)


def decide_platform(state: AgentState) -> Dict[str, Any]:
    """
    Decide which platform/channel to use for outreach
    
    Args:
        state: Current agent state with target_archetype, urgency_level, time
        
    Returns:
        Updated state with: selected_channel, channel_reasoning
    """
    # Check if user explicitly requested email in prompt
    user_prompt = state.get('user_prompt', '').lower()
    force_email = any(keyword in user_prompt for keyword in ['send email', 'email to', 'via email', 'through email', 'email them'])
    
    if force_email:
        logger.info("User explicitly requested email channel - forcing email")
        return {
            "selected_channel": "email",
            "channel_reasoning": "Email channel explicitly requested by user in prompt"
        }
    
    target_archetype = state.get("target_archetype", "")
    urgency_level = state.get("urgency_level", "medium")
    time_context = state.get("time", "current")
    
    logger.info(f"Deciding platform: archetype={target_archetype}, urgency={urgency_level}")
    
    try:
        # Get channel performance data from database
        db = get_db()
        
        # Get performance for similar archetype
        channel_performance = get_channel_performance(
            db=db,
            archetype=target_archetype
        )
        
        db.close()
        
        # If no data, use defaults
        if not channel_performance:
            logger.warning("No channel performance data found, using defaults")
            channel_performance = {
                "email": {"open_rate": 35.0, "reply_rate": 8.0, "count": 100},
                "linkedin": {"open_rate": 42.0, "reply_rate": 12.0, "count": 80},
                "call": {"open_rate": 55.0, "reply_rate": 20.0, "count": 50},
            }
        
        logger.info(f"Channel performance: {channel_performance}")
        
        # Generate prompt
        prompt = get_platform_prompt(
            channel_performance=channel_performance,
            urgency_level=urgency_level,
            time_context=time_context,
            target_archetype=target_archetype
        )
        
        # Get LLM decision
        llm = get_llm(temperature=TEMPERATURE_CONFIG["platform_decision"])
        
        response = llm.invoke(prompt)
        response_text = response.content.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        # Parse JSON response
        decision_data = json.loads(response_text)
        
        selected_channel = decision_data.get("selected_channel", "email")
        channel_reasoning = decision_data.get("channel_reasoning", "Default selection")
        
        # Validate channel
        valid_channels = ["email", "linkedin", "call"]
        if selected_channel not in valid_channels:
            logger.warning(f"Invalid channel {selected_channel}, defaulting to email")
            selected_channel = "email"
        
        logger.info(f"Selected channel: {selected_channel}")
        logger.info(f"Reasoning: {channel_reasoning}")
        
        # Update state
        return {
            **state,
            "selected_channel": selected_channel,
            "channel_reasoning": channel_reasoning,
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response was: {response_text}")
        return {
            **state,
            "selected_channel": "email",
            "channel_reasoning": "Default fallback due to parsing error",
        }
    except Exception as e:
        logger.error(f"Error in platform decision: {e}")
        return {
            **state,
            "selected_channel": "email",
            "channel_reasoning": "Default fallback due to error",
        }
