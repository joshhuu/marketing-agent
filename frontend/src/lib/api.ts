// src/lib/api.ts
const API_BASE_URL = 'http://localhost:8000';
const USER_ROLE = 'marketer';

export interface SSEEvent {
  stage: string;
  status: string;
  data?: any;
  timestamp: string;
  session_id?: string;
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
