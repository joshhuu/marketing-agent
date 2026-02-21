import { useState, useEffect } from "react";
import { Shield, BarChart, Users, Zap, Lock, FileText, ArrowRight, CheckCircle, Target, Sparkles } from "lucide-react";
import LoginModal from "@/components/LoginModal";

const LandingPage = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginTab, setLoginTab] = useState<"login" | "signup">("login");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openLogin = (tab: "login" | "signup" = "login") => {
    setLoginTab(tab);
    setShowLoginModal(true);
  };

  const features = [
    {
      icon: Zap,
      color: "bg-indigo-600",
      title: "AI Agent Orchestration",
      desc: "Multi-agent workflows handle classification, strategy, and personalized content generation end-to-end.",
    },
    {
      icon: Target,
      color: "bg-violet-600",
      title: "Smart ICP Matching",
      desc: "Precision prospect scoring powered by engagement signals to hit your ideal customer profile every time.",
    },
    {
      icon: BarChart,
      color: "bg-blue-600",
      title: "Real-Time Analytics",
      desc: "Live campaign performance dashboards across all channels with exportable audit-ready reports.",
    },
    {
      icon: Shield,
      color: "bg-sky-600",
      title: "Role-Based Access",
      desc: "Fine-grained permissions for Viewers, Users, and Admins — with full audit trails built in.",
    },
    {
      icon: Lock,
      color: "bg-indigo-500",
      title: "Security & Compliance",
      desc: "End-to-end encryption and enterprise-ready controls to keep your data protected at all times.",
    },
    {
      icon: FileText,
      color: "bg-violet-500",
      title: "Human-in-the-Loop",
      desc: "Review and approve prospects before any content is generated or email is sent.",
    },
  ];

  const steps = [
    { num: "01", icon: Sparkles, title: "Define Your Campaign", desc: "Set your ICP, goals, and messaging strategy using our guided campaign builder." },
    { num: "02", icon: Users, title: "Match & Score Prospects", desc: "AI agents scan your database and surface the highest-fit prospects automatically." },
    { num: "03", icon: Zap, title: "Generate & Deploy", desc: "Personalized emails are drafted, approved, and delivered — all from one platform." },
  ];

  const stats = [
    { value: "10×", label: "Faster campaign setup" },
    { value: "98%", label: "Email delivery rate" },
    { value: "3 min", label: "Time to first prospect" },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">

      {/* ── Navbar ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Infynd Aurevix" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-slate-900 text-lg tracking-tight">Infynd Aurevix</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it Works</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openLogin("login")}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5"
            >
              Sign In
            </button>
            <button
              onClick={() => openLogin("signup")}
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:72px_72px]" />
        {/* Indigo glow blob */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-100/60 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles size={12} />
            Enterprise B2B Marketing Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            AI-Powered Campaigns.<br />
            <span className="text-indigo-600">Delivered at Scale.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Design, match, and deploy personalized B2B campaigns with a multi-agent platform built for compliance, auditability, and results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => openLogin("signup")}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-7 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              Start for free <ArrowRight size={16} />
            </button>
            <button
              onClick={() => openLogin("login")}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-7 py-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
            >
              Sign in to platform
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-3xl mx-auto mt-20 grid grid-cols-3 gap-px bg-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {stats.map((s) => (
            <div key={s.label} className="bg-white px-6 py-6 text-center">
              <div className="text-3xl font-extrabold text-indigo-600 tracking-tight">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Platform Capabilities</p>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Everything you need to run<br />high-performance B2B campaigns</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className={`w-11 h-11 ${f.color} rounded-xl flex items-center justify-center mb-5 shadow-sm`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">How it Works</p>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">From strategy to sent — in minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative flex flex-col items-center text-center">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-9 left-[calc(50%+44px)] right-0 h-px bg-slate-200 border-dashed border-t border-slate-300" />
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5 shadow-sm">
                    <Icon size={26} className="text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-indigo-400 tracking-widest mb-2">{step.num}</span>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Band ── */}
      <section className="py-20 px-6 bg-indigo-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">Ready to transform your marketing?</h2>
          <p className="text-indigo-200 text-lg mb-8">Join teams already running smarter, faster, compliant B2B campaigns.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => openLogin("signup")}
              className="inline-flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold px-8 py-3.5 rounded-xl shadow-md hover:shadow-lg hover:bg-slate-50 transition-all"
            >
              Create free account <ArrowRight size={16} />
            </button>
            <button
              onClick={() => openLogin("login")}
              className="inline-flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold px-8 py-3.5 rounded-xl border border-indigo-500 transition-all"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Infynd Aurevix" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-white text-sm tracking-tight">Infynd Aurevix</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <CheckCircle size={12} className="text-green-500" />
            Enterprise-grade security &amp; compliance
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} MarketAgent. All rights reserved.</p>
        </div>
      </footer>

      {/* Login / Signup Modal */}
      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        defaultTab={loginTab}
      />
    </div>
  );
};

export default LandingPage;
