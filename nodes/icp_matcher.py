"""
ICP Matcher Node (Agent 2) - UPDATED
Now respects explicit target_audience from user input
"""
import logging
import json
from typing import Dict, Any

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
    Now prioritizes explicit target_audience over business_behavior
    
    Args:
        state: Current agent state with location, business_behavior, and target_audience
        
    Returns:
        Updated state with: top_prospects, target_archetype
    """
    location = state.get("location", "")
    business_behavior = state.get("business_behavior", "")
    target_audience = state.get("target_audience", "any")  # NEW
    
    logger.info(f"Matching ICP: location={location}, behavior={business_behavior}, target={target_audience}")
    
    industry = None
    department = None
    
    # PRIORITY 1: Check if user explicitly stated target audience
    if target_audience and target_audience.lower() != "any":
        logger.info(f"Using explicit target_audience: {target_audience}")
        target_lower = target_audience.lower()
        
        # Map target_audience to department
        if any(kw in target_lower for kw in ["security", "ciso", "cyber", "it director", "it manager", "tech", "technology"]):
            department = "IT"
            logger.info(f"Mapped '{target_audience}' → IT department")
        elif any(kw in target_lower for kw in ["hr", "human resource", "people", "talent", "recruitment"]):
            department = "HR"
            logger.info(f"Mapped '{target_audience}' → HR department")
        elif any(kw in target_lower for kw in ["sales", "account executive", "business development", "cro"]):
            department = "Sales"
            logger.info(f"Mapped '{target_audience}' → Sales department")
        elif any(kw in target_lower for kw in ["marketing", "cmo", "brand", "content", "digital"]):
            department = "Marketing"
            logger.info(f"Mapped '{target_audience}' → Marketing department")
        elif any(kw in target_lower for kw in ["finance", "cfo", "accounting", "financial"]):
            department = "Finance"
            logger.info(f"Mapped '{target_audience}' → Finance department")
        elif any(kw in target_lower for kw in ["engineering", "cto", "developer", "software", "devops"]):
            department = "Engineering"
            logger.info(f"Mapped '{target_audience}' → Engineering department")
        elif any(kw in target_lower for kw in ["product", "cpo", "pm"]):
            department = "Product"
            logger.info(f"Mapped '{target_audience}' → Product department")
        elif any(kw in target_lower for kw in ["operations", "coo", "supply chain", "logistics"]):
            department = "Operations"
            logger.info(f"Mapped '{target_audience}' → Operations department")
        elif any(kw in target_lower for kw in ["customer success", "support", "service"]):
            department = "Customer Success"
            logger.info(f"Mapped '{target_audience}' → Customer Success department")
    
    # PRIORITY 2: If no explicit target or couldn't map it, fall back to business_behavior
    if not department:
        logger.info("No explicit target or couldn't map it, using business_behavior keywords")
        text = business_behavior.lower()
        
        KEYWORD_RULES = [
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
            {
                "keywords": ["hr", "payroll", "recruitment", "human resource"],
                "industry": None,
                "department": "HR"
            },
            {
                "keywords": ["finance", "cfo", "accounting", "financial"],
                "industry": "Finance",
                "department": "Finance"
            },
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
    
    logger.info(f"Extracted keywords from business_behavior: industry={industry}, department={department}")
    logger.info(f"Will query prospects with these filters")
    
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
        
        # Progressive fallback if no results
        if not prospects:
            logger.warning(f"No prospects found with industry={industry}, dept={department}, loc={location}")
            db = get_db()
            
            # Try 1: Relax industry, keep department and location
            if department or location:
                logger.info("Attempting fallback: department and/or location only")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    industry=None,
                    department=department,
                    location=location if location and location.lower() != "any" else None,
                    limit=15
                )
            
            # Try 2: Department only (most important for targeting)
            if not prospects and department:
                logger.info(f"Attempting fallback: {department} department globally")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    industry=None,
                    department=department,
                    location=None,
                    limit=15
                )
            
            # Try 3: Industry only
            if not prospects and industry:
                logger.info(f"Attempting fallback: {industry} industry globally")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    industry=industry,
                    department=None,
                    location=None,
                    limit=15
                )
            
            # Try 4: Last resort - top prospects by priority
            if not prospects:
                logger.warning("All specific filters failed, returning top prospects by priority score")
                prospects = get_top_prospects_by_criteria(db=db, limit=15)
            
            db.close()
            logger.info(f"Fallback successful: found {len(prospects)} prospects")
        else:
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