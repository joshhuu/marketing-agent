"""
Email Validator Node (Agent 5)
Validates email content for spam triggers and professionalism before sending
"""
import logging
import json
from typing import Dict, Any, List

from state import AgentState
from utils.llm import get_llm
from config import TEMPERATURE_CONFIG
from prompts.email_validator_prompt import get_email_validator_prompt

# Configure logging
logger = logging.getLogger(__name__)


def validate_email(state: AgentState) -> Dict[str, Any]:
    """
    Validates all generated email content for spam indicators and professionalism
    
    This node:
    1. Checks each personalized email for spam triggers
    2. Validates professionalism of content
    3. Provides detailed feedback and recommendations
    4. Marks emails as approved or rejected
    
    Args:
        state: Current agent state with personalized_content
        
    Returns:
        Updated state with email_validation_results
    """
    logger.info("=" * 80)
    logger.info("EMAIL VALIDATOR NODE - Starting email validation")
    logger.info("=" * 80)
    
    personalized_content = state.get("personalized_content", [])
    selected_channel = state.get("selected_channel", "email")
    
    # Only validate if channel is email
    if selected_channel != "email":
        logger.info(f"Channel is {selected_channel}, skipping email validation")
        return {
            "email_validation_results": [],
            "emails_approved": True  # Auto-approve non-email channels
        }
    
    if not personalized_content:
        logger.warning("No personalized content to validate")
        return {
            "email_validation_results": [],
            "emails_approved": False
        }
    
    logger.info(f"Validating {len(personalized_content)} email(s)")
    
    # Get LLM for validation
    llm = get_llm(temperature=TEMPERATURE_CONFIG.get("email_validator", 0.2))
    
    validation_results = []
    all_passed = True
    
    for idx, content in enumerate(personalized_content):
        prospect_name = content.get("prospect_name", "Unknown")
        email_message = content.get("email_message", {})
        
        if not email_message:
            logger.warning(f"No email message found for prospect {prospect_name}")
            continue
        
        subject = email_message.get("subject", "")
        body = email_message.get("body", "")
        
        logger.info(f"\n--- Validating email {idx + 1}/{len(personalized_content)} for {prospect_name} ---")
        logger.info(f"Subject: {subject[:50]}...")
        
        try:
            # Generate validation prompt
            prompt = get_email_validator_prompt(subject, body)
            
            # Call LLM for validation
            response = llm.invoke(prompt)
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Parse JSON response
            # Clean response to extract JSON
            response_text = response_text.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            validation_data = json.loads(response_text)
            
            # Determine if email passed validation
            passed = validation_data.get("overall_verdict", "FAIL") == "PASS"
            
            if not passed:
                all_passed = False
            
            # Store validation result
            result = {
                "prospect_id": content.get("prospect_id"),
                "prospect_name": prospect_name,
                "subject": subject,
                "is_spam_free": validation_data.get("is_spam_free", False),
                "is_professional": validation_data.get("is_professional", False),
                "spam_score": validation_data.get("spam_score", 100),
                "professionalism_score": validation_data.get("professionalism_score", 0),
                "spam_issues": validation_data.get("spam_issues", []),
                "professionalism_issues": validation_data.get("professionalism_issues", []),
                "recommendations": validation_data.get("recommendations", []),
                "verdict": validation_data.get("overall_verdict", "FAIL"),
                "summary": validation_data.get("summary", "Validation failed"),
                "passed": passed
            }
            
            validation_results.append(result)
            
            # Log detailed results
            logger.info(f"✓ Validation complete for {prospect_name}")
            logger.info(f"  Verdict: {result['verdict']}")
            logger.info(f"  Spam Score: {result['spam_score']}/100 (threshold: <50)")
            logger.info(f"  Professionalism Score: {result['professionalism_score']}/100 (threshold: >60)")
            logger.info(f"  Spam Free: {result['is_spam_free']}")
            logger.info(f"  Professional: {result['is_professional']}")
            
            if not passed:
                logger.warning(f"  ⚠ VALIDATION FAILED for {prospect_name}")
                logger.warning(f"     Requirements: spam_free=True, professional=True, spam<50, prof>60")
            
            if result['spam_issues']:
                logger.warning(f"  Spam Issues: {', '.join(result['spam_issues'])}")
            if result['professionalism_issues']:
                logger.warning(f"  Professionalism Issues: {', '.join(result['professionalism_issues'])}")
            if result['recommendations']:
                logger.info(f"  Recommendations: {', '.join(result['recommendations'][:3])}...")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse validation response for {prospect_name}: {e}")
            logger.debug(f"Raw response: {response_text[:200]}")
            all_passed = False
            validation_results.append({
                "prospect_id": content.get("prospect_id"),
                "prospect_name": prospect_name,
                "subject": subject,
                "verdict": "FAIL",
                "summary": "Validation parsing failed",
                "passed": False,
                "spam_score": 100,
                "professionalism_score": 0
            })
            
        except Exception as e:
            logger.error(f"Validation error for {prospect_name}: {e}")
            all_passed = False
            validation_results.append({
                "prospect_id": content.get("prospect_id"),
                "prospect_name": prospect_name,
                "subject": subject,
                "verdict": "FAIL",
                "summary": f"Validation error: {str(e)}",
                "passed": False,
                "spam_score": 100,
                "professionalism_score": 0
            })
    
    # Log summary
    passed_count = sum(1 for r in validation_results if r.get("passed", False))
    failed_count = len(validation_results) - passed_count
    
    logger.info(f"\n{'=' * 80}")
    logger.info(f"VALIDATION SUMMARY:")
    logger.info(f"  Total Emails: {len(validation_results)}")
    logger.info(f"  Passed: {passed_count}")
    logger.info(f"  Failed: {failed_count}")
    logger.info(f"  Overall Approval: {'✓ APPROVED' if all_passed else '✗ REJECTED'}")
    
    if not all_passed:
        logger.warning(f"\n  EMAILS WILL NOT BE SENT - VALIDATION FAILED")
        logger.warning(f"  Check individual email validation results above for details")
    else:
        logger.info(f"\n  ✓ ALL EMAILS APPROVED - PROCEEDING TO SEND")
    
    logger.info(f"{'=' * 80}\n")
    
    return {
        "email_validation_results": validation_results,
        "emails_approved": all_passed
    }
