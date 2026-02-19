"""
Test the agent fixes with the original failing prompt
"""
import logging
from graph import build_graph
from state import AgentState

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Test prompt: "Target CTOs at financial companies in London with our cybersecurity compliance platform. Urgent, Q1 deadlines approaching."
test_prompt = "Target CTOs at financial companies in London with our cybersecurity compliance platform. Urgent, Q1 deadlines approaching."

test_input = {
    "user_prompt": test_prompt
}

print("="*80)
print("TESTING AGENT FIXES")
print("="*80)
print(f"\nINPUT PROMPT:")
print(f"  '{test_prompt}'")
print("\n" + "="*80)

# Create and run the graph
graph = build_graph()

# Run the graph
print("\nEXECUTING AGENT WORKFLOW...")
print("="*80 + "\n")

try:
    result = graph.invoke(test_input)
    
    print("\n" + "="*80)
    print("RESULT ANALYSIS")
    print("="*80)
    
    # Input Parser Results
    print("\n1. INPUT PARSER:")
    print(f"   ✓ Time: {result.get('time', 'N/A')}")
    print(f"   ✓ Location: {result.get('location', 'N/A')}")
    print(f"   ✓ Business: {result.get('business_behavior', 'N/A')}")
    print(f"   ✓ Intent: {result.get('user_intent', 'N/A')}")
    print(f"   ✓ Target: {result.get('target_audience', 'N/A')}")
    
    # Classifier Results
    print("\n2. CLASSIFIER:")
    category = result.get('category', 'N/A')
    confidence = result.get('confidence', 0)
    print(f"   Category: {category}")
    print(f"   Confidence: {confidence}")
    print(f"   ✓ Expected B2B_lead_gen: {'✓' if category == 'B2B_lead_gen' else '✗ FAILED'}")
    
    # Strategy Results
    print("\n3. STRATEGY:")
    tone = result.get('tone', 'N/A')
    cta = result.get('cta_type', 'N/A')
    urgency = result.get('urgency_level', 'N/A')
    print(f"   Tone: {tone}")
    print(f"   CTA: {cta}")
    print(f"   Urgency: {urgency}")
    print(f"   ✓ Urgency HIGH: {'✓' if urgency == 'high' else '✗ FAILED (should detect Urgent keyword)'}")
    print(f"   ✓ Sales-focused CTA: {'✓' if cta in ['book_demo', 'schedule_call', 'start_trial'] else '✗ FAILED'}")
    print(f"   ✓ NOT educational tone: {'✓' if tone != 'educational' else '✗ FAILED'}")
    
    # ICP Matcher Results
    print("\n4. ICP MATCHER:")
    prospects = result.get('top_prospects', [])
    archetype = result.get('target_archetype', 'N/A')
    print(f"   Prospects found: {len(prospects)}")
    print(f"   Target archetype: {archetype}")
    
    if prospects:
        # Analyze first prospect to check targeting
        p = prospects[0]
        print(f"\n   Sample Prospect:")
        print(f"   - Name: {p.get('name', 'N/A')}")
        print(f"   - Title: {p.get('job_title', 'N/A')}")
        print(f"   - Department: {p.get('department', 'N/A')}")
        print(f"   - Seniority: {p.get('seniority_level', 'N/A')}")
        print(f"   - Industry: {p.get('industry', 'N/A')}")
        print(f"   - Company: {p.get('company_name', 'N/A')}")
        
        # Check targeting accuracy
        finance_count = sum(1 for p in prospects if p.get('industry') == 'Finance')
        it_dept_count = sum(1 for p in prospects if p.get('department') == 'IT')
        c_level_count = sum(1 for p in prospects if p.get('seniority_level') == 'c_level')
        
        print(f"\n   Targeting Accuracy:")
        print(f"   - Finance industry: {finance_count}/{len(prospects)} ({finance_count/len(prospects)*100:.0f}%)")
        print(f"   - IT department: {it_dept_count}/{len(prospects)} ({it_dept_count/len(prospects)*100:.0f}%)")
        print(f"   - C-level: {c_level_count}/{len(prospects)} ({c_level_count/len(prospects)*100:.0f}%)")
        
        print(f"\n   ✓ Finance extraction: {'✓' if finance_count > 0 else '✗ FAILED'}")
        print(f"   ✓ IT dept mapping: {'✓' if it_dept_count > 0 else '✗ FAILED'}")
        print(f"   ✓ C-level targeting: {'✓' if c_level_count > 0 else '✗ FAILED'}")
        print(f"   ✓ Archetype mentions CTOs/Finance: {'✓' if ('CTO' in archetype or 'Finance' in archetype or 'Financial' in archetype) else '✗ FAILED'}")
    else:
        print("   ✗ NO PROSPECTS FOUND - CRITICAL FAILURE")
    
    # Engagement Analyzer Results (if present)
    if 'prospects_filtered_count' in result:
        filtered = result.get('prospects_filtered_count', 0)
        print(f"\n5. ENGAGEMENT ANALYZER:")
        print(f"   Prospects filtered: {filtered}")
        print(f"   Remaining: {len(prospects)}")
    
    # Platform Decision
    if 'selected_channels' in result:
        channels = result.get('selected_channels', [])
        print(f"\n6. PLATFORM DECISION:")
        print(f"   Selected channels: {', '.join(channels)}")
        print(f"   ✓ Has channels: {'✓' if channels else '✗ FAILED'}")
    
     # Content Generation
    if 'generated_content' in result:
        print(f"\n7. CONTENT GENERATION:")
        content = result.get('generated_content', {})
        for channel, data in content.items():
            print(f"\n   {channel.upper()}:")
            if isinstance(data, dict):
                print(f"   - Subject: {data.get('subject', 'N/A')[:60]}...")
                print(f"   - Product: {data.get('product_name', 'N/A')}")
                print(f"   - CTA: {data.get('cta', 'N/A')[:50]}...")
            else:
                print(f"   {str(data)[:100]}...")
    
    print("\n" + "="*80)
    print("SUCCESS SUMMARY")
    print("="*80)
    
    success_count = 0
    total_checks = 9
    
    # Count successes
    if category == 'B2B_lead_gen': success_count += 1
    if urgency == 'high': success_count += 1
    if cta in ['book_demo', 'schedule_call', 'start_trial']: success_count += 1
    if tone != 'educational': success_count += 1
    if len(prospects) > 0: success_count += 1
    if finance_count > 0: success_count += 1
    if it_dept_count > 0: success_count += 1
    if c_level_count > 0: success_count += 1
    if 'CTO' in archetype or 'Finance' in archetype or 'Financial' in archetype: success_count += 1
    
    print(f"\nPassed: {success_count}/{total_checks} checks ({success_count/total_checks*100:.0f}%)")
    
    if success_count == total_checks:
        print("🎉 ALL TESTS PASSED! Agent is working correctly.")
    elif success_count >= 7:
        print("✓ GOOD - Most critical fixes working, some minor issues remain")
    elif success_count >= 5:
        print("⚠ PARTIAL - Some fixes working but major issues remain")
    else:
        print("✗ FAILED - Critical issues remain, agent needs more fixes")
    
    print("="*80)
    
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    import traceback
    traceback.print_exc()
