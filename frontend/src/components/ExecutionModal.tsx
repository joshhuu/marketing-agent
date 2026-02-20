import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Circle, Loader2, Copy, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StageData, Prospect, CampaignResult } from '../types/campaign';
import { ApiClient, SSEEvent } from '../lib/api';
import confetti from 'canvas-confetti';
import { useToast } from './ui/use-toast';
import { FormattedText } from '../lib/formatters';

type Stage = 'input_parser' | 'classifier' | 'strategy' | 'icp_matcher' | 'platform' | 'content_generator' | 'complete';

const STAGES: { id: Stage; label: string; icon: string; duration: number }[] = [
  { id: 'input_parser', label: 'Input Parser', icon: '🔍', duration: 2200 },
  { id: 'classifier', label: 'Classifier', icon: '🏷️', duration: 1800 },
  { id: 'strategy', label: 'Strategy', icon: '🎯', duration: 2000 },
  { id: 'icp_matcher', label: 'ICP Matcher', icon: '👥', duration: 2500 },
  { id: 'platform', label: 'Platform', icon: '📡', duration: 1600 },
  { id: 'content_generator', label: 'Content', icon: '✍️', duration: 3000 },
  { id: 'complete', label: 'Complete', icon: '🎉', duration: 0 },
];

const STAGE_INDEX: Record<Stage, number> = {
  input_parser: 0, classifier: 1, strategy: 2, icp_matcher: 3, platform: 4, content_generator: 5, complete: 6,
};

interface ExecutionModalProps {
  open: boolean;
  prompt: string;
  onClose: () => void;
  onComplete: (result: CampaignResult) => void;
}

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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ProgressBar({ active }: { active: boolean }) {
  return (
    <div className="h-1 bg-muted rounded-full overflow-hidden mt-3">
      {active && (
        <motion.div
          className="h-full bg-gradient-primary rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

interface StageItemProps {
  stage: typeof STAGES[0];
  status: 'pending' | 'active' | 'done' | 'approval';
  stageData: StageData;
  onApprove: () => void;
  onCancel: () => void;
  prospects: Prospect[];
  setProspects: (p: Prospect[]) => void;
}

function StageItem({ stage, status, stageData, onApprove, onCancel, prospects, setProspects }: StageItemProps) {
  const [activeTab, setActiveTab] = useState<'linkedin' | 'email' | 'call'>('linkedin');
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const isDone = status === 'done';
  const isActive = status === 'active';
  const isApproval = status === 'approval';

  const borderClass = isDone
    ? 'border-l-success bg-success/5'
    : isActive || isApproval
    ? 'border-l-primary bg-accent/30'
    : 'border-l-border bg-muted/30';

  const selectedCount = prospects.filter(p => p.selected).length;
  const allSelected = prospects.every(p => p.selected);

  const toggleAll = () => {
    setProspects(prospects.map(p => ({ ...p, selected: !allSelected })));
  };

  const toggleProspect = (id: string) => {
    setProspects(prospects.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const selectTopN = (n: number) => {
    setProspects(prospects.map((p, i) => ({ ...p, selected: i < n })));
  };

  const clearAll = () => {
    setProspects(prospects.map(p => ({ ...p, selected: false })));
  };

  return (
    <motion.div
      layout
      className={`rounded-xl border-l-[3px] border border-border/50 p-4 transition-all duration-300 ${borderClass}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDone ? (
            <motion.div animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.4 }}>
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
            </motion.div>
          ) : isActive || isApproval ? (
            <div className="w-5 h-5 flex-shrink-0">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
          <span className={`text-sm font-semibold ${isDone ? 'text-success' : isActive || isApproval ? 'text-primary' : 'text-muted-foreground'}`}>
            {stage.icon} {stage.label}
          </span>
          {isApproval && (
            <span className="text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full font-medium">Approval Required</span>
          )}
        </div>
        {isDone && (
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {(isActive || isApproval || (isDone && expanded)) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              {stage.id === 'input_parser' && stageData.inputParser && (
                <div className="space-y-2">
                  {isActive && <p className="text-sm text-muted-foreground mb-3 italic">Analyzing your campaign description...</p>}
                  <div className="space-y-1.5">
                    {Object.entries(stageData.inputParser).map(([key, val], i) => (
                      <motion.div key={key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
                        className="flex gap-2 items-start font-mono text-sm">
                        <span className="text-success font-bold flex-shrink-0">✓</span>
                        <span className="text-muted-foreground capitalize min-w-16">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="text-foreground font-medium">{val}</span>
                      </motion.div>
                    ))}
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {stage.id === 'classifier' && stageData.classifier && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-muted-foreground italic">Classifying campaign type...</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Category:</span>
                    <span className="font-semibold text-primary bg-accent px-2.5 py-0.5 rounded-full text-sm">{stageData.classifier.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground flex-shrink-0">Confidence:</span>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${stageData.classifier.confidence}%` }} transition={{ duration: 1, delay: 0.3 }} />
                      </div>
                      <span className="font-bold text-success text-sm">{stageData.classifier.confidence}%</span>
                    </div>
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {stage.id === 'strategy' && stageData.strategy && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-muted-foreground italic">Designing communication strategy...</p>}
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[
                      { label: 'Tone', value: stageData.strategy.tone },
                      { label: 'CTA', value: stageData.strategy.cta },
                      { label: 'Urgency', value: stageData.strategy.urgency },
                    ].map((item, i) => (
                      <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.15 }}
                        className="bg-card rounded-lg p-3 border border-border/60 text-center">
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className="text-xs font-semibold text-foreground">{item.value}</p>
                      </motion.div>
                    ))}
                  </div>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {stage.id === 'icp_matcher' && prospects.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Found {prospects.length} matching prospects</p>
                    <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
                  </div>

                  {/* Quick Selection Buttons */}
                  <div className="bg-accent/50 rounded-lg p-3 border border-border/60">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Quick Select:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => selectTopN(5)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-semibold transition-colors border border-primary/30"
                      >
                        Top 5
                      </button>
                      <button
                        onClick={() => selectTopN(10)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-semibold transition-colors border border-primary/30"
                      >
                        Top 10
                      </button>
                      <button
                        onClick={() => selectTopN(20)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-semibold transition-colors border border-primary/30"
                      >
                        Top 20
                      </button>
                      <button
                        onClick={toggleAll}
                        className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-md text-xs font-semibold transition-colors border border-border"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        onClick={clearAll}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-md text-xs font-semibold transition-colors border border-border"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="max-h-56 overflow-y-auto divide-y divide-border/50">
                      {prospects.map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.04, 0.5) }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
                          onClick={() => toggleProspect(p.id)}
                        >
                          <input type="checkbox" checked={p.selected} onChange={() => toggleProspect(p.id)} className="w-4 h-4 accent-primary" onClick={e => e.stopPropagation()} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.name} — {p.title}</p>
                            <p className="text-xs text-muted-foreground">{p.company} | {p.industry} | Priority: <span className="text-success font-semibold">{p.priority}</span></p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  {isApproval && (
                    <div className="flex gap-3 pt-1">
                      <button onClick={onApprove}
                        className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Approve & Continue ({selectedCount})
                      </button>
                      <button onClick={onCancel}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/80 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {stage.id === 'platform' && stageData.platform && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-muted-foreground italic">Analyzing best outreach channel...</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stageData.platform.icon}</span>
                    <div>
                      <p className="font-bold text-foreground text-lg">{stageData.platform.selected}</p>
                      <div className="flex gap-3 mt-1">
                        {stageData.platform.stats.map(s => (
                          <span key={s.label} className="text-xs text-muted-foreground">{s.label}: <span className="text-primary font-bold">{s.value}</span></span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-card rounded-lg p-3 border border-border/60">
                    💡 {stageData.platform.reason}
                  </p>
                  {isActive && <ProgressBar active />}
                </div>
              )}

              {stage.id === 'content_generator' && stageData.contentGenerator && (
                <div className="space-y-3">
                  {isActive && <p className="text-sm text-muted-foreground italic">Generating personalized content for all prospects...</p>}
                  
                  {/* Show personalized content if available, otherwise show legacy content */}
                  {stageData.contentGenerator.personalizedContent && stageData.contentGenerator.personalizedContent.length > 0 ? (
                    <>
                      {/* Prospect Selector */}
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                        <span className="text-sm font-medium text-foreground">View content for:</span>
                        <select
                          value={selectedProspectIndex}
                          onChange={(e) => setSelectedProspectIndex(Number(e.target.value))}
                          className="flex-1 px-3 py-1.5 text-sm bg-card border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {stageData.contentGenerator.personalizedContent.map((pc, idx) => (
                            <option key={pc.prospect_id} value={idx}>
                              {pc.prospect_name} — {pc.prospect_job_title} at {pc.prospect_company}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {selectedProspectIndex + 1} / {stageData.contentGenerator.personalizedContent.length}
                        </span>
                      </div>

                      {/* Content Tabs */}
                      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                        {(['linkedin', 'email', 'call'] as const).map(tab => (
                          <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold capitalize transition-all ${activeTab === tab ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            {tab === 'linkedin' ? '💼 LinkedIn' : tab === 'email' ? '📧 Email' : '📞 Call Script'}
                          </button>
                        ))}
                      </div>

                      {/* Personalized Content Display */}
                      <div className="relative">
                        {stageData.contentGenerator.personalizedContent[selectedProspectIndex] && (
                          <>
                            <div className="bg-card border border-border rounded-xl p-4 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                              <FormattedText>
                                {activeTab === 'linkedin' 
                                  ? stageData.contentGenerator.personalizedContent[selectedProspectIndex].linkedin_message
                                  : activeTab === 'email'
                                  ? `Subject: ${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.subject}\n\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.body}`
                                  : `Opener:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.opener}\n\nObjections:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.objections.join('\n\n')}\n\nClose:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.close}`
                                }
                              </FormattedText>
                            </div>
                            <div className="absolute top-2 right-2">
                              <CopyButton text={
                                activeTab === 'linkedin' 
                                  ? stageData.contentGenerator.personalizedContent[selectedProspectIndex].linkedin_message
                                  : activeTab === 'email'
                                  ? `Subject: ${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.subject}\n\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].email_message.body}`
                                  : `Opener:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.opener}\n\nObjections:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.objections.join('\n\n')}\n\nClose:\n${stageData.contentGenerator.personalizedContent[selectedProspectIndex].call_script.close}`
                              } />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Legacy Content Display (fallback for backward compatibility) */}
                      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                        {(['linkedin', 'email', 'call'] as const).map(tab => (
                          <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold capitalize transition-all ${activeTab === tab ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            {tab === 'linkedin' ? '💼 LinkedIn' : tab === 'email' ? '📧 Email' : '📞 Call Script'}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <div className="bg-card border border-border rounded-xl p-4 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                          <FormattedText>
                            {activeTab === 'linkedin' ? stageData.contentGenerator.linkedin :
                              activeTab === 'email' ? stageData.contentGenerator.email :
                                stageData.contentGenerator.callScript}
                          </FormattedText>
                        </div>
                        <div className="absolute top-2 right-2">
                          <CopyButton text={
                            activeTab === 'linkedin' ? stageData.contentGenerator!.linkedin :
                              activeTab === 'email' ? stageData.contentGenerator!.email :
                                stageData.contentGenerator!.callScript
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
    </motion.div>
  );
}

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
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({ ...opts, origin: { y: 0.7 }, particleCount: Math.floor(200 * particleRatio) });
    };
    fire(0.25, { spread: 26, startVelocity: 55, colors: ['#6366f1', '#8b5cf6', '#10b981'] });
    fire(0.2, { spread: 60, colors: ['#6366f1', '#a5b4fc', '#34d399'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#818cf8', '#c4b5fd', '#6ee7b7'] });
    fire(0.1, { spread: 120, startVelocity: 45, colors: ['#6366f1', '#10b981'] });
  }, []);

  useEffect(() => {
    if (!open) return;
    
    reset();
    
    let cleanup: (() => void) | null = null;

    const startExecution = async () => {
      cleanup = await ApiClient.executeCampaign(
        prompt,
        // onMessage handler
        (event: SSEEvent) => {
          console.log('SSE Event:', event);

          switch (event.stage) {
            case 'input_parser':
              if (event.status === 'started') {
                setCurrentStageIdx(0);
              } else if (event.status === 'completed' && event.data) {
                setStageData(prev => ({
                  ...prev,
                  inputParser: {
                    time: event.data.time || 'current',
                    location: event.data.location || 'any',
                    business: event.data.business_behavior || prompt,
                    intent: event.data.user_intent || 'generate leads',
                    target: event.data.target_audience || 'prospects',
                  },
                }));
                setCompletedStages(prev => [...prev, 'input_parser']);
              }
              break;

            case 'classifier':
              if (event.status === 'started') {
                setCurrentStageIdx(1);
              } else if (event.status === 'completed' && event.data) {
                setStageData(prev => ({
                  ...prev,
                  classifier: {
                    category: event.data.category || 'B2B Lead Generation',
                    confidence: Math.round((event.data.confidence || 0.95) * 100),
                  },
                }));
                setCompletedStages(prev => [...prev, 'classifier']);
              }
              break;

            case 'strategy':
              if (event.status === 'started') {
                setCurrentStageIdx(2);
              } else if (event.status === 'completed' && event.data) {
                setStageData(prev => ({
                  ...prev,
                  strategy: {
                    tone: event.data.tone || 'Professional',
                    cta: event.data.cta_type || 'book_demo',
                    urgency: event.data.urgency_level || 'medium',
                  },
                }));
                setCompletedStages(prev => [...prev, 'strategy']);
              }
              break;

            case 'icp_matcher':
              if (event.status === 'started') {
                setCurrentStageIdx(3);
              } else if (event.status === 'completed' && event.data) {
                // Save session ID for approval
                if (event.session_id) {
                  setSessionId(event.session_id);
                }

                // Map prospects from backend to frontend format
                const backendProspects = event.data.top_prospects || [];
                const mappedProspects = backendProspects.map((p: any, idx: number) => ({
                  id: p.id || `prospect-${idx}`,
                  name: p.name || `${p.first_name} ${p.last_name}`,
                  title: p.job_title || 'Unknown',
                  company: p.company_name || 'Unknown',
                  industry: p.industry || 'Unknown',
                  priority: p.priority_score?.toFixed(2) || '0.00',
                  selected: true, // All selected by default
                }));

                setProspects(mappedProspects);
                setStageData(prev => ({
                  ...prev,
                  icpMatcher: {
                    prospects: mappedProspects,
                    archetype: event.data.target_archetype || 'B2B Decision Makers',
                  },
                }));

                // Trigger approval wait
                setTimeout(() => {
                  setWaitingApproval(true);
                }, 500);
              }
              break;

            case 'platform_decision':
              if (event.status === 'started') {
                setCurrentStageIdx(4);
              } else if (event.status === 'completed' && event.data) {
                const channelIcons: Record<string, string> = {
                  linkedin: '💼',
                  email: '📧',
                  call: '📞',
                };

                setStageData(prev => ({
                  ...prev,
                  platform: {
                    selected: event.data.selected_channel || 'LinkedIn',
                    icon: channelIcons[event.data.selected_channel?.toLowerCase()] || '💼',
                    reason: event.data.channel_reasoning || 'Best channel for your audience',
                    stats: [
                      { label: 'Open Rate', value: '42%' },
                      { label: 'Reply Rate', value: '12%' },
                    ],
                  },
                }));
                setCompletedStages(prev => [...prev, 'platform']);
              }
              break;

            case 'content_generator':
              if (event.status === 'started') {
                setCurrentStageIdx(5);
              } else if (event.status === 'completed' && event.data) {
                // Handle personalized content for each prospect
                const personalizedContent = event.data.personalized_content || [];
                
                // Legacy fields (for backward compatibility, use first prospect)
                const linkedin = event.data.linkedin_message || 'LinkedIn message...';
                const email = event.data.email_message
                  ? `Subject: ${event.data.email_message.subject}\n\n${event.data.email_message.body}`
                  : 'Email content...';
                const callScript = event.data.call_script
                  ? `Opener:\n${event.data.call_script.opener}\n\nObjections:\n${event.data.call_script.objections?.join('\n\n')}\n\nClose:\n${event.data.call_script.close}`
                  : 'Call script...';

                setStageData(prev => ({
                  ...prev,
                  contentGenerator: {
                    linkedin,
                    email,
                    callScript,
                    personalizedContent,  // NEW: Store all personalized content
                  },
                }));
                setCompletedStages(prev => [...prev, 'content_generator']);
              }
              break;

            case 'complete':
              setCurrentStageIdx(6);
              setIsDone(true);
              if (event.classification_id) {
                setClassificationId(event.classification_id);
              }
              fireConfetti();
              break;

            case 'error':
              console.error('Execution error:', event.status);
              toast({ variant: 'destructive', description: `Error: ${event.status}` });
              break;
          }
        },
        // onError handler
        (error: Error) => {
          console.error('SSE Error:', error);
          toast({ variant: 'destructive', description: `Failed to connect: ${error.message}` });
        },
        // onComplete handler
        () => {
          console.log('Stream completed');
        }
      );
    };

    startExecution();

    return () => {
      if (cleanup) cleanup();
    };
  }, [open, prompt, reset, fireConfetti, toast]);

  const handleApprove = useCallback(async () => {
    if (!sessionId) {
      console.error('No session ID available');
      toast({ variant: 'destructive', description: 'No session ID available' });
      return;
    }

    const selectedIds = prospects
      .filter(p => p.selected)
      .map(p => p.id);

    try {
      // Send approval to backend
      await ApiClient.approveCampaign(sessionId, true, selectedIds);
      
      // Continue execution (backend will resume streaming)
      setWaitingApproval(false);
      setCompletedStages(prev => [...prev, 'icp_matcher']);
    } catch (error) {
      console.error('Failed to approve campaign:', error);
      toast({ variant: 'destructive', description: 'Failed to approve campaign' });
    }
  }, [sessionId, prospects, toast]);

  const handleCancel = () => { reset(); onClose(); };
  const handleClose = () => { reset(); onClose(); };

  const getStageStatus = (stage: typeof STAGES[0], idx: number): 'pending' | 'active' | 'done' | 'approval' => {
    if (completedStages.includes(stage.id as Stage)) return 'done';
    if (waitingApproval && stage.id === 'icp_matcher') return 'approval';
    if (currentStageIdx === idx && !completedStages.includes(stage.id as Stage)) return 'active';
    return 'pending';
  };

  const selectedCount = prospects.filter(p => p.selected).length;

  if (!open) return null;

  return (
    <>
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 backdrop-blur-sm p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl my-8"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">AI Campaign Execution</h2>
                <p className="text-xs text-muted-foreground truncate max-w-xs">"{prompt.substring(0, 60)}{prompt.length > 60 ? '...' : ''}"</p>
              </div>
            </div>
            {!waitingApproval && !isDone && (
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress rail */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-1">
              {STAGES.slice(0, -1).map((s, i) => {
                const status = getStageStatus(s, i);
                return (
                  <div key={s.id} className="flex items-center gap-1 flex-1">
                    <motion.div
                      className={`h-1.5 w-full rounded-full transition-colors duration-700 ${status === 'done' ? 'bg-success' : status === 'active' || status === 'approval' ? 'bg-primary' : 'bg-muted'}`}
                    />
                    {i < STAGES.length - 2 && (
                      <div className={`w-1 h-1 rounded-full flex-shrink-0 ${status === 'done' ? 'bg-success' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {STAGES.slice(0, -1).map((s, i) => {
                const status = getStageStatus(s, i);
                return (
                  <span key={s.id} className={`text-[10px] ${status === 'done' ? 'text-success' : status === 'active' || status === 'approval' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {s.icon}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Stages list */}
          <div className="p-5 space-y-3">
            <AnimatePresence mode="popLayout">
              {STAGES.slice(0, -1).map((stage, idx) => {
                const status = getStageStatus(stage, idx);
                if (status === 'pending' && currentStageIdx < idx) return null;
                return (
                  <StageItem
                    key={stage.id}
                    stage={stage}
                    status={status}
                    stageData={stageData}
                    onApprove={handleApprove}
                    onCancel={handleCancel}
                    prospects={prospects}
                    setProspects={setProspects}
                  />
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {isDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="text-center py-8 px-6 bg-success/5 rounded-xl border border-success/20"
                >
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2, damping: 15 }}
                    className="text-5xl mb-4">🎉</motion.div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Campaign Ready!</h3>
                  <p className="text-muted-foreground text-sm mb-5">Your AI-powered campaign has been created successfully</p>
                  <div className="flex flex-wrap justify-center gap-4 mb-6">
                    {[
                      `${selectedCount} prospects targeted`,
                      `${stageData.contentGenerator?.personalizedContent?.length || selectedCount} personalized messages`,
                      `${stageData.platform?.selected ?? 'LinkedIn'} ready`,
                    ].map((label, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-1.5 text-sm text-success font-medium">
                        <CheckCircle className="w-4 h-4" />
                        {label}
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button onClick={handleClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors">
                      Start New Campaign
                    </button>
                    <button 
                      onClick={() => { 
                        if (classificationId) {
                          handleClose();
                          navigate(`/history/${classificationId}`);
                        }
                      }} 
                      disabled={!classificationId} 
                      className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      View Campaign →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </>
  );
}
