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
    seniority = None
    
    # PRIORITY 1: Check if user explicitly stated target audience
    if target_audience and target_audience.lower() != "any":
        logger.info(f"Using explicit target_audience: {target_audience}")
        target_lower = target_audience.lower()
        
        # SENIORITY MAPPING (check first for C-level roles)
        if any(kw in target_lower for kw in ["ceo", "chief executive"]):
            seniority = "c_level"
            department = None  # CEOs span all departments
            logger.info(f"Mapped '{target_audience}' → c_level seniority")
        elif any(kw in target_lower for kw in ["cto", "chief technology"]):
            seniority = "c_level"
            department = "IT"  # CTOs manage technology/IT
            logger.info(f"Mapped '{target_audience}' → c_level + IT")
        elif any(kw in target_lower for kw in ["cfo", "chief financial"]):
            seniority = "c_level"
            department = "Finance"
            logger.info(f"Mapped '{target_audience}' → c_level + Finance")
        elif any(kw in target_lower for kw in ["ciso", "chief information security", "chief security"]):
            seniority = "c_level"
            department = "IT"  # Security under IT/Tech
            logger.info(f"Mapped '{target_audience}' → c_level + IT (Security)")
        elif any(kw in target_lower for kw in ["cmo", "chief marketing"]):
            seniority = "c_level"
            department = "Marketing"
            logger.info(f"Mapped '{target_audience}' → c_level + Marketing")
        elif any(kw in target_lower for kw in ["coo", "chief operating"]):
            seniority = "c_level"
            department = "Operations"
            logger.info(f"Mapped '{target_audience}' → c_level + Operations")
        elif any(kw in target_lower for kw in ["cro", "chief revenue"]):
            seniority = "c_level"
            department = "Sales"
            logger.info(f"Mapped '{target_audience}' → c_level + Sales")
        elif any(kw in target_lower for kw in ["cpo", "chief product"]):
            seniority = "c_level"
            department = "Product"
            logger.info(f"Mapped '{target_audience}' → c_level + Product")
        elif any(kw in target_lower for kw in ["vp", "vice president"]):
            seniority = "vp"
            logger.info(f"Mapped '{target_audience}' → vp seniority")
        elif any(kw in target_lower for kw in ["director"]):
            seniority = "director"
            logger.info(f"Mapped '{target_audience}' → director seniority")
        elif any(kw in target_lower for kw in ["manager"]):
            seniority = "manager"
            logger.info(f"Mapped '{target_audience}' → manager seniority")
        
        # DEPARTMENT MAPPING (if not already set by C-level mapping)
        if not department:
            if any(kw in target_lower for kw in ["security", "it director", "it manager", "tech", "technology"]):
                department = "IT"
                logger.info(f"Mapped '{target_audience}' → IT department")
            elif any(kw in target_lower for kw in ["hr", "human resource", "people", "talent", "recruitment"]):
                department = "HR"
                logger.info(f"Mapped '{target_audience}' → HR department")
            elif any(kw in target_lower for kw in ["sales", "account executive", "business development"]):
                department = "Sales"
                logger.info(f"Mapped '{target_audience}' → Sales department")
            elif any(kw in target_lower for kw in ["marketing", "brand", "content", "digital"]):
                department = "Marketing"
                logger.info(f"Mapped '{target_audience}' → Marketing department")
            elif any(kw in target_lower for kw in ["finance", "accounting", "financial"]):
                department = "Finance"
                logger.info(f"Mapped '{target_audience}' → Finance department")
            elif any(kw in target_lower for kw in ["product", "pm"]):
                department = "Product"
                logger.info(f"Mapped '{target_audience}' → Product department")
            elif any(kw in target_lower for kw in ["operations", "supply chain", "logistics"]):
                department = "Operations"
                logger.info(f"Mapped '{target_audience}' → Operations department")
    
    # PRIORITY 2: Extract industry from business_behavior or target_audience
    # Combine both for better keyword matching
    combined_text = f"{business_behavior} {target_audience}".lower()
    
    # Industry keyword mapping (matches database industries)
    INDUSTRY_KEYWORDS = {
        "Finance": ["financial", "finance", "bank", "fintech", "insurance", "wealth", "investment", "trading"],
        "Healthcare": ["healthcare", "health", "hospital", "medical", "clinic", "pharma", "patient"],
        "Technology": ["software", "saas", "platform", "tech", "cloud", "data", "ai", "ml"],
        "Manufacturing": ["manufacturing", "factory", "production", "industrial", "automotive"],
        "Retail": ["retail", "ecommerce", "store", "shopping", "consumer"],
        "Education": ["education", "school", "university", "learning", "academic", "student"],
        "Real Estate": ["real estate", "property", "housing", "construction"],
        "Logistics": ["logistics", "shipping", "supply chain", "transportation", "delivery"],
        "Professional Services": ["consulting", "legal", "accounting", "advisory", "professional services"],
        "Media": ["media", "publishing", "entertainment", "news", "broadcasting"]
    }
    
    # Try to extract industry from keywords
    if not industry:
        for industry_name, keywords in INDUSTRY_KEYWORDS.items():
            if any(kw in combined_text for kw in keywords):
                industry = industry_name
                logger.info(f"Extracted industry: {industry} from keywords")
                break
    
    # PRIORITY 3: If still no department, fall back to business_behavior keywords
    if not department:
        logger.info("Checking business_behavior for department keywords")
        text = business_behavior.lower()
        
        KEYWORD_RULES = [
            {
                "keywords": ["cyber", "security", "threat", "breach", "soc"],
                "department": "IT"
            },
            {
                "keywords": ["compliance", "regulation", "audit", "risk", "governance"],
                "department": "Finance"
            },
            {
                "keywords": ["hr", "payroll", "recruitment", "human resource"],
                "department": "HR"
            },
            {
                "keywords": ["marketing", "branding", "ads", "advertising"],
                "department": "Marketing"
            },
            {
                "keywords": ["sales", "lead generation", "crm", "outreach"],
                "department": "Sales"
            },
        ]
        
        for rule in KEYWORD_RULES:
            if any(keyword in text for keyword in rule["keywords"]):
                if not department and rule["department"]:
                    department = rule["department"]
                break
    
    logger.info(f"Extracted criteria - industry={industry}, department={department}, seniority={seniority}")
    logger.info(f"Will query prospects with these filters")
    
    try:
        # Query database for top prospects
        db = get_db()
        
        prospects = get_top_prospects_by_criteria(
            db=db,
            industry=industry,
            department=department,
            seniority=seniority,
            location=location if location and location.lower() != "any" else None,
            limit=15
        )
        
        db.close()
        
        # Progressive fallback if no results - try combinations before going random
        if not prospects:
            logger.warning(f"No prospects found with all filters. Trying intelligent fallbacks...")
            db = get_db()
            
            # Try 1: Keep seniority + department (most targeted)
            if seniority and department:
                logger.info(f"Fallback 1: {seniority} + {department} (any industry/location)")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    seniority=seniority,
                    department=department,
                    limit=15
                )
            
            # Try 2: Seniority + industry
            if not prospects and seniority and industry:
                logger.info(f"Fallback 2: {seniority} in {industry}")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    seniority=seniority,
                    industry=industry,
                    limit=15
                )
            
            # Try 3: Department + industry
            if not prospects and department and industry:
                logger.info(f"Fallback 3: {department} in {industry}")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    department=department,
                    industry=industry,
                    limit=15
                )
            
            # Try 4: Seniority only
            if not prospects and seniority:
                logger.info(f"Fallback 4: {seniority} level (any dept/industry)")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    seniority=seniority,
                    limit=15
                )
            
            # Try 5: Department only
            if not prospects and department:
                logger.info(f"Fallback 5: {department} department (any level/industry)")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    department=department,
                    limit=15
                )
            
            # Try 6: Industry only
            if not prospects and industry:
                logger.info(f"Fallback 6: {industry} industry only")
                prospects = get_top_prospects_by_criteria(
                    db=db,
                    industry=industry,
                    limit=15
                )
            
            # Try 7: Last resort - top prospects by priority
            if not prospects:
                logger.warning("All filters failed. Using top priority prospects (last resort)")
                prospects = get_top_prospects_by_criteria(db=db, limit=15)
            
            db.close()
            logger.info(f"Fallback successful: found {len(prospects)} prospects")
        else:
            logger.info(f"Found {len(prospects)} prospects with exact filters")
        
        # Extract target archetype using LLM
        archetype = "B2B Decision Makers"  # default
        if prospects:
            try:
                archetype_prompt = get_icp_archetype_prompt(
                    prospects=prospects,
                    target_audience=target_audience,
                    industry=industry,
                    department=department,
                    seniority=seniority
                )
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
                # Use fallback archetype based on what we know
                if target_audience and target_audience.lower() != "any":
                    if industry:
                        archetype = f"{target_audience} in {industry}"
                    else:
                        archetype = target_audience
                    logger.info(f"Using fallback archetype: {archetype}")
        
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