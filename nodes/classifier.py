"""
Classifier Node (Agent 1)
Classifies the task category and saves to database
"""
import logging
import json
from typing import Dict, Any

from state import AgentState
from utils.llm import get_llm
from utils.db_queries import save_classification
from database import get_db
from config import TEMPERATURE_CONFIG
from prompts.classifier_prompt import get_classifier_prompt

# Configure logging
logger = logging.getLogger(__name__)


def classify_task(state: AgentState) -> Dict[str, Any]:
    """
    Classify the user's task into a category
    
    Args:
        state: Current agent state with parsed fields
        
    Returns:
        Updated state with: category, confidence
    """
    time = state.get("time", "current")
    location = state.get("location", "any")
    business_behavior = state.get("business_behavior", "")
    user_intent = state.get("user_intent", "")
    
    logger.info(f"Classifying task: intent={user_intent}, behavior={business_behavior}")
    
    # Generate prompt
    prompt = get_classifier_prompt(time, location, business_behavior, user_intent)
    
    try:
        # Get LLM with very low temperature for deterministic classification
        llm = get_llm(temperature=TEMPERATURE_CONFIG["classifier"])
        
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
        classification_data = json.loads(response_text)
        
        category = classification_data.get("category", "B2B_lead_gen")
        confidence = classification_data.get("confidence", 0.7)
        context_reasoning = classification_data.get("context_reasoning", "No contextual signals detected.")
        
        logger.info(f"Classification result: category={category}, confidence={confidence}")
        logger.info(f"Context reasoning: {context_reasoning[:100]}...")
        
        # Save to database
        try:
            db = get_db()
            save_classification(
                db=db,
                prompt_text=state.get("user_prompt", ""),
                category=category,
                confidence=confidence,
                time=time,
                location=location,
                business_behavior=business_behavior,
                user_intent=user_intent
            )
            db.close()
            logger.info("Classification saved to database")
        except Exception as db_error:
            logger.error(f"Failed to save classification to database: {db_error}")
            # Continue execution even if DB save fails
        
        # Update state
        return {
            **state,
            "category": category,
            "confidence": float(confidence),
            "context_reasoning": context_reasoning,
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response was: {response_text}")
        # Fallback to default category
        return {
            **state,
            "category": "B2B_lead_gen",
            "confidence": 0.5,
            "context_reasoning": "Classification failed — defaulting to B2B lead generation.",
        }
    except Exception as e:
        logger.error(f"Error in classifier: {e}")
        return {
            **state,
            "category": "B2B_lead_gen",
            "confidence": 0.5,
            "context_reasoning": "Classification error — defaulting to B2B lead generation.",
        }
