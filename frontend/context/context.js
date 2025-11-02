'use client';
import { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [files , setFiles] = useState([]);
  const [folders , setFolders] = useState([]);
  const [moveMode , setMoveMode] = useState(false);

  const refreshUser = async () => {
    if (!token) return null;
    try {
      const res = await axios.get("http://127.0.0.1:8000/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = res.data?.user || res.data;
      setUser(u);
      return u;
    } catch (e) {
      return null;
    }
  };

  // Restore from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    const storedLoggedIn = localStorage.getItem("isLoggedIn");

    if (storedUser && storedToken && storedLoggedIn === "true") {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      setIsLoggedIn(true);
    }

    setHydrated(true); // Now context is ready
  }, []);

  // Keep localStorage synced
  useEffect(() => {
    if (hydrated) {
      if (user) localStorage.setItem("user", JSON.stringify(user));
      if (token) localStorage.setItem("token", token);
      localStorage.setItem("isLoggedIn", isLoggedIn);
    }
  }, [user, token, isLoggedIn, hydrated]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        token,
        setToken,
        isLoggedIn,
        setIsLoggedIn,
        hydrated,
        setHydrated,
        files,
        setFiles,
        folders,
        setFolders,
        moveMode,
        setMoveMode,
        refreshUser
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
