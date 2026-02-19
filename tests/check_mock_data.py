"""
Check mock data quality for intelligence upgrades
"""
from database import get_db
from sqlalchemy import text
from datetime import datetime, timedelta

db = get_db()

print("="*70)
print("MOCK DATA ANALYSIS FOR INTELLIGENCE UPGRADES")
print("="*70)

# Check prospects
print("\n1. PROSPECTS TABLE:")
result = db.execute(text("SELECT COUNT(*) FROM prospects")).fetchone()
print(f"   Total prospects: {result[0]}")

result = db.execute(text("SELECT COUNT(*) FROM prospects WHERE last_contacted_at IS NOT NULL")).fetchone()
print(f"   With last_contacted_at: {result[0]}")

# Check recent contacts
cutoff_7d = datetime.now() - timedelta(days=7)
cutoff_14d = datetime.now() - timedelta(days=14)
cutoff_30d = datetime.now() - timedelta(days=30)

result = db.execute(text(f"SELECT COUNT(*) FROM prospects WHERE last_contacted_at > :cutoff"), {"cutoff": cutoff_7d}).fetchone()
recent_7d = result[0]
print(f"   Contacted in last 7 days: {recent_7d}")

result = db.execute(text(f"SELECT COUNT(*) FROM prospects WHERE last_contacted_at > :cutoff"), {"cutoff": cutoff_14d}).fetchone()
recent_14d = result[0]
print(f"   Contacted in last 14 days: {recent_14d}")

result = db.execute(text(f"SELECT COUNT(*) FROM prospects WHERE last_contacted_at > :cutoff"), {"cutoff": cutoff_30d}).fetchone()
recent_30d = result[0]
print(f"   Contacted in last 30 days: {recent_30d}")

# Check engagement history
print("\n2. ENGAGEMENT HISTORY TABLE:")
result = db.execute(text("SELECT COUNT(*) FROM engagement_history")).fetchone()
total_engagements = result[0]
print(f"   Total engagement records: {total_engagements}")

result = db.execute(text("SELECT COUNT(DISTINCT prospect_id) FROM engagement_history")).fetchone()
prospects_with_history = result[0]
print(f"   Prospects with engagement history: {prospects_with_history}")

result = db.execute(text("SELECT COUNT(*) FROM engagement_history WHERE was_opened = true")).fetchone()
print(f"   Messages opened: {result[0]} ({result[0]/total_engagements*100:.1f}%)")

result = db.execute(text("SELECT COUNT(*) FROM engagement_history WHERE was_replied = true")).fetchone()
print(f"   Messages replied: {result[0]} ({result[0]/total_engagements*100:.1f}%)")

# Check mismatch between last_contacted_at and engagement_history
print("\n3. DATA CONSISTENCY CHECK:")
result = db.execute(text("""
    SELECT COUNT(*) 
    FROM prospects p 
    WHERE p.last_contacted_at IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM engagement_history e WHERE e.prospect_id = p.id)
""")).fetchone()
prospects_with_contact_no_history = result[0]
print(f"   Prospects with last_contacted_at but NO engagement history: {prospects_with_contact_no_history}")

result = db.execute(text("""
    SELECT COUNT(DISTINCT e.prospect_id)
    FROM engagement_history e
    LEFT JOIN prospects p ON e.prospect_id = p.id
    WHERE p.last_contacted_at IS NULL
""")).fetchone()
prospects_with_history_no_contact = result[0]
print(f"   Prospects with engagement history but NO last_contacted_at: {prospects_with_history_no_contact}")

# Impact analysis
print("\n4. IMPACT ANALYSIS FOR INTELLIGENCE UPGRADES:")
print(f"   ⚠️  {recent_7d} prospects ({recent_7d/500*100:.1f}%) would be FILTERED (7-day rule)")
print(f"   ✓  {500-recent_7d} prospects ({(500-recent_7d)/500*100:.1f}%) would be AVAILABLE")

if recent_7d > 100:
    print(f"\n   🔥 WARNING: High filtering rate! {recent_7d} prospects blocked.")
    print(f"   This is because mock data has random contact dates within last 12 months.")
elif recent_7d > 50:
    print(f"\n   ⚠️  Medium filtering: {recent_7d} prospects blocked.")
    print(f"   This is expected with mock data.")
else:
    print(f"\n   ✓ Low filtering rate, should work well.")

# Check if engagement_history dates match last_contacted_at
print("\n5. LAST CONTACT DATE COMPARISON:")
result = db.execute(text("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN p.last_contacted_at IS NOT NULL AND last_engagement IS NOT NULL 
                   AND ABS(EXTRACT(EPOCH FROM (p.last_contacted_at - last_engagement))) < 86400 
              THEN 1 END) as matching
    FROM prospects p
    LEFT JOIN (
        SELECT prospect_id, MAX(sent_at) as last_engagement
        FROM engagement_history
        GROUP BY prospect_id
    ) e ON p.id = e.prospect_id
    WHERE p.last_contacted_at IS NOT NULL
""")).fetchone()
total_with_dates = result[0]
matching_dates = result[1]
print(f"   Prospects with last_contacted_at: {total_with_dates}")
print(f"   Matching engagement_history dates: {matching_dates}")
print(f"   Mismatch rate: {(total_with_dates-matching_dates)/total_with_dates*100:.1f}%")

print("\n" + "="*70)
print("RECOMMENDATION:")
print("="*70)

if prospects_with_contact_no_history > 200:
    print("""
⚠️  ISSUE FOUND: Many prospects have last_contacted_at but no engagement_history!

This means the engagement_analyzer will think they've never been contacted,
but the mock data says they have been.

SOLUTION: Update engagement_analyzer to check BOTH sources:
1. Check engagement_history.sent_at (preferred - actual data)
2. Fallback to prospects.last_contacted_at if no history exists
""")
    recommendation = "NEEDS_FIX"
elif recent_7d > 150:
    print("""
⚠️  TOO MUCH FILTERING: Many prospects contacted recently in mock data.

This will cause most prospects to be filtered out during testing.

SOLUTION: Either:
1. Reduce min_days from 7 to 3 for testing with mock data
2. Re-seed database with older contact dates
3. Accept that you'll see high filtering in demo
""")
    recommendation = "ADJUST_THRESHOLD"
else:
    print("""
✓ Mock data looks good for intelligence upgrades!

The filtering rate is reasonable and engagement_history exists.
You should see intelligent prospect selection in action.
""")
    recommendation = "GOOD_TO_GO"

db.close()

print(f"\nStatus: {recommendation}")
