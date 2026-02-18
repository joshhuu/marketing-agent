"""
Input Parser Node
Extracts structured fields from natural language input
"""
import logging
import json
from typing import Dict, Any

from state import AgentState
from utils.llm import get_llm
from config import TEMPERATURE_CONFIG

# Configure logging
logger = logging.getLogger(__name__)


def parse_input(state: AgentState) -> Dict[str, Any]:
    """
    Parse natural language user prompt to extract structured fields
    
    Args:
        state: Current agent state with user_prompt
        
    Returns:
        Updated state with: time, location, business_behavior, user_intent
    """
    user_prompt = state.get("user_prompt", "")
    logger.info(f"Parsing input: {user_prompt[:100]}...")
    
    # Create prompt for extraction
    extraction_prompt = f"""You are a natural language processing system. Extract the following 4 fields from the user's prompt:

USER PROMPT:
"{user_prompt}"

FIELDS TO EXTRACT:
1. time: When the user wants to execute this (e.g., "current", "next week", "Q4 2024", "morning")
2. location: Geographic location mentioned (e.g., "UK", "San Francisco", "Europe", "remote")
3. business_behavior: What the user is trying to do/sell (e.g., "selling HR software", "promoting webinar", "re-engaging leads")
4. user_intent: The core goal or intent (e.g., "generate leads", "book demos", "increase engagement", "build partnerships")

EXTRACTION RULES:
- If a field is not explicitly mentioned, infer intelligently from context
- If unable to infer, use sensible defaults:
  - time: "current"
  - location: "any"
  - business_behavior: [infer from prompt]
  - user_intent: [infer from prompt]
- Be concise but specific
- Return ONLY valid JSON with NO explanation

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "time": "extracted or inferred time",
    "location": "extracted or inferred location",
    "business_behavior": "extracted or inferred business behavior",
    "user_intent": "extracted or inferred user intent"
}}

Return ONLY the JSON object, nothing else."""
    
    try:
        # Get LLM with low temperature for structured extraction
        llm = get_llm(temperature=TEMPERATURE_CONFIG["input_parser"])
        
        # Invoke LLM
        response = llm.invoke(extraction_prompt)
        response_text = response.content.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        # Parse JSON response
        extracted_data = json.loads(response_text)
        
        logger.info(f"Extracted fields: {extracted_data}")
        
        # Update state
        return {
            **state,
            "time": extracted_data.get("time", "current"),
            "location": extracted_data.get("location", "any"),
            "business_behavior": extracted_data.get("business_behavior", "business development"),
            "user_intent": extracted_data.get("user_intent", "generate leads"),
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response was: {response_text}")
        # Fallback to defaults
        return {
            **state,
            "time": "current",
            "location": "any",
            "business_behavior": "business development",
            "user_intent": "generate leads",
        }
    except Exception as e:
        logger.error(f"Error in input parser: {e}")
        # Return state with defaults
        return {
            **state,
            "time": "current",
            "location": "any",
            "business_behavior": "business development",
            "user_intent": "generate leads",
        }
