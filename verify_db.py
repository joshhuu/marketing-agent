"""Quick verification of all DB improvements"""
import json
from sqlalchemy import create_engine, text
from config import DATABASE_URL

engine = create_engine(DATABASE_URL)
with engine.connect() as c:
    print("=== PRODUCTS (newest 5) ===")
    products = c.execute(text("SELECT name, value_proposition FROM products ORDER BY created_at DESC LIMIT 5")).fetchall()
    for p in products:
        print(f"  {p[0]}: {str(p[1])[:70]}")

    print("\n=== PROSPECT PAIN POINTS (sample 3) ===")
    rows = c.execute(text("SELECT first_name, department, industry, pain_points FROM prospects LIMIT 3")).fetchall()
    for row in rows:
        pts_ = row[3] if isinstance(row[3], list) else json.loads(row[3])
        print(f"  {row[0]} ({row[1]}, {row[2]}):")
        for pt in pts_:
            print(f"    - {pt[:70]}")

    print("\n=== COMPANY NAMES (sample 5) ===")
    companies = c.execute(text("SELECT company_name, industry FROM prospects LIMIT 5")).fetchall()
    for co in companies:
        print(f"  {co[0]} ({co[1]})")

    print("\n=== ENGAGEMENT HISTORY BREAKDOWN ===")
    eng = c.execute(text("SELECT channel, COUNT(*) as cnt FROM engagement_history GROUP BY channel")).fetchall()
    total = sum(r[1] for r in eng)
    for row in eng:
        print(f"  {row[0]}: {row[1]}")
    print(f"  TOTAL: {total}")

    print("\n=== is_mock COLUMN ===")
    is_mock = c.execute(text("SELECT COUNT(*) FROM information_schema.columns WHERE table_name='prospects' AND column_name='is_mock'")).scalar()
    print(f"  Exists: {bool(is_mock)}")
    mock_count = c.execute(text("SELECT COUNT(*) FROM prospects WHERE is_mock = TRUE")).scalar()
    print(f"  Prospects marked is_mock=TRUE: {mock_count}")

    print("\n=== PRODUCT CATALOG (all) ===")
    all_prods = c.execute(text("SELECT name FROM products ORDER BY created_at")).fetchall()
    for p in all_prods:
        print(f"  - {p[0]}")

print("\n✅ Verification complete!")
