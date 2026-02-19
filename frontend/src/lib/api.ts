// src/lib/api.ts
const API_BASE_URL = 'http://localhost:8000';
const USER_ROLE = 'marketer';

export interface SSEEvent {
  stage: string;
  status: string;
  data?: any;
  timestamp: string;
  session_id?: string;
  classification_id?: string;
}

export interface ExecutionHistory {
  id: string;
  time_context: string | null;
  location: string | null;
  business_behavior: string | null;
  user_intent: string | null;
  category: string;
  confidence: number;
  tone: string | null;
  cta_type: string | null;
  urgency_level: string | null;
  created_at: string;
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

export interface ExecutionDetail {
  classification: {
    id: string;
    time_context: string | null;
    location: string | null;
    business_behavior: string | null;
    user_intent: string | null;
    category: string;
    confidence: number;
    tone: string | null;
    cta_type: string | null;
    urgency_level: string | null;
    created_at: string;
  };
  details: {
    sender_name: string | null;
    target_audience: string | null;
    target_archetype: string | null;
    prospects: Array<{
      id: string;
      name: string;
      job_title: string;
      company: string;
      industry: string;
      priority_score: number;
    }>;
    prospects_count: number;
    prospects_filtered_count: number;
    selected_channel: string | null;
    channel_reasoning: string | null;
    created_at: string | null;
    personalized_content: PersonalizedContent[];  // NEW: Personalized content for each prospect
    content: {
      linkedin_message: string | null;
      email: {
        subject: string | null;
        body: string | null;
      };
      call_script: {
        opener: string | null;
        objections: Array<{
          objection: string;
          response: string;
        }>;
        close: string | null;
      };
    };
    product: {
      name: string | null;
      value_proposition: string | null;
    };
  } | null;
}

export interface ProspectHistory {
  id: string;
  name: string;
  job_title: string;
  company_name: string;
  industry: string;
  priority_score: number;
  icp_score: number | null;
  times_contacted: number;
  last_contacted_at: string | null;
  from_campaign?: boolean;
}

export interface PaginatedProspects {
  prospects: ProspectHistory[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ProspectDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  job_title: string;
  company_name: string;
  company_size: string | null;
  seniority: string;
  department: string;
  industry: string;
  country: string | null;
  city: string | null;
  timezone: string | null;
  icp_archetype: string | null;
  icp_score: number | null;
  priority_score: number | null;
  is_decision_maker: boolean | null;
  preferred_channel: string | null;
  best_contact_time: string | null;
  email_open_rate: number | null;
  linkedin_click_rate: number | null;
  call_answer_rate: number | null;
  times_contacted: number | null;
  last_contacted_at: string | null;
  pain_points: string[] | null;
  interests: string[] | null;
  created_at: string | null;
  engagements: Array<{
    id: string;
    channel: string;
    sent_at: string | null;
    was_opened: boolean;
    was_replied: boolean;
  }>;
}

export class ApiClient {
  /**
   * Execute campaign with SSE streaming
   */
  static async executeCampaign(
    userPrompt: string,
    onMessage: (event: SSEEvent) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<() => void> {
    const payload = {
      time: 'current',
      location: 'any',
      business_behavior: userPrompt,
      intent: userPrompt,
      target_audience: userPrompt,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': USER_ROLE,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Process SSE stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              onComplete();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data) {
                  try {
                    const event: SSEEvent = JSON.parse(data);
                    onMessage(event);
                  } catch (e) {
                    console.error('Failed to parse SSE data:', data);
                  }
                }
              }
            }
          }
        } catch (error) {
          onError(error as Error);
        }
      };

      processStream();

      // Return cleanup function
      return () => {
        reader.cancel();
      };
    } catch (error) {
      onError(error as Error);
      return () => {};
    }
  }

  /**
   * Approve campaign after ICP matching
   */
  static async approveCampaign(
    sessionId: string,
    approved: boolean,
    selectedProspectIds: string[]
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/campaigns/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': USER_ROLE,
      },
      body: JSON.stringify({
        session_id: sessionId,
        approved,
        selected_prospect_ids: selectedProspectIds,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to approve campaign');
    }
  }

  /**
   * Get execution history
   */
  static async getExecutionHistory(
    limit: number = 50,
    offset: number = 0
  ): Promise<ExecutionHistory[]> {
    const response = await fetch(
      `${API_BASE_URL}/history/executions?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'X-User-Role': USER_ROLE,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch execution history');
    }

    return response.json();
  }

  /**
   * Get detailed execution information for a specific campaign
   */
  static async getExecutionDetails(
    executionId: string
  ): Promise<ExecutionDetail> {
    const response = await fetch(
      `${API_BASE_URL}/history/executions/${executionId}/details`,
      {
        headers: {
          'X-User-Role': USER_ROLE,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch execution details');
    }

    return response.json();
  }

  /**
   * Delete a campaign execution
   */
  static async deleteExecution(
    executionId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${API_BASE_URL}/history/executions/${executionId}`,
      {
        method: 'DELETE',
        headers: {
          'X-User-Role': USER_ROLE,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete execution');
    }

    return response.json();
  }

  /**
   * Get prospect history
   */
  static async getProspectHistory(
    minPriorityScore: number = 0.0,
    limit: number = 100,
    offset: number = 0
  ): Promise<ProspectHistory[]> {
    const response = await fetch(
      `${API_BASE_URL}/history/prospects?min_priority_score=${minPriorityScore}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'X-User-Role': USER_ROLE,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch prospect history');
    }

    return response.json();
  }

  /**
   * Get paginated prospects from database
   */
  static async getRecentCampaignProspects(
    limit: number = 50,
    page: number = 1
  ): Promise<PaginatedProspects> {
    const response = await fetch(
      `${API_BASE_URL}/prospects/recent?limit=${limit}&page=${page}`,
      {
        headers: {
          'X-User-Role': USER_ROLE,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch prospects');
    }

    return response.json();
  }

  /**
   * Get detailed information for a specific prospect
   */
  static async getProspectDetails(
    prospectId: string
  ): Promise<ProspectDetail> {
    const response = await fetch(
      `${API_BASE_URL}/prospects/${prospectId}`,
      {
        headers: {
          'X-User-Role': USER_ROLE,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch prospect details');
    }

    return response.json();
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{ status: string; service: string; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
      throw new Error('Health check failed');
    }

    return response.json();
  }
}
