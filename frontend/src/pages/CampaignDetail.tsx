import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, Calendar, Target, MessageSquare, Mail, Phone, Package, AlertCircle } from 'lucide-react';
import { ApiClient, ExecutionDetail, PersonalizedContent } from '../lib/api';
import { FormattedText } from '../lib/formatters';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchExecutionDetails();
    }
  }, [id]);

  const fetchExecutionDetails = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const details = await ApiClient.getExecutionDetails(id);
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

  if (!id) {
    return (
      <div className="min-h-full gradient-bg flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-2">Invalid Campaign ID</h2>
          <Link to="/history" className="text-primary hover:underline">Back to History</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full gradient-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header with Back Button */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate('/history')}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to History</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Campaign Details</h1>
              <p className="text-sm text-muted-foreground">View complete execution information</p>
            </div>
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="animate-spin text-primary mx-auto mb-3" size={40} />
              <span className="text-muted-foreground">Loading campaign details...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-glass rounded-xl p-6 border border-destructive/20 bg-destructive/5"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Error Loading Details</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Content */}
        {executionDetail && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Classification Section */}
            <Section
              title="1. Input Parsing & Classification"
              icon={<Target className="w-4 h-4" />}
              expanded={expandedSections.classification}
              onToggle={() => toggleSection('classification')}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </Section>

            {/* Strategy & Details Section */}
            {executionDetail.details && (
              <>
                <Section
                  title="2. Strategy & Approach"
                  icon={<MessageSquare className="w-4 h-4" />}
                  expanded={expandedSections.strategy}
                  onToggle={() => toggleSection('strategy')}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="Tone" value={executionDetail.classification.tone} />
                    <InfoItem label="CTA Type" value={executionDetail.classification.cta_type} />
                    <InfoItem label="Urgency Level" value={executionDetail.classification.urgency_level} />
                  </div>
                </Section>

                {/* ICP Matching Section */}
                <Section
                  title="3. ICP Matching"
                  icon={<Target className="w-4 h-4" />}
                  expanded={expandedSections.icpMatching}
                  onToggle={() => toggleSection('icpMatching')}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <InfoItem label="Sender Name" value={executionDetail.details.sender_name} />
                    <InfoItem label="Target Audience" value={executionDetail.details.target_audience} />
                    <InfoItem
                      label="Target Archetype"
                      value={executionDetail.details.target_archetype}
                      fullWidth
                    />
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {executionDetail.details.prospects_count}
                      </span>
                      Matched Prospects
                    </h4>
                    <button
                      onClick={() => toggleSection('prospects')}
                      className="w-full text-left px-4 py-2 bg-muted/50 hover:bg-muted rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm text-muted-foreground">
                        {expandedSections.prospects ? 'Hide' : 'Show'} prospect details
                      </span>
                      {expandedSections.prospects ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    
                    {expandedSections.prospects && executionDetail.details.prospects && (
                      <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                        {executionDetail.details.prospects.map((prospect, idx) => (
                          <div key={idx} className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-foreground text-sm">{prospect.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{prospect.job_title}</p>
                                <p className="text-xs text-muted-foreground">{prospect.company} • {prospect.industry}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-primary">
                                  {prospect.priority_score.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">Priority</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>

                {/* Platform Decision Section */}
                <Section
                  title="4. Platform Decision"
                  icon={<MessageSquare className="w-4 h-4" />}
                  expanded={expandedSections.platformDecision}
                  onToggle={() => toggleSection('platformDecision')}
                >
                  <div className="space-y-3">
                    <InfoItem
                      label="Selected Channel"
                      value={executionDetail.details.selected_channel}
                    />
                    <InfoItem
                      label="Reasoning"
                      value={executionDetail.details.channel_reasoning}
                      fullWidth
                    />
                  </div>
                </Section>

                {/* Content Generation Section */}
                <Section
                  title="5. Generated Content"
                  icon={<Mail className="w-4 h-4" />}
                  expanded={expandedSections.content}
                  onToggle={() => toggleSection('content')}
                >
                  <div className="space-y-6">
                    {/* Check if personalized content is available */}
                    {executionDetail.details.personalized_content && 
                     executionDetail.details.personalized_content.length > 0 ? (
                      <>
                        {/* Personalized Content View */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-blue-600 font-semibold">
                              🎯 Personalized Content for {executionDetail.details.personalized_content.length} Prospects
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">View content for:</label>
                            <select
                              value={selectedProspectIndex}
                              onChange={(e) => setSelectedProspectIndex(Number(e.target.value))}
                              className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                            >
                              {executionDetail.details.personalized_content.map((pc, idx) => (
                                <option key={pc.prospect_id} value={idx}>
                                  {pc.prospect_name} — {pc.prospect_job_title} at {pc.prospect_company}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {selectedProspectIndex + 1} / {executionDetail.details.personalized_content.length}
                            </span>
                          </div>
                        </div>

                        {/* Display selected prospect's content */}
                        {executionDetail.details.personalized_content[selectedProspectIndex] && (
                          <div className="space-y-6">
                            {/* LinkedIn Message */}
                            {executionDetail.details.personalized_content[selectedProspectIndex].linkedin_message && (
                              <ContentBlock
                                icon={<MessageSquare className="w-4 h-4" />}
                                title="LinkedIn Message"
                                iconColor="bg-blue-500"
                              >
                                <FormattedText className="text-foreground whitespace-pre-wrap leading-relaxed">
                                  {executionDetail.details.personalized_content[selectedProspectIndex].linkedin_message}
                                </FormattedText>
                              </ContentBlock>
                            )}

                            {/* Email */}
                            {executionDetail.details.personalized_content[selectedProspectIndex].email_message && (
                              <ContentBlock
                                icon={<Mail className="w-4 h-4" />}
                                title="Email"
                                iconColor="bg-green-500"
                              >
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Subject</p>
                                    <FormattedText className="text-foreground font-medium">
                                      {executionDetail.details.personalized_content[selectedProspectIndex].email_message.subject}
                                    </FormattedText>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Body</p>
                                    <FormattedText className="text-foreground whitespace-pre-wrap leading-relaxed">
                                      {executionDetail.details.personalized_content[selectedProspectIndex].email_message.body}
                                    </FormattedText>
                                  </div>
                                </div>
                              </ContentBlock>
                            )}

                            {/* Call Script */}
                            {executionDetail.details.personalized_content[selectedProspectIndex].call_script && (
                              <ContentBlock
                                icon={<Phone className="w-4 h-4" />}
                                title="Call Script"
                                iconColor="bg-purple-500"
                              >
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Opener</p>
                                    <FormattedText className="text-foreground whitespace-pre-wrap leading-relaxed">
                                      {executionDetail.details.personalized_content[selectedProspectIndex].call_script.opener}
                                    </FormattedText>
                                  </div>
                                  
                                  {executionDetail.details.personalized_content[selectedProspectIndex].call_script.objections &&
                                    executionDetail.details.personalized_content[selectedProspectIndex].call_script.objections.length > 0 && (
                                      <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">
                                          Objection Handling
                                        </p>
                                        <div className="space-y-2">
                                          {executionDetail.details.personalized_content[selectedProspectIndex].call_script.objections.map((obj, idx) => (
                                            <div key={idx} className="bg-muted/50 rounded-lg p-3 border border-border">
                                              <FormattedText className="text-sm text-foreground">
                                                {obj}
                                              </FormattedText>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                  {executionDetail.details.personalized_content[selectedProspectIndex].call_script.close && (
                                    <div>
                                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Close</p>
                                      <FormattedText className="text-foreground whitespace-pre-wrap leading-relaxed">
                                        {executionDetail.details.personalized_content[selectedProspectIndex].call_script.close}
                                      </FormattedText>
                                    </div>
                                  )}
                                </div>
                              </ContentBlock>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Legacy Content Display */}
                        {executionDetail.details.content.linkedin_message && (
                          <ContentBlock
                            icon={<MessageSquare className="w-4 h-4" />}
                            title="LinkedIn Message"
                            iconColor="bg-blue-500"
                          >
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                              {executionDetail.details.content.linkedin_message}
                            </p>
                          </ContentBlock>
                        )}

                        {executionDetail.details.content.email.subject && (
                          <ContentBlock
                            icon={<Mail className="w-4 h-4" />}
                            title="Email"
                            iconColor="bg-green-500"
                          >
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Subject</p>
                                <p className="text-foreground font-medium">
                                  {executionDetail.details.content.email.subject}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Body</p>
                                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                                  {executionDetail.details.content.email.body}
                                </p>
                              </div>
                            </div>
                          </ContentBlock>
                        )}

                        {executionDetail.details.content.call_script.opener && (
                          <ContentBlock
                            icon={<Phone className="w-4 h-4" />}
                            title="Call Script"
                            iconColor="bg-purple-500"
                          >
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Opener</p>
                                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                                  {executionDetail.details.content.call_script.opener}
                                </p>
                              </div>
                              
                              {executionDetail.details.content.call_script.objections &&
                                executionDetail.details.content.call_script.objections.length > 0 && (
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">
                                      Objection Handling
                                    </p>
                                    <div className="space-y-2">
                                      {executionDetail.details.content.call_script.objections.map((obj, idx) => (
                                        <div key={idx} className="bg-muted/50 rounded-lg p-3 border border-border">
                                          <p className="text-sm font-medium text-foreground mb-1">
                                            Objection: {obj.objection}
                                          </p>
                                          <p className="text-sm text-muted-foreground">Response: {obj.response}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                              {executionDetail.details.content.call_script.close && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Close</p>
                                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                                    {executionDetail.details.content.call_script.close}
                                  </p>
                                </div>
                              )}
                            </div>
                          </ContentBlock>
                        )}
                      </>
                    )}

                    {/* Product Info */}
                    {executionDetail.details.product.name && (
                      <ContentBlock
                        icon={<Package className="w-4 h-4" />}
                        title="Product Information"
                        iconColor="bg-orange-500"
                      >
                        <div>
                          <p className="font-semibold text-foreground mb-2">
                            {executionDetail.details.product.name}
                          </p>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {executionDetail.details.product.value_proposition}
                          </p>
                        </div>
                      </ContentBlock>
                    )}
                  </div>
                </Section>
              </>
            )}

            {/* Timestamp */}
            <div className="card-glass rounded-xl p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                Executed on {new Date(
                  executionDetail.details?.created_at || executionDetail.classification.created_at
                ).toLocaleString('en-US', { 
                  dateStyle: 'long', 
                  timeStyle: 'short' 
                })}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Helper Components
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, icon, expanded, onToggle, children }: SectionProps) {
  return (
    <motion.div 
      layout
      className="card-glass rounded-xl overflow-hidden border border-border"
    >
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-primary-foreground">
            {icon}
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>
      {expanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-5 bg-card"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}

interface InfoItemProps {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}

function InfoItem({ label, value, fullWidth = false }: InfoItemProps) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">{label}</p>
      <p className="text-foreground leading-relaxed">{value || 'N/A'}</p>
    </div>
  );
}

interface ContentBlockProps {
  icon: React.ReactNode;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}

function ContentBlock({ icon, title, iconColor, children }: ContentBlockProps) {
  return (
    <div>
      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className={`w-6 h-6 rounded-full ${iconColor} text-white flex items-center justify-center`}>
          {icon}
        </span>
        {title}
      </h4>
      <div className="bg-muted/30 rounded-xl p-4 border border-border">
        {children}
      </div>
    </div>
  );
}
