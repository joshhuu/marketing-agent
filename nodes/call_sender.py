"""
Call Sender Node (Agent 6)
Makes automated AI-powered calls using Twilio
Uses webhooks for real-time conversational AI (speech-to-text -> Gemini -> text-to-speech)
"""
import logging
from datetime import datetime
from typing import Dict, Any
import uuid

from state import AgentState
from config import (
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    TWILIO_WEBHOOK_BASE_URL,
    HARDCODED_TEST_PHONES
)

# Configure logging
logger = logging.getLogger(__name__)


def make_calls(state: AgentState) -> Dict[str, Any]:
    """
    Makes AI-powered calls to hardcoded test phone numbers using Twilio
    
    This node:
    1. Takes all personalized call scripts from content generator
    2. Registers each call with the conversation handler (stores script context)
    3. Initiates call with webhook URL so Twilio calls back our server
    4. The webhook handles the real-time conversation loop:
       - Speaks opener -> Listens (speech-to-text) -> Sends to Gemini -> Speaks response -> Repeat
    
    Args:
        state: Current agent state with personalized_content
        
    Returns:
        Updated state with call_send_results
    """
    logger.info("=" * 80)
    logger.info("CALL SENDER NODE - Starting AI-powered call process")
    logger.info("=" * 80)
    
    personalized_content = state.get("personalized_content", [])
    selected_channel = state.get("selected_channel", "call")
    
    # Only make calls if channel is call
    if selected_channel != "call":
        logger.info(f"Channel is {selected_channel}, skipping calls")
        return {
            **state,
            "call_send_results": [],
            "calls_made_count": 0
        }
    
    if not personalized_content:
        logger.warning("No personalized content for calls")
        return {
            **state,
            "call_send_results": [],
            "calls_made_count": 0
        }
    
    # Check Twilio configuration
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        logger.error("Twilio credentials not configured")
        return {
            **state,
            "call_send_results": [],
            "calls_made_count": 0,
            "call_error": "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env"
        }
    
    # Check webhook URL
    webhook_base = TWILIO_WEBHOOK_BASE_URL.rstrip("/") if TWILIO_WEBHOOK_BASE_URL else ""
    if not webhook_base:
        logger.error("TWILIO_WEBHOOK_BASE_URL not configured. Run ngrok and set the URL in .env")
        return {
            **state,
            "call_send_results": [],
            "calls_made_count": 0,
            "call_error": "TWILIO_WEBHOOK_BASE_URL not set. Run: ngrok http 8000, then set the https URL in .env"
        }
    
    logger.info(f"Preparing to make {len(personalized_content)} AI-powered call(s)")
    logger.info(f"Hardcoded test phones: {', '.join(HARDCODED_TEST_PHONES)}")
    logger.info(f"Twilio from number: {TWILIO_PHONE_NUMBER}")
    logger.info(f"Webhook base URL: {webhook_base}")
    
    call_results = []
    successful_calls = 0
    
    # Get shared context from state
    sender_name = state.get("sender_name", "Joshua")
    business_behavior = state.get("business_behavior", "")
    
    try:
        from twilio.rest import Client
        from utils.call_conversation import register_call
        
        # Initialize Twilio client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("✓ Twilio client initialized")
        
        # Make calls - 1:1 mapping between personalized content and hardcoded phones
        for idx, content in enumerate(personalized_content):
            prospect_id = content.get("prospect_id")
            prospect_name = content.get("prospect_name", "Unknown")
            prospect_company = content.get("prospect_company", "their company")
            prospect_job_title = content.get("prospect_job_title", "")
            call_script = content.get("call_script", {})
            
            if not call_script:
                logger.warning(f"No call script for prospect {prospect_name}")
                continue
            
            # 1:1 mapping: each prospect call goes to one hardcoded phone (cycling if needed)
            test_phone = HARDCODED_TEST_PHONES[idx % len(HARDCODED_TEST_PHONES)]
            
            logger.info(f"\n--- Making AI call {idx + 1}/{len(personalized_content)} for {prospect_name} -> {test_phone} ---")
            logger.info(f"  Script opener: {call_script.get('opener', '')[:80]}...")
            
            try:
                # Webhook URLs
                voice_url = f"{webhook_base}/api/twilio/voice"
                status_url = f"{webhook_base}/api/twilio/status"
                
                # Initiate the call - Twilio will call our voice webhook when connected
                call = client.calls.create(
                    to=test_phone,
                    from_=TWILIO_PHONE_NUMBER,
                    url=voice_url,
                    method="POST",
                    status_callback=status_url,
                    status_callback_method="POST",
                    status_callback_event=["completed", "failed", "busy", "no-answer"]
                )
                
                logger.info(f"  ✓ Call initiated to {test_phone} (SID: {call.sid})")
                logger.info(f"  Status: {call.status}")
                
                # Register the call with conversation handler
                # This stores the context so webhooks can access it
                register_call(
                    call_sid=call.sid,
                    prospect_name=prospect_name,
                    prospect_company=prospect_company,
                    prospect_job_title=prospect_job_title,
                    call_script=call_script,
                    sender_name=sender_name,
                    business_behavior=business_behavior,
                    product_name=content.get("product_name", "our solution")
                )
                
                successful_calls += 1
                
                call_results.append({
                    "prospect_id": str(prospect_id) if prospect_id else None,
                    "prospect_name": prospect_name,
                    "status": "initiated",
                    "recipient_phone": test_phone,
                    "call_sid": call.sid,
                    "call_status": call.status,
                    "mode": "ai_conversation",
                    "script_opener": call_script.get("opener", "")[:100]
                })
                
            except Exception as e:
                logger.error(f"  ✗ Failed to call {test_phone}: {e}")
                call_results.append({
                    "prospect_id": str(prospect_id) if prospect_id else None,
                    "prospect_name": prospect_name,
                    "recipient_phone": test_phone,
                    "status": "failed",
                    "error": str(e)
                })
                continue
        
    except ImportError:
        logger.error("Twilio package not installed. Run: pip install twilio")
        return {
            **state,
            "call_send_results": [],
            "calls_made_count": 0,
            "call_error": "Twilio package not installed. Run: pip install twilio"
        }
    except Exception as e:
        logger.error(f"Unexpected error during call process: {e}")
        return {
            **state,
            "call_send_results": call_results,
            "calls_made_count": successful_calls,
            "call_error": f"Unexpected error: {str(e)}"
        }
    
    # Log summary
    logger.info(f"\n{'=' * 80}")
    logger.info(f"AI CALL SUMMARY:")
    logger.info(f"  Total Prospects: {len(personalized_content)}")
    logger.info(f"  Calls Initiated: {successful_calls}")
    logger.info(f"  Mode: AI Conversation (Twilio + Gemini)")
    logger.info(f"  Max turns per call: 6")
    logger.info(f"  Failed: {len(personalized_content) - successful_calls}")
    logger.info(f"{'=' * 80}\n")
    
    return {
        **state,
        "call_send_results": call_results,
        "calls_made_count": successful_calls
    }
