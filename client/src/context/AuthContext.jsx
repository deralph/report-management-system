import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
// Create axios instance with base URL

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 🔑 Don't set Content-Type manually for FormData
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);



export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLoggedIn();
  }, []);

  const checkLoggedIn = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await api.get('/api/auth/me');
        setUser(response.data.data.user);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await api.post('/api/auth/login', credentials);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.data.user);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to login');
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.data.user);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to register');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    api // Export the axios instance for other components to use
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};