import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, ChevronDown, ChevronRight, Calendar,
  Target, MessageSquare, Mail, Phone, Package, AlertCircle,
  Edit2, Sparkles, Save, X, Send, Users, CheckCircle, Zap, Globe, Download
} from 'lucide-react';
import { ApiClient, ExecutionDetail, PersonalizedContent } from '../lib/api';
import { FormattedText } from '../lib/formatters';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';

/* ─── InfoItem ───────────────────────────────────────────── */
function InfoItem({ label, value, fullWidth = false }: { label: string; value?: string | null; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2 md:col-span-3' : ''}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800 leading-relaxed">{value || <span className="text-slate-400 italic">N/A</span>}</p>
    </div>
  );
}

/* ─── Section ────────────────────────────────────────────── */
function Section({
  step, title, icon, badge, expanded, onToggle, children,
}: {
  step: string; title: string; icon: React.ReactNode; badge?: React.ReactNode;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all duration-200 ${expanded ? 'border-slate-200 shadow-sm' : 'border-slate-100'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
            {step}
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            {icon}
            {title}
          </div>
          {badge}
        </div>
        <div className="text-slate-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-slate-50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── ContentBlock ───────────────────────────────────────── */
function ContentBlock({
  icon, title, iconBg, children, onEdit, isEditing, onSave, onCancel, isSaving,
}: {
  icon: React.ReactNode; title: string; iconBg: string; children: React.ReactNode;
  onEdit?: () => void; isEditing?: boolean; onSave?: () => void; onCancel?: () => void; isSaving?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center text-white`}>{icon}</div>
          <span className="text-sm font-bold text-slate-800">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button onClick={onCancel} disabled={isSaving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
                <X size={11} /> Cancel
              </button>
              <button onClick={onSave} disabled={isSaving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50">
                {isSaving ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : <><Save size={11} /> Save</>}
              </button>
            </>
          ) : onEdit && (
            <button onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Edit2 size={11} /> Edit
            </button>
          )}
        </div>
      </div>
      <div className="p-4 text-sm text-slate-700 bg-white">{children}</div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();

  const [executionDetail, setExecutionDetail] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    classification: true, strategy: true, icpMatching: true,
    prospects: false, platformDecision: true, content: true,
  });
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);
  const [activeContentTab, setActiveContentTab] = useState<'linkedin' | 'email' | 'call'>('email');

  // Edit state
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Partial<PersonalizedContent>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Regenerate state
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Email send state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [emailToSend, setEmailToSend] = useState<{ subject: string; prospectId: string } | null>(null);

  // LinkedIn report download state
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  useEffect(() => { if (id) fetchDetails(); }, [id]);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try { setExecutionDetail(await ApiClient.getExecutionDetails(id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  };

  const toggle = (s: string) => setExpanded((p) => ({ ...p, [s]: !p[s] }));

  const startEditing = (type: string) => {
    if (!executionDetail?.details.personalized_content) return;
    setEditedContent(executionDetail.details.personalized_content[selectedProspectIndex]);
    setIsEditing(type);
  };

  const cancelEditing = () => { setIsEditing(null); setEditedContent({}); };

  const saveContent = async () => {
    if (!executionDetail || !id) return;
    const cur = executionDetail.details.personalized_content[selectedProspectIndex];
    if (!cur) return;
    setIsSaving(true);
    try {
      const payload: any = {};
      if (editedContent.linkedin_message !== undefined) payload.linkedin_message = editedContent.linkedin_message;
      if (editedContent.email_message) { payload.email_subject = editedContent.email_message.subject; payload.email_body = editedContent.email_message.body; }
      if (editedContent.call_script) { payload.call_script_opener = editedContent.call_script.opener; payload.call_script_objections = editedContent.call_script.objections; payload.call_script_close = editedContent.call_script.close; }
      const res = await ApiClient.updatePersonalizedContent(id, cur.prospect_id, payload);
      if (executionDetail.details.personalized_content) {
        const updated = [...executionDetail.details.personalized_content];
        updated[selectedProspectIndex] = res.updated_content;
        setExecutionDetail({ ...executionDetail, details: { ...executionDetail.details, personalized_content: updated } });
      }
      setIsEditing(null); setEditedContent({});
      toast({ title: 'Saved', description: 'Content updated successfully.' });
    } catch (e) {
      toast({ title: 'Save Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const handleDownloadLinkedInReport = async () => {
    if (!id) return;
    setIsDownloadingReport(true);
    try {
      await ApiClient.downloadLinkedInReport(id);
      toast({ title: '✅ Report Downloaded', description: 'LinkedIn outreach report saved — open it in your browser to print as PDF.' });
    } catch (e) {
      toast({ title: 'Download Failed', description: e instanceof Error ? e.message : 'Error generating report', variant: 'destructive' });
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleRegenerate = async () => {
    if (!executionDetail || !id || !regeneratePrompt.trim()) return;
    const cur = executionDetail.details.personalized_content[selectedProspectIndex];
    if (!cur) return;
    setIsRegenerating(true);
    try {
      const res = await ApiClient.regeneratePersonalizedContent(id, cur.prospect_id, regeneratePrompt);
      if (executionDetail.details.personalized_content) {
        const updated = [...executionDetail.details.personalized_content];
        updated[selectedProspectIndex] = res.updated_content;
        setExecutionDetail({ ...executionDetail, details: { ...executionDetail.details, personalized_content: updated } });
      }
      setShowRegenerateModal(false); setRegeneratePrompt('');
      toast({ title: 'Regenerated!', description: 'Content updated with AI.' });
    } catch (e) {
      toast({ title: 'Regeneration Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally { setIsRegenerating(false); }
  };

  const handleSendEmail = () => {
    if (!executionDetail) return;
    const cur = executionDetail.details.personalized_content[selectedProspectIndex];
    if (!cur) return;
    setEmailToSend({ subject: cur.email_message?.subject || 'No Subject', prospectId: cur.prospect_id });
    setShowSendEmailModal(true);
  };

  const confirmSendEmail = async () => {
    if (!executionDetail || !id || !emailToSend) return;
    setShowSendEmailModal(false); setIsSendingEmail(true);
    try {
      await ApiClient.sendEmail(id, emailToSend.prospectId);
      toast({ title: 'Email Sent! ✉️', description: 'Email delivered successfully.' });
      setEmailToSend(null);
    } catch (e) {
      toast({ title: 'Send Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally { setIsSendingEmail(false); }
  };

  if (!id) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">Invalid Campaign ID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Back + Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <button
            onClick={() => navigate('/history')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4 group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Back to History
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Campaign Details</h1>
              <p className="text-slate-500 text-sm mt-0.5">Complete AI execution report</p>
            </div>
            {executionDetail && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
                <CheckCircle size={12} /> Completed
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading campaign details…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3 mb-5">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Error loading details</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {executionDetail && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* 1. Classification */}
            <Section
              step="1" title="Input Parsing & Classification"
              icon={<Target size={14} />}
              badge={
                <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                  {Math.round(executionDetail.classification.confidence * 100)}% confidence
                </span>
              }
              expanded={expanded.classification} onToggle={() => toggle('classification')}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5 pt-2">
                <InfoItem label="Category" value={executionDetail.classification.category} />
                <InfoItem label="Confidence" value={`${(executionDetail.classification.confidence * 100).toFixed(1)}%`} />
                <InfoItem label="Time Context" value={executionDetail.classification.time_context} />
                <InfoItem label="Location" value={executionDetail.classification.location} />
                <InfoItem label="Business Behavior" value={executionDetail.classification.business_behavior} fullWidth />
                <InfoItem label="User Intent" value={executionDetail.classification.user_intent} fullWidth />
              </div>
            </Section>

            {executionDetail.details && (
              <>
                {/* 2. Strategy */}
                <Section
                  step="2" title="Strategy & Approach"
                  icon={<Zap size={14} />}
                  expanded={expanded.strategy} onToggle={() => toggle('strategy')}
                >
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    {[
                      { label: 'Tone', value: executionDetail.classification.tone, accent: 'from-indigo-500 to-violet-500' },
                      { label: 'CTA Type', value: executionDetail.classification.cta_type, accent: 'from-blue-500 to-sky-500' },
                      { label: 'Urgency', value: executionDetail.classification.urgency_level, accent: 'from-amber-500 to-orange-500' },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                        <div className={`w-8 h-1 mx-auto rounded-full bg-gradient-to-r ${item.accent} mb-2`} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="text-sm font-bold text-slate-800 capitalize">{item.value || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* 3. ICP Matching */}
                <Section
                  step="3" title="ICP Matching"
                  icon={<Users size={14} />}
                  badge={
                    <span className="ml-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                      {executionDetail.details.prospects_count} Prospects
                    </span>
                  }
                  expanded={expanded.icpMatching} onToggle={() => toggle('icpMatching')}
                >
                  <div className="pt-2 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                      <InfoItem label="Sender Name" value={executionDetail.details.sender_name} />
                      <InfoItem label="Target Audience" value={executionDetail.details.target_audience} />
                      <InfoItem label="Target Archetype" value={executionDetail.details.target_archetype} fullWidth />
                    </div>

                    {/* Toggle prospects */}
                    <button
                      onClick={() => toggle('prospects')}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-semibold ${expanded.prospects ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-200'
                        }`}
                    >
                      <span>{expanded.prospects ? 'Hide' : 'Show'} {executionDetail.details.prospects_count} matched prospects</span>
                      {expanded.prospects ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <AnimatePresence>
                      {expanded.prospects && executionDetail.details.prospects && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-xl border border-slate-100 overflow-hidden bg-white">
                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                              {executionDetail.details.prospects.map((p, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                                    <p className="text-xs text-slate-500">{p.job_title} · {p.company} · {p.industry}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-indigo-600">{p.priority_score.toFixed(2)}</p>
                                    <p className="text-[10px] text-slate-400">Priority</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Section>

                {/* 4. Platform Decision */}
                <Section
                  step="4" title="Platform Decision"
                  icon={<Globe size={14} />}
                  badge={
                    executionDetail.details.selected_channel && (
                      <span className="ml-2 text-xs font-semibold text-sky-600 bg-sky-50 border border-sky-100 px-2.5 py-0.5 rounded-full capitalize">
                        {executionDetail.details.selected_channel}
                      </span>
                    )
                  }
                  expanded={expanded.platformDecision} onToggle={() => toggle('platformDecision')}
                >
                  <div className="pt-2 space-y-4">
                    <InfoItem label="Selected Channel" value={executionDetail.details.selected_channel} />
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reasoning</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{executionDetail.details.channel_reasoning}</p>
                    </div>
                  </div>
                </Section>

                {/* 5. Generated Content */}
                <Section
                  step="5" title="Generated Content"
                  icon={<Mail size={14} />}
                  badge={
                    executionDetail.details.personalized_content?.length > 0 && (
                      <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                        {executionDetail.details.personalized_content.length} personalized
                      </span>
                    )
                  }
                  expanded={expanded.content} onToggle={() => toggle('content')}
                >
                  <div className="pt-2 space-y-5">
                    {executionDetail.details.personalized_content?.length > 0 ? (
                      <>
                        {/* Prospect selector + actions */}
                        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <span className="text-sm font-semibold text-slate-700 shrink-0">View for:</span>
                          <select
                            value={selectedProspectIndex}
                            onChange={(e) => setSelectedProspectIndex(Number(e.target.value))}
                            className="flex-1 px-3 py-2 text-sm bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800"
                          >
                            {executionDetail.details.personalized_content.map((pc, idx) => (
                              <option key={pc.prospect_id} value={idx}>
                                {pc.prospect_name} — {pc.prospect_job_title} @ {pc.prospect_company}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-slate-500 shrink-0">
                            {selectedProspectIndex + 1} / {executionDetail.details.personalized_content.length}
                          </span>
                        </div>

                        {/* Action buttons */}
                        {userRole !== 'viewer' && !isEditing && (
                          <div className="flex gap-2 justify-end flex-wrap">
                            {/* Download LinkedIn Report button — always visible when LinkedIn content exists */}
                            {executionDetail.details.personalized_content.some(pc => pc.linkedin_message) && (
                              <button
                                onClick={handleDownloadLinkedInReport}
                                disabled={isDownloadingReport}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                                title="Download LinkedIn messages for all prospects as an HTML report (printable as PDF)"
                              >
                                {isDownloadingReport
                                  ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                                  : <><Download size={14} /> LinkedIn Report</>
                                }
                              </button>
                            )}
                            <button
                              onClick={handleSendEmail}
                              disabled={isSendingEmail || !executionDetail.details.personalized_content[selectedProspectIndex]?.email_message}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                            >
                              {isSendingEmail ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Email</>}
                            </button>
                            <button
                              onClick={() => setShowRegenerateModal(true)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                            >
                              <Sparkles size={14} /> Regenerate with AI
                            </button>
                          </div>
                        )}

                        {/* Content tabs */}
                        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                          {(['email', 'linkedin', 'call'] as const).map((tab) => (
                            <button key={tab} onClick={() => setActiveContentTab(tab)}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeContentTab === tab ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                }`}>
                              {tab === 'email' ? '📧 Email' : tab === 'linkedin' ? '💼 LinkedIn' : '📞 Call Script'}
                            </button>
                          ))}
                        </div>

                        {/* Content display */}
                        {executionDetail.details.personalized_content[selectedProspectIndex] && (() => {
                          const pc = executionDetail.details.personalized_content[selectedProspectIndex];
                          if (activeContentTab === 'linkedin' && pc.linkedin_message) {
                            return (
                              <ContentBlock icon={<MessageSquare size={13} />} title="LinkedIn Message" iconBg="bg-blue-600"
                                onEdit={userRole !== 'viewer' ? () => startEditing('linkedin') : undefined}
                                isEditing={isEditing === 'linkedin'} onSave={saveContent} onCancel={cancelEditing} isSaving={isSaving}>
                                {isEditing === 'linkedin' ? (
                                  <textarea
                                    value={editedContent.linkedin_message || ''}
                                    onChange={(e) => setEditedContent({ ...editedContent, linkedin_message: e.target.value })}
                                    className="w-full min-h-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-900 resize-none"
                                  />
                                ) : (
                                  <FormattedText className="whitespace-pre-wrap leading-relaxed text-slate-700">
                                    {pc.linkedin_message}
                                  </FormattedText>
                                )}
                              </ContentBlock>
                            );
                          }
                          if (activeContentTab === 'email' && pc.email_message) {
                            return (
                              <ContentBlock icon={<Mail size={13} />} title="Email" iconBg="bg-emerald-600"
                                onEdit={userRole !== 'viewer' ? () => startEditing('email') : undefined}
                                isEditing={isEditing === 'email'} onSave={saveContent} onCancel={cancelEditing} isSaving={isSaving}>
                                {isEditing === 'email' ? (
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</p>
                                      <input type="text" value={editedContent.email_message?.subject || ''}
                                        onChange={(e) => setEditedContent({ ...editedContent, email_message: { ...editedContent.email_message!, subject: e.target.value, body: editedContent.email_message?.body || '' } })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-slate-900" />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Body</p>
                                      <textarea value={editedContent.email_message?.body || ''}
                                        onChange={(e) => setEditedContent({ ...editedContent, email_message: { subject: editedContent.email_message?.subject || '', body: e.target.value } })}
                                        className="w-full min-h-[300px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-slate-900 resize-none" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</p>
                                      <p className="font-semibold text-slate-800">{pc.email_message.subject}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Body</p>
                                      <FormattedText className="whitespace-pre-wrap leading-relaxed text-slate-700">{pc.email_message.body}</FormattedText>
                                    </div>
                                  </div>
                                )}
                              </ContentBlock>
                            );
                          }
                          if (activeContentTab === 'call' && pc.call_script) {
                            return (
                              <ContentBlock icon={<Phone size={13} />} title="Call Script" iconBg="bg-violet-600"
                                onEdit={userRole !== 'viewer' ? () => startEditing('call_script') : undefined}
                                isEditing={isEditing === 'call_script'} onSave={saveContent} onCancel={cancelEditing} isSaving={isSaving}>
                                {isEditing === 'call_script' ? (
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Opener</p>
                                      <textarea value={editedContent.call_script?.opener || ''} rows={3}
                                        onChange={(e) => setEditedContent({ ...editedContent, call_script: { opener: e.target.value, objections: editedContent.call_script?.objections || [], close: editedContent.call_script?.close || '' } })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-slate-900 resize-none" />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Close</p>
                                      <textarea value={editedContent.call_script?.close || ''} rows={3}
                                        onChange={(e) => setEditedContent({ ...editedContent, call_script: { opener: editedContent.call_script?.opener || '', objections: editedContent.call_script?.objections || [], close: e.target.value } })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-slate-900 resize-none" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">🎙️ Opener</p>
                                      <FormattedText className="whitespace-pre-wrap leading-relaxed text-slate-700">{pc.call_script.opener}</FormattedText>
                                    </div>
                                    {pc.call_script.objections?.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">🛡️ Objection Handling</p>
                                        <div className="space-y-2">
                                          {pc.call_script.objections.map((obj, i) => (
                                            <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                              <FormattedText className="text-sm text-slate-700">{obj}</FormattedText>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {pc.call_script.close && (
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">✅ Close</p>
                                        <FormattedText className="whitespace-pre-wrap leading-relaxed text-slate-700">{pc.call_script.close}</FormattedText>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </ContentBlock>
                            );
                          }
                          return <p className="text-slate-400 text-sm italic text-center py-4">No {activeContentTab} content available for this prospect.</p>;
                        })()}

                        {/* Product info */}
                        {executionDetail.details.product?.name && (
                          <ContentBlock icon={<Package size={13} />} title="Product Information" iconBg="bg-orange-500">
                            <p className="font-semibold text-slate-800 mb-2">{executionDetail.details.product.name}</p>
                            <p className="text-slate-600 text-sm leading-relaxed">{executionDetail.details.product.value_proposition}</p>
                          </ContentBlock>
                        )}
                      </>
                    ) : (
                      /* Legacy content */
                      <div className="space-y-4">
                        {executionDetail.details.content?.linkedin_message && (
                          <ContentBlock icon={<MessageSquare size={13} />} title="LinkedIn Message" iconBg="bg-blue-600">
                            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{executionDetail.details.content.linkedin_message}</p>
                          </ContentBlock>
                        )}
                        {executionDetail.details.content?.email?.subject && (
                          <ContentBlock icon={<Mail size={13} />} title="Email" iconBg="bg-emerald-600">
                            <div className="space-y-3">
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</p><p className="font-semibold text-slate-800">{executionDetail.details.content.email.subject}</p></div>
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Body</p><p className="whitespace-pre-wrap leading-relaxed text-slate-700">{executionDetail.details.content.email.body}</p></div>
                            </div>
                          </ContentBlock>
                        )}
                        {executionDetail.details.product?.name && (
                          <ContentBlock icon={<Package size={13} />} title="Product Information" iconBg="bg-orange-500">
                            <p className="font-semibold text-slate-800 mb-2">{executionDetail.details.product.name}</p>
                            <p className="text-slate-600 text-sm leading-relaxed">{executionDetail.details.product.value_proposition}</p>
                          </ContentBlock>
                        )}
                      </div>
                    )}
                  </div>
                </Section>
              </>
            )}

            {/* Timestamp footer */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-white rounded-xl border border-slate-100 px-5 py-3">
              <Calendar size={13} />
              Executed on {new Date(executionDetail.details?.created_at || executionDetail.classification.created_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── AI Regenerate Modal ── */}
      <AnimatePresence>
        {showRegenerateModal && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Regenerate with AI</h3>
                </div>
                <button onClick={() => { setShowRegenerateModal(false); setRegeneratePrompt(''); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Provide custom instructions to modify the content using AI. The existing content will be sent as context.
              </p>
              <textarea
                value={regeneratePrompt}
                onChange={(e) => setRegeneratePrompt(e.target.value)}
                placeholder="E.g., Make it more casual and friendly, emphasize ROI, mention their recent product launch…"
                className="w-full min-h-[140px] px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-900 resize-none"
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowRegenerateModal(false); setRegeneratePrompt(''); }} disabled={isRegenerating}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleRegenerate} disabled={!regeneratePrompt.trim() || isRegenerating}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {isRegenerating ? <><Loader2 size={14} className="animate-spin" /> Regenerating…</> : <><Sparkles size={14} /> Regenerate</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Send Email Modal ── */}
      <AnimatePresence>
        {showSendEmailModal && emailToSend && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                    <Send size={18} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Send Email</h3>
                </div>
                <button onClick={() => { setShowSendEmailModal(false); setEmailToSend(null); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</p>
                <p className="text-sm font-semibold text-slate-800">{emailToSend.subject}</p>
              </div>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to send this email? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowSendEmailModal(false); setEmailToSend(null); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={confirmSendEmail}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-2">
                  <Send size={14} /> Send Email
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
