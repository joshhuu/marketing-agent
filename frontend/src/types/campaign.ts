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
