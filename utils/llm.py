"""
LLM wrapper for Gemini 1.5 Pro via LangChain
Provides helper functions for LLM interactions
"""
import os
import logging
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI

from config import GOOGLE_API_KEY, MODEL_NAME

# Configure logging
logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.7) -> ChatGoogleGenerativeAI:
    """
    Returns configured Gemini 1.5 Pro instance
    
    Args:
        temperature: Controls randomness (0.0 = deterministic, 1.0 = creative)
        
    Returns:
        Configured ChatGoogleGenerativeAI instance
        
    Raises:
        ValueError: If GOOGLE_API_KEY is not set
    """
    api_key = GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        raise ValueError(
            "GOOGLE_API_KEY not found. Please set it as an environment variable."
        )
    
    logger.info(f"Initializing LLM with temperature={temperature}")
    
    return ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=temperature,
        google_api_key=api_key,
        convert_system_message_to_human=True,
    )
