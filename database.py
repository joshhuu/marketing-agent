"""
SQLAlchemy models and database session management
Defines models for prospects, products, engagement_history, and classifications
"""
import logging
import uuid
from datetime import datetime
from typing import Generator

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

from config import DATABASE_URL

# Configure logging
logger = logging.getLogger(__name__)

# Create base class for declarative models
Base = declarative_base()

# Create engine
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Prospect(Base):
    """Model for prospects table"""
    __tablename__ = "prospects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50))
    linkedin_url = Column(String(255))
    
    company_name = Column(String(200), nullable=False)
    job_title = Column(String(150), nullable=False)
    seniority = Column(String(50), nullable=False)
    department = Column(String(100), nullable=False)
    industry = Column(String(100), nullable=False)
    company_size = Column(String(30))
    
    country = Column(String(100))
    city = Column(String(100))
    timezone = Column(String(50))
    
    icp_archetype = Column(String(100))
    icp_score = Column(Float)
    priority_score = Column(Float)
    is_decision_maker = Column(Boolean, default=False)
    
    preferred_channel = Column(String(30))
    best_contact_time = Column(String(50))
    
    email_open_rate = Column(Float)
    linkedin_click_rate = Column(Float)
    call_answer_rate = Column(Float)
    times_contacted = Column(Integer, default=0)
    last_contacted_at = Column(DateTime)
    
    pain_points = Column(JSONB)
    interests = Column(JSONB)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    engagements = relationship("EngagementHistory", back_populates="prospect")


class Product(Base):
    """Model for products table"""
    __tablename__ = "products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text)
    
    target_industries = Column(JSONB)
    target_seniority = Column(JSONB)
    
    key_benefits = Column(JSONB)
    value_proposition = Column(Text)
    cta_primary = Column(String(100))
    cta_secondary = Column(String(100))
    
    price_model = Column(String(50))
    price_from_usd = Column(Float)
    trial_available = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    engagements = relationship("EngagementHistory", back_populates="product")


class EngagementHistory(Base):
    """Model for engagement_history table"""
    __tablename__ = "engagement_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id = Column(UUID(as_uuid=True), ForeignKey("prospects.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    
    channel = Column(String(30), nullable=False)
    content_type = Column(String(50))
    subject = Column(String(255))
    sent_at = Column(DateTime, nullable=False)
    
    was_opened = Column(Boolean, default=False)
    was_clicked = Column(Boolean, default=False)
    was_replied = Column(Boolean, default=False)
    reply_sentiment = Column(String(30))
    was_converted = Column(Boolean, default=False)
    
    day_of_week = Column(String(15))
    time_of_day = Column(String(30))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    prospect = relationship("Prospect", back_populates="engagements")
    product = relationship("Product", back_populates="engagements")


class Classification(Base):
    """Model for classifications table"""
    __tablename__ = "classifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time_context = Column(String(100))
    location = Column(String(100))
    business_behavior = Column(Text)
    user_intent = Column(Text)
    
    category = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    
    tone = Column(String(50))
    cta_type = Column(String(50))
    urgency_level = Column(String(30))
    
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db_session() -> Generator[Session, None, None]:
    """
    Create and yield a database session
    Ensures proper cleanup after use
    
    Usage:
        with next(get_db_session()) as session:
            # Use session here
    
    Returns:
        Generator yielding database session
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def get_db() -> Session:
    """
    Get a database session (simplified version)
    Remember to close the session after use
    
    Returns:
        Database session
    """
    return SessionLocal()
