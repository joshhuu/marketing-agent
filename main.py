"""
Main entry point for Multi-Agent Marketing System
Run this file to execute the full workflow
"""
import logging
import sys
from typing import Optional

from graph import build_graph
from config import LOG_LEVEL

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def print_separator(title: str = "", char: str = "=", width: int = 70):
    """Print a formatted separator line"""
    if title:
        print(f"\n{char * width}")
        print(f"{title.center(width)}")
        print(f"{char * width}")
    else:
        print(f"{char * width}")


def print_results(result: dict):
    """
    Pretty print the results from the agent workflow
    
    Args:
        result: Final state dictionary from graph execution
    """
    print_separator("CLASSIFICATION")
    print(f"Category: {result.get('category', 'N/A')}")
    print(f"Confidence: {result.get('confidence', 0):.0%}")
    
    print_separator("STRATEGY")
    print(f"Tone: {result.get('tone', 'N/A')}")
    print(f"CTA: {result.get('cta_type', 'N/A')}")
    print(f"Urgency: {result.get('urgency_level', 'N/A')}")
    
    top_prospects = result.get('top_prospects', [])
    print_separator(f"TARGET PROSPECTS ({len(top_prospects)} found)")
    print(f"Archetype: {result.get('target_archetype', 'N/A')}\n")
    
    for i, p in enumerate(top_prospects[:5], 1):
        print(f"{i}. {p.get('name', 'Unknown')} - {p.get('job_title', 'Unknown')}")
        print(f"   {p.get('company_name', 'Unknown')} | {p.get('industry', 'Unknown')} | "
              f"Priority Score: {p.get('priority_score', 0):.2f}")
    
    if len(top_prospects) > 5:
        print(f"\n... and {len(top_prospects) - 5} more prospects")
    
    print_separator("CHANNEL DECISION")
    print(f"Selected: {result.get('selected_channel', 'N/A').upper()}")
    print(f"Reasoning: {result.get('channel_reasoning', 'N/A')}")
    
    selected_channel = result.get('selected_channel', 'email')
    
    print_separator(f"{selected_channel.upper()} CONTENT")
    
    if selected_channel == 'email':
        email_message = result.get('email_message', {})
        print(f"Subject: {email_message.get('subject', 'N/A')}\n")
        print(email_message.get('body', 'N/A'))
    elif selected_channel == 'linkedin':
        print(result.get('linkedin_message', 'N/A'))
    else:  # call
        call_script = result.get('call_script', {})
        print(f"OPENER:\n{call_script.get('opener', 'N/A')}\n")
        
        objections = call_script.get('objections', [])
        if objections:
            print("\nOBJECTION HANDLING:")
            for i, obj in enumerate(objections, 1):
                print(f"{i}. {obj}")
        
        print(f"\nCLOSE:\n{call_script.get('close', 'N/A')}")
    
    # Show all content types
    print_separator("ALL GENERATED CONTENT")
    
    print("\n📧 EMAIL:")
    print("-" * 70)
    email_message = result.get('email_message', {})
    print(f"Subject: {email_message.get('subject', 'N/A')}")
    print(f"\n{email_message.get('body', 'N/A')}")
    
    print("\n\n💼 LINKEDIN:")
    print("-" * 70)
    print(result.get('linkedin_message', 'N/A'))
    
    print("\n\n📞 CALL SCRIPT:")
    print("-" * 70)
    call_script = result.get('call_script', {})
    print(f"Opener: {call_script.get('opener', 'N/A')}")
    print(f"\nObjections: {', '.join(call_script.get('objections', []))}")
    print(f"\nClose: {call_script.get('close', 'N/A')}")
    
    print_separator()


def main(user_prompt: Optional[str] = None):
    """
    Main execution function
    
    Args:
        user_prompt: Optional custom prompt, uses default test prompt if None
    """
    print_separator("MULTI-AGENT MARKETING CONTENT SYSTEM", char="*")
    
    # Use provided prompt or default test prompt
    if user_prompt is None:
        user_prompt = (
            "I'm Josh from Xyndrix, selling HR payroll software in UK. "
            "Want to reach HR managers at mid-sized companies dealing with "
            "manual payroll headaches."
        )
    
    print(f"\nUser Prompt:\n{user_prompt}")
    
    try:
        # Build the graph
        logger.info("Initializing agent workflow...")
        graph = build_graph()
        
        # Execute the workflow
        logger.info("Starting agent execution...")
        print_separator("EXECUTING WORKFLOW")
        
        result = graph.invoke({"user_prompt": user_prompt})
        
        logger.info("Workflow completed successfully")
        
        # Print results
        print_results(result)
        
        return result
        
    except Exception as e:
        logger.error(f"Error during execution: {e}", exc_info=True)
        print(f"\n❌ ERROR: {e}")
        print("\nPlease check:")
        print("1. GOOGLE_API_KEY is set in your environment")
        print("2. PostgreSQL database is running and accessible")
        print("3. All dependencies are installed (pip install -r requirements.txt)")
        return None


if __name__ == "__main__":
    # Check for command line argument
    if len(sys.argv) > 1:
        custom_prompt = " ".join(sys.argv[1:])
        main(custom_prompt)
    else:
        # Run with default test prompt
        main()
