
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type User = {
  username: string;
} | null;

type AuthContextType = {
  user: User;
  isAuthenticated: boolean;
  login: (username: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in on mount
    const storedAuth = localStorage.getItem("nawitech-auth");
    if (storedAuth) {
      try {
        const userData = JSON.parse(storedAuth);
        setUser({ username: userData.username });
      } catch (error) {
        localStorage.removeItem("nawitech-auth");
      }
    }
  }, []);

  const login = (username: string) => {
    setUser({ username });
    localStorage.setItem("nawitech-auth", JSON.stringify({ username }));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("nawitech-auth");
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
