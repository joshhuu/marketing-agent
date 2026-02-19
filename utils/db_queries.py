"""
Helper functions for database queries
Provides common query patterns used by agents
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, Integer

from database import Prospect, Product, EngagementHistory, Classification

# Configure logging
logger = logging.getLogger(__name__)


def get_top_prospects_by_criteria(
    db: Session,
    industry: Optional[str] = None,
    department: Optional[str] = None,
    seniority: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    """
    Query top prospects based on ICP criteria
    
    Args:
        db: Database session
        industry: Filter by industry
        department: Filter by department
        seniority: Filter by seniority level (c_level, vp, director, manager, individual)
        location: Filter by location (country)
        limit: Maximum number of prospects to return
        
    Returns:
        List of prospect dictionaries
    """
    logger.info(f"Querying prospects: industry={industry}, dept={department}, seniority={seniority}, loc={location}")
    
    query = db.query(Prospect)
    
    # Apply filters
    filters = []
    if industry:
        filters.append(Prospect.industry.ilike(f"%{industry}%"))
    if department:
        filters.append(Prospect.department.ilike(f"%{department}%"))
    if seniority:
        filters.append(Prospect.seniority.ilike(f"%{seniority}%"))
    if location:
        filters.append(or_(
            Prospect.country.ilike(f"%{location}%"),
            Prospect.city.ilike(f"%{location}%")
        ))
    
    if filters:
        query = query.filter(and_(*filters))
    
    # Order by priority score and limit
    prospects = query.order_by(Prospect.priority_score.desc()).limit(limit).all()
    
    # Convert to dictionaries
    result = []
    for p in prospects:
        # Combine first and last name
        full_name = f"{p.first_name} {p.last_name}"
        
        # Handle JSONB fields
        pain_points_str = ""
        if p.pain_points:
            if isinstance(p.pain_points, list):
                pain_points_str = ", ".join(p.pain_points)
            elif isinstance(p.pain_points, dict):
                pain_points_str = str(p.pain_points)
            else:
                pain_points_str = str(p.pain_points)
        
        result.append({
            "id": str(p.id),
            "name": full_name,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "email": p.email,
            "phone": p.phone,
            "job_title": p.job_title,
            "seniority_level": p.seniority,
            "department": p.department,
            "company_name": p.company_name,
            "company_size": p.company_size,
            "industry": p.industry,
            "location": f"{p.city}, {p.country}" if p.city and p.country else (p.country or p.city or ""),
            "linkedin_url": p.linkedin_url,
            "icp_archetype": p.icp_archetype,
            "priority_score": p.priority_score or p.icp_score or 0.0,
            "pain_points": pain_points_str,
        })
    
    logger.info(f"Found {len(result)} prospects")
    return result


def get_channel_performance(
    db: Session,
    archetype: Optional[str] = None
) -> Dict[str, Dict[str, float]]:
    """
    Calculate performance metrics for each channel
    
    Args:
        db: Database session
        archetype: Filter by ICP archetype
        
    Returns:
        Dictionary with channel performance metrics
        {
            'linkedin': {'open_rate': 45.2, 'reply_rate': 12.3, 'count': 100},
            'email': {'open_rate': 32.1, 'reply_rate': 8.5, 'count': 150},
            'call': {'open_rate': 60.0, 'reply_rate': 25.0, 'count': 50}
        }
    """
    logger.info(f"Calculating channel performance for archetype={archetype}")
    
    query = db.query(
        EngagementHistory.channel,
        func.avg(func.cast(EngagementHistory.was_opened, Integer)) * 100,
        func.avg(func.cast(EngagementHistory.was_replied, Integer)) * 100,
        func.count(EngagementHistory.id)
    )
    
    # Join with prospects if archetype filter is needed
    if archetype:
        query = query.join(Prospect).filter(
            Prospect.icp_archetype.ilike(f"%{archetype}%")
        )
    
    query = query.group_by(EngagementHistory.channel)
    
    results = {}
    for channel, open_rate, reply_rate, count in query.all():
        results[channel] = {
            "open_rate": round(float(open_rate or 0), 2),
            "reply_rate": round(float(reply_rate or 0), 2),
            "count": count
        }
    
    logger.info(f"Channel performance: {results}")
    return results


def get_products_by_category(
    db: Session,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get products, optionally filtered by category
    
    Args:
        db: Database session
        category: Filter by product category
        
    Returns:
        List of product dictionaries
    """
    logger.info(f"Querying products: category={category}")
    
    query = db.query(Product)
    
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    
    products = query.all()
    
    result = []
    for p in products:
        # Handle JSONB fields
        key_benefits_str = ""
        if p.key_benefits:
            if isinstance(p.key_benefits, list):
                key_benefits_str = ", ".join(str(b) for b in p.key_benefits)
            elif isinstance(p.key_benefits, dict):
                key_benefits_str = ", ".join(f"{k}: {v}" for k, v in p.key_benefits.items())
            else:
                key_benefits_str = str(p.key_benefits)
        
        target_persona_str = "B2B Decision Makers"
        if p.target_seniority:
            if isinstance(p.target_seniority, list):
                target_persona_str = ", ".join(str(s) for s in p.target_seniority)
        
        result.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "description": p.description,
            "key_benefits": key_benefits_str,
            "value_proposition": p.value_proposition,
            "target_persona": target_persona_str,
            "pricing_tier": p.price_model,
            "cta_primary": p.cta_primary,
            "cta_secondary": p.cta_secondary,
        })
    
    logger.info(f"Found {len(result)} products")
    return result


def get_products_by_keywords(
    db: Session,
    keywords: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Get products by matching keywords in name, description, or benefits
    
    Args:
        db: Database session
        keywords: List of keywords to search for
        
    Returns:
        List of product dictionaries
    """
    logger.info(f"Querying products with keywords: {keywords}")
    
    query = db.query(Product)
    
    if keywords:
        # Build OR conditions for each keyword
        conditions = []
        for keyword in keywords:
            conditions.append(Product.name.ilike(f"%{keyword}%"))
            conditions.append(Product.description.ilike(f"%{keyword}%"))
            conditions.append(Product.value_proposition.ilike(f"%{keyword}%"))
        
        query = query.filter(or_(*conditions))
    
    products = query.limit(5).all()
    
    # Convert to dictionaries (same format as get_products_by_category)
    result = []
    for p in products:
        # Handle JSONB fields
        key_benefits_str = ""
        if p.key_benefits:
            if isinstance(p.key_benefits, list):
                key_benefits_str = ", ".join(str(b) for b in p.key_benefits)
            elif isinstance(p.key_benefits, dict):
                key_benefits_str = ", ".join(f"{k}: {v}" for k, v in p.key_benefits.items())
            else:
                key_benefits_str = str(p.key_benefits)
        
        target_persona_str = "B2B Decision Makers"
        if p.target_seniority:
            if isinstance(p.target_seniority, list):
                target_persona_str = ", ".join(str(s) for s in p.target_seniority)
        
        result.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "description": p.description,
            "key_benefits": key_benefits_str,
            "value_proposition": p.value_proposition,
            "target_persona": target_persona_str,
            "pricing_tier": p.price_model,
            "cta_primary": p.cta_primary,
            "cta_secondary": p.cta_secondary,
        })
    
    logger.info(f"Found {len(result)} products")
    return result


def save_classification(
    db: Session,
    prompt_text: str,
    category: str,
    confidence: float,
    time: Optional[str] = None,
    location: Optional[str] = None,
    business_behavior: Optional[str] = None,
    user_intent: Optional[str] = None
) -> Classification:
    """
    Save classification result to database
    
    Args:
        db: Database session
        prompt_text: Original user prompt (not stored in new schema)
        category: Classified category
        confidence: Confidence score
        time: Extracted time field
        location: Extracted location
        business_behavior: Extracted business behavior
        user_intent: Extracted user intent
        
    Returns:
        Created Classification object
    """
    logger.info(f"Saving classification: category={category}, confidence={confidence}")
    
    classification = Classification(
        category=category,
        confidence=confidence,
        time_context=time,
        location=location,
        business_behavior=business_behavior,
        user_intent=user_intent
    )
    
    db.add(classification)
    db.commit()
    db.refresh(classification)
    
    logger.info(f"Classification saved with ID={classification.id}")
    return classification


# ========================================================================
# ENGAGEMENT INTELLIGENCE FUNCTIONS (NEW)
# ========================================================================

def get_prospect_engagement_summary(
    db: Session,
    prospect_id: str
) -> Dict[str, Any]:
    """
    Get engagement history summary for a specific prospect
    
    Args:
        db: Database session
        prospect_id: Prospect UUID
        
    Returns:
        Dictionary with engagement metrics:
        - last_contacted: datetime of last contact
        - days_since_contact: days elapsed
        - open_rate: % of messages opened
        - reply_rate: % of messages replied to
        - preferred_channel: channel with best performance
        - best_send_time: time with best engagement
        - total_interactions: count of past interactions
        - last_outcome: outcome of last contact
    """
    try:
        # Query engagement history for this prospect
        engagements = db.query(EngagementHistory).filter(
            EngagementHistory.prospect_id == prospect_id
        ).order_by(EngagementHistory.sent_at.desc()).all()
        
        if not engagements:
            # No history - return defaults
            return {
                "last_contacted": None,
                "days_since_contact": 999,
                "open_rate": 0.0,
                "reply_rate": 0.0,
                "preferred_channel": "email",
                "best_send_time": "09:00",
                "total_interactions": 0,
                "last_outcome": "unknown",
            }
        
        # Calculate metrics
        last_contact = engagements[0].sent_at
        days_since = (datetime.now() - last_contact).days if last_contact else 999
        
        total = len(engagements)
        opened = sum(1 for e in engagements if e.was_opened)
        replied = sum(1 for e in engagements if e.was_replied)
        
        open_rate = (opened / total * 100) if total > 0 else 0.0
        reply_rate = (replied / total * 100) if total > 0 else 0.0
        
        # Find preferred channel (most successful)
        channel_performance = {}
        for eng in engagements:
            channel = eng.channel
            if channel not in channel_performance:
                channel_performance[channel] = {"opened": 0, "total": 0}
            
            channel_performance[channel]["total"] += 1
            if eng.was_opened:
                channel_performance[channel]["opened"] += 1
        
        # Calculate success rate per channel
        best_channel = "email"
        best_rate = 0.0
        for channel, stats in channel_performance.items():
            rate = stats["opened"] / stats["total"] if stats["total"] > 0 else 0
            if rate > best_rate:
                best_rate = rate
                best_channel = channel
        
        # Determine last outcome
        last_outcome = "unknown"
        if engagements[0].was_replied:
            last_outcome = "replied"
        elif engagements[0].was_opened:
            last_outcome = "opened"
        else:
            last_outcome = "no_response"
        
        # TODO: Calculate best send time from engagement timestamps
        # For now, default to morning
        best_send_time = "09:00"
        
        return {
            "last_contacted": last_contact,
            "days_since_contact": days_since,
            "open_rate": round(open_rate, 2),
            "reply_rate": round(reply_rate, 2),
            "preferred_channel": best_channel,
            "best_send_time": best_send_time,
            "total_interactions": total,
            "last_outcome": last_outcome,
        }
        
    except Exception as e:
        logger.error(f"Error getting engagement summary for prospect {prospect_id}: {e}")
        # Return safe defaults on error
        return {
            "last_contacted": None,
            "days_since_contact": 999,
            "open_rate": 0.0,
            "reply_rate": 0.0,
            "preferred_channel": "email",
            "best_send_time": "09:00",
            "total_interactions": 0,
            "last_outcome": "unknown",
        }


def calculate_engagement_score(
    open_rate: float,
    reply_rate: float,
    days_since_contact: int,
    total_interactions: int
) -> float:
    """
    Calculate overall engagement score (0-100)
    
    Scoring logic:
    - Reply rate: 40 points (most important)
    - Open rate: 30 points
    - Recency: 20 points (higher score if contacted recently but not too recent)
    - Volume: 10 points (more interactions = better understanding)
    
    Args:
        open_rate: Percentage of opens (0-100)
        reply_rate: Percentage of replies (0-100)
        days_since_contact: Days since last contact
        total_interactions: Total number of interactions
        
    Returns:
        Engagement score between 0-100
    """
    score = 0.0
    
    # Reply rate contribution (0-40 points)
    # 100% reply rate = 40 points, 0% = 0 points
    score += (reply_rate / 100) * 40
    
    # Open rate contribution (0-30 points)
    score += (open_rate / 100) * 30
    
    # Recency contribution (0-20 points)
    # Sweet spot: 30-90 days ago (engaged but not burned out)
    if days_since_contact < 7:
        recency_score = 0  # Too recent, don't boost score
    elif days_since_contact <= 30:
        recency_score = 15  # Recent, good
    elif days_since_contact <= 90:
        recency_score = 20  # Sweet spot
    elif days_since_contact <= 180:
        recency_score = 10  # Cooling off
    else:
        recency_score = 5  # Cold, but at least we can try
    
    score += recency_score
    
    # Volume contribution (0-10 points)
    # More interactions = better data
    if total_interactions >= 10:
        volume_score = 10
    elif total_interactions >= 5:
        volume_score = 7
    elif total_interactions >= 2:
        volume_score = 4
    elif total_interactions >= 1:
        volume_score = 2
    else:
        volume_score = 10  # No history = neutral, allow contact
    
    score += volume_score
    
    return round(min(score, 100.0), 2)


def check_contact_allowed(
    days_since_contact: int,
    last_outcome: str,
    min_days: int = 7
) -> bool:
    """
    Determine if we should contact this prospect based on recency and last outcome
    
    Business rules:
    - If never contacted: Allow
    - If last outcome was 'replied': Wait 14 days minimum
    - If last outcome was 'opened' but no reply: Wait 7 days
    - If last outcome was 'no_response': Wait 5 days
    - Override with min_days parameter if specified
    
    Args:
        days_since_contact: Days since last contact
        last_outcome: 'replied', 'opened', 'no_response', 'unknown'
        min_days: Minimum days to wait (default 7)
        
    Returns:
        True if contact allowed, False otherwise
    """
    # Never contacted = always allow
    if days_since_contact >= 900:  # Effectively infinite
        return True
    
    # Apply outcome-based rules
    if last_outcome == "replied":
        # They engaged! Give them breathing room
        required_days = max(min_days, 14)
    elif last_outcome == "opened":
        # They looked but didn't reply - normal cadence
        required_days = max(min_days, 7)
    elif last_outcome == "no_response":
        # No engagement - can try again sooner
        required_days = max(min_days, 5)
    else:
        # Unknown - use min_days
        required_days = min_days
    
    return days_since_contact >= required_days


def record_campaign_result(
    db: Session,
    prospect_id: str,
    channel: str,
    category: str,
    archetype: str,
    tone: str,
    cta_type: str,
    was_opened: bool = False,
    was_replied: bool = False,
    outcome_notes: Optional[str] = None
) -> EngagementHistory:
    """
    Record campaign result for learning and optimization
    
    This function logs what happened after content was sent so the system can learn:
    - Which strategies work for which archetypes
    - Which channels perform best
    - Which CTAs get the most engagement
    
    Args:
        db: Database session
        prospect_id: Prospect UUID
        channel: 'email', 'linkedin', 'call'
        category: Campaign category (from classifier)
        archetype: Target archetype
        tone: Tone used
        cta_type: CTA type used
        was_opened: Whether message was opened
        was_replied: Whether prospect replied
        outcome_notes: Additional notes about outcome
        
    Returns:
        Created EngagementHistory object
    """
    logger.info(
        f"Recording campaign result: prospect={prospect_id}, channel={channel}, "
        f"opened={was_opened}, replied={was_replied}"
    )
    
    try:
        # Store campaign metadata in content_type field as JSON
        # Format: category|archetype|tone|cta
        metadata = f"{category}|{archetype}|{tone}|{cta_type}"
        
        engagement = EngagementHistory(
            prospect_id=prospect_id,
            channel=channel,
            sent_at=datetime.now(),
            was_opened=was_opened,
            was_replied=was_replied,
            content_type=metadata  # Store metadata here for now
        )
        
        db.add(engagement)
        db.commit()
        db.refresh(engagement)
        
        logger.info(f"Campaign result recorded with ID={engagement.id}")
        return engagement
        
    except Exception as e:
        logger.error(f"Error recording campaign result: {e}")
        db.rollback()
        raise


def get_best_performing_strategies(
    db: Session,
    archetype: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get historically successful strategies for an archetype/channel combination
    
    Analyzes past engagement_history to find winning patterns.
    Returns strategies (tone, cta, timing) that got the best reply rates.
    
    Args:
        db: Database session
        archetype: Filter by target archetype
        channel: Filter by channel
        limit: Number of top strategies to return
        
    Returns:
        List of strategy dictionaries with performance metrics
    """
    logger.info(f"Querying best strategies for archetype={archetype}, channel={channel}")
    
    try:
        # Query successful engagements (replied = True)
        query = db.query(EngagementHistory).filter(
            EngagementHistory.was_replied == True
        )
        
        if channel:
            query = query.filter(EngagementHistory.channel == channel)
        
        successes = query.limit(100).all()
        
        if not successes:
            logger.info("No successful engagements found")
            return []
        
        # Parse content_type to extract strategy patterns
        # Format: "category|archetype|tone|cta"
        strategies = {}
        
        for eng in successes:
            if not eng.content_type or '|' not in eng.content_type:
                continue
            
            parts = eng.content_type.split("|")
            if len(parts) < 4:
                continue
                
            strategy_key = eng.content_type  # Full strategy string
            
            if strategy_key not in strategies:
                strategies[strategy_key] = {
                    "count": 0,
                    "opened": 0,
                    "replied": 0,
                    "strategy": strategy_key
                }
            
            strategies[strategy_key]["count"] += 1
            if eng.was_opened:
                strategies[strategy_key]["opened"] += 1
            if eng.was_replied:
                strategies[strategy_key]["replied"] += 1
        
        # Calculate success rates and sort
        results = []
        for key, stats in strategies.items():
            reply_rate = (stats["replied"] / stats["count"] * 100) if stats["count"] > 0 else 0
            
            results.append({
                "strategy": key,
                "reply_rate": round(reply_rate, 2),
                "sample_size": stats["count"],
                "total_replies": stats["replied"],
            })
        
        # Sort by reply rate
        results.sort(key=lambda x: x["reply_rate"], reverse=True)
        
        logger.info(f"Found {len(results)} strategy patterns")
        return results[:limit]
        
    except Exception as e:
        logger.error(f"Error getting best strategies: {e}")
        return []