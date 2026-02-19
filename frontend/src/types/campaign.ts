export type StageStatus = 'pending' | 'active' | 'done' | 'waiting';

export interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  priority: number;
  selected: boolean;
}

export interface PersonalizedContent {
  prospect_id: string;
  prospect_name: string;
  prospect_company: string;
  prospect_job_title: string;
  linkedin_message: string;
  email_message: {
    subject: string;
    body: string;
  };
  call_script: {
    opener: string;
    objections: string[];
    close: string;
  };
}

export interface StageData {
  inputParser?: {
    time: string;
    location: string;
    business: string;
    intent: string;
    target: string;
  };
  classifier?: {
    category: string;
    confidence: number;
  };
  strategy?: {
    tone: string;
    cta: string;
    urgency: string;
  };
  icpMatcher?: {
    prospects: Prospect[];
  };
  platform?: {
    selected: string;
    icon: string;
    reason: string;
    stats: { label: string; value: string }[];
  };
  contentGenerator?: {
    linkedin: string;
    email: string;
    callScript: string;
    personalizedContent?: PersonalizedContent[];  // NEW: All personalized content
  };
}

export interface CampaignResult {
  id: string;
  prompt: string;
  createdAt: Date;
  category: string;
  prospectsCount: number;
  platform: string;
  stageData: StageData;
}
