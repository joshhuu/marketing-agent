import React, { useEffect, useState } from 'react';
import { X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { ApiClient, ExecutionDetail } from '../lib/api';

interface CampaignDetailModalProps {
  executionId: string | null;
  onClose: () => void;
}

export function CampaignDetailModal({ executionId, onClose }: CampaignDetailModalProps) {
  const [executionDetail, setExecutionDetail] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    classification: true,
    strategy: true,
    icpMatching: true,
    prospects: false,
    platformDecision: true,
    content: true,
  });

  useEffect(() => {
    if (executionId) {
      fetchExecutionDetails();
    }
  }, [executionId]);

  const fetchExecutionDetails = async () => {
    if (!executionId) return;

    setLoading(true);
    setError(null);

    try {
      const details = await ApiClient.getExecutionDetails(executionId);
      setExecutionDetail(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution details');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!executionId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-2xl font-bold text-gray-900">Campaign Execution Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <span className="ml-3 text-gray-600">Loading execution details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {executionDetail && !loading && (
            <div className="space-y-4">
              {/* Classification Section */}
              <Section
                title="1. Input Parsing & Classification"
                expanded={expandedSections.classification}
                onToggle={() => toggleSection('classification')}
              >
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Category" value={executionDetail.classification.category} />
                  <InfoItem
                    label="Confidence"
                    value={`${(executionDetail.classification.confidence * 100).toFixed(1)}%`}
                  />
                  <InfoItem label="Time Context" value={executionDetail.classification.time_context} />
                  <InfoItem label="Location" value={executionDetail.classification.location} />
                  <InfoItem
                    label="Business Behavior"
                    value={executionDetail.classification.business_behavior}
                    fullWidth
                  />
                  <InfoItem
                    label="User Intent"
                    value={executionDetail.classification.user_intent}
                    fullWidth
                  />
                  {executionDetail.details?.sender_name && (
                    <InfoItem label="Sender Name" value={executionDetail.details.sender_name} />
                  )}
                  {executionDetail.details?.target_audience && (
                    <InfoItem label="Target Audience" value={executionDetail.details.target_audience} />
                  )}
                </div>
              </Section>

              {/* Strategy Section */}
              <Section
                title="2. Strategy Generation"
                expanded={expandedSections.strategy}
                onToggle={() => toggleSection('strategy')}
              >
                <div className="grid grid-cols-3 gap-4">
                  <InfoItem label="Tone" value={executionDetail.classification.tone} />
                  <InfoItem label="CTA Type" value={executionDetail.classification.cta_type} />
                  <InfoItem label="Urgency Level" value={executionDetail.classification.urgency_level} />
                </div>
              </Section>

              {/* ICP Matching Section */}
              {executionDetail.details && (
                <>
                  <Section
                    title="3. ICP Matching"
                    expanded={expandedSections.icpMatching}
                    onToggle={() => toggleSection('icpMatching')}
                  >
                    <div className="space-y-3">
                      <InfoItem label="Target Archetype" value={executionDetail.details.target_archetype} />
                      <InfoItem
                        label="Prospects Found"
                        value={`${executionDetail.details.prospects_count} prospects identified`}
                      />
                      {executionDetail.details.prospects_filtered_count !==
                        executionDetail.details.prospects_count && (
                        <InfoItem
                          label="Filtered Count"
                          value={`${executionDetail.details.prospects_filtered_count} after filtering`}
                        />
                      )}
                    </div>
                  </Section>

                  {/* Prospects List */}
                  <Section
                    title="Top Prospects"
                    expanded={expandedSections.prospects}
                    onToggle={() => toggleSection('prospects')}
                  >
                    <div className="space-y-2">
                      {executionDetail.details.prospects.length > 0 ? (
                        <div className="divide-y">
                          {executionDetail.details.prospects.map((prospect, idx) => (
                            <div key={prospect.id} className="py-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {idx + 1}. {prospect.name}
                                  </p>
                                  <p className="text-sm text-gray-600">{prospect.job_title}</p>
                                  <p className="text-sm text-gray-500">
                                    {prospect.company} • {prospect.industry}
                                  </p>
                                </div>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                                  Score: {prospect.priority_score.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No prospects available</p>
                      )}
                    </div>
                  </Section>

                  {/* Platform Decision */}
                  <Section
                    title="4. Platform Decision"
                    expanded={expandedSections.platformDecision}
                    onToggle={() => toggleSection('platformDecision')}
                  >
                    <div className="space-y-3">
                      <InfoItem label="Selected Channel" value={executionDetail.details.selected_channel} />
                      <InfoItem
                        label="Reasoning"
                        value={executionDetail.details.channel_reasoning}
                        fullWidth
                      />
                    </div>
                  </Section>

                  {/* Content Generation */}
                  <Section
                    title="5. Generated Content"
                    expanded={expandedSections.content}
                    onToggle={() => toggleSection('content')}
                  >
                    <div className="space-y-6">
                      {/* LinkedIn Message */}
                      {executionDetail.details.content.linkedin_message && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            LinkedIn Message
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 border">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {executionDetail.details.content.linkedin_message}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Email */}
                      {executionDetail.details.content.email.subject && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Email
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 border space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Subject</p>
                              <p className="text-gray-900 font-medium">
                                {executionDetail.details.content.email.subject}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Body</p>
                              <p className="text-gray-700 whitespace-pre-wrap">
                                {executionDetail.details.content.email.body}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Call Script */}
                      {executionDetail.details.content.call_script.opener && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                            Call Script
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 border space-y-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Opener</p>
                              <p className="text-gray-700 whitespace-pre-wrap">
                                {executionDetail.details.content.call_script.opener}
                              </p>
                            </div>
                            
                            {executionDetail.details.content.call_script.objections &&
                              executionDetail.details.content.call_script.objections.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">
                                    Objection Handling
                                  </p>
                                  <div className="space-y-2">
                                    {executionDetail.details.content.call_script.objections.map((obj, idx) => (
                                      <div key={idx} className="bg-white rounded p-3 border">
                                        <p className="text-sm font-medium text-gray-700 mb-1">
                                          Objection: {obj.objection}
                                        </p>
                                        <p className="text-sm text-gray-600">Response: {obj.response}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {executionDetail.details.content.call_script.close && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Close</p>
                                <p className="text-gray-700 whitespace-pre-wrap">
                                  {executionDetail.details.content.call_script.close}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Product Info */}
                      {executionDetail.details.product.name && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                            Product Information
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 border">
                            <p className="font-medium text-gray-900 mb-1">
                              {executionDetail.details.product.name}
                            </p>
                            <p className="text-gray-700 text-sm">
                              {executionDetail.details.product.value_proposition}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              {/* Timestamp */}
              <div className="mt-6 pt-4 border-t text-sm text-gray-500">
                Executed on {new Date(executionDetail.classification.created_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface SectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
      >
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>
      {expanded && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

interface InfoItemProps {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}

function InfoItem({ label, value, fullWidth = false }: InfoItemProps) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-gray-900">{value || 'N/A'}</p>
    </div>
  );
}
