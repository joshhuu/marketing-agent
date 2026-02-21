import { useState } from "react";
import { Shield, BarChart, Users, Zap, Lock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoginModal from "@/components/LoginModal";

const LandingPage = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight text-slate-900 mb-4">
                AI-powered Marketing Intelligence
              </h1>
              <p className="text-lg text-slate-600 mb-6 max-w-2xl">
                Enterprise-grade multi-agent platform to design, match, and deliver
                personalized B2B campaigns — with auditability and compliance built-in.
              </p>
              <div className="flex gap-4">
                <Button
                  onClick={() => setShowLoginModal(true)}
                  size="lg"
                  className="bg-slate-900 text-white px-6 py-3 shadow-md hover:shadow-lg"
                >
                  Get Started
                </Button>
                <Button variant="outline" onClick={() => window.scrollTo({ top: 800, behavior: 'smooth' })} className="px-6 py-3">
                  Learn More
                </Button>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-sm font-semibold text-slate-500 mb-4">Product Snapshot</h3>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li>• Multi-agent orchestration for campaign automation</li>
                  <li>• Precision prospect matching with engagement signals</li>
                  <li>• Built-in audit trails and role-based access</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
                <Zap className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">AI Agent Workflow</h3>
              <p className="text-slate-600 text-sm">Orchestrate agents for classification, strategy, and content generation.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <Users className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Smart ICP Matching</h3>
              <p className="text-slate-600 text-sm">Intelligent prospect scoring to target your ideal customer profile.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                <BarChart className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Real-Time Analytics</h3>
              <p className="text-slate-600 text-sm">Track campaign performance and engagement across channels.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-4">
                <Shield className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Role-Based Access</h3>
              <p className="text-slate-600 text-sm">Fine-grained permissions for Viewers, Users, and Admins.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mb-4">
                <Lock className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Security & Compliance</h3>
              <p className="text-slate-600 text-sm">Encryption, audit logs, and enterprise-ready controls.</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
                <FileText className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Human-in-the-Loop</h3>
              <p className="text-slate-600 text-sm">Review and approve prospects before content generation.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12">
          <div className="bg-white rounded-xl shadow-md p-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Ready to transform your marketing?</h2>
            <p className="text-slate-600 mb-6">Start with a quick sign-in and explore the platform.</p>
            <Button onClick={() => setShowLoginModal(true)} className="bg-slate-900 text-white px-6 py-3">Access Platform</Button>
          </div>
        </section>
      </div>

      {/* Login Modal */}
      <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default LandingPage;
