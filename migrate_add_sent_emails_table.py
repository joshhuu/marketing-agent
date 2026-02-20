"""
Migration script to add sent_emails table for email tracking
Run this script to add the table to your existing database
"""
from database import engine, Base, SentEmail
from sqlalchemy import inspect

def migrate():
    """Add sent_emails table if it doesn't exist"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if 'sent_emails' not in existing_tables:
        print("Creating sent_emails table...")
        SentEmail.__table__.create(engine)
        print("✅ sent_emails table created successfully!")
    else:
        print("ℹ️  sent_emails table already exists, skipping...")

if __name__ == "__main__":
    migrate()
