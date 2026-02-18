# GITHUB COPILOT FIX PROMPT — Critical Issues in Multi-Agent System

## CONTEXT
I have a working multi-agent marketing system, but there are 3 critical issues causing wrong outputs:

1. **Wrong product selection** — picks first product from search results instead of best match
2. **Naive ICP fallback** — returns random prospects instead of trying relaxed filters
3. **Generic content** — doesn't validate that generated content matches user intent

---

## ISSUE 1: Product Selection Logic (CRITICAL)

**File:** `nodes/content_generator.py`  
**Current code (lines 65-67):**
```python
if products:
    product_info = products[0]  # ← WRONG: takes first blindly
```

**Problem:**
- `get_products_by_keywords()` returns 5 products matching ANY keyword
- System picks the first one without checking which is the BEST match
- Example: User asks for "HR payroll software", finds ["CloseGas Platform", "FlowHR Platform", ...]
- Picks "CloseGas" just because it's first, even though "FlowHR" has "HR" and "Flow" in the name

**Required Fix:**
```python
# Score each product by how many keywords match in name + description
# Pick the product with the highest score
# If tie, pick first one
# Make sure to handle case where keywords list is empty

if products:
    best_product = None
    best_score = 0
    
    for product in products:
        score = 0
        product_text = f"{product['name']} {product['description']} {product.get('key_benefits', '')}".lower()
        
        # Count keyword matches
        for keyword in keywords:
            if keyword.lower() in product_text:
                score += 1
        
        # Update best if this scores higher
        if score > best_score:
            best_score = score
            best_product = product
    
    # Use best match, or first if no keywords matched
    product_info = best_product if best_product and best_score > 0 else products[0]
    logger.info(f"Selected product '{product_info.get('name')}' with score {best_score}")
else:
    # ... existing fallback logic
```

**Test case after fix:**
- Keywords: `['HR', 'Flow', 'payroll']`
- Products found: ["CloseGas Platform", "FlowHR Platform", "DataBridge", ...]
- Expected selection: "FlowHR Platform" (has "HR" + "Flow" = score 2)

---

## ISSUE 2: ICP Fallback Logic (CRITICAL)

**File:** `nodes/icp_matcher.py`  
**Current code (lines 80-87):**
```python
if not prospects:
    logger.warning("No prospects found matching criteria, using fallback")
    # Fallback: get any prospects
    db = get_db()
    prospects = get_top_prospects_by_criteria(db=db, limit=15)
    db.close()
```

**Problem:**
- If exact match fails (e.g., dept=HR + location=UK), immediately returns ANY 15 prospects
- No attempt to relax filters intelligently
- Results in completely wrong targeting (CMO in Media when user asked for HR in UK)

**Required Fix:**
```python
# Try progressive filter relaxation:
# 1. All filters (industry + dept + location)
# 2. If none: Try dept + location (drop industry)
# 3. If none: Try dept only (drop location)
# 4. If none: Try industry + dept (drop location)
# 5. If none: Try industry only
# 6. Last resort: Get top 15 by priority score

if not prospects:
    logger.warning(f"No prospects found with industry={industry}, dept={department}, loc={location}")
    db = get_db()
    
    # Try 1: Relax industry only
    if department or location:
        logger.info("Attempting fallback: department and/or location only")
        prospects = get_top_prospects_by_criteria(
            db=db,
            industry=None,
            department=department,
            location=location,
            limit=15
        )
    
    # Try 2: Department only (most important for targeting)
    if not prospects and department:
        logger.info(f"Attempting fallback: {department} department globally")
        prospects = get_top_prospects_by_criteria(
            db=db,
            industry=None,
            department=department,
            location=None,
            limit=15
        )
    
    # Try 3: Industry only
    if not prospects and industry:
        logger.info(f"Attempting fallback: {industry} industry globally")
        prospects = get_top_prospects_by_criteria(
            db=db,
            industry=industry,
            department=None,
            location=None,
            limit=15
        )
    
    # Try 4: Last resort - top prospects by priority
    if not prospects:
        logger.warning("All specific filters failed, returning top prospects by priority score")
        prospects = get_top_prospects_by_criteria(db=db, limit=15)
    
    db.close()
    logger.info(f"Fallback successful: found {len(prospects)} prospects")
```

**Test case after fix:**
- Query: dept=HR, location=UK
- Try 1: dept=HR + location=UK → 0 results
- Try 2: dept=HR globally → Should find HR prospects from any country
- Result: HR Directors, HR Managers (correct targeting even if not in UK)

---

## ISSUE 3: Content Validation (MEDIUM PRIORITY)

**File:** `nodes/content_generator.py`  
**After content generation (line ~130):**

**Problem:**
- Content is generated but never validated
- LLM might produce generic content that doesn't mention the actual product/keywords
- No way to know if content is relevant

**Required Fix:**
```python
# After parsing JSON response and before returning state:

# Validate that content mentions key terms from business_behavior
validation_keywords = []
behavior_lower = business_behavior.lower()

# Extract 2-3 most important keywords
if "hr" in behavior_lower or "payroll" in behavior_lower:
    validation_keywords = ["hr", "payroll", "employee"]
elif "security" in behavior_lower or "cyber" in behavior_lower:
    validation_keywords = ["security", "threat", "compliance"]
elif "crm" in behavior_lower or "sales" in behavior_lower:
    validation_keywords = ["sales", "crm", "pipeline"]
elif "data" in behavior_lower or "analytics" in behavior_lower:
    validation_keywords = ["data", "analytics", "reporting"]
elif "marketing" in behavior_lower:
    validation_keywords = ["marketing", "campaign", "outreach"]

# Check if content mentions at least ONE validation keyword
if validation_keywords:
    content_text = f"{linkedin_message} {email_message.get('body', '')} {call_script.get('opener', '')}".lower()
    matches = [kw for kw in validation_keywords if kw in content_text]
    
    if not matches:
        logger.warning(f"Content validation failed: none of {validation_keywords} found in generated content")
        logger.warning("Content may be too generic or off-topic")
    else:
        logger.info(f"Content validation passed: found keywords {matches}")
```

**This doesn't regenerate content, just logs warnings so you can see when content is off-topic.**

---

## ISSUE 4: Better Logging for Debugging

**File:** `nodes/icp_matcher.py` (line 83)

**Add this logging after keyword extraction:**
```python
logger.info(f"Extracted keywords from business_behavior: industry={industry}, department={department}")
logger.info(f"Will query prospects with these filters")
```

**File:** `nodes/content_generator.py` (line 66)

**Add this after product selection:**
```python
if products:
    logger.info(f"Products found: {[p.get('name') for p in products]}")
    logger.info(f"Selected: {product_info.get('name')} (best keyword match)")
```


## DELIVERABLES

Update these 2 files with the fixes above:
1. `nodes/content_generator.py` — Fix product selection + add validation
2. `nodes/icp_matcher.py` — Fix fallback logic with progressive relaxation

Maintain all existing error handling and logging patterns.
Keep the same function signatures (don't break the graph).
Add the new logging statements for better debugging visibility.

---

## SUCCESS CRITERIA

After implementing these fixes:
✅ Product selection consistently picks the most relevant product based on keywords
✅ ICP fallback tries department-only before returning random prospects
✅ Content validation logs warnings when generated text doesn't match user intent
✅ All 3 test prompts above produce sensible, on-topic outputs