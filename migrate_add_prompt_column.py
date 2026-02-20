"""
Migration script to add prompt_preview column to api_call_logs table
"""
from sqlalchemy import text
from database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    """Add prompt_preview column to api_call_logs"""
    try:
        with engine.connect() as conn:
            # Check if column already exists (PostgreSQL)
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='api_call_logs' AND column_name='prompt_preview'
            """))
            
            exists = result.fetchone() is not None
            
            if not exists:
                logger.info("Adding prompt_preview column to api_call_logs...")
                conn.execute(text("ALTER TABLE api_call_logs ADD COLUMN prompt_preview TEXT"))
                conn.commit()
                logger.info("✓ Successfully added prompt_preview column")
            else:
                logger.info("✓ prompt_preview column already exists")
        
        print("\nMigration complete!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    migrate()
