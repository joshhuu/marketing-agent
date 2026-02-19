"""
FINAL Multi-Agent System Database Seeder
=========================================
Simplified, production-ready schema aligned with Assessment Task 2.

4 Tables:
  - prospects (500 rows)      → Agent 2 (ICP Module) queries this
  - products (20 rows)         → Agent 4 (Content Gen) uses this
  - engagement_history (2000)  → Agent 3 (Platform) learns from this
  - classifications (50)       → Agent 1 audit trail

SETUP:
  pip install faker psycopg2-binary sqlalchemy

USAGE:
  createdb mas_db
  python seed_final.py
"""

import random
import json
import uuid
import csv
import os
from datetime import datetime, timedelta

from faker import Faker
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean,
    DateTime, Text, ForeignKey, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship, Session

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
DB_URL = "postgresql://postgres:12345@localhost:5433/mas_db"

fake = Faker()
Faker.seed(42)
random.seed(42)

Base = declarative_base()


# ═══════════════════════════════════════════════
# SCHEMA
# ═══════════════════════════════════════════════

class Prospect(Base):
    """Individual leads/prospects - Agent 2 queries this for ICP matching"""
    __tablename__ = "prospects"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name          = Column(String(100), nullable=False)
    last_name           = Column(String(100), nullable=False)
    email               = Column(String(255), unique=True, nullable=False)
    phone               = Column(String(50))
    linkedin_url        = Column(String(255))
    
    company_name        = Column(String(200), nullable=False)
    job_title           = Column(String(150), nullable=False)
    seniority           = Column(String(50), nullable=False)
    department          = Column(String(100), nullable=False)
    industry            = Column(String(100), nullable=False)
    company_size        = Column(String(30))
    
    country             = Column(String(100))
    city                = Column(String(100))
    timezone            = Column(String(50))
    
    icp_archetype       = Column(String(100))
    icp_score           = Column(Float)
    priority_score      = Column(Float)
    is_decision_maker   = Column(Boolean, default=False)
    
    preferred_channel   = Column(String(30))
    best_contact_time   = Column(String(50))
    
    email_open_rate     = Column(Float)
    linkedin_click_rate = Column(Float)
    call_answer_rate    = Column(Float)
    times_contacted     = Column(Integer, default=0)
    last_contacted_at   = Column(DateTime)
    
    pain_points         = Column(JSONB)
    interests           = Column(JSONB)
    
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow)

    engagements = relationship("EngagementHistory", back_populates="prospect")


class Product(Base):
    """Products being sold - Agent 4 uses this for content generation"""
    __tablename__ = "products"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                = Column(String(200), nullable=False)
    category            = Column(String(100), nullable=False)
    description         = Column(Text)
    
    target_industries   = Column(JSONB)
    target_seniority    = Column(JSONB)
    
    key_benefits        = Column(JSONB)
    value_proposition   = Column(Text)
    cta_primary         = Column(String(100))
    cta_secondary       = Column(String(100))
    
    price_model         = Column(String(50))
    price_from_usd      = Column(Float)
    trial_available     = Column(Boolean, default=False)
    
    created_at          = Column(DateTime, default=datetime.utcnow)

    engagements = relationship("EngagementHistory", back_populates="product")


class EngagementHistory(Base):
    """Historical interactions - Agent 3 learns which channel works best"""
    __tablename__ = "engagement_history"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id     = Column(UUID(as_uuid=True), ForeignKey("prospects.id"), nullable=False)
    product_id      = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    
    channel         = Column(String(30), nullable=False)
    content_type    = Column(String(50))
    subject         = Column(String(255))
    sent_at         = Column(DateTime, nullable=False)
    
    was_opened      = Column(Boolean, default=False)
    was_clicked     = Column(Boolean, default=False)
    was_replied     = Column(Boolean, default=False)
    reply_sentiment = Column(String(30))
    was_converted   = Column(Boolean, default=False)
    
    day_of_week     = Column(String(15))
    time_of_day     = Column(String(30))
    
    created_at      = Column(DateTime, default=datetime.utcnow)

    prospect = relationship("Prospect", back_populates="engagements")
    product  = relationship("Product", back_populates="engagements")


class Classification(Base):
    """Agent 1 classifications - audit trail"""
    __tablename__ = "classifications"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time_context        = Column(String(100))
    location            = Column(String(100))
    business_behavior   = Column(Text)
    user_intent         = Column(Text)
    
    category            = Column(String(100), nullable=False)
    confidence          = Column(Float, nullable=False)
    
    tone                = Column(String(50))
    cta_type            = Column(String(50))
    urgency_level       = Column(String(30))
    
    created_at          = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════
# LOOKUP DATA
# ═══════════════════════════════════════════════

INDUSTRIES = ["Technology", "Finance", "Healthcare", "Retail", "Manufacturing",
              "Professional Services", "Education", "Media", "Real Estate", "Logistics"]

SENIORITY_LEVELS = {
    "c_level":    ["CEO", "CTO", "CFO", "COO", "CMO", "CISO"],
    "vp":         ["VP of Sales", "VP of Engineering", "VP of Marketing", "VP of Product"],
    "director":   ["Director of Sales", "Director of IT", "Director of Marketing"],
    "manager":    ["Sales Manager", "Product Manager", "Marketing Manager", "IT Manager"],
    "individual": ["Software Engineer", "Account Executive", "Business Analyst"],
}

DEPARTMENTS = ["Sales", "Engineering", "Marketing", "Product", "Finance",
               "Operations", "IT", "HR", "Customer Success"]

ARCHETYPES = {
    "c_level":    ["Enterprise_CEO", "Tech_CTO", "Finance_CFO"],
    "vp":         ["Sales_VP", "Engineering_VP", "Marketing_VP"],
    "director":   ["Sales_Director", "IT_Director"],
    "manager":    ["SMB_Manager", "Mid_Market_Manager"],
    "individual": ["Technical_Evaluator", "End_User"],
}

COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"]

PAIN_POINTS = {
    "Sales":       ["low conversion", "long sales cycles", "poor lead quality"],
    "Engineering": ["legacy tech debt", "slow deployments", "scaling issues"],
    "Marketing":   ["low ROI", "attribution challenges", "content bottlenecks"],
    "Product":     ["unclear requirements", "slow delivery", "prioritization"],
    "Finance":     ["manual reporting", "forecasting errors", "compliance"],
    "Operations":  ["process inefficiencies", "supply chain issues", "automation"],
    "IT":          ["security incidents", "vendor complexity", "uptime"],
    "HR":          ["high turnover", "slow hiring", "engagement"],
}

INTERESTS = ["AI/ML", "automation", "growth hacking", "data analytics", "leadership",
             "product-led growth", "DevOps", "remote work", "sustainability"]

CHANNELS = ["linkedin", "email", "call"]
CONTENT_TYPES = ["outreach", "follow_up", "nurture", "demo_invite"]

PRODUCTS_DATA = [
    {
        "name": "Nexus CRM Pro",
        "category": "SaaS",
        "description": "AI-powered CRM for B2B sales teams",
        "target_industries": ["Technology", "Professional Services", "Finance"],
        "target_seniority": ["c_level", "vp", "director", "manager"],
        "key_benefits": ["Automated lead scoring", "Pipeline forecasting", "Email automation"],
        "value_proposition": "Close 40% more deals with AI-driven insights",
        "cta_primary": "Start Free Trial",
        "cta_secondary": "Book a Demo",
        "price_model": "per_seat",
        "price_from_usd": 79.0,
        "trial_available": True,
    },
    {
        "name": "ShieldLayer Security",
        "category": "SaaS",
        "description": "Enterprise cybersecurity platform",
        "target_industries": ["Technology", "Finance", "Healthcare"],
        "target_seniority": ["c_level", "vp", "director"],
        "key_benefits": ["Real-time threat detection", "SOC2 compliance", "24/7 monitoring"],
        "value_proposition": "Reduce breach risk by 80%",
        "cta_primary": "Request a Demo",
        "cta_secondary": "Download Security Report",
        "price_model": "flat_rate",
        "price_from_usd": 5000.0,
        "trial_available": False,
    },
    {
        "name": "FlowHR Platform",
        "category": "SaaS",
        "description": "Modern HR and payroll platform",
        "target_industries": ["Retail", "Manufacturing", "Healthcare"],
        "target_seniority": ["c_level", "director", "manager"],
        "key_benefits": ["Automated payroll", "Self-service onboarding", "Performance reviews"],
        "value_proposition": "Cut HR admin time by 60%",
        "cta_primary": "Start Free Trial",
        "cta_secondary": "Watch Product Tour",
        "price_model": "per_seat",
        "price_from_usd": 12.0,
        "trial_available": True,
    },
    {
        "name": "DataBridge Analytics",
        "category": "SaaS",
        "description": "Business intelligence platform",
        "target_industries": ["Finance", "Retail", "Logistics"],
        "target_seniority": ["c_level", "vp", "director"],
        "key_benefits": ["No-code dashboards", "Real-time pipelines", "200+ integrations"],
        "value_proposition": "Turn data into insights in 30 minutes",
        "cta_primary": "Start Free Trial",
        "cta_secondary": "Book a Demo",
        "price_model": "usage",
        "price_from_usd": 299.0,
        "trial_available": True,
    },
    {
        "name": "ReachMax Outreach",
        "category": "SaaS",
        "description": "Multi-channel outreach automation",
        "target_industries": ["Technology", "Professional Services"],
        "target_seniority": ["vp", "director", "manager"],
        "key_benefits": ["Multi-channel sequences", "AI personalisation", "A/B testing"],
        "value_proposition": "3x your reply rate",
        "cta_primary": "Start Free Trial",
        "cta_secondary": "See It In Action",
        "price_model": "per_seat",
        "price_from_usd": 99.0,
        "trial_available": True,
    },
]


# ═══════════════════════════════════════════════
# CSV EXPORT HELPERS
# ═══════════════════════════════════════════════

def export_to_csv(data_list, filename, fieldnames):
    """Export a list of objects to CSV"""
    os.makedirs('csv_backup', exist_ok=True)
    filepath = os.path.join('csv_backup', filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for item in data_list:
            row = {}
            for field in fieldnames:
                value = getattr(item, field, None)
                
                # Convert special types to string for CSV
                if isinstance(value, uuid.UUID):
                    row[field] = str(value)
                elif isinstance(value, datetime):
                    row[field] = value.isoformat()
                elif isinstance(value, (list, dict)):
                    row[field] = json.dumps(value)
                elif value is None:
                    row[field] = ''
                else:
                    row[field] = value
            
            writer.writerow(row)
    
    print(f"  ✅ Exported to {filepath}")


# ═══════════════════════════════════════════════
# SEEDER FUNCTIONS
# ═══════════════════════════════════════════════

def make_prospects(n=500):
    prospects = []
    emails_used = set()

    for _ in range(n):
        seniority = random.choices(
            list(SENIORITY_LEVELS.keys()),
            weights=[5, 10, 20, 35, 30],
            k=1
        )[0]
        
        job_title   = random.choice(SENIORITY_LEVELS[seniority])
        department  = random.choice(DEPARTMENTS)
        industry    = random.choice(INDUSTRIES)
        archetype   = random.choice(ARCHETYPES[seniority])
        
        is_decision_maker = seniority in ["c_level", "vp", "director"]
        
        # ICP scoring
        base_icp = random.uniform(0.5, 0.95)
        icp_score = round(base_icp, 2)
        
        priority_score = round(
            icp_score * 0.6
            + (0.25 if is_decision_maker else 0.0)
            + random.uniform(-0.05, 0.15),
            2
        )
        priority_score = min(1.0, max(0.0, priority_score))
        
        email = fake.unique.email()
        while email in emails_used:
            email = fake.unique.email()
        emails_used.add(email)
        
        # Engagement rates vary by channel and seniority
        if seniority in ["c_level", "vp"]:
            email_open = round(random.uniform(15, 30), 2)
            linkedin_click = round(random.uniform(25, 50), 2)
            call_answer = round(random.uniform(10, 25), 2)
        else:
            email_open = round(random.uniform(25, 40), 2)
            linkedin_click = round(random.uniform(15, 35), 2)
            call_answer = round(random.uniform(20, 40), 2)
        
        pain_points_list = random.sample(
            PAIN_POINTS.get(department, PAIN_POINTS["Operations"]),
            k=random.randint(2, 3)
        )
        
        interests_list = random.sample(INTERESTS, k=random.randint(2, 4))
        
        last_contacted = fake.date_time_between(start_date="-12m", end_date="now") if random.random() > 0.3 else None
        
        prospects.append(Prospect(
            id                  = uuid.uuid4(),
            first_name          = fake.first_name(),
            last_name           = fake.last_name(),
            email               = email,
            phone               = fake.phone_number() if random.random() > 0.4 else None,
            linkedin_url        = f"https://linkedin.com/in/{fake.slug()}" if random.random() > 0.3 else None,
            company_name        = fake.company(),
            job_title           = job_title,
            seniority           = seniority,
            department          = department,
            industry            = industry,
            company_size        = random.choice(COMPANY_SIZES),
            country             = fake.country(),
            city                = fake.city(),
            timezone            = random.choice(["UTC", "America/New_York", "Europe/London", "Asia/Singapore"]),
            icp_archetype       = archetype,
            icp_score           = icp_score,
            priority_score      = priority_score,
            is_decision_maker   = is_decision_maker,
            preferred_channel   = random.choices(CHANNELS, weights=[35, 45, 20], k=1)[0],
            best_contact_time   = random.choice(["weekday_morning", "weekday_afternoon", "weekday_evening"]),
            email_open_rate     = email_open,
            linkedin_click_rate = linkedin_click,
            call_answer_rate    = call_answer,
            times_contacted     = random.randint(0, 8),
            last_contacted_at   = last_contacted,
            pain_points         = pain_points_list,
            interests           = interests_list,
            created_at          = fake.date_time_between(start_date="-2y", end_date="now"),
            updated_at          = fake.date_time_between(start_date="-6m", end_date="now"),
        ))
    
    return prospects


def make_products():
    products = []
    
    for p in PRODUCTS_DATA:
        products.append(Product(
            id                  = uuid.uuid4(),
            name                = p["name"],
            category            = p["category"],
            description         = p["description"],
            target_industries   = p["target_industries"],
            target_seniority    = p["target_seniority"],
            key_benefits        = p["key_benefits"],
            value_proposition   = p["value_proposition"],
            cta_primary         = p["cta_primary"],
            cta_secondary       = p["cta_secondary"],
            price_model         = p["price_model"],
            price_from_usd      = p["price_from_usd"],
            trial_available     = p["trial_available"],
            created_at          = fake.date_time_between(start_date="-2y", end_date="-6m"),
        ))
    
    # Add 15 more synthetic products
    for i in range(15):
        products.append(Product(
            id                  = uuid.uuid4(),
            name                = f"{fake.word().capitalize()}{fake.word().capitalize()} Platform",
            category            = random.choice(["SaaS", "Consulting", "Managed Service"]),
            description         = fake.paragraph(nb_sentences=2),
            target_industries   = random.sample(INDUSTRIES, k=random.randint(2, 4)),
            target_seniority    = random.sample(list(SENIORITY_LEVELS.keys()), k=random.randint(2, 3)),
            key_benefits        = [fake.sentence(nb_words=4).rstrip(".") for _ in range(3)],
            value_proposition   = fake.sentence(nb_words=10),
            cta_primary         = random.choice(["Book a Demo", "Start Trial", "Get Quote"]),
            cta_secondary       = random.choice(["Learn More", "Watch Tour", "Download Guide"]),
            price_model         = random.choice(["per_seat", "flat_rate", "usage", "custom"]),
            price_from_usd      = round(random.choice([29, 99, 299, 999, 2500]), 2),
            trial_available     = random.random() > 0.4,
            created_at          = fake.date_time_between(start_date="-2y", end_date="-3m"),
        ))
    
    return products


def make_engagements(prospects, products, n=2000):
    engagements = []
    product_ids = [p.id for p in products]

    for _ in range(n):
        prospect = random.choice(prospects)
        sent_dt  = fake.date_time_between(start_date="-18m", end_date="now")
        channel  = random.choices(CHANNELS, weights=[30, 50, 20], k=1)[0]

        # Realistic engagement rates per channel
        if channel == "email":
            was_opened  = random.random() < 0.28
            was_clicked = was_opened and random.random() < 0.18
            was_replied = was_clicked and random.random() < 0.12
        elif channel == "linkedin":
            was_opened  = random.random() < 0.45
            was_clicked = was_opened and random.random() < 0.22
            was_replied = was_clicked and random.random() < 0.20
        else:  # call
            was_opened  = random.random() < 0.35
            was_clicked = False
            was_replied = was_opened and random.random() < 0.40

        was_converted = was_replied and prospect.is_decision_maker and random.random() < 0.12

        reply_sentiment = None
        if was_replied:
            reply_sentiment = random.choices(["positive", "neutral", "negative"], weights=[50, 30, 20], k=1)[0]

        hour = sent_dt.hour
        if 6 <= hour < 12:
            time_of_day = "morning"
        elif 12 <= hour < 17:
            time_of_day = "afternoon"
        elif 17 <= hour < 21:
            time_of_day = "evening"
        else:
            time_of_day = "night"

        engagements.append(EngagementHistory(
            id              = uuid.uuid4(),
            prospect_id     = prospect.id,
            product_id      = random.choice(product_ids) if random.random() > 0.2 else None,
            channel         = channel,
            content_type    = random.choice(CONTENT_TYPES),
            subject         = fake.sentence(nb_words=7).rstrip(".") if channel != "call" else None,
            sent_at         = sent_dt,
            was_opened      = was_opened,
            was_clicked     = was_clicked,
            was_replied     = was_replied,
            reply_sentiment = reply_sentiment,
            was_converted   = was_converted,
            day_of_week     = sent_dt.strftime("%A"),
            time_of_day     = time_of_day,
            created_at      = sent_dt,
        ))

    return engagements


def make_classifications(n=50):
    classifications = []
    
    categories = [
        "B2B_lead_gen", "B2B_reengagement", "B2C_marketing", "product_launch",
        "event_promotion", "partnership_outreach", "recruitment", "content_distribution"
    ]
    
    tones = ["formal", "persuasive", "conversational", "data_driven"]
    cta_types = ["book_demo", "start_trial", "download_resource", "schedule_call", "visit_website"]
    urgency_levels = ["high", "medium", "low"]
    
    for _ in range(n):
        classifications.append(Classification(
            id                  = uuid.uuid4(),
            time_context        = random.choice(["weekday morning", "Friday afternoon", "Monday 9am"]),
            location            = fake.city() + ", " + fake.country(),
            business_behavior   = random.choice([
                "SaaS startup, growth stage",
                "Enterprise, mature market",
                "SMB, service-based",
                "Mid-market, scaling fast"
            ]),
            user_intent         = random.choice([
                "generate enterprise leads",
                "re-engage cold prospects",
                "promote new feature launch",
                "recruit senior engineers",
                "build partnerships with agencies"
            ]),
            category            = random.choice(categories),
            confidence          = round(random.uniform(0.65, 0.98), 2),
            tone                = random.choice(tones),
            cta_type            = random.choice(cta_types),
            urgency_level       = random.choice(urgency_levels),
            created_at          = fake.date_time_between(start_date="-3m", end_date="now"),
        ))
    
    return classifications


# ═══════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════

def seed():
    print("🔌 Connecting to PostgreSQL...")
    engine = create_engine(DB_URL, echo=False)
    
    print("🗑️  Dropping existing tables...")
    Base.metadata.drop_all(engine)
    
    print("📋 Creating tables...")
    Base.metadata.create_all(engine)
    print("✅ Tables created: prospects, products, engagement_history, classifications\n")

    # Generate all data first
    print("👤 Generating prospects (500)...")
    prospects = make_prospects(500)
    
    print("📦 Generating products (20)...")
    products = make_products()
    
    print("📊 Generating engagement_history (2000)...")
    engagements = make_engagements(prospects, products, 2000)
    
    print("🏷️  Generating classifications (50)...")
    classifications = make_classifications(50)
    
    # Export to CSV BEFORE inserting to DB (in case DB insert fails)
    print("\n💾 Exporting to CSV backup...")
    
    export_to_csv(
        prospects,
        'prospects.csv',
        ['id', 'first_name', 'last_name', 'email', 'phone', 'linkedin_url',
         'company_name', 'job_title', 'seniority', 'department', 'industry',
         'company_size', 'country', 'city', 'timezone', 'icp_archetype',
         'icp_score', 'priority_score', 'is_decision_maker', 'preferred_channel',
         'best_contact_time', 'email_open_rate', 'linkedin_click_rate',
         'call_answer_rate', 'times_contacted', 'last_contacted_at',
         'pain_points', 'interests', 'created_at', 'updated_at']
    )
    
    export_to_csv(
        products,
        'products.csv',
        ['id', 'name', 'category', 'description', 'target_industries',
         'target_seniority', 'key_benefits', 'value_proposition',
         'cta_primary', 'cta_secondary', 'price_model', 'price_from_usd',
         'trial_available', 'created_at']
    )
    
    export_to_csv(
        engagements,
        'engagement_history.csv',
        ['id', 'prospect_id', 'product_id', 'channel', 'content_type',
         'subject', 'sent_at', 'was_opened', 'was_clicked', 'was_replied',
         'reply_sentiment', 'was_converted', 'day_of_week', 'time_of_day',
         'created_at']
    )
    
    export_to_csv(
        classifications,
        'classifications.csv',
        ['id', 'time_context', 'location', 'business_behavior', 'user_intent',
         'category', 'confidence', 'tone', 'cta_type', 'urgency_level',
         'created_at']
    )
    
    print("\n📥 Inserting data into PostgreSQL...")
    
    with Session(engine) as session:
        print("  → prospects...")
        session.add_all(prospects)
        session.flush()

        print("  → products...")
        session.add_all(products)
        session.flush()

        print("  → engagement_history...")
        session.add_all(engagements)
        session.flush()

        print("  → classifications...")
        session.add_all(classifications)

        session.commit()

    print("\n✅ Database seeded successfully!\n")
    
    print("=" * 70)
    print("ROW COUNTS:")
    print("=" * 70)
    with engine.connect() as conn:
        for table in ["prospects", "products", "engagement_history", "classifications"]:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"  {table:<30} {count:>5} rows")
    
    print("\n" + "=" * 70)
    print("SAMPLE QUERY — Top 10 Highest Priority Prospects:")
    print("=" * 70)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT first_name, last_name, job_title, icp_archetype,
                   priority_score, company_name, industry, preferred_channel
            FROM   prospects
            ORDER  BY priority_score DESC
            LIMIT  10
        """)).fetchall()
        
        print(f"  {'Name':<20} {'Title':<25} {'Archetype':<20} {'Score':<7} {'Channel':<10} {'Company'}")
        print("  " + "-" * 120)
        for r in rows:
            name = f"{r[0]} {r[1]}"
            print(f"  {name:<20} {r[2]:<25} {r[3]:<20} {r[4]:<7.2f} {r[7]:<10} {r[5]} ({r[6]})")
    
    print("\n" + "=" * 70)
    print("AGENT 3 LEARNING — Channel Performance by Seniority:")
    print("=" * 70)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT p.seniority, e.channel,
                   COUNT(*) as sent,
                   ROUND(AVG(CASE WHEN e.was_opened THEN 100.0 ELSE 0 END), 1) as open_rate,
                   ROUND(AVG(CASE WHEN e.was_replied THEN 100.0 ELSE 0 END), 1) as reply_rate
            FROM   engagement_history e
            JOIN   prospects p ON p.id = e.prospect_id
            GROUP  BY p.seniority, e.channel
            ORDER  BY p.seniority, open_rate DESC
        """)).fetchall()
        
        print(f"  {'Seniority':<15} {'Channel':<12} {'Sent':<8} {'Open %':<10} {'Reply %'}")
        print("  " + "-" * 60)
        for r in rows:
            print(f"  {r[0]:<15} {r[1]:<12} {r[2]:<8} {r[3]:<10} {r[4]}")
    
    print("\n🎉 Done! Your database is ready for the Multi-Agent System.")
    print(f"📁 CSV backups saved in: ./csv_backup/\n")


if __name__ == "__main__":
    seed()