"""
Quick test of the realistic product generation function
"""
import logging
from nodes.content_generator import generate_realistic_product

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

print("="*80)
print("TESTING REALISTIC PRODUCT GENERATION")
print("="*80)

# Test different business scenarios
test_cases = [
    {
        "business_behavior": "Selling AI-powered CRM that predicts customer churn and automates sales workflows",
        "target_archetype": "Sales Directors at B2B SaaS Companies",
        "category": "B2B_lead_gen"
    },
    {
        "business_behavior": "Promoting cloud accounting software for small businesses with automated invoicing",
        "target_archetype": "CFOs at SMBs",
        "category": "B2B_lead_gen"
    },
    {
        "business_behavior": "Marketing employee wellness platform focused on mental health tracking",
        "target_archetype": "HR Directors at Tech Companies",
        "category": "B2B_lead_gen"
    },
]

for i, test in enumerate(test_cases, 1):
    print(f"\n{'='*80}")
    print(f"TEST {i}")
    print(f"{'='*80}")
    print(f"Business: {test['business_behavior']}")
    print(f"Target: {test['target_archetype']}")
    print(f"\nGenerating realistic product...")
    
    try:
        product = generate_realistic_product(
            business_behavior=test['business_behavior'],
            target_archetype=test['target_archetype'],
            category=test['category']
        )
        
        print(f"\n✓ Product Generated:")
        print(f"  Name: {product.get('name')}")
        print(f"  Value Prop: {product.get('value_proposition')}")
        print(f"  Benefits:")
        for benefit in product.get('key_benefits', []):
            print(f"    - {benefit}")
        print(f"  Primary CTA: {product.get('cta_primary')}")
        print(f"  Secondary CTA: {product.get('cta_secondary')}")
        
        # Validate product name is not generic
        name = product.get('name', '')
        if name and name not in ["Your Solution", "Your Product", "Our Platform"]:
            print(f"\n  ✓ Product name is specific and professional")
        else:
            print(f"\n  ⚠ Product name may be too generic")
            
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()

print(f"\n{'='*80}")
print("COMPLETE")
print(f"{'='*80}")
