import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "admin" | "user" | "viewer";

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedRole = localStorage.getItem("userRole") as UserRole | null;
    if (storedRole && ["admin", "user", "viewer"].includes(storedRole)) {
      setUserRole(storedRole);
      setIsAuthenticated(true);
    }
  }, []);

  const login = (role: UserRole) => {
    setUserRole(role);
    setIsAuthenticated(true);
    localStorage.setItem("userRole", role);
  };

  const logout = () => {
    setUserRole(null);
    setIsAuthenticated(false);
    localStorage.removeItem("userRole");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
