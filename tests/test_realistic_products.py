"""
Test the content generator's ability to create realistic products when no database match exists
"""
import logging
from graph import build_graph

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

print("="*80)
print("TESTING PRODUCT GENERATION (NO DATABASE MATCH)")
print("="*80)

# Test different scenarios where products won't match database
test_cases = [
    {
        "name": "AI-Powered CRM",
        "prompt": "Promote our AI-powered CRM that uses machine learning to predict customer churn and automate sales workflows"
    },
    {
        "name": "Cloud Accounting Software",
        "prompt": "Sell cloud accounting software that helps small businesses automate invoicing and tax compliance"
    },
    {
        "name": "Employee Wellness Platform",
        "prompt": "Market our employee wellness platform that tracks mental health and promotes work-life balance"
    },
]

graph = build_graph()

for i, test_case in enumerate(test_cases, 1):
    print(f"\n{'='*80}")
    print(f"TEST CASE {i}: {test_case['name']}")
    print(f"{'='*80}")
    print(f"Prompt: '{test_case['prompt']}'")
    print(f"\nExecuting...")
    
    try:
        result = graph.invoke({
            "user_prompt": test_case['prompt']
        })
        
        # Check if content was generated
        email_content = result.get('email_message', {})
        linkedin_content = result.get('linkedin_message', '')
        
        print(f"\n✓ Content Generated Successfully")
        print(f"\nEmail Subject: {email_content.get('subject', 'N/A')}")
        print(f"\nLinkedIn Preview (first 200 chars):")
        print(f"{linkedin_content[:200]}...")
        
        # Check if realistic product was mentioned
        email_body = email_content.get('body', '')
        combined_content = f"{email_body} {linkedin_content}".lower()
        
        # Look for product-specific keywords from the prompt
        prompt_lower = test_case['prompt'].lower()
        
        if 'ai' in prompt_lower and 'crm' in prompt_lower:
            if 'ai' in combined_content or 'machine learning' in combined_content or 'predict' in combined_content:
                print("\n✓ Product context maintained (AI/ML/prediction mentioned)")
            else:
                print("\n⚠ Product context possibly weak")
                
        elif 'accounting' in prompt_lower:
            if 'accounting' in combined_content or 'invoicing' in combined_content or 'tax' in combined_content:
                print("\n✓ Product context maintained (accounting features mentioned)")
            else:
                print("\n⚠ Product context possibly weak")
                
        elif 'wellness' in prompt_lower or 'mental health' in prompt_lower:
            if 'wellness' in combined_content or 'mental' in combined_content or 'health' in combined_content:
                print("\n✓ Product context maintained (wellness/health mentioned)")
            else:
                print("\n⚠ Product context possibly weak")
        
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()

print(f"\n{'='*80}")
print("TEST COMPLETE")
print(f"{'='*80}")
print("\nNote: The system should generate realistic product names and value propositions")
print("that match the user's business description, even without database products.")
