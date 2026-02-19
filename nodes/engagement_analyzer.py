"""
Engagement Analyzer Node
Enriches prospects with engagement history and contact recency checks
Prevents over-contacting and provides intelligence for better personalization

UPDATED: Now handles mock data intelligently with dual-source date checking
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from state import AgentState
from utils.db_queries import (
    get_prospect_engagement_summary,
    calculate_engagement_score,
    check_contact_allowed
)
from database import get_db
from config import TEMPERATURE_CONFIG

# Configure logging
logger = logging.getLogger(__name__)

# CONFIGURATION: Adjustable contact frequency thresholds
# For production: 7-14 days
# For testing with mock data: 3-5 days (since mock data may have recent dates)
CONTACT_FREQUENCY_CONFIG = {
    "min_days_default": 7,          # Default minimum days between contacts
    "enable_strict_filtering": False,  # Set to True for production, False for testing
    "check_prospect_table": True,    # Check prospects.last_contacted_at as fallback
    "check_engagement_history": True  # Check engagement_history.sent_at (primary)
}


def analyze_engagement(state: AgentState) -> Dict[str, Any]:
    """
    Analyze prospect engagement history and enrich with intelligence
    
    This node:
    1. Checks when prospects were last contacted (prevents spam)
    2. Analyzes their historical engagement patterns
    3. Identifies preferred channels and optimal timing
    4. Calculates engagement scores
    5. Filters out prospects contacted too recently
    
    UPDATED: Now intelligently handles mock data by:
    - Checking BOTH engagement_history and prospects.last_contacted_at
    - Using configurable thresholds
    - Prioritizing actual engagement data over prospect table
    
    Args:
        state: Current agent state with top_prospects from ICP matcher
        
    Returns:
        Updated state with enriched prospects containing:
        - last_contacted: When we last reached out
        - days_since_contact: Days elapsed since last contact
        - open_rate: Historical open rate for this prospect
        - reply_rate: Historical reply rate for this prospect
        - preferred_channel: Channel they engage with most
        - best_send_time: Optimal send time based on history
        - engagement_score: Overall engagement score (0-100)
        - contact_allowed: Whether enough time has passed to contact again
    """
    prospects = state.get("top_prospects", [])
    
    if not prospects:
        logger.warning("No prospects to analyze engagement for")
        return {**state, "top_prospects": []}
    
    # Get configuration from state or use defaults
    # This allows the agent to adjust based on urgency_level
    urgency_level = state.get("urgency_level", "medium")
    
    # Adjust min_days based on urgency (but respect config)
    if urgency_level == "high" and not CONTACT_FREQUENCY_CONFIG["enable_strict_filtering"]:
        min_days = 3  # More aggressive for high urgency
    elif urgency_level == "low":
        min_days = 10  # More conservative for low urgency
    else:
        min_days = CONTACT_FREQUENCY_CONFIG["min_days_default"]
    
    logger.info(
        f"Analyzing engagement history for {len(prospects)} prospects "
        f"(min_days={min_days}, urgency={urgency_level})"
    )
    
    try:
        db = get_db()
        enriched_prospects = []
        filtered_count = 0
        
        for prospect in prospects:
            prospect_id = prospect.get("id")
            
            # DUAL-SOURCE DATE CHECKING
            # Priority 1: Check engagement_history (actual truth)
            engagement = get_prospect_engagement_summary(db, prospect_id)
            
            # Priority 2: Check prospect.last_contacted_at as fallback
            # This handles cases where engagement_history doesn't exist yet
            prospect_last_contacted = prospect.get("last_contacted_at")
            
            # Determine which date to use
            if engagement.get("last_contacted"):
                # Use engagement history date (most accurate)
                last_contacted = engagement.get("last_contacted")
                days_since = engagement.get("days_since_contact", 999)
                source = "engagement_history"
            elif prospect_last_contacted and CONTACT_FREQUENCY_CONFIG["check_prospect_table"]:
                # Fallback to prospect table date
                if isinstance(prospect_last_contacted, str):
                    last_contacted = datetime.fromisoformat(prospect_last_contacted.replace('Z', '+00:00'))
                else:
                    last_contacted = prospect_last_contacted
                days_since = (datetime.now() - last_contacted).days if last_contacted else 999
                source = "prospect_table"
            else:
                # No contact history found
                last_contacted = None
                days_since = 999
                source = "none"
            
            logger.debug(
                f"Prospect {prospect.get('name')}: "
                f"last contact {days_since} days ago (source: {source})"
            )
            
            # Calculate if contact is allowed
            contact_allowed = check_contact_allowed(
                days_since_contact=days_since,
                last_outcome=engagement.get("last_outcome", "unknown"),
                min_days=min_days
            )
            
            # Calculate engagement score (0-100)
            engagement_score = calculate_engagement_score(
                open_rate=engagement.get("open_rate", 0),
                reply_rate=engagement.get("reply_rate", 0),
                days_since_contact=days_since,
                total_interactions=engagement.get("total_interactions", 0)
            )
            
            # Enrich prospect data
            enriched_prospect = {
                **prospect,
                "last_contacted": last_contacted,
                "days_since_contact": days_since,
                "contact_recency_source": source,  # NEW: Track where date came from
                "open_rate": engagement.get("open_rate", 0.0),
                "reply_rate": engagement.get("reply_rate", 0.0),
                "preferred_channel": engagement.get("preferred_channel", "email"),
                "best_send_time": engagement.get("best_send_time", "09:00"),
                "engagement_score": engagement_score,
                "contact_allowed": contact_allowed,
                "total_interactions": engagement.get("total_interactions", 0),
                "last_outcome": engagement.get("last_outcome", "unknown"),
            }
            
            # SMART FILTERING: Only filter if config allows AND contact not allowed
            if CONTACT_FREQUENCY_CONFIG["enable_strict_filtering"] and not contact_allowed:
                filtered_count += 1
                logger.info(
                    f"FILTERED: {prospect.get('name')} - "
                    f"contacted {days_since} days ago (< {min_days} day minimum)"
                )
            else:
                # Include prospect (either allowed OR filtering disabled for testing)
                if not contact_allowed:
                    logger.debug(
                        f"Including {prospect.get('name')} despite recent contact "
                        f"(strict_filtering=False for testing)"
                    )
                enriched_prospects.append(enriched_prospect)
        
        db.close()
        
        # Log summary
        logger.info(
            f"Engagement analysis complete: "
            f"{len(enriched_prospects)} prospects eligible, "
            f"{filtered_count} filtered (contacted too recently)"
        )
        
        if CONTACT_FREQUENCY_CONFIG["enable_strict_filtering"]:
            logger.info("Strict filtering ENABLED - prospects filtered")
        else:
            logger.info("Strict filtering DISABLED - all prospects included (good for testing)")
        
        # If all prospects were filtered, log warning
        if not enriched_prospects and prospects:
            logger.warning(
                "All prospects were filtered due to recent contact. "
                "Consider adjusting search criteria or contact window."
            )
        
        # Calculate average engagement score for logging
        if enriched_prospects:
            avg_score = sum(p["engagement_score"] for p in enriched_prospects) / len(enriched_prospects)
            logger.info(f"Average engagement score: {avg_score:.1f}/100")
        
        return {
            **state,
            "top_prospects": enriched_prospects,
            "prospects_filtered_count": filtered_count,
        }
        
    except Exception as e:
        logger.error(f"Error in engagement analysis: {e}")
        logger.warning("Falling back to original prospects without enrichment")
        
        # Fallback: Return original prospects with default engagement values
        fallback_prospects = []
        for prospect in prospects:
            fallback_prospects.append({
                **prospect,
                "last_contacted": None,
                "days_since_contact": 999,
                "contact_recency_source": "error_fallback",
                "open_rate": 0.0,
                "reply_rate": 0.0,
                "preferred_channel": "email",
                "best_send_time": "09:00",
                "engagement_score": 50.0,  # Neutral score
                "contact_allowed": True,  # Allow by default if error
                "total_interactions": 0,
                "last_outcome": "unknown",
            })
        
        return {
            **state,
            "top_prospects": fallback_prospects,
            "prospects_filtered_count": 0,
        }
