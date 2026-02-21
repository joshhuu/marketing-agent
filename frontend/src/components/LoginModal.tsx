import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, User, Eye } from "lucide-react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const LoginModal = ({ open, onClose }: LoginModalProps) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const roles: { id: UserRole; label: string; icon: any }[] = [
    { id: "viewer", label: "Viewer", icon: Eye },
    { id: "user", label: "User", icon: User },
    { id: "admin", label: "Admin", icon: Shield },
  ];

  const handleSubmit = () => {
    if (!selectedRole) {
      toast({ title: "Select role", description: "Please choose a role", variant: "destructive" });
      return;
    }

    // Accept any credentials and sign in
    login(selectedRole);
    toast({ title: "Signed in", description: `Welcome ${username || selectedRole}` });
    setUsername("");
    setPassword("");
    onClose();
    navigate("/");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl">Sign in</DialogTitle>
          <DialogDescription>Select a role and enter your credentials to continue.</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex gap-3">
            {roles.map((r) => {
              const Icon = r.icon as any;
              const active = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  aria-pressed={active}
                  className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-md transition-border duration-150 border ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:shadow-sm'
                  }`}>
                  <span className={`w-9 h-9 flex items-center justify-center rounded-md ${active ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <Icon size={16} />
                  </span>
                  <span className="text-sm font-medium">{r.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 placeholder:opacity-60"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRole(null);
                setUsername("");
                setPassword("");
                onClose();
              }}
              className="px-4 py-2"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              className={`px-5 py-2 rounded-md ${selectedRole ? 'bg-[color:var(--brand)] text-white' : 'bg-slate-300 text-slate-600 cursor-not-allowed'}`}
              disabled={!selectedRole}
            >
              Login
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
