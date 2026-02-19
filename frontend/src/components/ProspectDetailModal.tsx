import React, { useEffect, useState } from 'react';
import { X, Loader2, Mail, Phone, Linkedin, MapPin, Building2, Briefcase, Target, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { ApiClient, ProspectDetail } from '../lib/api';

interface ProspectDetailModalProps {
  prospectId: string | null;
  onClose: () => void;
}

export function ProspectDetailModal({ prospectId, onClose }: ProspectDetailModalProps) {
  const [prospectDetail, setProspectDetail] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prospectId) {
      fetchProspectDetails();
    }
  }, [prospectId]);

  const fetchProspectDetails = async () => {
    if (!prospectId) return;

    setLoading(true);
    setError(null);

    try {
      const details = await ApiClient.getProspectDetails(prospectId);
      setProspectDetail(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prospect details');
    } finally {
      setLoading(false);
    }
  };

  if (!prospectId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {prospectDetail ? `${prospectDetail.first_name} ${prospectDetail.last_name}` : 'Loading...'}
            </h2>
            {prospectDetail && (
              <p className="text-gray-600 mt-1">
                {prospectDetail.job_title} at {prospectDetail.company_name}
              </p>
            )}
          </div>
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
              <span className="ml-3 text-gray-600">Loading prospect details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {prospectDetail && !loading && (
            <div className="space-y-6">
              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-500" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <a href={`mailto:${prospectDetail.email}`} className="text-blue-600 hover:underline">
                      {prospectDetail.email}
                    </a>
                  </div>
                  {prospectDetail.phone && (
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <a href={`tel:${prospectDetail.phone}`} className="text-blue-600 hover:underline">
                        {prospectDetail.phone}
                      </a>
                    </div>
                  )}
                  {prospectDetail.linkedin_url && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">LinkedIn</p>
                      <a
                        href={prospectDetail.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Linkedin className="w-4 h-4" />
                        View Profile
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Information */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-green-500" />
                  Professional Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Job Title</p>
                    <p className="font-medium text-gray-900">{prospectDetail.job_title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium text-gray-900">{prospectDetail.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Seniority</p>
                    <p className="font-medium text-gray-900">{prospectDetail.seniority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Decision Maker</p>
                    <p className="font-medium text-gray-900">
                      {prospectDetail.is_decision_maker ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  Company Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Company</p>
                    <p className="font-medium text-gray-900">{prospectDetail.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Industry</p>
                    <p className="font-medium text-gray-900">{prospectDetail.industry}</p>
                  </div>
                  {prospectDetail.company_size && (
                    <div>
                      <p className="text-sm text-gray-500">Company Size</p>
                      <p className="font-medium text-gray-900">{prospectDetail.company_size}</p>
                    </div>
                  )}
                  {(prospectDetail.city || prospectDetail.country) && (
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {[prospectDetail.city, prospectDetail.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ICP & Scoring */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  ICP & Scoring
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {prospectDetail.icp_archetype && (
                    <div>
                      <p className="text-sm text-gray-500">ICP Archetype</p>
                      <p className="font-medium text-gray-900">{prospectDetail.icp_archetype}</p>
                    </div>
                  )}
                  {prospectDetail.priority_score !== null && (
                    <div>
                      <p className="text-sm text-gray-500">Priority Score</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            style={{ width: `${prospectDetail.priority_score * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold text-gray-900">
                          {prospectDetail.priority_score.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  {prospectDetail.icp_score !== null && (
                    <div>
                      <p className="text-sm text-gray-500">ICP Score</p>
                      <p className="font-medium text-gray-900">{prospectDetail.icp_score.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Engagement Preferences */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Engagement Preferences
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {prospectDetail.preferred_channel && (
                    <div>
                      <p className="text-sm text-gray-500">Preferred Channel</p>
                      <p className="font-medium text-gray-900 capitalize">{prospectDetail.preferred_channel}</p>
                    </div>
                  )}
                  {prospectDetail.best_contact_time && (
                    <div>
                      <p className="text-sm text-gray-500">Best Contact Time</p>
                      <p className="font-medium text-gray-900">{prospectDetail.best_contact_time}</p>
                    </div>
                  )}
                  {prospectDetail.timezone && (
                    <div>
                      <p className="text-sm text-gray-500">Timezone</p>
                      <p className="font-medium text-gray-900">{prospectDetail.timezone}</p>
                    </div>
                  )}
                </div>

                {/* Engagement Rates */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {prospectDetail.email_open_rate !== null && (
                    <div className="text-center bg-white rounded p-3">
                      <p className="text-xs text-gray-500">Email Open Rate</p>
                      <p className="text-lg font-bold text-blue-600">
                        {(prospectDetail.email_open_rate * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}
                  {prospectDetail.linkedin_click_rate !== null && (
                    <div className="text-center bg-white rounded p-3">
                      <p className="text-xs text-gray-500">LinkedIn Click Rate</p>
                      <p className="text-lg font-bold text-indigo-600">
                        {(prospectDetail.linkedin_click_rate * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}
                  {prospectDetail.call_answer_rate !== null && (
                    <div className="text-center bg-white rounded p-3">
                      <p className="text-xs text-gray-500">Call Answer Rate</p>
                      <p className="text-lg font-bold text-green-600">
                        {(prospectDetail.call_answer_rate * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact History */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  Contact History
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Times Contacted</p>
                    <p className="font-medium text-gray-900">{prospectDetail.times_contacted || 0}</p>
                  </div>
                  {prospectDetail.last_contacted_at && (
                    <div>
                      <p className="text-sm text-gray-500">Last Contacted</p>
                      <p className="font-medium text-gray-900">
                        {new Date(prospectDetail.last_contacted_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recent Engagements */}
                {prospectDetail.engagements && prospectDetail.engagements.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Recent Engagements</p>
                    <div className="space-y-2">
                      {prospectDetail.engagements.slice(0, 5).map((engagement) => (
                        <div key={engagement.id} className="bg-white rounded p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                                {engagement.channel}
                              </span>
                              <span className="text-gray-600">
                                {engagement.sent_at && new Date(engagement.sent_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {engagement.was_opened && (
                                <span className="text-green-600 text-xs flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Opened
                                </span>
                              )}
                              {engagement.was_replied && (
                                <span className="text-purple-600 text-xs flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Replied
                                </span>
                              )}
                              {!engagement.was_opened && !engagement.was_replied && (
                                <span className="text-gray-400 text-xs flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  No response
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pain Points & Interests */}
              {((prospectDetail.pain_points && prospectDetail.pain_points.length > 0) ||
                (prospectDetail.interests && prospectDetail.interests.length > 0)) && (
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-3">Insights</h3>
                  {prospectDetail.pain_points && prospectDetail.pain_points.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-500 mb-2">Pain Points</p>
                      <div className="flex flex-wrap gap-2">
                        {prospectDetail.pain_points.map((point, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {prospectDetail.interests && prospectDetail.interests.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Interests</p>
                      <div className="flex flex-wrap gap-2">
                        {prospectDetail.interests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex items-center justify-between">
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Contact
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
