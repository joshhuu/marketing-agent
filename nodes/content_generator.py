"""
Content Generator Node (Agent 4)
Generates personalized content for all channels
"""
import logging
import json
from typing import Dict, Any

from state import AgentState
from utils.llm import get_llm
from utils.db_queries import get_products_by_keywords
from database import get_db
from config import TEMPERATURE_CONFIG
from prompts.content_prompt import get_content_prompt

# Configure logging
logger = logging.getLogger(__name__)


def generate_realistic_product(business_behavior: str, target_archetype: str, category: str) -> Dict[str, Any]:
    """
    Use LLM to generate a realistic product based on user's business description
    
    Args:
        business_behavior: What the user is selling/promoting
        target_archetype: Who they're targeting
        category: Campaign category
        
    Returns:
        Product info dictionary with name, value_proposition, key_benefits, etc.
    """
    logger.info(f"Generating realistic product for: {business_behavior[:50]}...")
    
    prompt = f"""You are a product marketing expert. Based on the user's business description, create a realistic product profile that matches what they're trying to sell.

USER'S BUSINESS DESCRIPTION:
"{business_behavior}"

TARGET AUDIENCE:
{target_archetype or "B2B decision makers"}

CAMPAIGN TYPE:
{category}

Your task is to create a REALISTIC product that sounds professional and specific to the business description. This should feel like a real SaaS product or service, not generic text.

GUIDELINES:
1. Product name should be:
   - Professional and memorable (2-4 words max)
   - Related to the business description
   - Sound like a real tech/SaaS product (e.g., "DataFlow Analytics", "SecureGuard Pro", "TalentBridge HR")
   
2. Value proposition should be:
   - Clear and quantifiable benefit statement
   - 1 sentence max
   - Include metrics or outcomes when possible (e.g., "Reduce compliance costs by 40%")
   
3. Key benefits should be:
   - 3-4 specific, tangible benefits
   - Short phrases (not full sentences)
   - Relevant to the business description
   
4. CTAs should be:
   - Action-oriented and specific to the product
   - Professional B2B language

EXAMPLES OF GOOD OUTPUTS:
- For "selling cybersecurity compliance platform": 
  {{
    "name": "ComplianceShield Pro",
    "value_proposition": "Automate security compliance and reduce audit costs by 60%",
    "key_benefits": ["Automated SOC 2 & ISO compliance", "Real-time risk monitoring", "One-click audit reports", "24/7 threat detection"]
  }}

- For "promoting HR analytics software":
  {{
    "name": "PeopleMetrics Suite",
    "value_proposition": "Make data-driven HR decisions with predictive workforce analytics",
    "key_benefits": ["Turnover prediction models", "Hiring performance insights", "Compensation benchmarking", "Skills gap analysis"]
  }}

Return ONLY valid JSON with NO explanation.

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
    "name": "professional product name",
    "value_proposition": "clear benefit statement in one sentence",
    "key_benefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
    "cta_primary": "primary call-to-action",
    "cta_secondary": "secondary call-to-action"
}}

Return ONLY the JSON object, nothing else."""
    
    try:
        llm = get_llm(temperature=0.6)  # Balanced creativity
        response = llm.invoke(prompt)
        response_text = response.content.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        product_info = json.loads(response_text)
        logger.info(f"Generated realistic product: '{product_info.get('name')}'")
        
        return product_info
        
    except Exception as e:
        logger.error(f"Failed to generate realistic product: {e}")
        # Ultra-minimal fallback if LLM fails
        return {
            "name": "Your Solution",
            "value_proposition": "Streamline operations and drive results",
            "key_benefits": ["Save time", "Reduce costs", "Improve efficiency", "Scale faster"],
            "cta_primary": "Schedule a Demo",
            "cta_secondary": "Learn More",
        }


def generate_content(state: AgentState) -> Dict[str, Any]:
    """
    Generate personalized content for LinkedIn, Email, and Call for ALL prospects
    
    Args:
        state: Current agent state with all previous data
        
    Returns:
        Updated state with: personalized_content (list), and legacy fields for backward compatibility
    """
    tone = state.get("tone", "professional")
    cta_type = state.get("cta_type", "book_demo")
    urgency_level = state.get("urgency_level", "medium")
    target_archetype = state.get("target_archetype", "")
    category = state.get("category", "")
    business_behavior = state.get("business_behavior", "")
    top_prospects = state.get("top_prospects", [])
    sender_name = state.get("sender_name", "Joshua")  # NEW: Get sender name
    
    logger.info(f"Generating personalized content for {len(top_prospects)} prospects: tone={tone}, cta={cta_type}")
    
    try:
        # Extract keywords from business_behavior to match products
        behavior_lower = business_behavior.lower()
        keywords = []
        
        # Map business behavior to product keywords
        if any(word in behavior_lower for word in ["cyber", "security", "threat", "breach", "soc"]):
            keywords.extend(["security", "Shield", "cyber"])
        if any(word in behavior_lower for word in ["compliance", "audit", "regulation", "soc2"]):
            keywords.extend(["compliance", "Shield", "security"])
        if any(word in behavior_lower for word in ["hr", "payroll", "recruitment", "human resource"]):
            keywords.extend(["HR", "Flow", "payroll"])
        if any(word in behavior_lower for word in ["crm", "sales", "pipeline", "lead"]):
            keywords.extend(["CRM", "Nexus", "sales"])
        if any(word in behavior_lower for word in ["data", "analytics", "bi", "reporting"]):
            keywords.extend(["Data", "Bridge", "analytics"])
        if any(word in behavior_lower for word in ["outreach", "marketing", "email", "campaign"]):
            keywords.extend(["Reach", "Max", "outreach"])
        
        logger.info(f"Extracted product keywords: {keywords}")
        
        # Get product information from database using keywords
        db = get_db()
        products = get_products_by_keywords(db=db, keywords=keywords) if keywords else []
        db.close()
        
        # ENHANCED PRODUCT SCORING ALGORITHM
        # Scores products based on multiple factors:
        # 1. Keyword match count (primary)
        # 2. Keyword match location (name > value_prop > description)
        # 3. Department/industry alignment with target audience
        # 4. Archetype match
        if products:
            logger.info(f"Products found: {[p.get('name') for p in products]}")
            
            best_product = None
            best_score = 0
            
            # Get target context for better matching
            target_dept = top_prospects[0].get("department", "") if top_prospects else ""
            target_industry = top_prospects[0].get("industry", "") if top_prospects else ""
            
            for product in products:
                score = 0
                
                # Factor 1: Keyword matches (weighted by location)
                product_name = product.get('name', '').lower()
                product_value_prop = product.get('value_proposition', '').lower()
                product_desc = product.get('description', '').lower()
                product_benefits = product.get('key_benefits', '').lower()
                
                for keyword in keywords:
                    kw_lower = keyword.lower()
                    # Name match: 5 points (most important)
                    if kw_lower in product_name:
                        score += 5
                    # Value proposition match: 3 points
                    if kw_lower in product_value_prop:
                        score += 3
                    # Benefits match: 2 points
                    if kw_lower in product_benefits:
                        score += 2
                    # Description match: 1 point (least specific)
                    if kw_lower in product_desc:
                        score += 1
                
                # Factor 2: Target persona alignment (if we have prospect data)
                if target_dept:
                    product_persona = product.get('target_persona', '').lower()
                    if target_dept.lower() in product_persona:
                        score += 3
                        logger.debug(f"Product {product_name} matches target dept {target_dept}: +3")
                
                # Factor 3: Industry relevance (if product category matches industry)
                if target_industry:
                    product_category = product.get('category', '').lower()
                    if target_industry.lower() in product_category or product_category in target_industry.lower():
                        score += 2
                        logger.debug(f"Product {product_name} matches industry {target_industry}: +2")
                
                # Factor 4: Archetype match (extract from target_persona)
                if target_archetype:
                    archetype_lower = target_archetype.lower()
                    product_persona = product.get('target_persona', '').lower()
                    # Check if archetype contains key roles mentioned in product targeting
                    archetype_keywords = ["ceo", "cfo", "cmo", "cto", "ciso", "manager", "director", "vp"]
                    for ak in archetype_keywords:
                        if ak in archetype_lower and ak in product_persona:
                            score += 2
                            break
                
                logger.debug(f"Product '{product.get('name')}' scored {score} points")
                
                # Update best if this scores higher
                if score > best_score:
                    best_score = score
                    best_product = product
            
            # Use best match, or first if no keywords matched (fallback)
            if best_product and best_score > 0:
                product_info = best_product
                logger.info(f"Selected product '{product_info.get('name')}' with score {best_score}")
            else:
                product_info = products[0]
                logger.info(f"No strong match, using first product '{product_info.get('name')}'")
        else:
            logger.warning("No products found in database, generating realistic product based on user input")
            
            # Use LLM to generate a realistic product matching the user's business description
            product_info = generate_realistic_product(
                business_behavior=business_behavior,
                target_archetype=target_archetype,
                category=category
            )
        
        # ============================================================
        # GENERATE PERSONALIZED CONTENT FOR EACH PROSPECT
        # ============================================================
        personalized_content = []
        
        if not top_prospects:
            # No prospects, create one generic entry
            top_prospects = [{
                "id": "unknown",
                "name": "Prospect",
                "job_title": "Decision Maker",
                "company_name": "Company",
                "pain_points": ["Operational challenges", "Process inefficiencies"],
            }]
        
        logger.info(f"Generating content for {len(top_prospects)} prospects...")
        
        for prospect in top_prospects:
            prospect_id = prospect.get("id", "unknown")
            prospect_name = prospect.get("name", "Prospect")
            
            logger.info(f"Generating content for {prospect_name} (ID: {prospect_id})")
            
            try:
                # Generate prompt for this specific prospect
                prompt = get_content_prompt(
                    tone=tone,
                    cta_type=cta_type,
                    urgency_level=urgency_level,
                    target_archetype=target_archetype,
                    product_info=product_info,
                    prospect_sample=prospect,  # Use this specific prospect
                    sender_name=sender_name
                )
                
                # Get LLM with higher temperature for creative content
                llm = get_llm(temperature=TEMPERATURE_CONFIG["content_generator"])
                
                response = llm.invoke(prompt)
                response_text = response.content.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()
                
                # Parse JSON response
                content_data = json.loads(response_text)
                
                # Store personalized content for this prospect
                personalized_content.append({
                    "prospect_id": prospect_id,
                    "prospect_name": prospect_name,
                    "prospect_company": prospect.get("company_name", ""),
                    "prospect_job_title": prospect.get("job_title", ""),
                    "linkedin_message": content_data.get("linkedin_message", ""),
                    "email_message": content_data.get("email_message", {}),
                    "call_script": content_data.get("call_script", {}),
                })
                
                logger.info(f"Content generated successfully for {prospect_name}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response for {prospect_name}: {e}")
                logger.error(f"Response was: {response_text[:200]}...")
                
                # Create fallback content for this prospect
                personalized_content.append({
                    "prospect_id": prospect_id,
                    "prospect_name": prospect_name,
                    "prospect_company": prospect.get("company_name", ""),
                    "prospect_job_title": prospect.get("job_title", ""),
                    "linkedin_message": f"Hi {prospect_name.split()[0]}, I noticed you're in {target_archetype}. Would love to connect and share how we can help. Interested in a quick chat?",
                    "email_message": {
                        "subject": "Quick question about your workflows",
                        "body": f"Hi {prospect_name.split()[0]},\n\nI hope this email finds you well. I wanted to reach out because we work with similar companies to help optimize their operations.\n\nWould you be open to a brief conversation?\n\nBest regards,\n{sender_name}"
                    },
                    "call_script": {
                        "opener": f"Hi {prospect_name.split()[0]}, this is {sender_name} calling about optimizing your current workflows. Do you have a moment?",
                        "objections": [
                            "I understand you're busy. This will only take 2 minutes.",
                            "Many of our clients felt the same way initially.",
                            "No commitment needed, just exploring if there's a fit."
                        ],
                        "close": "Great! Let me send you a calendar invite for next week. Does Tuesday or Wednesday work better for you?"
                    },
                })
                
            except Exception as e:
                logger.error(f"Error generating content for {prospect_name}: {e}")
                
                # Create minimal fallback for this prospect
                personalized_content.append({
                    "prospect_id": prospect_id,
                    "prospect_name": prospect_name,
                    "prospect_company": prospect.get("company_name", ""),
                    "prospect_job_title": prospect.get("job_title", ""),
                    "linkedin_message": f"Hi {prospect_name.split()[0]}, Let's connect!",
                    "email_message": {"subject": "Following up", "body": f"Hi {prospect_name.split()[0]}, wanted to reach out. - {sender_name}"},
                    "call_script": {"opener": f"Hi {prospect_name.split()[0]}", "objections": ["I understand"], "close": "Thanks!"},
                })
        
        # ============================================================
        # BACKWARD COMPATIBILITY: Use first prospect's content
        # ============================================================
        first_content = personalized_content[0] if personalized_content else {
            "linkedin_message": "Let's connect!",
            "email_message": {"subject": "Following up", "body": "Hi, wanted to reach out."},
            "call_script": {"opener": "Hi there", "objections": ["I understand"], "close": "Thanks!"},
        }
        
        linkedin_message = first_content.get("linkedin_message", "")
        email_message = first_content.get("email_message", {})
        call_script = first_content.get("call_script", {})
        
        logger.info(f"Content generation successful for {len(personalized_content)} prospects")
        
        # Validate that content mentions key terms from business_behavior
        validation_keywords = []
        behavior_lower = business_behavior.lower()
        
        # Extract 2-3 most important keywords
        if "hr" in behavior_lower or "payroll" in behavior_lower:
            validation_keywords = ["hr", "payroll", "employee"]
        elif "security" in behavior_lower or "cyber" in behavior_lower:
            validation_keywords = ["security", "threat", "compliance"]
        elif "crm" in behavior_lower or "sales" in behavior_lower:
            validation_keywords = ["sales", "crm", "pipeline"]
        elif "data" in behavior_lower or "analytics" in behavior_lower:
            validation_keywords = ["data", "analytics", "reporting"]
        elif "marketing" in behavior_lower:
            validation_keywords = ["marketing", "campaign", "outreach"]
        
        # Check if content mentions at least ONE validation keyword
        if validation_keywords:
            content_text = f"{linkedin_message} {email_message.get('body', '')} {call_script.get('opener', '')}".lower()
            matches = [kw for kw in validation_keywords if kw in content_text]
            
            if not matches:
                logger.warning(f"Content validation failed: none of {validation_keywords} found in generated content")
                logger.warning("Content may be too generic or off-topic")
            else:
                logger.info(f"Content validation passed: found keywords {matches}")
        
        # Update state with personalized content + backward compatible fields
        return {
            **state,
            "personalized_content": personalized_content,  # NEW: List of personalized content
            "linkedin_message": linkedin_message,  # Legacy field
            "email_message": email_message,  # Legacy field
            "call_script": call_script,  # Legacy field
        }
        
    except Exception as e:
        logger.error(f"Critical error in content generation: {e}")
        
        # Return minimal fallback with personalized_content as empty list
        return {
            **state,
            "personalized_content": [],
            "linkedin_message": "Let's connect!",
            "email_message": {"subject": "Following up", "body": "Hi, wanted to reach out."},
            "call_script": {"opener": "Hi there", "objections": ["I understand"], "close": "Thanks!"},
        }