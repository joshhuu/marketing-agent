"""
Database migration: Add execution_details table to store full agent workflow
"""
from sqlalchemy import create_engine
from database import Base
from config import DATABASE_URL

if __name__ == "__main__":
    engine = create_engine(DATABASE_URL)
    
    # Create all tables (will skip existing ones)
    Base.metadata.create_all(engine)
    
    print("✓ Database tables created/updated successfully")
    print("✓ execution_details table is ready")
