import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { ExecutionModal } from '../components/ExecutionModal';
import { CampaignResult } from '../types/campaign';

const MIN_CHARS = 20;
const MAX_CHARS = 1000;

const EXAMPLES = [
  "I'm selling HR payroll software to HR managers at mid-sized companies in the UK. Need to generate leads ASAP.",
  "Target CTOs at financial companies in London with our cybersecurity compliance platform. Urgent — Q1 deadlines approaching.",
  "Reach out to sales directors at tech startups about our new CRM tool. Want to book demos next week.",
];

export default function Index() {
  const [prompt, setPrompt] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = prompt.length;
  const isValid = charCount >= MIN_CHARS;

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setPrompt(val);
      // Auto-resize
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 280)}px`;
      }
    }
  };

  const handleExample = (ex: string) => {
    setPrompt(ex);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 280)}px`;
      ta.focus();
    }
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
    // Store in localStorage for history
    const history = JSON.parse(localStorage.getItem('campaignHistory') || '[]');
    history.unshift({ ...result, createdAt: new Date().toISOString() });
    localStorage.setItem('campaignHistory', JSON.stringify(history.slice(0, 50)));
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative">
        {/* Hero Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent border border-primary/20 text-primary text-xs font-semibold mb-5">
            <Zap className="w-3 h-3" />
            Powered by Multi-Agent AI
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-4">
            🤖 AI Marketing<br />
            <span className="text-gradient">Campaign Generator</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            Describe your campaign in plain English, and AI agents handle the rest — from finding prospects to crafting personalized messages.
          </p>
        </motion.div>

        {/* Input Card */}
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="card-glass rounded-2xl p-1 glow-primary-sm">
            <div className="bg-card rounded-xl border border-border/50">
              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Example: I'm Sarah from TechFlow selling cybersecurity to IT directors in London. Need to book demos this week..."
                  rows={5}
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/60 text-base leading-relaxed resize-none outline-none px-5 pt-5 pb-3 rounded-xl font-sans"
                  style={{ minHeight: '140px', maxHeight: '280px' }}
                />
              </div>

              {/* Footer bar */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono transition-colors ${charCount < MIN_CHARS ? 'text-muted-foreground' : 'text-success'}`}>
                    {charCount}/{MAX_CHARS}
                  </span>
                  {!isValid && charCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({MIN_CHARS - charCount} more chars needed)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground hidden sm:block">⌘ + Enter</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!isValid}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  >
                    <Sparkles className="w-4 h-4" />
                    Launch AI Campaign
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Character progress */}
          <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden mx-1">
            <motion.div
              className="h-full bg-gradient-primary rounded-full"
              animate={{ width: `${Math.min((charCount / MIN_CHARS) * 100, 100)}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>

          {/* Examples */}
          <motion.div
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
              <span>💡</span> Click to try an example:
            </p>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleExample(ex)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/40 transition-all duration-200 group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  whileHover={{ x: 3 }}
                >
                  <span className="text-primary mr-2 font-bold group-hover:mr-3 transition-all">•</span>
                  "{ex}"
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="flex items-center justify-center gap-6 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {[
              { emoji: '🔍', label: '7 AI Agents' },
              { emoji: '👥', label: 'Smart Prospect Matching' },
              { emoji: '✍️', label: 'Personalized Content' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{badge.emoji}</span>
                <span>{badge.label}</span>
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
