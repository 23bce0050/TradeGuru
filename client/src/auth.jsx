import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("tg_token")));

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("tg_token")) return;
    refreshUser()
      .catch(() => localStorage.removeItem("tg_token"))
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const saveSession = (data) => {
    localStorage.setItem("tg_token", data.token);
    setUser(data.user);
  };

  const login = async (email, password) => saveSession((await api.post("/auth/login", { email, password })).data);
  const signup = async (name, email, password) =>
    saveSession((await api.post("/auth/signup", { name, email, password })).data);

  const logout = () => {
    localStorage.removeItem("tg_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
