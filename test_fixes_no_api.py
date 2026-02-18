"""
Test Script — Validate Fixes Without Using LLM API
Run this to test product selection and ICP fallback logic directly
"""

# ============================================
# TEST 1: Product Selection Logic
# ============================================

print("=" * 70)
print("TEST 1: Product Selection Logic")
print("=" * 70)

# Mock products returned from database
mock_products = [
    {"name": "CloseGas Platform", "description": "Optimize operational workflows", "key_benefits": "Process efficiency"},
    {"name": "FlowHR Platform", "description": "Modern HR and payroll platform", "key_benefits": "Automated payroll, HR"},
    {"name": "DataBridge Analytics", "description": "Business intelligence platform", "key_benefits": "Data analytics"},
]

# Test Case 1: HR Keywords
print("\n[Test Case 1: HR Product Matching]")
keywords = ['HR', 'Flow', 'payroll']
print(f"Keywords: {keywords}")
print(f"Products available: {[p['name'] for p in mock_products]}")

# YOUR FIX: Score each product
best_product = None
best_score = 0

for product in mock_products:
    score = 0
    product_text = f"{product['name']} {product['description']} {product.get('key_benefits', '')}".lower()
    
    for keyword in keywords:
        if keyword.lower() in product_text:
            score += 1
    
    print(f"  - {product['name']}: score = {score}")
    
    if score > best_score:
        best_score = score
        best_product = product

product_info = best_product if best_product and best_score > 0 else mock_products[0]
print(f"✅ Selected: {product_info['name']} (score: {best_score})")
print(f"Expected: FlowHR Platform")
print(f"PASS: {product_info['name'] == 'FlowHR Platform'}")

# Test Case 2: Security Keywords
print("\n[Test Case 2: Security Product Matching]")
mock_products_2 = [
    {"name": "FlowHR Platform", "description": "HR and payroll", "key_benefits": "Automated payroll"},
    {"name": "ShieldLayer Security", "description": "Cybersecurity platform", "key_benefits": "Threat detection, compliance"},
    {"name": "Nexus CRM Pro", "description": "CRM for sales teams", "key_benefits": "Pipeline management"},
]

keywords = ['security', 'Shield', 'cyber', 'compliance']
print(f"Keywords: {keywords}")

best_product = None
best_score = 0

for product in mock_products_2:
    score = 0
    product_text = f"{product['name']} {product['description']} {product.get('key_benefits', '')}".lower()
    
    for keyword in keywords:
        if keyword.lower() in product_text:
            score += 1
    
    print(f"  - {product['name']}: score = {score}")
    
    if score > best_score:
        best_score = score
        best_product = product

product_info = best_product if best_product and best_score > 0 else mock_products_2[0]
print(f"✅ Selected: {product_info['name']} (score: {best_score})")
print(f"Expected: ShieldLayer Security")
print(f"PASS: {product_info['name'] == 'ShieldLayer Security'}")


# ============================================
# TEST 2: ICP Fallback Logic
# ============================================

print("\n" + "=" * 70)
print("TEST 2: ICP Fallback Logic")
print("=" * 70)

def mock_query(industry=None, department=None, location=None):
    """Simulate database query returning prospects"""
    # Simulate your actual database having:
    # - 0 HR prospects in UK
    # - 25 HR prospects globally
    # - 50 IT prospects globally
    # - 500 total prospects
    
    if department == "HR" and location == "UK":
        return []  # No HR in UK specifically
    elif department == "HR":
        return ["HR Manager 1", "HR Director 2", "HR Manager 3"]  # HR globally
    elif industry == "Finance" and department == "IT":
        return []  # No Finance+IT combo
    elif department == "IT":
        return ["IT Director 1", "CTO 2", "IT Manager 3"]  # IT globally
    elif industry == "Finance":
        return ["CFO 1", "Finance Director 2"]  # Finance globally
    else:
        return ["Random 1", "Random 2", "Random 3"]  # Fallback

print("\n[Test Case 1: HR + UK → Should fallback to HR globally]")
industry = None
department = "HR"
location = "UK"

print(f"Query: dept={department}, location={location}")
prospects = mock_query(industry=industry, department=department, location=location)

if not prospects:
    print("  ❌ No exact match found")
    
    # Try 1: Relax location
    if department or location:
        print(f"  → Trying: dept={department} globally")
        prospects = mock_query(industry=None, department=department, location=None)
    
    if prospects:
        print(f"  ✅ Fallback successful: {len(prospects)} prospects")
        print(f"  Found: {prospects}")
    
print(f"Expected: HR prospects globally")
print(f"PASS: {'HR' in str(prospects)}")


print("\n[Test Case 2: Finance+IT → Should try IT globally, then Finance]")
industry = "Finance"
department = "IT"
location = None

print(f"Query: industry={industry}, dept={department}")
prospects = mock_query(industry=industry, department=department, location=location)

if not prospects:
    print("  ❌ No exact match found")
    
    # Try dept only (more important)
    print(f"  → Trying: dept={department} globally")
    prospects = mock_query(industry=None, department=department, location=None)
    
    if not prospects:
        print(f"  → Trying: industry={industry} globally")
        prospects = mock_query(industry=industry, department=None, location=None)
    
    if prospects:
        print(f"  ✅ Fallback successful: {len(prospects)} prospects")
        print(f"  Found: {prospects}")

print(f"Expected: IT prospects (department priority)")
print(f"PASS: {'IT' in str(prospects)}")


# ============================================
# TEST 3: Content Validation
# ============================================

print("\n" + "=" * 70)
print("TEST 3: Content Validation")
print("=" * 70)

print("\n[Test Case 1: HR content validation]")
business_behavior = "pitching HR product"
generated_content = """
Hi, we help companies streamline their HR operations and automate payroll processing.
Our platform reduces manual work for your HR team by 60%.
"""

validation_keywords = ["hr", "payroll", "employee"]
content_lower = generated_content.lower()
matches = [kw for kw in validation_keywords if kw in content_lower]

print(f"Business behavior: {business_behavior}")
print(f"Validation keywords: {validation_keywords}")
print(f"Content mentions: {matches}")
print(f"✅ PASS: {len(matches) > 0}")


print("\n[Test Case 2: Wrong content detection]")
business_behavior = "pitching HR product"
generated_content_bad = """
Our platform helps optimize supply chain operations and reduce manufacturing costs.
We streamline logistics workflows for mid-market companies.
"""

content_lower = generated_content_bad.lower()
matches = [kw for kw in validation_keywords if kw in content_lower]

print(f"Business behavior: {business_behavior}")
print(f"Validation keywords: {validation_keywords}")
print(f"Content mentions: {matches}")
print(f"⚠️  Should fail validation: {len(matches) == 0}")


print("\n" + "=" * 70)
print("ALL TESTS COMPLETE")
print("=" * 70)
print("\nIf all tests PASS, the logic fixes are correct.")
print("You can then apply them to your actual code without burning API calls.")