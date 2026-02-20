"""
Email Sender Node (Agent 5)
Sends personalized emails directly to hardcoded recipient addresses
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, List
import uuid

from state import AgentState
from config import (
    MAILEROO_SMTP_HOST,
    MAILEROO_SMTP_PORT,
    MAILEROO_SMTP_USERNAME,
    MAILEROO_SMTP_PASSWORD,
    MAILEROO_FROM_EMAIL,
    MAILEROO_FROM_NAME,
    MAILEROO_USE_TLS,
    HARDCODED_TEST_EMAILS
)
from database import get_db, SentEmail

# Configure logging
logger = logging.getLogger(__name__)


def send_emails(state: AgentState) -> Dict[str, Any]:
    """
    Sends personalized emails directly to hardcoded test recipients
    
    This node:
    1. Takes all personalized email content from content generator
    2. Sends each email to hardcoded recipient addresses
    3. Tracks sent emails in the database
    4. Handles SMTP errors gracefully
    
    Args:
        state: Current agent state with personalized_content
        
    Returns:
        Updated state with email_send_results
    """
    logger.info("=" * 80)
    logger.info("EMAIL SENDER NODE - Starting email sending process")
    logger.info("=" * 80)
    
    personalized_content = state.get("personalized_content", [])
    selected_channel = state.get("selected_channel", "email")
    
    # Only send if channel is email
    if selected_channel != "email":
        logger.info(f"Channel is {selected_channel}, skipping email sending")
        return {
            "email_send_results": [],
            "emails_sent_count": 0
        }
    
    if not personalized_content:
        logger.warning("No personalized content to send")
        return {
            "email_send_results": [],
            "emails_sent_count": 0
        }
    
    # Check SMTP configuration
    if not all([MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD]):
        logger.error("SMTP credentials not configured")
        return {
            "email_send_results": [],
            "emails_sent_count": 0,
            "send_error": "SMTP credentials not configured"
        }
    
    logger.info(f"Preparing to send {len(personalized_content)} email(s)")
    logger.info(f"Hardcoded recipients: {', '.join(HARDCODED_TEST_EMAILS)}")
    logger.info(f"Classification ID: {state.get('classification_id', 'NOT SET')}")
    
    send_results = []
    successful_sends = 0
    db = get_db()
    
    try:
        # Connect to SMTP server
        logger.info(f"Connecting to SMTP server: {MAILEROO_SMTP_HOST}:{MAILEROO_SMTP_PORT}")
        
        if MAILEROO_USE_TLS:
            server = smtplib.SMTP(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT)
        
        server.login(MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD)
        logger.info("✓ SMTP authentication successful")
        
        # Send emails - 1:1 mapping between personalized content and hardcoded recipients
        for idx, content in enumerate(personalized_content):
            prospect_id = content.get("prospect_id")
            prospect_name = content.get("prospect_name", "Unknown")
            email_message = content.get("email_message", {})
            
            if not email_message:
                logger.warning(f"No email message for prospect {prospect_name}")
                continue
            
            subject = email_message.get("subject", "")
            body = email_message.get("body", "")
            
            # 1:1 mapping: each prospect email goes to one hardcoded address (cycling if needed)
            test_email = HARDCODED_TEST_EMAILS[idx % len(HARDCODED_TEST_EMAILS)]
            
            logger.info(f"\n--- Sending email {idx + 1}/{len(personalized_content)} for {prospect_name} -> {test_email} ---")
            
            try:
                # Create email message
                msg = MIMEMultipart('alternative')
                msg['From'] = f"{MAILEROO_FROM_NAME} <{MAILEROO_FROM_EMAIL}>"
                msg['To'] = test_email
                msg['Subject'] = subject
                
                # Add body
                # Add a note at the top indicating this is a test
                test_note = f"[TEST EMAIL - Originally for: {prospect_name}]\n\n"
                full_body = test_note + body
                
                msg.attach(MIMEText(full_body, 'plain'))
                
                # Send email
                server.send_message(msg)
                
                logger.info(f"  ✓ Sent to {test_email}")
                
                # Track in database - convert IDs to UUID if they're strings
                try:
                    execution_id_value = state.get("classification_id")
                    if execution_id_value and isinstance(execution_id_value, str):
                        execution_id_value = uuid.UUID(execution_id_value)
                    
                    prospect_id_value = prospect_id
                    if prospect_id_value and isinstance(prospect_id_value, str):
                        prospect_id_value = uuid.UUID(prospect_id_value)
                    
                    sent_email = SentEmail(
                        id=uuid.uuid4(),
                        execution_id=execution_id_value,
                        prospect_id=prospect_id_value,
                        prospect_name=prospect_name,
                        prospect_email=content.get("prospect_email", "unknown@example.com"),
                        prospect_company=content.get("prospect_company"),
                        prospect_job_title=content.get("prospect_job_title"),
                        email_subject=subject,
                        email_body=body,
                        recipient_email=test_email,
                        sent_by_role="admin",
                        sent_at=datetime.utcnow(),
                        status="sent"
                    )
                    db.add(sent_email)
                    successful_sends += 1
                except Exception as db_err:
                    logger.error(f"  ✗ Database error tracking email for {test_email}: {db_err}")
                    # Continue even if DB tracking fails
                    successful_sends += 1
                
            except smtplib.SMTPException as e:
                logger.error(f"  ✗ Failed to send to {test_email}: {e}")
                send_results.append({
                    "prospect_id": prospect_id,
                    "prospect_name": prospect_name,
                    "recipient_email": test_email,
                    "status": "failed",
                    "error": str(e)
                })
                continue
            except Exception as e:
                logger.error(f"  ✗ Unexpected error sending to {test_email}: {e}")
                send_results.append({
                    "prospect_id": prospect_id,
                    "prospect_name": prospect_name,
                    "recipient_email": test_email,
                    "status": "failed",
                    "error": str(e)
                })
                continue
            
            # Record successful send for this prospect
            send_results.append({
                "prospect_id": prospect_id,
                "prospect_name": prospect_name,
                "status": "sent",
                "recipient": test_email,
                "subject": subject
            })
        
        # Commit database changes
        db.commit()
        
        # Close SMTP connection
        server.quit()
        logger.info("✓ SMTP connection closed")
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {e}")
        db.rollback()
        return {
            "email_send_results": send_results,
            "emails_sent_count": successful_sends,
            "send_error": "SMTP authentication failed"
        }
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {e}")
        db.rollback()
        return {
            "email_send_results": send_results,
            "emails_sent_count": successful_sends,
            "send_error": f"SMTP error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Unexpected error during email sending: {e}")
        db.rollback()
        return {
            "email_send_results": send_results,
            "emails_sent_count": successful_sends,
            "send_error": f"Unexpected error: {str(e)}"
        }
    finally:
        db.close()
    
    # Log summary
    logger.info(f"\n{'=' * 80}")
    logger.info(f"EMAIL SENDING SUMMARY:")
    logger.info(f"  Total Prospects: {len(personalized_content)}")
    logger.info(f"  Emails Sent: {successful_sends}")
    logger.info(f"  Test Recipients per prospect: {len(HARDCODED_TEST_EMAILS)}")
    logger.info(f"  Total Emails Dispatched: {successful_sends}")
    logger.info(f"{'=' * 80}\n")
    
    return {
        "email_send_results": send_results,
        "emails_sent_count": successful_sends
    }
