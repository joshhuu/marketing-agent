"""
improve_db.py  — Multi-Agent System Database Improvement Script
================================================================
Upgrades the prototype database WITHOUT dropping tables or breaking FK constraints.

Changes made:
  1. Products   : Removes 15 gibberish Faker products, adds 10 real industry-specific ones
  2. Prospects  : Adds `is_mock` column, rewrites pain_points with rich dept×industry combos,
                  upgrades company names to sound like real B2B firms
  3. Engagement : Rebuilds engagement_history so each prospect has a consistent
                  open/reply rate "profile" (high / medium / low engager)

Run:
    python improve_db.py
"""

import json
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from config import DATABASE_URL

random.seed(99)  # Different from seed=42 so we don't regenerate identical data

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

# ─────────────────────────────────────────────────────────────────────────────
# 1.  REAL PRODUCTS – 10 industry-specific, hand-crafted SaaS products
# ─────────────────────────────────────────────────────────────────────────────

NEW_PRODUCTS = [
    {
        "name": "HealthSync EHR",
        "category": "SaaS",
        "description": "Cloud-native electronic health records platform built for mid-market hospitals and clinics, with HIPAA-compliant data pipelines and real-time interoperability.",
        "target_industries": ["Healthcare"],
        "target_seniority": ["c_level", "vp", "director"],
        "target_persona": "CTO CMO Director IT Healthcare",
        "key_benefits": ["HIPAA-compliant by design", "HL7 FHIR integration", "70% less admin time", "Patient portal included"],
        "value_proposition": "Reduce clinical admin overhead by 70% with a HIPAA-compliant EHR that connects every care team in real time.",
        "cta_primary": "Book a Compliance Demo",
        "cta_secondary": "Download HIPAA Readiness Guide",
        "price_model": "flat_rate",
        "price_from_usd": 2500.0,
        "trial_available": False,
    },
    {
        "name": "LogiTrack AI",
        "category": "SaaS",
        "description": "AI-powered supply chain visibility platform that delivers live shipment tracking, delay prediction, and carrier benchmarking for logistics and manufacturing companies.",
        "target_industries": ["Logistics", "Manufacturing"],
        "target_seniority": ["c_level", "vp", "director", "manager"],
        "target_persona": "COO VP Operations Director Logistics Manager Supply Chain",
        "key_benefits": ["Live GPS shipment tracking", "48-hour delay prediction", "Carrier performance scoring", "1-click exception alerts"],
        "value_proposition": "Cut supply chain disruptions by 40% with AI that predicts delays before they happen.",
        "cta_primary": "Request a Live Demo",
        "cta_secondary": "Download ROI Calculator",
        "price_model": "per_seat",
        "price_from_usd": 149.0,
        "trial_available": True,
    },
    {
        "name": "EduFlow LMS",
        "category": "SaaS",
        "description": "Next-generation learning management system for universities and corporate L&D teams. Supports async video, live sessions, AI-graded assessments, and SCORM/xAPI compliance.",
        "target_industries": ["Education"],
        "target_seniority": ["c_level", "director", "manager"],
        "target_persona": "Chief Learning Officer Director HR Manager Training Education",
        "key_benefits": ["SCORM & xAPI compliant", "AI-graded assessments", "Built-in video studio", "50% faster course creation"],
        "value_proposition": "Launch engaging online courses 50% faster with AI-assisted authoring and automated assessments.",
        "cta_primary": "Start Free Trial",
        "cta_secondary": "See a Course Demo",
        "price_model": "per_seat",
        "price_from_usd": 8.0,
        "trial_available": True,
    },
    {
        "name": "BuildPro CRM",
        "category": "SaaS",
        "description": "CRM purpose-built for real estate developers and property managers. Tracks deals from land acquisition through construction to final sale, with built-in document management.",
        "target_industries": ["Real Estate"],
        "target_seniority": ["c_level", "vp", "director", "manager"],
        "target_persona": "CEO Director Sales Real Estate Property Manager",
        "key_benefits": ["Deal pipeline from land-to-close", "Automated contract generation", "Buyer portal & e-sign", "Commission tracking"],
        "value_proposition": "Close property deals 35% faster with a CRM designed for the full real estate lifecycle.",
        "cta_primary": "Book a Demo",
        "cta_secondary": "Watch 3-Minute Overview",
        "price_model": "flat_rate",
        "price_from_usd": 399.0,
        "trial_available": False,
    },
    {
        "name": "MfgOps Suite",
        "category": "SaaS",
        "description": "Predictive maintenance and OEE (Overall Equipment Effectiveness) platform for discrete and process manufacturers. IoT-enabled with edge compute support.",
        "target_industries": ["Manufacturing"],
        "target_seniority": ["c_level", "vp", "director", "manager"],
        "target_persona": "VP Operations Director Manufacturing Plant Manager COO",
        "key_benefits": ["Predictive failure alerts 72h early", "OEE dashboard per line", "IoT sensor integration", "Maintenance ticket automation"],
        "value_proposition": "Reduce unplanned downtime by 55% with IoT-powered predictive maintenance built for factory floors.",
        "cta_primary": "Request an IoT Demo",
        "cta_secondary": "Download OEE Benchmark Report",
        "price_model": "flat_rate",
        "price_from_usd": 1200.0,
        "trial_available": False,
    },
    {
        "name": "TalentBridge ATS",
        "category": "SaaS",
        "description": "AI-first applicant tracking system for high-volume recruiters and HR teams. Includes resume parsing, skills-based matching, interview scheduling, and DEI analytics.",
        "target_industries": ["Technology", "Professional Services", "Healthcare", "Finance"],
        "target_seniority": ["c_level", "director", "manager"],
        "target_persona": "CHRO HR Director Talent Acquisition Manager Recruiter",
        "key_benefits": ["AI resume screening in <30s", "Skills-based candidate ranking", "Automated interview scheduling", "DEI pipeline analytics"],
        "value_proposition": "Fill senior roles 40% faster with AI-driven screening that surfaces the best candidates, not just keyword matches.",
        "cta_primary": "Start 14-Day Free Trial",
        "cta_secondary": "Book a Walkthrough",
        "price_model": "per_seat",
        "price_from_usd": 49.0,
        "trial_available": True,
    },
    {
        "name": "ComplianceGuard",
        "category": "SaaS",
        "description": "Automated compliance management platform covering SOX, GDPR, ISO 27001, and SOC 2. Provides continuous control monitoring, evidence collection, and auditor-ready reports.",
        "target_industries": ["Finance", "Technology", "Healthcare"],
        "target_seniority": ["c_level", "vp", "director"],
        "target_persona": "CFO CISO Compliance Officer VP Finance Director Risk",
        "key_benefits": ["Continuous control monitoring", "One-click auditor exports", "SOX + GDPR + ISO 27001 + SOC2", "Automated evidence collection"],
        "value_proposition": "Pass your next compliance audit in half the time with automated evidence collection and real-time control monitoring.",
        "cta_primary": "Schedule a Compliance Review",
        "cta_secondary": "Download Compliance Checklist",
        "price_model": "flat_rate",
        "price_from_usd": 3500.0,
        "trial_available": False,
    },
    {
        "name": "ServDesk Pro",
        "category": "SaaS",
        "description": "ITSM platform for IT teams managing internal helpdesk, asset lifecycle, and SLA compliance. Configurable workflows with no-code automation and CMDB integration.",
        "target_industries": ["Technology", "Finance", "Manufacturing", "Healthcare"],
        "target_seniority": ["director", "manager"],
        "target_persona": "IT Director IT Manager ITSM Head of IT Support",
        "key_benefits": ["<1 hour average resolution SLA", "No-code workflow builder", "CMDB asset tracking", "Multi-channel ticketing (email, Slack, Teams)"],
        "value_proposition": "Resolve 80% of IT tickets automatically and hit your SLA targets every quarter with zero-code workflow automation.",
        "cta_primary": "Start Free Trial",
        "cta_secondary": "See ITSM Workflows",
        "price_model": "per_seat",
        "price_from_usd": 29.0,
        "trial_available": True,
    },
    {
        "name": "SalesIQ Pro",
        "category": "SaaS",
        "description": "Buyer intent intelligence platform that surfaces which companies are actively researching your product category, scored by purchase likelihood and integrated with your CRM.",
        "target_industries": ["Technology", "Professional Services", "Finance"],
        "target_seniority": ["vp", "director", "manager"],
        "target_persona": "VP Sales Director Sales Revenue Operations Manager SDR Manager",
        "key_benefits": ["Bombora intent data built-in", "Account-level buying signals", "CRM-native (Salesforce, HubSpot)", "Weekly hot account list"],
        "value_proposition": "Find your next 50 ideal customers before they ever fill out a form — identify, prioritize, and close faster.",
        "cta_primary": "Get Your Free Intent Report",
        "cta_secondary": "Book a Strategy Call",
        "price_model": "flat_rate",
        "price_from_usd": 999.0,
        "trial_available": True,
    },
    {
        "name": "CloudCost Optimizer",
        "category": "SaaS",
        "description": "FinOps platform for engineering and finance teams that monitors AWS, Azure, and GCP spend in real time, identifies waste, and automates rightsizing recommendations.",
        "target_industries": ["Technology", "Finance", "Retail"],
        "target_seniority": ["c_level", "vp", "director"],
        "target_persona": "CTO VP Engineering Director Infrastructure Head of FinOps CFO",
        "key_benefits": ["Cross-cloud (AWS, Azure, GCP)", "Automated rightsizing", "30-day savings forecast", "Tagging & showback reports"],
        "value_proposition": "Reduce your cloud bill by 30% in 90 days with automated rightsizing and real-time waste detection across all cloud providers.",
        "cta_primary": "Get a Free Savings Audit",
        "cta_secondary": "See the FinOps Dashboard",
        "price_model": "usage",
        "price_from_usd": 199.0,
        "trial_available": True,
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# 2.  RICH PAIN POINTS  — department × industry combinations
# ─────────────────────────────────────────────────────────────────────────────

PAIN_POINTS_RICH = {
    "Sales": {
        "Technology":            ["Long enterprise sales cycles (6-12 months)", "Poor lead-to-MQL conversion below 15%", "Reps spending 40% of time on CRM data entry"],
        "Finance":               ["Compliance delays kill deals at late stages", "Difficulty selling to risk-averse procurement teams", "Long contract redlining cycles"],
        "Healthcare":            ["Procurement committees slow down every deal", "HIPAA and regulatory questions stall pilots", "Low trust from clinical buyers unfamiliar with SaaS"],
        "Manufacturing":         ["Purchasing decisions require 6+ stakeholder sign-offs", "RFP processes take 4-6 months", "Low awareness of ROI from digital tools"],
        "Retail":                ["Seasonal buying patterns make pipeline unpredictable", "Buyers focused on short-term margin, not long-term tools", "High rep churn disrupts key account relationships"],
        "Education":             ["Budget cycles locked to academic year", "Parents and faculty committees slow procurement", "Thin margins limit software investment"],
        "Logistics":             ["Thin margins mean extreme price sensitivity", "Long RFP cycles with many competing bids", "Key contacts change frequently due to high turnover"],
        "Professional Services": ["Clients expect custom pricing and SOWs for every deal", "Long relationship-building phase before first contract", "Hard to differentiate from incumbent consultants"],
        "default":               ["Low outbound-to-meeting conversion rate", "Long average sales cycle with multiple decision-makers", "CRM hygiene issues causing pipeline blind spots"],
    },
    "Marketing": {
        "Technology":            ["Attribution across 8+ channels is impossible", "Rising CPL on LinkedIn ads (>$200 per lead)", "Content takes 3 weeks to produce and has short shelf life"],
        "Finance":               ["Strict compliance review delays every campaign by 2-3 weeks", "Can't run retargeting due to data privacy rules", "Low brand awareness vs. established incumbents"],
        "Healthcare":            ["HIPAA restricts what patient data can be used for targeting", "Long buying journey makes nurture sequences difficult", "Medical content requires clinical review before publishing"],
        "Retail":                ["Discounting trained customers to wait for sales", "Email open rates below 12% for repeat customers", "Social ROI hard to prove to CFO"],
        "Education":             ["Students and parents exist in completely different buyer personas", "Seasonal enrollment peaks create feast-or-famine campaigns", "Limited creative budget vs. for-profit competitors"],
        "Logistics":             ["Brand awareness is almost zero outside niche freight circles", "Content must educate on complex regulatory topics", "Difficult to reach operations decision-makers digitally"],
        "Manufacturing":         ["Buyers don't respond to digital marketing — prefer trade shows", "Long consideration cycle before any product demo", "Technical content requires engineering sign-off"],
        "Professional Services": ["Firm reputation is hyper-local — hard to scale campaigns", "Content marketing ROI takes 12+ months to show", "Partners resist co-marketing with technology vendors"],
        "default":               ["MQL-to-SQL conversion below 20%", "High cost per acquisition on paid channels", "Content production bandwidth limits campaign frequency"],
    },
    "IT": {
        "Technology":            ["Shadow IT purchases bypass security review", "Average 6-month vulnerability remediation backlog", "Multi-cloud complexity making IAM governance difficult"],
        "Finance":               ["Legacy core banking systems can't integrate with modern APIs", "PCI-DSS and SOX require separate compliance workstreams", "Security incidents increasing 40% YoY but headcount flat"],
        "Healthcare":            ["Medical devices running Windows XP can't be patched", "HL7 integration between systems is manual and error-prone", "Ransomware attacks targeting hospitals doubling annually"],
        "Manufacturing":         ["OT (operational technology) networks not segmented from IT", "Industrial IoT devices lack basic authentication controls", "40% of factory software is no longer vendor-supported"],
        "Retail":                ["POS systems store card data in violation of PCI scope", "Seasonal traffic spikes crash underpowered e-commerce stack", "Store networks use unsecured public WiFi for transactions"],
        "Education":             ["Student data stored in unencrypted on-prem servers", "Bring-your-own-device policy creates endpoint sprawl", "Ransomware attacks on schools tripled in 2 years"],
        "Logistics":             ["Fleet tracking systems use 2G networks being sunset", "GPS data not encrypted in transit", "API integrations with carriers break on every rate change"],
        "Professional Services": ["Remote workforce uses personal devices for client work", "No central SIEM — security events go undetected for weeks", "Client data stored across 15+ unsecured collaboration tools"],
        "default":               ["Unpatched vulnerabilities sitting open for 90+ days", "No unified asset inventory across cloud and on-prem", "Alert fatigue causing security team to miss real incidents"],
    },
    "Finance": {
        "Technology":            ["R&D spend is 40% of revenue — hard to forecast accurately", "Finance team manually reconciles 12 SaaS subscriptions monthly", "Board wants real-time cash burn visibility but FP&A runs monthly"],
        "Finance":               ["Manual month-end close takes 15 business days", "Regulatory reporting to 4 different regulators with different formats", "Spreadsheet models break when team scales beyond 20 people"],
        "Healthcare":            ["Insurance reimbursement timelines create 90-day cash gaps", "Complex CPT code billing errors cost 3-5% of revenue", "Compliance reporting for CMS is fully manual"],
        "Manufacturing":         ["COGS visibility requires pulling data from 6 ERP modules", "Capex planning dependent on outdated demand forecasts", "Transfer pricing between subsidiaries requires manual reconciliation"],
        "Retail":                ["Inventory shrinkage not detected until quarterly audits", "Working capital tied up in slow-moving seasonal inventory", "Gross margin varies 8% across locations with no clear cause"],
        "Education":             ["Grant reporting requires 40 hours of manual data extraction", "Tuition revenue fluctuates 25% year over year", "Endowment allocation decisions made on 6-month-old data"],
        "Logistics":             ["Fuel price volatility creates ±15% forecast error", "Customer invoice disputes tied up $2M in AR at any given time", "Multi-currency operations with no automated FX hedging"],
        "Professional Services": ["Revenue recognition for long-term contracts is audit-risky", "Project margin visibility is 3 weeks delayed", "Partner compensation calculations require full-day manual process"],
        "default":               ["Month-end close takes too long due to manual data gathering", "Budget vs. actuals variance analysis done in spreadsheets", "Lack of real-time cash flow visibility for leadership"],
    },
    "HR": {
        "Technology":            ["Engineering turnover at 35% — 2x industry average", "Time-to-hire for senior engineers exceeds 90 days", "Competing with FAANG salaries on a startup budget"],
        "Finance":               ["Bonus and comp structures require 3 weeks of manual calculation", "Headcount planning disconnected from financial model", "Regulatory requirements for employee data retention creating risk"],
        "Healthcare":            ["Nurse shortage means 25% of shifts run understaffed", "Credential verification for new clinical hires takes 6 weeks", "Per diem staffing costs running 60% above permanent rate"],
        "Manufacturing":         ["Floor worker absenteeism above 15% disrupting production", "Manual paper-based onboarding for 500+ factory workers per year", "Safety incident reporting is reactive, not predictive"],
        "Retail":                ["Seasonal hiring peaks require onboarding 200+ in 4 weeks", "High store manager turnover disrupting team continuity", "Scheduling conflicts cost 8 manager-hours per week per store"],
        "Education":             ["Teacher retention dropping — 30% leaving within first 3 years", "Faculty contract renewals managed in spreadsheets", "DE&I reporting requirements lack underlying data"],
        "Logistics":             ["Driver churn at 80% annually — highest in any industry", "DOT compliance documentation done entirely on paper", "Dangerous jobs mean workers' comp claims at 2x industry rate"],
        "Professional Services": ["Partner track is unclear — top performers leave for competitors", "Utilization tracking done weekly in spreadsheets", "Benefits administration managed across 3 disconnected platforms"],
        "default":               ["High employee turnover costing 1.5x annual salary per loss", "Manual onboarding taking 2 weeks per new hire", "No centralized HR dashboard for real-time headcount analytics"],
    },
    "Engineering": {
        "Technology":            ["Deploy frequency below 4 times per month due to manual QA gates", "Microservices architecture has 40% of services with no documentation", "P1 incidents average 4-hour MTTR due to poor observability"],
        "Finance":               ["Core banking system is 15 years old and prevents new feature delivery", "Security and compliance requirements slow sprint velocity by 30%", "Cross-team dependencies cause 6-week average feature lead time"],
        "Healthcare":            ["HIPAA requirements add 4 weeks to every release cycle", "Integration with 8 different EHR systems requires custom connectors", "On-call fatigue causing senior engineers to leave"],
        "Manufacturing":         ["OT/IT integration requires bridging two completely different stacks", "Firmware updates on 200+ devices requires physical access", "Real-time data processing from factory sensors exceeds current platform capacity"],
        "Retail":                ["E-commerce platform can't handle Black Friday traffic without manual scaling", "Product catalog changes take 3 days to propagate across all systems", "Mobile app crash rate above 2% causing customer churn"],
        "default":               ["Technical debt consuming 40% of every sprint capacity", "Deployment pipelines not automated — manual steps cause regressions", "No internal developer platform slowing feature delivery"],
    },
    "Operations": {
        "Technology":            ["SaaS tool sprawl — 80+ tools with no governance or rationalization", "Vendor management across 40+ contracts with manual renewal tracking", "No single source of truth for internal process documentation"],
        "Finance":               ["Operations processes not documented — tribal knowledge risk", "Regulatory change management requires manual process rewrites", "Cross-departmental request queues have no SLAs or tracking"],
        "Healthcare":            ["Patient throughput bottlenecks in intake and discharge workflows", "Supply chain for medical consumables runs on spreadsheets", "Manual bed management decisions based on 4-hour-old data"],
        "Manufacturing":         ["Production scheduling done in Excel — breaks with any capacity change", "Quality control defect rate above 3% causing rework costs", "Supplier on-time delivery below 80%"],
        "Retail":                ["Inventory accuracy below 85% causing stockouts and overstock simultaneously", "Manual store audit process takes 2 weeks per location", "Returns processing backlog growing 20% each quarter"],
        "Logistics":             ["Dock scheduling conflicts causing 30% of trucks to wait more than 2 hours", "Proof of delivery still paper-based — disputes take weeks to resolve", "Route optimization done manually by dispatchers — 15% fuel waste"],
        "Professional Services": ["Utilization vs. capacity planning done in monthly meetings, not real-time", "Project resource conflicts discovered too late to resolve smoothly", "Client deliverable review cycles averaging 5 rounds — killing margins"],
        "default":               ["No real-time operational dashboards for team leaders", "Manual approval workflows causing 3-day delays on routine requests", "Process documentation out of date across 80% of core workflows"],
    },
    "Product": {
        "Technology":            ["Roadmap driven by loudest customer voice, not data", "Feature usage tracked manually — no product analytics stack", "Engineering and product alignment breaks down every 2 sprints"],
        "Finance":               ["Regulatory constraints mean 40% of roadmap is compliance work", "User research only happens once per quarter", "Feature prioritization framework changed 3 times in 12 months"],
        "Healthcare":            ["Clinical workflow validation requires 6-month pilot before release", "FDA clearance process adds 18+ months to medical-grade features", "Clinician feedback loop is informal — no structured research process"],
        "Retail":                ["A/B testing infrastructure doesn't exist — all changes go straight to prod", "Mobile vs. desktop conversion gap widening with no clear fix", "Merchandising and product teams have different interpretations of the same data"],
        "default":               ["Roadmap not aligned to revenue outcomes — features shipped, not adopted", "No product analytics to measure feature impact post-launch", "Discovery and delivery running in parallel causing rework"],
    },
    "Customer Success": {
        "Technology":            ["Churn rate above 12% annually with no early warning system", "Onboarding takes 90 days — customers see value too slowly", "CS team managing 150+ accounts per person — bandwidth crisis"],
        "Finance":               ["Regulatory restrictions mean CS can't proactively reach out to some clients", "NPS below 25 — customers satisfied but not promoters", "Renewal conversations start too late — 30 days before contract end"],
        "Healthcare":            ["CS team lacks clinical credibility to support frontline nurse users", "System downtime creates patient safety escalations that overwhelm support", "Training new clinical users takes 8 weeks per cohort"],
        "default":               ["No health score model — churn is reactive, not predictive", "QBR preparation takes 6 hours per account", "Expansion revenue from existing accounts below 10%"],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# 3.  REALISTIC COMPANY NAMES by industry
# ─────────────────────────────────────────────────────────────────────────────

COMPANY_NAMES = {
    "Technology": [
        "Amplitude Systems", "Meridian Cloud", "Vanta Labs", "Axiom Software", "Luminary AI",
        "Cloudbridge Technologies", "PinPoint Data", "Nexora Inc", "Streamline Dev", "Skyward Analytics",
        "Kalvium Tech", "Prism Networks", "Ironclad Software", "Cobalt Systems", "Helix Platforms",
        "Zenith Computing", "Mosaic Digital", "Apex Data Solutions", "Vertex Tech Group", "Crestline Software",
    ],
    "Finance": [
        "Pinnacle Capital Group", "Meridian Wealth Partners", "Ascend Financial Services", "Crestview Fund Management",
        "Hartwell Investment Advisors", "Summit Credit Union", "Clearwater Asset Management",
        "Lakeshore Financial Group", "Ironbridge Capital", "Northgate Securities",
        "Silverline Wealth", "Fortis Banking", "Cascade Investments", "BlueCrest Capital", "Horizon Finance Corp",
    ],
    "Healthcare": [
        "Meridian Health Systems", "Apex Medical Group", "ClearPath Diagnostics", "Summit Surgical Solutions",
        "Welcare Hospital Network", "Beacon Health Partners", "Northstar Medical Center",
        "Ascent Clinical Research", "Coastal Care Network", "Vitalis Health",
        "Sunrise Wellness Group", "Caduceus Medical", "Lifespan Clinics", "Heritage Healthcare", "Unity Medical Network",
    ],
    "Manufacturing": [
        "Ironforge Industries", "Precision Parts Co.", "Axiom Manufacturing Group", "Midland Steel Works",
        "Cornerstone Fabrication", "Titan Assembly", "Summit Components", "Clearwater Industrial",
        "Northgate Manufacturing", "Crestline Engineering Works",
        "Duraforce Industries", "Allied Manufacturing Inc", "Keystone Production", "Steelcraft Group", "Paramount Machining",
    ],
    "Retail": [
        "Meridian Retail Group", "Apex Consumer Brands", "Crestview Commerce", "Clarity Retail Solutions",
        "Summit Shopping Co.", "Showcase Brands", "Prism Retail Partners", "Lakeshore Goods",
        "Mosaic Consumer Group", "Highstreet Retail Inc",
        "Beacon Commerce", "Northgate Retail", "Silverline Stores", "FreshMart Group", "Vantage Retail Corp",
    ],
    "Education": [
        "Meridian Learning Institute", "Apex Academy", "Brightpath University", "ClearVision Education",
        "Summit Training Group", "Keystone Learning Center", "Horizon Edu Solutions",
        "Ascend College", "Lighthouse Academy", "Pathways Institute",
        "Crestline School of Technology", "NorthStar eLearning", "Foundations EdTech", "Prism Learning Co", "Atlas Academy",
    ],
    "Logistics": [
        "Meridian Freight Co.", "Apex Supply Chain", "TransCore Logistics", "Crestline Shipping Group",
        "Summit Cargo Solutions", "Ironbridge Transport", "Clearwater Distribution",
        "Northgate Freight Management", "Keystone Fulfillment", "Silverline Logistics",
        "Cascade Freight", "BlueLine Transport", "HarborPoint Distribution", "Nexus Freight Solutions", "Velocity Logistics Group",
    ],
    "Professional Services": [
        "Meridian Consulting Group", "Apex Advisory Partners", "Clearwater Consultants", "Summit Strategy",
        "Crestview Management Consulting", "Northgate Professional Services", "Keystone Advisors",
        "Ironbridge Partners", "Mosaic Consulting", "Silverline Strategy Group",
        "Vanguard Advisory", "Beacon Consulting", "Prism Partners", "Caliber Advisors", "Latitude Consulting",
    ],
    "Media": [
        "Meridian Media Group", "Apex Publishing", "Crestline Broadcasting", "ClearChannel Digital",
        "Summit Content Studios", "Northgate Media", "Keystone Entertainment",
        "Prism Digital Media", "Lighthouse Publishing", "Mosaic Creative",
        "BlueSky Studios", "Vertex Media Co.", "Signal Publishing Group", "Broadcast One", "Pinnacle Media Works",
    ],
    "Real Estate": [
        "Meridian Property Group", "Apex Realty Partners", "Crestline Development", "Summit Properties",
        "Clearwater Real Estate", "Northgate Investment Properties", "Keystone Development Corp",
        "Ironbridge Properties", "Silverline Realty", "Mosaic Land Group",
        "Beacon Properties", "BlueCrest Realty", "Lakefront Development", "Horizon Property Solutions", "Atlas Real Estate",
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def get_pain_points(department: str, industry: str) -> list:
    """Return 2-3 rich pain points for this dept×industry combination."""
    dept_map = PAIN_POINTS_RICH.get(department, PAIN_POINTS_RICH.get("Operations", {}))
    if isinstance(dept_map, dict):
        industry_points = dept_map.get(industry, dept_map.get("default", ["Operational challenges", "Process inefficiencies", "Cost reduction pressure"]))
    else:
        industry_points = dept_map  # Already a list (legacy format)

    # Return 2-3 pain points
    k = min(random.randint(2, 3), len(industry_points))
    return random.sample(industry_points, k)


def get_company_name(industry: str) -> str:
    """Return a realistic company name for the given industry."""
    names = COMPANY_NAMES.get(industry, COMPANY_NAMES["Technology"])
    return random.choice(names)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN MIGRATION
# ─────────────────────────────────────────────────────────────────────────────

def run():
    print("=" * 70)
    print("🔧 MULTI-AGENT SYSTEM — DATABASE IMPROVEMENT SCRIPT")
    print("=" * 70)

    with Session(engine) as session:

        # ──────────────────────────────────────────────────
        # STEP 1: Products — Remove gibberish, add real ones
        # ──────────────────────────────────────────────────
        print("\n📦 STEP 1: Improving Products table...")

        # Add target_persona column to products first (needed for INSERT below)
        col_exists = session.execute(text("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name='products' AND column_name='target_persona'
        """)).scalar()
        if not col_exists:
            session.execute(text("ALTER TABLE products ADD COLUMN target_persona TEXT"))
            session.commit()
            print("  ✅ Added target_persona column to products")

        # Find and delete products that DON'T match any of the 5 real product names
        real_product_names = [
            "Nexus CRM Pro", "ShieldLayer Security", "FlowHR Platform",
            "DataBridge Analytics", "ReachMax Outreach"
        ]
        real_name_list = ", ".join(f"'{n}'" for n in real_product_names)

        # First: Remove FK references from engagement_history for these bad products
        result = session.execute(text(
            f"SELECT id FROM products WHERE name NOT IN ({real_name_list})"
        ))
        bad_product_ids = [str(row[0]) for row in result.fetchall()]
        print(f"  Found {len(bad_product_ids)} gibberish products to remove")

        if bad_product_ids:
            # Null out product_id in engagement_history (don't delete engagement rows)
            id_list = ", ".join(f"'{pid}'" for pid in bad_product_ids)
            session.execute(text(
                f"UPDATE engagement_history SET product_id = NULL WHERE product_id::text IN ({id_list})"
            ))
            # Now delete the bad products
            session.execute(text(
                f"DELETE FROM products WHERE id::text IN ({id_list})"
            ))
            print(f"  ✅ Removed {len(bad_product_ids)} gibberish products")

        # Insert the 10 new products using individual column inserts to avoid jsonb cast issues
        for p in NEW_PRODUCTS:
            prod_id = str(uuid.uuid4())
            # Use cast() in SQL to handle JSONB columns properly
            session.execute(text("""
                INSERT INTO products (
                    id, name, category, description,
                    target_industries, target_seniority, target_persona,
                    key_benefits, value_proposition,
                    cta_primary, cta_secondary,
                    price_model, price_from_usd, trial_available,
                    created_at
                ) VALUES (
                    CAST(:id AS UUID), :name, :category, :description,
                    CAST(:target_industries AS JSONB), CAST(:target_seniority AS JSONB), :target_persona,
                    CAST(:key_benefits AS JSONB), :value_proposition,
                    :cta_primary, :cta_secondary,
                    :price_model, :price_from_usd, :trial_available,
                    NOW()
                )
                ON CONFLICT DO NOTHING
            """), {
                "id": prod_id,
                "name": p["name"],
                "category": p["category"],
                "description": p["description"],
                "target_industries": json.dumps(p["target_industries"]),
                "target_seniority": json.dumps(p["target_seniority"]),
                "target_persona": p.get("target_persona", ""),
                "key_benefits": json.dumps(p["key_benefits"]),
                "value_proposition": p["value_proposition"],
                "cta_primary": p["cta_primary"],
                "cta_secondary": p["cta_secondary"],
                "price_model": p["price_model"],
                "price_from_usd": p["price_from_usd"],
                "trial_available": p["trial_available"],
            })

        print(f"  ✅ Inserted {len(NEW_PRODUCTS)} new industry-specific products")
        session.commit()

        # Verify products count
        count = session.execute(text("SELECT COUNT(*) FROM products")).scalar()
        print(f"  📊 Products table now has {count} rows (5 original + 10 new)")

        # ──────────────────────────────────────────────────
        # STEP 2: Add is_mock column if it doesn't exist
        # ──────────────────────────────────────────────────
        print("\n👤 STEP 2: Adding is_mock column to prospects...")

        # Check if column exists
        col_exists = session.execute(text("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name='prospects' AND column_name='is_mock'
        """)).scalar()

        if not col_exists:
            session.execute(text("ALTER TABLE prospects ADD COLUMN is_mock BOOLEAN DEFAULT TRUE"))
            session.execute(text("UPDATE prospects SET is_mock = TRUE"))
            print("  ✅ Added is_mock column — all existing prospects marked as mock")
        else:
            print("  ℹ️  is_mock column already exists — skipping")

        session.commit()

        # target_persona was already added before the product INSERT above

        # ──────────────────────────────────────────────────
        # STEP 3: Enrich prospect pain_points with rich dept×industry data
        # ──────────────────────────────────────────────────
        print("\n🧠 STEP 3: Enriching prospect pain_points with rich dept×industry combinations...")

        # Fetch all prospects
        rows = session.execute(text(
            "SELECT id, department, industry FROM prospects"
        )).fetchall()

        updated = 0
        for row in rows:
            prospect_id, department, industry = row[0], row[1], row[2]
            new_pain_points = get_pain_points(department, industry)
            session.execute(text("""
                UPDATE prospects
                SET pain_points = CAST(:pain_points AS JSONB)
                WHERE id = CAST(:id AS UUID)
            """), {
                "pain_points": json.dumps(new_pain_points),
                "id": str(prospect_id)
            })
            updated += 1

        session.commit()
        print(f"  ✅ Enriched pain_points for {updated} prospects with dept×industry-specific data")

        # ──────────────────────────────────────────────────
        # STEP 4: Improve company names to sound like real B2B firms
        # ──────────────────────────────────────────────────
        print("\n🏢 STEP 4: Upgrading company names to realistic B2B names...")

        rows = session.execute(text("SELECT id, industry FROM prospects")).fetchall()
        company_updated = 0
        for row in rows:
            prospect_id, industry = row[0], row[1]
            new_company = get_company_name(industry)
            session.execute(text("""
                UPDATE prospects SET company_name = :company WHERE CAST(id AS TEXT) = :id
            """), {"company": new_company, "id": str(prospect_id)})
            company_updated += 1

        session.commit()
        print(f"  ✅ Updated company names for {company_updated} prospects")

        # ──────────────────────────────────────────────────
        # STEP 5: Rebuild engagement_history with per-prospect consistent profiles
        # ──────────────────────────────────────────────────
        print("\n📊 STEP 5: Rebuilding engagement_history with per-prospect engagement profiles...")

        # Delete existing engagement_history
        deleted = session.execute(text("DELETE FROM engagement_history")).rowcount
        print(f"  🗑️  Deleted {deleted} old random engagement records")
        session.commit()

        # Fetch prospect info
        prospects_data = session.execute(text("""
            SELECT id, seniority, preferred_channel, email_open_rate, call_answer_rate
            FROM prospects
        """)).fetchall()

        # Fetch product IDs
        product_ids = [str(row[0]) for row in session.execute(text("SELECT id FROM products")).fetchall()]

        CHANNELS = ["email", "linkedin", "call"]
        CONTENT_TYPES = ["outreach", "follow_up", "nurture", "demo_invite"]

        # Assign each prospect an "engager profile" — determines their personal open/reply rates
        PROFILES = {
            "high":   {"email_open": (0.45, 0.70), "email_reply": (0.20, 0.35), "linkedin_open": (0.55, 0.75), "linkedin_reply": (0.25, 0.40), "call_answer": (0.40, 0.60)},
            "medium": {"email_open": (0.20, 0.40), "email_reply": (0.08, 0.18), "linkedin_open": (0.35, 0.55), "linkedin_reply": (0.12, 0.25), "call_answer": (0.20, 0.40)},
            "low":    {"email_open": (0.05, 0.18), "email_reply": (0.02, 0.08), "linkedin_open": (0.10, 0.30), "linkedin_reply": (0.03, 0.10), "call_answer": (0.05, 0.20)},
        }

        new_engagements = []
        for p_row in prospects_data:
            p_id = str(p_row[0])
            seniority = p_row[1]
            preferred_channel = p_row[2] or "email"

            # Assign a consistent engager profile per prospect
            profile_key = random.choices(["high", "medium", "low"], weights=[20, 50, 30], k=1)[0]
            profile = PROFILES[profile_key]

            # Number of historical engagements per prospect (3-6)
            n_engagements = random.randint(3, 6)

            for _ in range(n_engagements):
                # Weight towards preferred channel
                channel_weights = {"email": 30, "linkedin": 40, "call": 30}
                if preferred_channel in channel_weights:
                    channel_weights[preferred_channel] += 25
                channel = random.choices(list(channel_weights.keys()), weights=list(channel_weights.values()), k=1)[0]

                sent_dt = datetime.utcnow() - timedelta(days=random.randint(7, 365))

                # Engagement rates based on profile (consistent per person)
                if channel == "email":
                    was_opened = random.random() < random.uniform(*profile["email_open"])
                    was_clicked = was_opened and random.random() < 0.35
                    was_replied = was_clicked and random.random() < random.uniform(*profile["email_reply"])
                elif channel == "linkedin":
                    was_opened = random.random() < random.uniform(*profile["linkedin_open"])
                    was_clicked = was_opened and random.random() < 0.40
                    was_replied = was_clicked and random.random() < random.uniform(*profile["linkedin_reply"])
                else:  # call
                    was_opened = random.random() < random.uniform(*profile["call_answer"])
                    was_clicked = False
                    was_replied = was_opened and random.random() < 0.45

                # Decision-makers have higher conversion chance
                is_decision_maker = seniority in ["c_level", "vp", "director"]
                was_converted = was_replied and is_decision_maker and random.random() < 0.15

                reply_sentiment = None
                if was_replied:
                    reply_sentiment = random.choices(["positive", "neutral", "negative"], weights=[55, 30, 15], k=1)[0]

                hour = random.randint(7, 18)
                time_of_day = "morning" if hour < 12 else ("afternoon" if hour < 17 else "evening")

                new_engagements.append({
                    "id": str(uuid.uuid4()),
                    "prospect_id": p_id,
                    "product_id": random.choice(product_ids) if random.random() > 0.15 else None,
                    "channel": channel,
                    "content_type": random.choice(CONTENT_TYPES),
                    "subject": f"Quick question about your {random.choice(['operations', 'workflow', 'team', 'roadmap'])}" if channel != "call" else None,
                    "sent_at": sent_dt.isoformat(),
                    "was_opened": was_opened,
                    "was_clicked": was_clicked,
                    "was_replied": was_replied,
                    "reply_sentiment": reply_sentiment,
                    "was_converted": was_converted,
                    "day_of_week": sent_dt.strftime("%A"),
                    "time_of_day": time_of_day,
                    "created_at": sent_dt.isoformat(),
                })

        # Bulk insert in batches of 200 — use individual inserts to handle NULL product_id
        BATCH = 200
        total = len(new_engagements)
        for i in range(0, total, BATCH):
            batch = new_engagements[i:i+BATCH]
            for row in batch:
                session.execute(text("""
                    INSERT INTO engagement_history (
                        id, prospect_id, product_id, channel, content_type,
                        subject, sent_at, was_opened, was_clicked, was_replied,
                        reply_sentiment, was_converted, day_of_week, time_of_day, created_at
                    ) VALUES (
                        CAST(:id AS UUID),
                        CAST(:prospect_id AS UUID),
                        CASE WHEN :product_id IS NULL THEN NULL ELSE CAST(:product_id AS UUID) END,
                        :channel, :content_type,
                        :subject,
                        CAST(:sent_at AS TIMESTAMP),
                        :was_opened, :was_clicked, :was_replied,
                        :reply_sentiment, :was_converted, :day_of_week, :time_of_day,
                        CAST(:created_at AS TIMESTAMP)
                    )
                """), row)
            session.commit()
            print(f"  → Inserted {min(i+BATCH, total)}/{total} engagement records...", end="\r")

        print(f"\n  ✅ Rebuilt engagement_history with {total} records (per-prospect consistent profiles)")

        # ──────────────────────────────────────────────────
        # FINAL: Print summary
        # ──────────────────────────────────────────────────
        print("\n" + "=" * 70)
        print("✅ DATABASE IMPROVEMENT COMPLETE")
        print("=" * 70)

        for table in ["products", "prospects", "engagement_history", "classifications", "api_call_logs", "sent_emails"]:
            try:
                cnt = session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"  {table:<30} {cnt:>6} rows")
            except Exception:
                pass

        # Show sample improved products
        print("\n📦 New Product Catalog (sample):")
        prods = session.execute(text(
            "SELECT name, value_proposition FROM products ORDER BY created_at DESC LIMIT 6"
        )).fetchall()
        for p in prods:
            print(f"  • {p[0]:<35} → {p[1][:65]}...")

        # Show sample improved prospect pain points
        print("\n🧠 Sample Improved Pain Points:")
        sample = session.execute(text(
            "SELECT first_name, last_name, department, industry, pain_points FROM prospects LIMIT 5"
        )).fetchall()
        for s in sample:
            pain = json.loads(s[4]) if isinstance(s[4], str) else s[4]
            print(f"  • {s[0]} {s[1]} ({s[2]}, {s[3]}):")
            for pt in pain:
                print(f"      - {pt}")

        print("\n🎉 Database is now significantly more realistic for a prototype demo!")
        print("   Run your campaign pipeline to see the improved content quality.\n")


if __name__ == "__main__":
    run()
