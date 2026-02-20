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
