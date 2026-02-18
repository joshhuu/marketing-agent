"""
Helper functions for database queries
Provides common query patterns used by agents
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, Integer

from database import Prospect, Product, EngagementHistory, Classification

# Configure logging
logger = logging.getLogger(__name__)


def get_top_prospects_by_criteria(
    db: Session,
    industry: Optional[str] = None,
    department: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    """
    Query top prospects based on ICP criteria
    
    Args:
        db: Database session
        industry: Filter by industry
        department: Filter by department
        location: Filter by location (country)
        limit: Maximum number of prospects to return
        
    Returns:
        List of prospect dictionaries
    """
    logger.info(f"Querying prospects: industry={industry}, dept={department}, loc={location}")
    
    query = db.query(Prospect)
    
    # Apply filters
    filters = []
    if industry:
        filters.append(Prospect.industry.ilike(f"%{industry}%"))
    if department:
        filters.append(Prospect.department.ilike(f"%{department}%"))
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