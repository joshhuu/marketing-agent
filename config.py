"""
Configuration file for the Multi-Agent Marketing System
Stores database connection, API keys, and model settings
"""
import os
from typing import Dict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5433/mas_db")

# Google API Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Maileroo SMTP Configuration
MAILEROO_SMTP_HOST = os.getenv("MAILEROO_SMTP_HOST", "smtp.maileroo.com")
MAILEROO_SMTP_PORT = int(os.getenv("MAILEROO_SMTP_PORT", "587"))
MAILEROO_SMTP_USERNAME = os.getenv("MAILEROO_SMTP_USERNAME")  # Full email address
MAILEROO_SMTP_PASSWORD = os.getenv("MAILEROO_SMTP_PASSWORD")  # SMTP password from Maileroo
MAILEROO_FROM_EMAIL = os.getenv("MAILEROO_FROM_EMAIL", "noreply@yourdomain.com")
MAILEROO_FROM_NAME = os.getenv("MAILEROO_FROM_NAME", "Marketing Agent")
MAILEROO_USE_TLS = os.getenv("MAILEROO_USE_TLS", "True").lower() == "true"

# Model Configuration
MODEL_NAME = "gemma-3-27b-it"

# Temperature settings per agent
TEMPERATURE_CONFIG: Dict[str, float] = {
    "input_parser": 0.3,      # Low - structured extraction
    "classifier": 0.2,        # Very low - deterministic classification
    "strategy": 0.5,          # Medium - balanced creativity
    "icp_matcher": 0.3,       # Low - analytical matching
    "platform_decision": 0.4, # Medium-low - data-driven reasoning
    "content_generator": 0.7, # High - creative content generation
}

# Logging Configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
