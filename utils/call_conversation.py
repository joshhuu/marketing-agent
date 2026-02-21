"""
AI Call Conversation Handler
Manages real-time AI-powered phone conversations using Twilio + Gemini

Flow:
1. Call starts -> speak opener -> listen for response (Gather)
2. Person speaks -> Twilio transcribes (speech-to-text) -> POSTs to webhook
3. Webhook sends transcription + history to Gemini -> gets conversational response
4. Returns TwiML to speak Gemini's response -> listen again (loop)
5. After max turns or silence -> wrap up with closing statement
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime

from utils.llm import get_llm

# Configure logging
logger = logging.getLogger(__name__)

# In-memory store for active call conversations
# Key: call_sid, Value: conversation context
_active_calls: Dict[str, dict] = {}

MAX_CONVERSATION_TURNS = 6  # Max back-and-forth exchanges before wrapping up


def register_call(
    call_sid: str,
    prospect_name: str,
    prospect_company: str,
    prospect_job_title: str,
    call_script: dict,
    sender_name: str = "Joshua",
    business_behavior: str = "",
    product_name: str = ""
):
    """
    Register a new call conversation with its context
    
    Args:
        call_sid: Twilio call SID
        prospect_name: Name of the prospect being called
        prospect_company: Prospect's company
        prospect_job_title: Prospect's job title
        call_script: Generated call script with opener, objections, close
        sender_name: Name of the AI caller
        business_behavior: What the business does
        product_name: Product being pitched
    """
    _active_calls[call_sid] = {
        "prospect_name": prospect_name,
        "prospect_company": prospect_company,
        "prospect_job_title": prospect_job_title,
        "call_script": call_script,
        "sender_name": sender_name,
        "business_behavior": business_behavior,
        "product_name": product_name,
        "conversation_history": [],
        "turn_count": 0,
        "started_at": datetime.utcnow().isoformat(),
    }
    logger.info(f"Registered call {call_sid} for prospect {prospect_name}")


def get_call_context(call_sid: str) -> Optional[dict]:
    """Get the conversation context for an active call"""
    return _active_calls.get(call_sid)


def cleanup_call(call_sid: str):
    """Remove a completed call from active calls"""
    if call_sid in _active_calls:
        del _active_calls[call_sid]
        logger.info(f"Cleaned up call {call_sid}")


def generate_ai_response(call_sid: str, user_speech: str) -> str:
    """
    Generate an AI conversational response based on what the person said
    
    Args:
        call_sid: Twilio call SID to look up conversation context
        user_speech: What the person said (transcribed by Twilio)
        
    Returns:
        AI response text to speak back
    """
    context = _active_calls.get(call_sid)
    
    if not context:
        logger.warning(f"No context found for call {call_sid}")
        return "I appreciate your time. Thank you and have a great day!"
    
    # Add user's speech to history
    context["conversation_history"].append({
        "role": "prospect",
        "text": user_speech
    })
    context["turn_count"] += 1
    
    # Check if we should wrap up
    is_final_turn = context["turn_count"] >= MAX_CONVERSATION_TURNS
    
    # Build the prompt for Gemini
    prompt = _build_conversation_prompt(context, user_speech, is_final_turn)
    
    try:
        llm = get_llm(temperature=0.6)
        response = llm.invoke(prompt)
        ai_response = response.content.strip()
        
        # Clean up response - remove quotes if wrapped
        if ai_response.startswith('"') and ai_response.endswith('"'):
            ai_response = ai_response[1:-1]
        
        # Add AI response to history
        context["conversation_history"].append({
            "role": "agent",
            "text": ai_response
        })
        
        logger.info(f"Call {call_sid} - Turn {context['turn_count']}")
        logger.info(f"  Prospect said: {user_speech[:100]}...")
        logger.info(f"  AI responds: {ai_response[:100]}...")
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating AI response for call {call_sid}: {e}")
        return "That's a great point. I'd love to follow up with more details over email. Thank you for your time today!"


def get_opener_text(call_sid: str) -> str:
    """Get the opener text for the call (first thing the AI says)"""
    context = _active_calls.get(call_sid)
    if not context:
        return "Hello, thank you for taking my call."
    
    opener = context["call_script"].get("opener", "Hello, thank you for taking my call.")
    
    # Add this to conversation history
    context["conversation_history"].append({
        "role": "agent",
        "text": opener
    })
    
    return opener


def should_continue(call_sid: str) -> bool:
    """Check if the conversation should continue or wrap up"""
    context = _active_calls.get(call_sid)
    if not context:
        return False
    return context["turn_count"] < MAX_CONVERSATION_TURNS


def _build_conversation_prompt(context: dict, latest_speech: str, is_final_turn: bool) -> str:
    """Build the Gemini prompt for generating the next response"""
    
    prospect_name = context["prospect_name"]
    prospect_company = context["prospect_company"]
    prospect_job_title = context["prospect_job_title"]
    sender_name = context["sender_name"]
    business_behavior = context["business_behavior"]
    product_name = context["product_name"]
    call_script = context["call_script"]
    history = context["conversation_history"]
    turn_count = context["turn_count"]
    
    # Format conversation history
    history_text = ""
    for entry in history[:-1]:  # Exclude the latest (already in latest_speech)
        role = "You" if entry["role"] == "agent" else prospect_name
        history_text += f"{role}: {entry['text']}\n"
    
    # Objection handling reference
    objections = call_script.get("objections", [])
    objection_text = "\n".join(f"- {obj}" for obj in objections) if objections else "- Be understanding and address their concerns"
    
    close = call_script.get("close", "Let me send you a calendar invite for next week.")
    
    wrap_up_instruction = ""
    if is_final_turn:
        wrap_up_instruction = f"""
IMPORTANT: This is the FINAL turn. You MUST wrap up the conversation gracefully.
Use this closing approach: "{close}"
Thank them for their time and end the call politely.
"""
    
    return f"""You are {sender_name}, a friendly and professional sales representative making a B2B outreach call.
You are having a LIVE phone conversation. Respond naturally as if speaking on the phone.

YOUR CONTEXT:
- You're calling {prospect_name}, who is {prospect_job_title} at {prospect_company}
- Your business: {business_behavior}
- Product/Service: {product_name}
- This is conversation turn {turn_count} of {MAX_CONVERSATION_TURNS}

CALL SCRIPT REFERENCE (use as guidance, don't read verbatim):
- Objection handlers: 
{objection_text}
- Closing approach: {close}

CONVERSATION SO FAR:
{history_text}
{prospect_name}: {latest_speech}

{wrap_up_instruction}

GUIDELINES:
1. Keep responses SHORT and conversational (2-3 sentences max, like a real phone call)
2. Sound natural and human - use filler words occasionally ("Well,", "Actually,", "You know,")
3. Listen to what they said and respond specifically to their words
4. If they show interest, try to move toward scheduling a meeting
5. If they raise objections, address them naturally using the objection handlers
6. If they say they're busy or not interested, be respectful and offer to follow up later
7. If they ask questions, answer helpfully using your product knowledge
8. NEVER mention you're an AI or a bot
9. Don't use emojis or special characters (this will be spoken aloud)

Respond with ONLY what you would say next. No labels, no quotes, no stage directions. Just your spoken response."""
