import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle, Circle, Loader2, Copy, Check,
  ChevronDown, ChevronUp, Sparkles, ArrowRight,
  Bot, Cpu, Target, Filter, Activity, Zap, Send,
  LayoutGrid, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StageData, Prospect, CampaignResult } from '../types/campaign';
import { ApiClient, SSEEvent } from '../lib/api';
import confetti from 'canvas-confetti';
import { useToast } from './ui/use-toast';
import { FormattedText } from '../lib/formatters';

/* ─── Types ─────────────────────────────────────────────── */
type Stage = 'input_parser' | 'classifier' | 'strategy' | 'icp_matcher' | 'platform' | 'content_generator' | 'complete';

const STAGES: { id: Stage; label: string; icon: any; color: string; duration: number }[] = [
  { id: 'input_parser', label: 'Input Parser', icon: Bot, color: 'bg-indigo-500', duration: 2200 },
  { id: 'classifier', label: 'Classifier', icon: Cpu, color: 'bg-violet-500', duration: 1800 },
  { id: 'strategy', label: 'Strategy', icon: Target, color: 'bg-blue-500', duration: 2000 },
  { id: 'icp_matcher', label: 'ICP Matcher', icon: Filter, color: 'bg-sky-500', duration: 2500 },
  { id: 'platform', label: 'Platform Decision', icon: Activity, color: 'bg-cyan-500', duration: 1600 },
  { id: 'content_generator', label: 'Content Generator', icon: Zap, color: 'bg-emerald-500', duration: 3000 },
  { id: 'complete', label: 'Complete', icon: Send, color: 'bg-green-500', duration: 0 },
];

const STAGE_INDEX: Record<Stage, number> = {
  input_parser: 0, classifier: 1, strategy: 2, icp_matcher: 3, platform: 4, content_generator: 5, complete: 6,
};

/* ─── Props ─────────────────────────────────────────────── */
interface ExecutionModalProps {
  open: boolean;
  prompt: string;
  onClose: () => void;
  onComplete: (result: CampaignResult) => void;
}

/* ─── CopyButton ─────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ description: 'Copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ─── ProgressBar ────────────────────────────────────────── */
function ProgressBar({ active }: { active: boolean }) {
  return (
    <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-3">
      {active && (
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

/* ─── StageContent ───────────────────────────────────────── */
function StageContent({
  stage, status, stageData, onApprove, onCancel, prospects, setProspects,
}: {
  stage: typeof STAGES[0]; status: 'pending' | 'active' | 'done' | 'approval';
  stageData: StageData; onApprove: () => void; onCancel: () => void;
  prospects: Prospect[]; setProspects: (p: Prospect[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<'linkedin' | 'email' | 'call'>('linkedin');
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const isDone = status === 'done';
  const isActive = status === 'active';
  const isApproval = status === 'approval';

  const selectedCount = prospects.filter((p) => p.selected).length;
  const allSelected = prospects.every((p) => p.selected);

  const toggleAll = () => setProspects(prospects.map((p) => ({ ...p, selected: !allSelected })));
  const toggleProspect = (id: string) => setProspects(prospects.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  const selectTopN = (n: number) => setProspects(prospects.map((p, i) => ({ ...p, selected: i < n })));
  const clearAll = () => setProspects(prospects.map((p) => ({ ...p, selected: false })));

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isDone ? 'border-emerald-200 bg-emerald-50/40' :
      isApproval ? 'border-amber-300 bg-amber-50/60' :
        isActive ? 'border-indigo-200 bg-indigo-50/50' :
          'border-slate-100 bg-slate-50/60'
      }`}>
      {/* Stage header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => isDone && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {isDone ? (
            <motion.div animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.4 }}>
              <CheckCircle size={20} className="text-emerald-500" />
            </motion.div>
          ) : isActive || isApproval ? (
            <Loader2 size={20} className="text-indigo-500 animate-spin" />
          ) : (
            <Circle size={20} className="text-slate-300" />
          )}
          <span className={`text-sm font-bold ${isDone ? 'text-emerald-700' : isActive || isApproval ? 'text-indigo-700' : 'text-slate-400'
            }`}>
            {stage.emoji} {stage.label}
          </span>
          {isApproval && (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
              <AlertTriangle size={10} /> Human Approval Required
            </span>
          )}
        </div>
        {isDone && (
          <div className="text-slate-400">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {/* Stage body */}
      <AnimatePresence>
        {(isActive || isApproval || (isDone && expanded)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">

              {/* Input Parser */}
              {stage.id === 'input_parser' && stageData.inputParser && (
                <div className="space-y-2">
                  {isActive && <p className="text-sm text-slate-500 italic">Analyzing your campaign description…</p>}
                  <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
                    {Object.entries(stageData.inputParser).map(([k, v], i) => (
                      <motion.div key={k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                        className="flex gap-2 text-sm">
                        <span className="text-emerald-500 font-bold shrink-0">✓</span>
                        <span className="text-slate-400 capitalize min-w-[80px]">{k.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="text-slate-800 font-medium">{v as string}</span>
                      </motion.div>
                    ))}
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {/* Classifier */}
              {stage.id === 'classifier' && stageData.classifier && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-slate-500 italic">Classifying campaign type…</p>}
                  <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Category:</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-0.5 rounded-full text-sm">
                        {stageData.classifier.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500 shrink-0">Confidence:</span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${stageData.classifier.confidence}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                        />
                      </div>
                      <span className="font-bold text-emerald-600 text-sm">{stageData.classifier.confidence}%</span>
                    </div>
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {/* Strategy */}
              {stage.id === 'strategy' && stageData.strategy && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-slate-500 italic">Designing communication strategy…</p>}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Tone', value: stageData.strategy.tone },
                      { label: 'CTA', value: stageData.strategy.cta },
                      { label: 'Urgency', value: stageData.strategy.urgency },
                    ].map((item, i) => (
                      <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12 }}
                        className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm">
                        <p className="text-xs text-slate-400 mb-1 font-medium">{item.label}</p>
                        <p className="text-sm font-bold text-slate-800 capitalize">{item.value}</p>
                      </motion.div>
                    ))}
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {/* ICP Matcher */}
              {stage.id === 'icp_matcher' && prospects.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Found {prospects.length} matching prospects</p>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                      {selectedCount} selected
                    </span>
                  </div>

                  {/* Quick select */}
                  <div className="bg-white rounded-xl border border-slate-100 p-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Select</p>
                    <div className="flex flex-wrap gap-2">
                      {[5, 10, 20].map((n) => (
                        <button key={n} onClick={() => selectTopN(n)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors">
                          Top {n}
                        </button>
                      ))}
                      <button onClick={toggleAll}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors">
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      <button onClick={clearAll}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold border border-slate-200 transition-colors">
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Prospects list */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {prospects.map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => toggleProspect(p.id)}>
                          <input type="checkbox" checked={p.selected} onChange={() => toggleProspect(p.id)}
                            className="w-4 h-4 accent-indigo-600" onClick={(e) => e.stopPropagation()} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name} — {p.title}</p>
                            <p className="text-xs text-slate-400">{p.company} · {p.industry} · Score: <span className="text-emerald-600 font-bold">{p.priority}</span></p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {isApproval && (
                    <div className="flex gap-3">
                      <button onClick={onApprove}
                        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg">
                        <Check size={16} /> Approve &amp; Continue ({selectedCount} prospects)
                      </button>
                      <button onClick={onCancel}
                        className="px-5 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Platform */}
              {stage.id === 'platform' && stageData.platform && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-slate-500 italic">Analyzing best outreach channel…</p>}
                  <div className="bg-white rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{stageData.platform.icon}</span>
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{stageData.platform.selected}</p>
                        <div className="flex gap-4 mt-0.5">
                          {stageData.platform.stats.map((s) => (
                            <span key={s.label} className="text-xs text-slate-500">{s.label}: <span className="text-indigo-600 font-bold">{s.value}</span></span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                      💡 {stageData.platform.reason}
                    </p>
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {/* Content Generator */}
              {stage.id === 'content_generator' && stageData.contentGenerator && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-slate-500 italic">Generating personalized content for all prospects…</p>}

                  {stageData.contentGenerator.personalizedContent?.length > 0 ? (
                    <>
                      {/* Prospect selector */}
                      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-3">
                        <span className="text-sm font-medium text-slate-700 shrink-0">Prospect:</span>
                        <select
                          value={selectedProspectIndex}
                          onChange={(e) => setSelectedProspectIndex(Number(e.target.value))}
                          className="flex-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          {stageData.contentGenerator.personalizedContent.map((pc, idx) => (
                            <option key={pc.prospect_id} value={idx}>
                              {pc.prospect_name} — {pc.prospect_job_title} @ {pc.prospect_company}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-400 shrink-0">
                          {selectedProspectIndex + 1}/{stageData.contentGenerator.personalizedContent.length}
                        </span>
                      </div>

                      {/* Channel tabs */}
                      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        {(['linkedin', 'email', 'call'] as const).map((tab) => (
                          <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            {tab === 'linkedin' ? '💼 LinkedIn' : tab === 'email' ? '📧 Email' : '📞 Call Script'}
                          </button>
                        ))}
                      </div>

                      {/* Content display */}
                      {stageData.contentGenerator.personalizedContent[selectedProspectIndex] && (
                        <div className="relative">
                          <div className="bg-white rounded-xl border border-slate-100 p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-mono">
                            <FormattedText>
                              {activeTab === 'linkedin'
                                ? stageData.contentGenerator.personalizedContent[selectedProspectIndex].linkedin_message
                                : activeTab === 'email'
                                  ? `Subject: ${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.subject}\n\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.body}`
                                  : `Opener:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.opener}\n\nObjections:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.objections.join('\n\n')}\n\nClose:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.close}`}
                            </FormattedText>
                          </div>
                          <div className="absolute top-3 right-3">
                            <CopyButton text={
                              activeTab === 'linkedin'
                                ? stageData.contentGenerator.personalizedContent[selectedProspectIndex].linkedin_message
                                : activeTab === 'email'
                                  ? `Subject: ${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.subject}\n\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.body}`
                                  : `Opener:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.opener}\n\nObjections:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.objections.join('\n\n')}\n\nClose:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.close}`
                            } />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Legacy fallback */}
                      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        {(['linkedin', 'email', 'call'] as const).map((tab) => (
                          <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            {tab === 'linkedin' ? '💼 LinkedIn' : tab === 'email' ? '📧 Email' : '📞 Call Script'}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <div className="bg-white rounded-xl border border-slate-100 p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-mono">
                          <FormattedText>
                            {activeTab === 'linkedin' ? stageData.contentGenerator.linkedin :
                              activeTab === 'email' ? stageData.contentGenerator.email :
                                stageData.contentGenerator.callScript}
                          </FormattedText>
                        </div>
                        <div className="absolute top-3 right-3">
                          <CopyButton text={
                            activeTab === 'linkedin' ? stageData.contentGenerator.linkedin! :
                              activeTab === 'email' ? stageData.contentGenerator.email! :
                                stageData.contentGenerator.callScript!
                          } />
                        </div>
                      </div>
                    </>
                  )}
                  {isActive && <ProgressBar active />}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── ExecutionModal (Full Screen) ───────────────────────── */
export function ExecutionModal({ open, prompt, onClose, onComplete }: ExecutionModalProps) {
  const navigate = useNavigate();
  const [currentStageIdx, setCurrentStageIdx] = useState(-1);
  const [completedStages, setCompletedStages] = useState<Stage[]>([]);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [stageData, setStageData] = useState<StageData>({});
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [classificationId, setClassificationId] = useState<string | null>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setCurrentStageIdx(-1);
    setCompletedStages([]);
    setWaitingApproval(false);
    setStageData({});
    setProspects([]);
    setIsDone(false);
    setClassificationId(null);
  }, []);

  const fireConfetti = useCallback(() => {
    const fire = (r: number, opts: confetti.Options) =>
      confetti({ ...opts, origin: { y: 0.6 }, particleCount: Math.floor(200 * r) });
    fire(0.25, { spread: 26, startVelocity: 55, colors: ['#6366f1', '#8b5cf6', '#10b981'] });
    fire(0.2, { spread: 60, colors: ['#6366f1', '#a5b4fc', '#34d399'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#818cf8', '#c4b5fd'] });
    fire(0.1, { spread: 120, startVelocity: 45, colors: ['#6366f1', '#10b981'] });
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    let cleanup: (() => void) | null = null;

    const start = async () => {
      cleanup = await ApiClient.executeCampaign(
        prompt,
        (event: SSEEvent) => {
          switch (event.stage) {
            case 'input_parser':
              if (event.status === 'started') setCurrentStageIdx(0);
              else if (event.status === 'completed' && event.data) {
                setStageData((p) => ({
                  ...p, inputParser: {
                    time: event.data.time || 'current',
                    location: event.data.location || 'any',
                    business: event.data.business_behavior || prompt,
                    intent: event.data.user_intent || 'generate leads',
                    target: event.data.target_audience || 'prospects',
                  }
                }));
                setCompletedStages((p) => [...p, 'input_parser']);
              }
              break;
            case 'classifier':
              if (event.status === 'started') setCurrentStageIdx(1);
              else if (event.status === 'completed' && event.data) {
                setStageData((p) => ({
                  ...p, classifier: {
                    category: event.data.category || 'B2B Lead Generation',
                    confidence: Math.round((event.data.confidence || 0.95) * 100),
                  }
                }));
                setCompletedStages((p) => [...p, 'classifier']);
              }
              break;
            case 'strategy':
              if (event.status === 'started') setCurrentStageIdx(2);
              else if (event.status === 'completed' && event.data) {
                setStageData((p) => ({
                  ...p, strategy: {
                    tone: event.data.tone || 'Professional',
                    cta: event.data.cta_type || 'book_demo',
                    urgency: event.data.urgency_level || 'medium',
                  }
                }));
                setCompletedStages((p) => [...p, 'strategy']);
              }
              break;
            case 'icp_matcher':
              if (event.status === 'started') setCurrentStageIdx(3);
              else if (event.status === 'completed' && event.data) {
                if (event.session_id) setSessionId(event.session_id);
                const mapped = (event.data.top_prospects || []).map((p: any, i: number) => ({
                  id: p.id || `p-${i}`,
                  name: p.name || `${p.first_name} ${p.last_name}`,
                  title: p.job_title || 'Unknown',
                  company: p.company_name || 'Unknown',
                  industry: p.industry || 'Unknown',
                  priority: p.priority_score?.toFixed(2) || '0.00',
                  selected: true,
                }));
                setProspects(mapped);
                setStageData((p) => ({
                  ...p, icpMatcher: {
                    prospects: mapped,
                    archetype: event.data.target_archetype || 'B2B Decision Makers',
                  }
                }));
                setTimeout(() => setWaitingApproval(true), 500);
              }
              break;
            case 'platform_decision':
              if (event.status === 'started') setCurrentStageIdx(4);
              else if (event.status === 'completed' && event.data) {
                const icons: Record<string, string> = { linkedin: '💼', email: '📧', call: '📞' };
                setStageData((p) => ({
                  ...p, platform: {
                    selected: event.data.selected_channel || 'LinkedIn',
                    icon: icons[event.data.selected_channel?.toLowerCase()] || '💼',
                    reason: event.data.channel_reasoning || 'Best channel for your audience',
                    stats: [{ label: 'Open Rate', value: '42%' }, { label: 'Reply Rate', value: '12%' }],
                  }
                }));
                setCompletedStages((p) => [...p, 'platform']);
              }
              break;
            case 'content_generator':
              if (event.status === 'started') setCurrentStageIdx(5);
              else if (event.status === 'completed' && event.data) {
                setStageData((p) => ({
                  ...p, contentGenerator: {
                    linkedin: event.data.linkedin_message || '',
                    email: event.data.email_message
                      ? `Subject: ${event.data.email_message.subject}\n\n${event.data.email_message.body}` : '',
                    callScript: event.data.call_script
                      ? `Opener:\n${event.data.call_script.opener}\n\nObjections:\n${event.data.call_script.objections?.join('\n\n')}\n\nClose:\n${event.data.call_script.close}` : '',
                    personalizedContent: event.data.personalized_content || [],
                  }
                }));
                setCompletedStages((p) => [...p, 'content_generator']);
              }
              break;
            case 'complete':
              setCurrentStageIdx(6);
              setIsDone(true);
              if (event.classification_id) setClassificationId(event.classification_id);
              fireConfetti();
              break;
            case 'error':
              toast({ variant: 'destructive', description: `Error: ${event.status}` });
              break;
          }
        },
        (error: Error) => toast({ variant: 'destructive', description: `Failed to connect: ${error.message}` }),
        () => { }
      );
    };

    start();
    return () => { if (cleanup) cleanup(); };
  }, [open, prompt, reset, fireConfetti, toast]);

  const handleApprove = useCallback(async () => {
    if (!sessionId) { toast({ variant: 'destructive', description: 'No session ID' }); return; }
    const selectedIds = prospects.filter((p) => p.selected).map((p) => p.id);
    try {
      await ApiClient.approveCampaign(sessionId, true, selectedIds);
      setWaitingApproval(false);
      setCompletedStages((p) => [...p, 'icp_matcher']);
    } catch {
      toast({ variant: 'destructive', description: 'Failed to approve' });
    }
  }, [sessionId, prospects, toast]);

  const handleCancel = () => { reset(); onClose(); };
  const handleClose = () => { reset(); onClose(); };

  const getStatus = (s: typeof STAGES[0], i: number): 'pending' | 'active' | 'done' | 'approval' => {
    if (completedStages.includes(s.id as Stage)) return 'done';
    if (waitingApproval && s.id === 'icp_matcher') return 'approval';
    if (currentStageIdx === i && !completedStages.includes(s.id as Stage)) return 'active';
    return 'pending';
  };

  const selectedCount = prospects.filter((p) => p.selected).length;
  const overallPct = Math.round(
    ((completedStages.length + (isDone ? 1 : 0)) / (STAGES.length - 1)) * 100
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ── LEFT SIDEBAR (dark) ── */}
        <motion.div
          className="w-72 flex-shrink-0 bg-slate-900 flex flex-col"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          {/* Logo + title */}
          <div className="px-6 py-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="font-bold text-white text-sm">AI Campaign Execution</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
              "{prompt.substring(0, 80)}{prompt.length > 80 ? '…' : ''}"
            </p>
          </div>

          {/* Overall progress */}
          <div className="px-6 py-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Progress</span>
              <span className={`text-xs font-bold ${isDone ? 'text-emerald-400' : 'text-indigo-400'}`}>{overallPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
                animate={{ width: `${overallPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Agent steps */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {STAGES.slice(0, -1).map((stage, i) => {
              const status = getStatus(stage, i);
              const Icon = stage.icon;
              return (
                <div key={stage.id} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${status === 'active' || status === 'approval' ? 'bg-indigo-600/20 border border-indigo-500/30' :
                  status === 'done' ? 'bg-emerald-500/10' : 'opacity-40'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${status === 'done' ? 'bg-emerald-500' :
                    status === 'active' || status === 'approval' ? stage.color : 'bg-slate-700'
                    }`}>
                    {status === 'done' ? (
                      <CheckCircle size={16} className="text-white" />
                    ) : status === 'active' || status === 'approval' ? (
                      <Loader2 size={16} className="text-white animate-spin" />
                    ) : (
                      <Icon size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${status === 'done' ? 'text-emerald-400' :
                      status === 'active' || status === 'approval' ? 'text-white' : 'text-slate-500'
                      }`}>
                      {stage.label}
                    </p>
                    {status === 'approval' && (
                      <p className="text-[10px] text-amber-400 font-medium">Awaiting approval</p>
                    )}
                    {status === 'active' && (
                      <p className="text-[10px] text-indigo-400 font-medium">Running…</p>
                    )}
                    {status === 'done' && (
                      <p className="text-[10px] text-emerald-500 font-medium">Complete</p>
                    )}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Exit button */}
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={handleClose}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800 transition-all text-sm font-semibold"
            >
              <X size={15} /> Exit Execution
            </button>
          </div>
        </motion.div>

        {/* ── RIGHT CONTENT PANEL ── */}
        <motion.div
          className="flex-1 bg-slate-50 flex flex-col overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* Top bar */}
          <div className="h-16 px-8 flex items-center justify-between bg-white border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {STAGES.slice(0, -1).map((s, i) => {
                  const st = getStatus(s, i);
                  return (
                    <div key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${st === 'done' ? 'bg-emerald-500 w-6' :
                      st === 'active' || st === 'approval' ? 'bg-indigo-500 w-6' : 'bg-slate-200 w-4'
                      }`} />
                  );
                })}
              </div>
              <span className="text-xs text-slate-400 font-medium ml-1">
                {isDone ? 'Campaign Complete!' : waitingApproval ? 'Awaiting your approval…' : `Agent ${currentStageIdx + 1} of 6 running…`}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all text-sm font-medium"
            >
              <X size={15} /> Close
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {STAGES.slice(0, -1).map((stage, idx) => {
                const status = getStatus(stage, idx);
                if (status === 'pending' && currentStageIdx < idx) return null;
                return (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StageContent
                      stage={stage}
                      status={status}
                      stageData={stageData}
                      onApprove={handleApprove}
                      onCancel={handleCancel}
                      prospects={prospects}
                      setProspects={setProspects}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Success state */}
            <AnimatePresence>
              {isDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                  className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2, damping: 14 }}
                    className="text-6xl mb-4"
                  >🎉</motion.div>
                  <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Campaign Ready!</h3>
                  <p className="text-slate-500 text-sm mb-6">Your AI-powered campaign has been created successfully</p>

                  <div className="flex flex-wrap justify-center gap-4 mb-8">
                    {[
                      `${selectedCount} prospects targeted`,
                      `${stageData.contentGenerator?.personalizedContent?.length || selectedCount} personalized messages`,
                      `${stageData.platform?.selected ?? 'Email'} ready`,
                    ].map((label, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-2 text-sm text-emerald-700 font-semibold bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-full">
                        <CheckCircle size={14} /> {label}
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-4 justify-center">
                    <button onClick={handleClose}
                      className="px-6 py-3 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">
                      Start New Campaign
                    </button>
                    <button
                      onClick={() => { if (classificationId) { handleClose(); navigate(`/history/${classificationId}`); } }}
                      disabled={!classificationId}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      View Campaign <ArrowRight size={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
