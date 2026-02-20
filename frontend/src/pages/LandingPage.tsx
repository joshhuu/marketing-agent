import { useState } from "react";
import { Shield, BarChart, Users, Zap, Lock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoginModal from "@/components/LoginModal";

const LandingPage = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-6">
            AI-Powered Marketing <span className="text-purple-400">Intelligence</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Enterprise-grade multi-agent marketing system that automates B2B campaign creation
            with intelligent prospect matching, content generation, and compliance built-in.
          </p>
          <Button
            onClick={() => setShowLoginModal(true)}
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg"
          >
            Get Started Now
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {/* Feature 1 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
              <Zap className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">AI Agent Workflow</h3>
            <p className="text-gray-300">
              6-agent system that parses intent, classifies tasks, generates strategy,
              matches prospects, selects channels, and creates personalized content.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <Users className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart ICP Matching</h3>
            <p className="text-gray-300">
              Intelligent prospect scoring based on industry, seniority, engagement history,
              and behavioral signals to target your ideal customer profile.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
              <BarChart className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Real-Time Analytics</h3>
            <p className="text-gray-300">
              Track campaign performance, prospect engagement, and API usage with
              comprehensive dashboards and detailed audit trails.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-4">
              <Shield className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Role-Based Access Control</h3>
            <p className="text-gray-300">
              Three-tier permission system: Viewers (read-only), Users (campaign creation),
              and Admins (full analytics and system monitoring).
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mb-4">
              <Lock className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Security & Compliance</h3>
            <p className="text-gray-300">
              Encrypted data storage, complete audit logging, prompt tracking, and
              compliance-ready architecture for enterprise security standards.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <FileText className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Human-in-the-Loop</h3>
            <p className="text-gray-300">
              Review and approve prospects before content generation. Full control
              with AI-powered recommendations for optimal campaign performance.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white/5 backdrop-blur-lg rounded-lg p-12 border border-white/20">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Marketing?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join leading B2B companies using AI to scale their outreach
          </p>
          <Button
            onClick={() => setShowLoginModal(true)}
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg"
          >
            Access Platform
          </Button>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default LandingPage;
