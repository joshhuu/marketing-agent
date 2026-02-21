import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Shield, User, Eye, ArrowRight, Mail, Lock, UserPlus } from "lucide-react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "login" | "signup";
}

const LoginModal = ({ open, onClose, defaultTab = "login" }: LoginModalProps) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<"login" | "signup">(defaultTab);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Sync tab when defaultTab changes (e.g. opened via different buttons)
  useState(() => {
    setTab(defaultTab);
  });

  const roles: { id: UserRole; label: string; icon: any; desc: string }[] = [
    { id: "viewer", label: "Viewer", icon: Eye, desc: "Read-only access" },
    { id: "user", label: "User", icon: User, desc: "Run campaigns" },
    { id: "admin", label: "Admin", icon: Shield, desc: "Full control" },
  ];

  const resetForm = () => {
    setSelectedRole(null);
    setUsername("");
    setPassword("");
    setFullName("");
    setConfirmPassword("");
  };

  const handleSubmit = () => {
    if (!selectedRole) {
      toast({ title: "Select a role", description: "Please choose a role to continue.", variant: "destructive" });
      return;
    }
    login(selectedRole);
    const name = fullName || username || selectedRole;
    toast({ title: tab === "signup" ? "Account created!" : "Signed in", description: `Welcome, ${name}` });
    resetForm();
    onClose();
    navigate("/");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const switchTab = (t: "login" | "signup") => {
    setTab(t);
    setSelectedRole(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 max-w-md overflow-hidden border-0 shadow-2xl rounded-2xl">

        {/* Header */}
        <div className="bg-indigo-600 px-8 pt-8 pb-7">
          <div className="flex items-center gap-2.5 mb-6">
            <img src="/logo.png" alt="Infynd Aurevix" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-white text-sm tracking-tight">Infynd Aurevix</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {tab === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            {tab === "login" ? "Sign in to access your workspace." : "Get started with MarketAgent for free."}
          </p>

          {/* Tab Toggle */}
          <div className="flex gap-1 mt-5 bg-indigo-700/50 rounded-xl p-1">
            <button
              onClick={() => switchTab("login")}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${tab === "login" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-200 hover:text-white"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab("signup")}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${tab === "signup" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-200 hover:text-white"}`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-7 bg-white space-y-5">

          {/* Role Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Select Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map((r) => {
                const Icon = r.icon as any;
                const active = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3.5 rounded-xl border-2 transition-all duration-150 ${active
                      ? "border-indigo-600 bg-indigo-50 shadow-sm"
                      : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-indigo-600" : "bg-slate-200"}`}>
                      <Icon size={15} className={active ? "text-white" : "text-slate-500"} />
                    </div>
                    <span className={`text-xs font-bold ${active ? "text-indigo-700" : "text-slate-600"}`}>{r.label}</span>
                    <span className={`text-[10px] leading-tight text-center ${active ? "text-indigo-500" : "text-slate-400"}`}>{r.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3.5">
            {tab === "signup" && (
              <div className="relative">
                <UserPlus size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Work email"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {tab === "signup" && (
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedRole}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${selectedRole
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
          >
            {tab === "login" ? "Sign In" : "Create Account"}
            {selectedRole && <ArrowRight size={15} />}
          </button>

          {/* Switch hint */}
          <p className="text-center text-xs text-slate-400">
            {tab === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => switchTab("signup")} className="text-indigo-600 font-semibold hover:underline">
                  Sign up free
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => switchTab("login")} className="text-indigo-600 font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
