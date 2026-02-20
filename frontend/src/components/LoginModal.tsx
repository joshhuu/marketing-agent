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

  const roles = [
    {
      id: "viewer" as UserRole,
      name: "Viewer",
      icon: Eye,
      description: "Read-only access to campaigns and prospects",
      permissions: [
        "View campaign history",
        "View prospect details",
        "View analytics dashboards",
        "No editing or creation allowed",
      ],
      color: "blue",
    },
    {
      id: "user" as UserRole,
      name: "User",
      icon: User,
      description: "Create and manage your marketing campaigns",
      permissions: [
        "All Viewer permissions",
        "Create new campaigns",
        "Approve prospects",
        "Generate personalized content",
        "Delete campaigns",
      ],
      color: "purple",
    },
    {
      id: "admin" as UserRole,
      name: "Admin",
      icon: Shield,
      description: "Full system access with analytics and monitoring",
      permissions: [
        "All User permissions",
        "View API call analytics",
        "Access audit logs",
        "Monitor system performance",
        "View prompt history",
      ],
      color: "red",
    },
  ];

  const handleLogin = () => {
    if (!selectedRole) {
      toast({
        title: "Select a role",
        description: "Please select a user role to continue",
        variant: "destructive",
      });
      return;
    }

    login(selectedRole);
    toast({
      title: "Login successful",
      description: `Welcome! You are logged in as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`,
    });
    onClose();
    navigate("/");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          <DialogDescription>
            Choose the access level that matches your responsibilities. Each role has different
            permissions and capabilities.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;

            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`
                  p-6 rounded-lg border-2 transition-all text-left
                  ${
                    isSelected
                      ? `border-${role.color}-500 bg-${role.color}-50 dark:bg-${role.color}-950`
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                <div
                  className={`
                  w-12 h-12 rounded-lg flex items-center justify-center mb-4
                  ${
                    isSelected
                      ? `bg-${role.color}-500`
                      : role.color === "blue"
                        ? "bg-blue-500"
                        : role.color === "purple"
                          ? "bg-purple-500"
                          : "bg-red-500"
                  }
                `}
                >
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{role.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {role.description}
                </p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Permissions:
                  </p>
                  <ul className="space-y-1">
                    {role.permissions.map((permission, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-gray-600 dark:text-gray-400 flex items-start"
                      >
                        <span className="mr-2">•</span>
                        <span>{permission}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isSelected && (
                  <div className="mt-4 text-center">
                    <span
                      className={`
                      inline-block px-3 py-1 rounded-full text-xs font-semibold
                      ${
                        role.color === "blue"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : role.color === "purple"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }
                    `}
                    >
                      Selected
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center">
            <Shield className="mr-2" size={16} />
            Security & Compliance
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• All actions are logged for audit compliance</li>
            <li>• Data is encrypted at rest and in transit</li>
            <li>• Role-based access ensures data privacy</li>
            <li>• AI prompts are tracked for transparency</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLogin}
            disabled={!selectedRole}
            className={`
              ${
                selectedRole === "viewer"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : selectedRole === "user"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : selectedRole === "admin"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-gray-600 hover:bg-gray-700"
              }
            `}
          >
            Continue as {selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : "..."}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
