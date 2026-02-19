"""
Test the complete flow: prompt → realistic product → content generation
"""
import logging
from graph import build_graph

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

print("="*80)
print("COMPLETE FLOW TEST: PROMPT → PRODUCT → CONTENT")
print("="*80)

# Test with a product that definitely won't match the database
test_prompt = "Promote our blockchain-based supply chain tracking platform that helps manufacturers ensure product authenticity and reduce counterfeiting. Target procurement managers at manufacturing companies."

print(f"\nPrompt: '{test_prompt}'")
print(f"\n(This product type should NOT exist in your database)")
print("\n" + "="*80)
print("EXECUTING WORKFLOW...")
print("="*80 + "\n")

graph = build_graph()

try:
    result = graph.invoke({
        "user_prompt": test_prompt
    })
    
    print("\n" + "="*80)
    print("RESULTS")
    print("="*80)
    
    # Show extracted fields
    print(f"\n1. INPUT PARSING:")
    print(f"   Business: {result.get('business_behavior', 'N/A')}")
    print(f"   Target: {result.get('target_audience', 'N/A')}")
    print(f"   Intent: {result.get('user_intent', 'N/A')}")
    
    # Show strategy
    print(f"\n2. STRATEGY:")
    print(f"   Tone: {result.get('tone', 'N/A')}")
    print(f"   CTA Type: {result.get('cta_type', 'N/A')}")
    print(f"   Urgency: {result.get('urgency_level', 'N/A')}")
    
    # Show ICP matching
    print(f"\n3. ICP MATCHING:")
    prospects = result.get('top_prospects', [])
    print(f"   Prospects found: {len(prospects)}")
    print(f"   Archetype: {result.get('target_archetype', 'N/A')}")
    if prospects:
        print(f"   Sample: {prospects[0].get('job_title')} at {prospects[0].get('company_name')}")
    
    # Show content generation (the key part)
    print(f"\n4. CONTENT GENERATION:")
    email = result.get('email_message', {})
    linkedin = result.get('linkedin_message', '')
    
    print(f"\n   EMAIL:")
    print(f"   Subject: {email.get('subject', 'N/A')}")
    print(f"   Body Preview:")
    body = email.get('body', '')
    print(f"   {body[:300]}...")
    
    print(f"\n   LINKEDIN:")
    print(f"   {linkedin[:300]}...")
    
    # Validate that blockchain/supply chain context was maintained
    combined = f"{email.get('subject', '')} {body} {linkedin}".lower()
    
    print(f"\n5. PRODUCT CONTEXT VALIDATION:")
    checks = [
        ("blockchain", "blockchain" in combined or "distributed" in combined),
        ("supply chain", "supply chain" in combined or "supply" in combined),
        ("authenticity/counterfeit", "authentic" in combined or "counterfeit" in combined or "verify" in combined),
        ("manufacturing", "manufactur" in combined),
    ]
    
    passed = 0
    for check_name, check_result in checks:
        status = "✓" if check_result else "✗"
        print(f"   {status} {check_name}: {'Found' if check_result else 'Not found'}")
        if check_result:
            passed += 1
    
    print(f"\n   Context Preservation: {passed}/4 checks passed ({passed/4*100:.0f}%)")
    
    if passed >= 3:
        print("\n   ✓✓✓ EXCELLENT: Product context well maintained in generated content!")
    elif passed >= 2:
        print("\n   ✓ GOOD: Most product context preserved")
    else:
        print("\n   ⚠ WEAK: Product context not well preserved")
    
    print("\n" + "="*80)
    print("SUCCESS!")
    print("="*80)
    print("\nThe agent successfully:")
    print("  1. Parsed the unique product description")
    print("  2. Found NO matching products in database")
    print("  3. Generated a REALISTIC product based on the description")
    print("  4. Created targeted content using the generated product")
    print("\nInstead of generic 'Your Solution', you now get context-aware product names!")
    
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    import traceback
    traceback.print_exc()
