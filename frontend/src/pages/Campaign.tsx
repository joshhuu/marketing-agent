import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Zap, Bot, Users, Target, FileText, Send } from 'lucide-react';
import { ExecutionModal } from '../components/ExecutionModal';
import { CampaignResult } from '../types/campaign';

const MIN_CHARS = 20;
const MAX_CHARS = 1000;

const EXAMPLES = [
  "I'm selling payroll software to managers at companies in the UK. Need to generate leads ASAP.",
  "Target CTOs at financial companies with our cybersecurity compliance platform. Urgent — Q1 deadlines approaching.",
  "Reach out to directors about our new CRM tool. Want to book demos next week.",
];

const PIPELINE_STEPS = [
  { icon: Bot, label: 'Input Parser', color: 'bg-indigo-500' },
  { icon: Target, label: 'Classifier', color: 'bg-violet-500' },
  { icon: Users, label: 'ICP Matcher', color: 'bg-blue-500' },
  { icon: FileText, label: 'Content Generator', color: 'bg-sky-500' },
  { icon: Send, label: 'Sender', color: 'bg-emerald-500' },
];

export default function Campaign() {
  const [prompt, setPrompt] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = prompt.length;
  const isValid = charCount >= MIN_CHARS;
  const progress = Math.min((charCount / MIN_CHARS) * 100, 100);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setPrompt(val);
      const ta = textareaRef.current;
      if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`; }
    }
  };

  const handleExample = (ex: string) => {
    setPrompt(ex);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`; ta.focus(); }
  };

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    setSubmittedPrompt(prompt);
    setModalOpen(true);
  }, [isValid, prompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
  };

  const handleComplete = (result: CampaignResult) => {
    const history = JSON.parse(localStorage.getItem('campaignHistory') || '[]');
    history.unshift({ ...result, createdAt: new Date().toISOString() });
    localStorage.setItem('campaignHistory', JSON.stringify(history.slice(0, 50)));
  };

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-100/40 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f010_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f010_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-16">

        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3.5 py-1.5 rounded-full mb-5">
            <Zap size={11} /> Powered by Multi-Agent AI
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-4">
            Launch Your B2B<br />
            <span className="text-gradient">Campaign in Seconds</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-lg mx-auto leading-relaxed">
            Describe your goal in plain English. 7 AI agents handle prospect matching, strategy, and personalized outreach — end to end.
          </p>
        </motion.div>

        {/* Pipeline preview */}
        <motion.div
          className="flex items-center gap-2 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${step.color} flex items-center justify-center shadow-sm`}>
                  <Icon size={13} className="text-white" />
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight size={12} className="text-slate-300" />
                )}
              </div>
            );
          })}
          <span className="ml-2 text-xs text-slate-400 font-medium">7-agent pipeline</span>
        </motion.div>

        {/* Input Card */}
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
        >
          <div className={`bg-white rounded-2xl border-2 shadow-lg transition-all duration-200 ${focused ? 'border-indigo-400 shadow-indigo-100 shadow-xl' : 'border-slate-200 shadow-slate-100'}`}>
            {/* Textarea */}
            <div className="relative p-5 pb-3">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={`Describe your campaign...\n\nExample: "I'm selling HR payroll software to HR managers at mid-sized UK companies. Need to generate leads ASAP."`}
                rows={5}
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-base leading-relaxed resize-none outline-none font-sans"
                style={{ minHeight: '140px', maxHeight: '300px' }}
              />
            </div>

            {/* Progress bar */}
            <div className="mx-5 h-0.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 gap-4">
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-mono transition-colors ${isValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                  {charCount}/{MAX_CHARS}
                </span>
                {!isValid && charCount > 0 && (
                  <span className="text-slate-400">({MIN_CHARS - charCount} more chars needed)</span>
                )}
                {isValid && <span className="text-emerald-600 font-medium">✓ Ready to launch</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden sm:block">⌘+Enter</span>
                <button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isValid
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  <Sparkles size={15} />
                  Launch AI Campaign
                  {isValid && <ArrowRight size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Examples */}
          <motion.div
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">💡 Try an example</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleExample(ex)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-500 hover:text-slate-900 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 group shadow-sm"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.08 }}
                  whileHover={{ x: 4 }}
                >
                  <span className="text-indigo-500 font-bold mr-2 group-hover:mr-3 transition-all">›</span>
                  {ex}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="flex items-center justify-center gap-8 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {[
              { label: '7 AI Agents', emoji: '🤖' },
              { label: 'Smart Prospect Matching', emoji: '🎯' },
              { label: 'Personalized Content', emoji: '✍️' },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>{b.emoji}</span> {b.label}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <ExecutionModal
            open={modalOpen}
            prompt={submittedPrompt}
            onClose={() => setModalOpen(false)}
            onComplete={handleComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
