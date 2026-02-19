import { StageData, Prospect } from '../types/campaign';

const firstNames = ['Sarah', 'Michael', 'Emma', 'James', 'Olivia', 'David', 'Sophie', 'Robert', 'Charlotte', 'William', 'Amelia', 'Thomas', 'Isabella', 'Daniel', 'Ella'];
const lastNames = ['Johnson', 'Chen', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Martin', 'Clarke', 'Roberts', 'Walker', 'Hall', 'Wood', 'Thompson'];
const companies = ['Acme Corp', 'TechStart Inc', 'GlobalHR Solutions', 'InnovateCo', 'PrimeVentures', 'NexGen Ltd', 'AlphaTech', 'BlueStar Group', 'DataFlow Systems', 'Meridian Corp', 'Apex Solutions', 'Vertex Industries', 'Summit Partners', 'Eclipse Digital', 'Horizon Labs'];
const industries = ['Healthcare', 'Technology', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Real Estate', 'Logistics', 'Media', 'Consulting'];

function extractLocation(prompt: string): string {
  const locations = ['UK', 'London', 'US', 'New York', 'Europe', 'Germany', 'France', 'Australia', 'Canada', 'US & Canada', 'North America'];
  for (const loc of locations) {
    if (prompt.toLowerCase().includes(loc.toLowerCase())) return loc;
  }
  return 'Global';
}

function extractTarget(prompt: string): string {
  const targets: Record<string, string> = {
    'hr manager': 'HR Managers',
    'hr director': 'HR Directors',
    'cto': 'CTOs',
    'ceo': 'CEOs',
    'sales director': 'Sales Directors',
    'vp of': 'VP-Level Executives',
    'marketing': 'Marketing Professionals',
    'it director': 'IT Directors',
    'finance': 'Finance Leaders',
    'engineering': 'Engineering Leaders',
  };
  const lower = prompt.toLowerCase();
  for (const [key, val] of Object.entries(targets)) {
    if (lower.includes(key)) return val;
  }
  return 'Decision Makers';
}

function extractBusiness(prompt: string): string {
  const businesses: Record<string, string> = {
    'hr software': 'Selling HR Payroll Software',
    'payroll': 'Selling Payroll Software',
    'cybersecurity': 'Cybersecurity Compliance Platform',
    'crm': 'CRM Tool',
    'saas': 'SaaS Product',
    'ai': 'AI Platform',
    'marketing': 'Marketing Solution',
    'analytics': 'Analytics Software',
    'cloud': 'Cloud Infrastructure',
  };
  const lower = prompt.toLowerCase();
  for (const [key, val] of Object.entries(businesses)) {
    if (lower.includes(key)) return val;
  }
  return 'B2B Software Product';
}

function extractIntent(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('leads') || lower.includes('lead gen')) return 'Generate Leads';
  if (lower.includes('demo')) return 'Book Demos';
  if (lower.includes('aware')) return 'Build Awareness';
  if (lower.includes('partner')) return 'Find Partners';
  return 'Generate Leads';
}

function extractTone(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('deadline')) return 'Urgent & Direct';
  if (lower.includes('educate') || lower.includes('resource')) return 'Educational';
  return 'Professional & Consultative';
}

function extractUrgency(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('q1') || lower.includes('deadline')) return 'High';
  if (lower.includes('next week') || lower.includes('soon')) return 'Medium-High';
  return 'Medium';
}

function extractCTA(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('demo')) return 'Book a Demo';
  if (lower.includes('resource') || lower.includes('guide')) return 'Download Resource';
  if (lower.includes('call')) return 'Schedule a Call';
  return 'Book a Demo';
}

function selectPlatform(target: string): { selected: string; icon: string; reason: string; stats: { label: string; value: string }[] } {
  const lower = target.toLowerCase();
  if (lower.includes('cto') || lower.includes('engineer') || lower.includes('tech')) {
    return {
      selected: 'LinkedIn',
      icon: '💼',
      reason: 'LinkedIn dominates tech executive outreach with 54% open rates for CTO-level contacts, outperforming email (31%) significantly.',
      stats: [{ label: 'LinkedIn open rate', value: '54%' }, { label: 'Email open rate', value: '31%' }],
    };
  }
  if (lower.includes('hr') || lower.includes('people')) {
    return {
      selected: 'LinkedIn',
      icon: '💼',
      reason: 'LinkedIn shows 42% open rate for HR professionals, significantly higher than email (28%) for this audience.',
      stats: [{ label: 'LinkedIn open rate', value: '42%' }, { label: 'Email open rate', value: '28%' }],
    };
  }
  return {
    selected: 'Email + LinkedIn',
    icon: '📧',
    reason: 'A multi-channel approach combining Email (35% open rate) and LinkedIn (40% acceptance) maximizes reach for this audience.',
    stats: [{ label: 'Combined reach', value: '67%' }, { label: 'Response rate', value: '18%' }],
  };
}

function generateProspects(target: string, count = 15): Prospect[] {
  const titleMap: Record<string, string[]> = {
    'hr managers': ['HR Manager', 'HR Business Partner', 'People Operations Manager', 'HR Generalist', 'Talent Manager'],
    'hr directors': ['HR Director', 'Director of People', 'Chief People Officer', 'VP of HR', 'Head of Human Resources'],
    'ctos': ['Chief Technology Officer', 'VP of Engineering', 'Head of Technology', 'Director of Engineering', 'CTO'],
    'sales directors': ['Sales Director', 'VP of Sales', 'Head of Sales', 'Director of Revenue', 'Chief Revenue Officer'],
    'decision makers': ['VP of Operations', 'Director of Strategy', 'Head of Growth', 'Managing Director', 'COO'],
  };

  const lower = target.toLowerCase();
  let titles = titleMap['decision makers'];
  for (const [key, val] of Object.entries(titleMap)) {
    if (lower.includes(key.split(' ')[0])) {
      titles = val;
      break;
    }
  }

  return Array.from({ length: count }, (_, i) => ({
    id: `prospect-${i}`,
    name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
    title: titles[i % titles.length],
    company: companies[i % companies.length],
    industry: industries[i % industries.length],
    priority: parseFloat((0.95 - i * 0.02).toFixed(2)),
    selected: true,
  }));
}

function generateContent(name: string, title: string, company: string, business: string, cta: string): { linkedin: string; email: string; callScript: string } {
  const firstName = name.split(' ')[0];
  return {
    linkedin: `Hi ${firstName},\n\nAs ${title} at ${company}, you're likely navigating the challenge of ${business.toLowerCase()} — and I wanted to reach out personally.\n\nAt [Company], we've helped similar teams reduce operational overhead by 40% while improving team satisfaction scores.\n\nWould you be open to a 15-minute conversation to see if we could do the same for ${company}?\n\n${cta} → [Link]\n\nBest,\n[Your Name]`,
    email: `Subject: Quick question for ${title}s at ${company}\n\nHi ${firstName},\n\nI came across ${company} and was impressed by your growth trajectory.\n\nWe work with ${title}s at companies like yours to ${business.toLowerCase()} more efficiently — often cutting time-to-value by 35%.\n\nI'd love to show you specifically how it works for ${company}.\n\n${cta}: [Calendar Link]\n\nBest regards,\n[Your Name]\n[Company] | [Website]`,
    callScript: `[INTRO]\n"Hi ${firstName}, this is [Name] from [Company]. I'm reaching out because we work with ${title}s at companies like ${company}..."\n\n[HOOK]\n"We recently helped a similar company reduce [problem] by 40% — and I wanted to see if this resonates with what you're seeing at ${company}."\n\n[QUALIFICATION]\n"Quick question — is [specific challenge] currently on your radar for this quarter?"\n\n[CTA]\n"Would it make sense to schedule 20 minutes to walk through exactly how we'd approach this for ${company}?"\n\n[OBJECTION HANDLING]\n- "Not a good time" → "I completely understand. When would be a better time — next Tuesday or Thursday?"\n- "We have a solution" → "Great! I'd love to understand what you're using and see if there's a gap we could fill."`,
  };
}

export function generateMockStageData(prompt: string): StageData {
  const location = extractLocation(prompt);
  const target = extractTarget(prompt);
  const business = extractBusiness(prompt);
  const intent = extractIntent(prompt);
  const tone = extractTone(prompt);
  const urgency = extractUrgency(prompt);
  const cta = extractCTA(prompt);
  const platform = selectPlatform(target);
  const prospects = generateProspects(target);
  const firstProspect = prospects[0];

  return {
    inputParser: {
      time: urgency === 'High' ? 'ASAP' : urgency === 'Medium-High' ? 'Next 2 Weeks' : 'Ongoing',
      location,
      business,
      intent,
      target,
    },
    classifier: {
      category: 'B2B Lead Generation',
      confidence: 92 + Math.floor(Math.random() * 6),
    },
    strategy: {
      tone,
      cta,
      urgency,
    },
    icpMatcher: {
      prospects,
    },
    platform,
    contentGenerator: generateContent(firstProspect.name, firstProspect.title, firstProspect.company, business, cta),
  };
}
