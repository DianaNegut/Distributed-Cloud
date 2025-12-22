import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [pod, setPod] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // La montare, verifică dacă există sesiune salvată
  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      verifySession(token);
    } else {
      setLoading(false);
    }
  }, []);

  // Verifică sesiunea
  const verifySession = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': token
        }
      });

      setUser(response.data.user);
      setPod(response.data.pod);
      setSessionToken(token);
      localStorage.setItem('sessionToken', token);
    } catch (error) {
      console.error('Session verification failed:', error);
      localStorage.removeItem('sessionToken');
      setUser(null);
      setPod(null);
      setSessionToken(null);
    } finally {
      setLoading(false);
    }
  };

  // Înregistrare
  const register = async (username, password, email = '', name = '', description = '') => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/register`,
        { username, password, email, name, description },
        { headers: { 'x-api-key': API_KEY } }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  };

  // Login
  const login = async (username, password) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/login`,
        { username, password },
        { headers: { 'x-api-key': API_KEY } }
      );

      const { session } = response.data;
      setUser({
        username: session.username,
        email: session.email,
        role: session.role,
        podId: session.podId,
        webId: session.webId
      });
      setSessionToken(session.token);
      localStorage.setItem('sessionToken', session.token);

      // Încarcă detalii POD
      await loadPodDetails();

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      if (sessionToken) {
        await axios.post(
          `${API_URL}/auth/logout`,
          {},
          {
            headers: {
              'x-api-key': API_KEY,
              'x-session-token': sessionToken
            }
          }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setPod(null);
      setSessionToken(null);
      localStorage.removeItem('sessionToken');
    }
  };

  // Încarcă detalii POD
  const loadPodDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken || localStorage.getItem('sessionToken')
        }
      });

      setPod(response.data.pod);
    } catch (error) {
      console.error('Error loading POD details:', error);
    }
  };

  const value = {
    user,
    pod,
    sessionToken,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    register,
    login,
    logout,
    loadPodDetails
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
