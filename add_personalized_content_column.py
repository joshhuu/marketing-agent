"""
Database migration script to add personalized_content column
This script adds the new personalized_content JSON column to execution_details table.
"""
import logging
from sqlalchemy import text
from database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_database():
    """Add personalized_content column to execution_details table"""
    
    logger.info("Starting database migration...")
    
    with engine.connect() as connection:
        try:
            # Check if column already exists
            result = connection.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='execution_details' 
                AND column_name='personalized_content'
            """))
            
            if result.fetchone():
                logger.info("Column 'personalized_content' already exists. Skipping migration.")
                return
            
            # Add the new column
            logger.info("Adding 'personalized_content' column to execution_details table...")
            connection.execute(text("""
                ALTER TABLE execution_details 
                ADD COLUMN personalized_content JSON
            """))
            connection.commit()
            
            logger.info("✓ Migration completed successfully!")
            logger.info("The 'personalized_content' column has been added to execution_details table.")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            connection.rollback()
            raise


if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE MIGRATION: Add personalized_content column")
    print("=" * 60)
    
    try:
        migrate_database()
        print("\n✅ Migration successful! You can now run the server.")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("Please check the error and try again.")
