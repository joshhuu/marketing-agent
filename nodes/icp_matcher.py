"""
ICP Matcher Node (Agent 2)
Finds best prospects from database based on criteria
"""
import logging
import json
from typing import Dict, Any, List

from state import AgentState
from utils.llm import get_llm
from utils.db_queries import get_top_prospects_by_criteria
from database import get_db
from config import TEMPERATURE_CONFIG
from prompts.icp_prompt import get_icp_archetype_prompt

# Configure logging
logger = logging.getLogger(__name__)


def match_icp(state: AgentState) -> Dict[str, Any]:
    """
    Match prospects from database based on ICP criteria
    
    Args:
        state: Current agent state with location and business_behavior
        
    Returns:
        Updated state with: top_prospects, target_archetype
    """
    location = state.get("location", "")
    business_behavior = state.get("business_behavior", "")
    
    logger.info(f"Matching ICP: location={location}, behavior={business_behavior}")
    
    # Extract industry and department from business_behavior
    # Simple heuristic: look for keywords
    text = business_behavior.lower()
    
    industry = None
    department = None
    
    KEYWORD_RULES = [
        # Security / Compliance (highest priority)
        {
            "keywords": ["cyber", "security", "threat", "breach", "soc"],
            "industry": "Finance",
            "department": "IT"
        },
        {
            "keywords": ["compliance", "regulation", "audit", "risk", "governance"],
            "industry": "Finance",
            "department": "Finance"
        },
        # HR
        {
            "keywords": ["hr", "payroll", "recruitment", "human resource"],
            "industry": None,
            "department": "HR"
        },
        # Finance
        {
            "keywords": ["finance", "cfo", "accounting", "financial"],
            "industry": "Finance",
            "department": "Finance"
        },
        # Marketing / Sales
        {
            "keywords": ["marketing", "branding", "ads", "advertising"],
            "industry": None,
            "department": "Marketing"
        },
        {
            "keywords": ["sales", "lead generation", "crm"],
            "industry": None,
            "department": "Sales"
        },
        # Tech fallback
        {
            "keywords": ["software", "saas", "platform", "tech"],
            "industry": "Technology",
            "department": "Engineering"
        },
    ]
    
    for rule in KEYWORD_RULES:
        if any(keyword in text for keyword in rule["keywords"]):
            if not industry and rule["industry"]:
                industry = rule["industry"]
            if not department and rule["department"]:
                department = rule["department"]
            break
    
    try:
        # Query database for top prospects
        db = get_db()
        
        prospects = get_top_prospects_by_criteria(
            db=db,
            industry=industry,
            department=department,
            location=location if location and location.lower() != "any" else None,
            limit=15
        )
        
        db.close()
        
        if not prospects:
            logger.warning("No prospects found matching criteria, using fallback")
            # Fallback: get any prospects
            db = get_db()
            prospects = get_top_prospects_by_criteria(db=db, limit=15)
            db.close()
        
        logger.info(f"Found {len(prospects)} prospects")
        
        # Extract target archetype using LLM
        archetype = "B2B Decision Makers"  # default
        if prospects:
            try:
                archetype_prompt = get_icp_archetype_prompt(prospects)
                llm = get_llm(temperature=TEMPERATURE_CONFIG["icp_matcher"])
                
                response = llm.invoke(archetype_prompt)
                response_text = response.content.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()
                
                archetype_data = json.loads(response_text)
                archetype = archetype_data.get("target_archetype", archetype)
                
                logger.info(f"Extracted archetype: {archetype}")
                
            except Exception as e:
                logger.error(f"Failed to extract archetype: {e}")
                # Use fallback archetype
        
        # Update state
        return {
            **state,
            "top_prospects": prospects,
            "target_archetype": archetype,
        }
        
    except Exception as e:
        logger.error(f"Error in ICP matching: {e}")
        return {
            **state,
            "top_prospects": [],
            "target_archetype": "B2B Decision Makers",
        }