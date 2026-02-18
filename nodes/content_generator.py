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


def generate_content(state: AgentState) -> Dict[str, Any]:
    """
    Generate personalized content for LinkedIn, Email, and Call
    
    Args:
        state: Current agent state with all previous data
        
    Returns:
        Updated state with: linkedin_message, email_message, call_script
    """
    tone = state.get("tone", "professional")
    cta_type = state.get("cta_type", "book_demo")
    urgency_level = state.get("urgency_level", "medium")
    target_archetype = state.get("target_archetype", "")
    category = state.get("category", "")
    business_behavior = state.get("business_behavior", "")
    top_prospects = state.get("top_prospects", [])
    
    logger.info(f"Generating content: tone={tone}, cta={cta_type}")
    
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
        
        # Use first product or create default based on business_behavior
        if products:
            product_info = products[0]
            logger.info(f"Using product: {product_info.get('name', 'Unknown')}")
        else:
            logger.warning("No products found, creating context-aware default")
            
            # Create a more contextual default based on business_behavior
            if "security" in behavior_lower or "cyber" in behavior_lower:
                product_info = {
                    "name": "Your Cybersecurity Solution",
                    "value_proposition": "Reduce security risks and automate compliance reporting",
                    "key_benefits": ["Real-time threat detection", "Automated compliance", "24/7 monitoring"],
                    "cta_primary": "Request Security Assessment",
                    "cta_secondary": "Download Security Report",
                }
            elif "hr" in behavior_lower or "payroll" in behavior_lower:
                product_info = {
                    "name": "Your HR Platform",
                    "value_proposition": "Streamline payroll and reduce HR admin time",
                    "key_benefits": ["Automated payroll", "Self-service onboarding", "Compliance tracking"],
                    "cta_primary": "Schedule Demo",
                    "cta_secondary": "See Features",
                }
            else:
                product_info = {
                    "name": "Your Solution",
                    "value_proposition": "Streamline operations and boost productivity",
                    "key_benefits": ["Save time", "Reduce costs", "Improve efficiency"],
                    "cta_primary": "Schedule a Demo",
                    "cta_secondary": "Learn More",
                }
        
        # Get sample prospect for personalization
        prospect_sample = {}
        if top_prospects:
            prospect_sample = top_prospects[0]
        else:
            prospect_sample = {
                "name": "Prospect",
                "job_title": "Decision Maker",
                "company_name": "Company",
                "pain_points": ["Operational challenges", "Process inefficiencies"],
            }
        
        # Generate prompt
        prompt = get_content_prompt(
            tone=tone,
            cta_type=cta_type,
            urgency_level=urgency_level,
            target_archetype=target_archetype,
            product_info=product_info,
            prospect_sample=prospect_sample  # Pass this for context
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
        
        linkedin_message = content_data.get("linkedin_message", "")
        email_message = content_data.get("email_message", {})
        call_script = content_data.get("call_script", {})
        
        logger.info("Content generation successful")
        
        # Update state
        return {
            **state,
            "linkedin_message": linkedin_message,
            "email_message": email_message,
            "call_script": call_script,
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response was: {response_text[:200]}...")
        
        # Create fallback content
        return {
            **state,
            "linkedin_message": f"Hi, I noticed you're in {target_archetype}. Would love to connect and share how we can help. Interested in a quick chat?",
            "email_message": {
                "subject": "Quick question about your workflows",
                "body": "Hi,\n\nI hope this email finds you well. I wanted to reach out because we work with similar companies to help optimize their operations.\n\nWould you be open to a brief conversation?\n\nBest regards"
            },
            "call_script": {
                "opener": "Hi, this is calling about optimizing your current workflows. Do you have a moment?",
                "objections": [
                    "I understand you're busy. This will only take 2 minutes.",
                    "Many of our clients felt the same way initially.",
                    "No commitment needed, just exploring if there's a fit."
                ],
                "close": "Great! Let me send you a calendar invite for next week. Does Tuesday or Wednesday work better for you?"
            },
        }
    except Exception as e:
        logger.error(f"Error in content generation: {e}")
        
        # Return minimal fallback
        return {
            **state,
            "linkedin_message": "Let's connect!",
            "email_message": {"subject": "Following up", "body": "Hi, wanted to reach out."},
            "call_script": {"opener": "Hi there", "objections": ["I understand"], "close": "Thanks!"},
        }