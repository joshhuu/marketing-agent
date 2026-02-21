import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Mail, Phone, Linkedin, MapPin, Building2,
  Briefcase, Target, TrendingUp, Clock, CheckCircle, XCircle,
  Star, Globe, AlertCircle
} from 'lucide-react';
import { ApiClient, ProspectDetail } from '../lib/api';

interface ProspectDetailModalProps {
  prospectId: string | null;
  onClose: () => void;
}

/* ─── small info cell ────────────────────────────────────── */
function InfoCell({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
      value !== null && value !== undefined && value !== '' ? String(value) : null;

  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      {display
        ? <p className="text-sm font-medium text-slate-800">{display}</p>
        : <p className="text-sm text-slate-300 italic">—</p>}
    </div>
  );
}

/* ─── section card ───────────────────────────────────────── */
function SectionCard({
  icon, title, iconBg, children
}: { icon: React.ReactNode; title: string; iconBg: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center text-white`}>{icon}</div>
        <span className="text-sm font-bold text-slate-800">{title}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ─── deterministic avatar color ─────────────────────────── */
const COLORS = ['bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-amber-500'];
const avatarBg = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length];

/* ─── modal ──────────────────────────────────────────────── */
export function ProspectDetailModal({ prospectId, onClose }: ProspectDetailModalProps) {
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prospectId) return;
    (async () => {
      setLoading(true); setError(null); setDetail(null);
      try { setDetail(await ApiClient.getProspectDetails(prospectId)); }
      catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
      finally { setLoading(false); }
    })();
  }, [prospectId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!prospectId) return null;

  const fullName = detail ? `${detail.first_name} ${detail.last_name}` : '…';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 28, stiffness: 380 }}
          className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* ── Modal Header ── */}
          <div className="bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              {detail ? (
                <div className={`w-12 h-12 rounded-2xl ${avatarBg(detail.first_name)} flex items-center justify-center text-white text-lg font-extrabold shrink-0`}>
                  {detail.first_name.charAt(0)}
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse" />
              )}
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{fullName}</h2>
                {detail && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {detail.job_title} · <span className="font-medium text-slate-700">{detail.company_name}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {detail?.priority_score !== null && detail?.priority_score !== undefined && (
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  <Star size={11} fill="currentColor" />
                  {detail.priority_score.toFixed(2)} Priority
                </div>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Scrollable Content ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-500 text-sm">Loading prospect details…</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {detail && !loading && (
              <>
                {/* 1. Contact Information */}
                <SectionCard icon={<Mail size={14} />} title="Contact Information" iconBg="bg-blue-600">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</p>
                      <a href={`mailto:${detail.email}`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}>
                        {detail.email}
                      </a>
                    </div>
                    {detail.phone && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                        <a href={`tel:${detail.phone}`}
                          className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1">
                          <Phone size={12} /> {detail.phone}
                        </a>
                      </div>
                    )}
                    {detail.linkedin_url && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LinkedIn</p>
                        <a href={detail.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors hover:bg-blue-100"
                          onClick={(e) => e.stopPropagation()}>
                          <Linkedin size={13} /> View LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* 2. Professional Info */}
                <SectionCard icon={<Briefcase size={14} />} title="Professional Information" iconBg="bg-emerald-600">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <InfoCell label="Job Title" value={detail.job_title} />
                    <InfoCell label="Department" value={detail.department} />
                    <InfoCell label="Seniority" value={detail.seniority} />
                    <InfoCell label="Decision Maker" value={detail.is_decision_maker} />
                  </div>
                </SectionCard>

                {/* 3. Company Info */}
                <SectionCard icon={<Building2 size={14} />} title="Company Information" iconBg="bg-violet-600">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <InfoCell label="Company" value={detail.company_name} />
                    <InfoCell label="Industry" value={detail.industry} />
                    {detail.company_size && <InfoCell label="Company Size" value={detail.company_size} />}
                    {(detail.city || detail.country) && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Location</p>
                        <p className="text-sm font-medium text-slate-800 flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          {[detail.city, detail.country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* 4. ICP & Scoring */}
                <SectionCard icon={<Target size={14} />} title="ICP & Scoring" iconBg="bg-orange-500">
                  <div className="grid grid-cols-2 gap-5">
                    {detail.icp_archetype && <InfoCell label="ICP Archetype" value={detail.icp_archetype} />}
                    {detail.icp_score !== null && <InfoCell label="ICP Score" value={detail.icp_score?.toFixed(2)} />}

                    {detail.priority_score !== null && detail.priority_score !== undefined && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Priority Score</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${detail.priority_score >= 0.85 ? 'bg-emerald-500' :
                                  detail.priority_score >= 0.70 ? 'bg-amber-500' : 'bg-slate-400'
                                }`}
                              style={{ width: `${detail.priority_score * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-extrabold text-slate-800 font-mono">{detail.priority_score.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* 5. Engagement */}
                <SectionCard icon={<TrendingUp size={14} />} title="Engagement Preferences" iconBg="bg-sky-600">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {detail.preferred_channel && <InfoCell label="Preferred Channel" value={detail.preferred_channel} />}
                      {detail.best_contact_time && <InfoCell label="Best Contact Time" value={detail.best_contact_time} />}
                      {detail.timezone && <InfoCell label="Timezone" value={detail.timezone} />}
                    </div>

                    {/* Rate tiles */}
                    {(detail.email_open_rate !== null || detail.linkedin_click_rate !== null || detail.call_answer_rate !== null) && (
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        {detail.email_open_rate !== null && (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Open</p>
                            <p className="text-xl font-extrabold text-blue-600">{(detail.email_open_rate * 100).toFixed(0)}%</p>
                          </div>
                        )}
                        {detail.linkedin_click_rate !== null && (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LinkedIn Click</p>
                            <p className="text-xl font-extrabold text-indigo-600">{(detail.linkedin_click_rate * 100).toFixed(0)}%</p>
                          </div>
                        )}
                        {detail.call_answer_rate !== null && (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Call Answer</p>
                            <p className="text-xl font-extrabold text-emerald-600">{(detail.call_answer_rate * 100).toFixed(0)}%</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* 6. Contact History */}
                <SectionCard icon={<Clock size={14} />} title="Contact History" iconBg="bg-slate-500">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoCell label="Times Contacted" value={detail.times_contacted || 0} />
                      {detail.last_contacted_at && (
                        <InfoCell label="Last Contacted" value={new Date(detail.last_contacted_at).toLocaleDateString('en-US', { dateStyle: 'medium' })} />
                      )}
                    </div>

                    {detail.engagements && detail.engagements.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recent Engagements</p>
                        <div className="space-y-2">
                          {detail.engagements.slice(0, 5).map((eng) => (
                            <div key={eng.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg capitalize">
                                  {eng.channel}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {eng.sent_at && new Date(eng.sent_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                {eng.was_replied && (
                                  <span className="flex items-center gap-1 text-violet-600 font-semibold">
                                    <CheckCircle size={12} /> Replied
                                  </span>
                                )}
                                {eng.was_opened && !eng.was_replied && (
                                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                                    <CheckCircle size={12} /> Opened
                                  </span>
                                )}
                                {!eng.was_opened && !eng.was_replied && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <XCircle size={12} /> No response
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* 7. Insights (pain points + interests) */}
                {((detail.pain_points && detail.pain_points.length > 0) ||
                  (detail.interests && detail.interests.length > 0)) && (
                    <SectionCard icon={<Star size={14} />} title="Insights" iconBg="bg-pink-500">
                      <div className="space-y-4">
                        {detail.pain_points && detail.pain_points.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pain Points</p>
                            <div className="flex flex-wrap gap-2">
                              {detail.pain_points.map((pt, i) => (
                                <span key={i} className="text-xs font-medium bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-full">
                                  {pt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {detail.interests && detail.interests.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Interests</p>
                            <div className="flex flex-wrap gap-2">
                              {detail.interests.map((int, i) => (
                                <span key={i} className="text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full">
                                  {int}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-slate-100 bg-white px-6 py-4 flex items-center justify-between shrink-0">
            {detail ? (
              <a
                href={`mailto:${detail.email}`}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail size={14} /> Contact
              </a>
            ) : <div />}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
