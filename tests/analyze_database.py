"""
Comprehensive database analysis for agent optimization
"""
from database import get_db
from sqlalchemy import text
import json

db = get_db()

print("="*80)
print("DATABASE ANALYSIS FOR AGENT OPTIMIZATION")
print("="*80)

# 1. PROSPECTS ANALYSIS
print("\n1. PROSPECTS TABLE:")
print("-"*80)

# Industries
result = db.execute(text("""
    SELECT industry, COUNT(*) as count 
    FROM prospects 
    GROUP BY industry 
    ORDER BY count DESC
""")).fetchall()
print("\n📊 Industries:")
for row in result:
    print(f"   {row[0]}: {row[1]} prospects")

# Departments
result = db.execute(text("""
    SELECT department, COUNT(*) as count 
    FROM prospects 
    GROUP BY department 
    ORDER BY count DESC
""")).fetchall()
print("\n📊 Departments:")
for row in result:
    print(f"   {row[0]}: {row[1]} prospects")

# Seniority levels
result = db.execute(text("""
    SELECT seniority, COUNT(*) as count 
    FROM prospects 
    GROUP BY seniority 
    ORDER BY count DESC
""")).fetchall()
print("\n📊 Seniority Levels:")
for row in result:
    print(f"   {row[0]}: {row[1]} prospects")

# Top locations
result = db.execute(text("""
    SELECT country, COUNT(*) as count 
    FROM prospects 
    GROUP BY country 
    ORDER BY count DESC 
    LIMIT 10
""")).fetchall()
print("\n📊 Top 10 Countries:")
for row in result:
    print(f"   {row[0]}: {row[1]} prospects")

# CTOs specifically
result = db.execute(text("""
    SELECT COUNT(*) FROM prospects 
    WHERE job_title ILIKE '%CTO%' OR job_title ILIKE '%Chief Technology%'
""")).fetchone()
print(f"\n🎯 CTOs in database: {result[0]}")

result = db.execute(text("""
    SELECT COUNT(*) FROM prospects 
    WHERE seniority = 'c_level'
""")).fetchone()
print(f"🎯 C-level executives: {result[0]}")

result = db.execute(text("""
    SELECT COUNT(*) FROM prospects 
    WHERE industry = 'Finance'
""")).fetchone()
print(f"🎯 Finance industry: {result[0]}")

result = db.execute(text("""
    SELECT COUNT(*) FROM prospects 
    WHERE industry = 'Finance' AND seniority = 'c_level'
""")).fetchone()
print(f"🎯 Finance C-level: {result[0]}")

# 2. PRODUCTS ANALYSIS
print("\n\n2. PRODUCTS TABLE:")
print("-"*80)

result = db.execute(text("""
    SELECT category, COUNT(*) as count 
    FROM products 
    GROUP BY category 
    ORDER BY count DESC
""")).fetchall()
print("\n📦 Product Categories:")
for row in result:
    print(f"   {row[0]}: {row[1]} products")

result = db.execute(text("""
    SELECT name, category, description
    FROM products
    LIMIT 10
""")).fetchall()
print("\n📦 Sample Products:")
for row in result:
    print(f"\n   {row[0]} ({row[1]})")
    print(f"   {row[2][:100]}...")

# Check for security/compliance products
result = db.execute(text("""
    SELECT name, description, value_proposition
    FROM products
    WHERE name ILIKE '%security%' OR name ILIKE '%shield%' 
       OR description ILIKE '%security%' OR description ILIKE '%compliance%'
    LIMIT 3
""")).fetchall()
print("\n🔒 Security/Compliance Products:")
for row in result:
    print(f"\n   {row[0]}")
    print(f"   Desc: {row[1][:100]}...")
    print(f"   Value: {row[2][:100]}..." if row[2] else "")

# 3. ENGAGEMENT HISTORY
print("\n\n3. ENGAGEMENT HISTORY:")
print("-"*80)

result = db.execute(text("""
    SELECT channel, COUNT(*) as count 
    FROM engagement_history 
    GROUP BY channel 
    ORDER BY count DESC
""")).fetchall()
print("\n📊 Channel Distribution:")
for row in result:
    print(f"   {row[0]}: {row[1]} engagements")

result = db.execute(text("""
    SELECT 
        channel,
        ROUND(AVG(CASE WHEN was_opened THEN 1 ELSE 0 END) * 100, 2) as open_rate,
        ROUND(AVG(CASE WHEN was_replied THEN 1 ELSE 0 END) * 100, 2) as reply_rate
    FROM engagement_history
    GROUP BY channel
""")).fetchall()
print("\n📊 Channel Performance:")
for row in result:
    print(f"   {row[0]}: {row[1]}% open, {row[2]}% reply")

# 4. PAIN POINTS ANALYSIS
print("\n\n4. COMMON PAIN POINTS:")
print("-"*80)

result = db.execute(text("""
    SELECT pain_points
    FROM prospects
    WHERE pain_points IS NOT NULL
    LIMIT 20
""")).fetchall()

pain_points_all = {}
for row in result:
    if row[0]:
        for pain in row[0]:
            pain_points_all[pain] = pain_points_all.get(pain, 0) + 1

print("\n🔥 Top Pain Points:")
for pain, count in sorted(pain_points_all.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"   {pain}: {count} mentions")

# 5. ARCHETYPE ANALYSIS
print("\n\n5. ICP ARCHETYPES:")
print("-"*80)

result = db.execute(text("""
    SELECT icp_archetype, COUNT(*) as count 
    FROM prospects 
    WHERE icp_archetype IS NOT NULL
    GROUP BY icp_archetype 
    ORDER BY count DESC
    LIMIT 10
""")).fetchall()
print("\n🎯 Existing Archetypes:")
for row in result:
    print(f"   {row[0]}: {row[1]} prospects")

db.close()

print("\n" + "="*80)
print("KEY INSIGHTS FOR AGENT FIXES:")
print("="*80)
print("""
Based on this data, the agent needs to:
1. Support all industries in database (not just hardcoded ones)
2. Better map seniority levels (c_level, vp, director, manager, individual)
3. Handle multiple department types
4. Use pain points for better personalization
5. Match to actual product catalog (not just security/HR)
6. Generate sales-focused CTAs (not educational resources)
""")
