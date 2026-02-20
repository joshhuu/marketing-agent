"""
Migration script to add API call logging and audit trail tables
Run this to update the database with new security and compliance features
"""
from database import Base, engine
from sqlalchemy import inspect

def migrate():
    """Create new tables if they don't exist"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    print("Checking for new tables...")
    
    # Create all tables (will only create missing ones)
    Base.metadata.create_all(bind=engine)
    
    new_inspector = inspect(engine)
    new_tables = new_inspector.get_table_names()
    
    added_tables = set(new_tables) - set(existing_tables)
    
    if added_tables:
        print(f"✓ Successfully added tables: {', '.join(added_tables)}")
    else:
        print("✓ All tables already exist")
    
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
