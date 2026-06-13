import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'citizen' | 'police' 
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, userId, getToken, signOut } = useClerkAuth();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncUserSession = async () => {
      // Wait until Clerk loaded state is true
      if (!isLoaded) return;

      if (!userId) {
        // No Clerk user is logged in
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Retrieve Clerk session JWT token
        const jwt = await getToken();
        if (jwt) {
          setToken(jwt);
          
          // Call the backend to sync clerk identity with database
          const syncRes = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`
            }
          });

          if (syncRes.ok) {
            const data = await syncRes.json();
            setUser(data);
          } else {
            console.error('Database synchronization failed:', syncRes.statusText);
            setUser(null);
            setToken(null);
          }
        } else {
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error('Error during Clerk-database session sync:', err);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    syncUserSession();
  }, [isLoaded, userId, getToken]);

  useEffect(() => {
    if (!userId) return;

    // Periodically refresh the token every 50 seconds to keep it fresh
    const interval = setInterval(async () => {
      try {
        const freshToken = await getToken();
        if (freshToken) {
          setToken(freshToken);
        }
      } catch (err) {
        console.error('Error refreshing token in interval:', err);
      }
    }, 50000);

    return () => clearInterval(interval);
  }, [userId, getToken]);

  const logout = async () => {
    try {
      setLoading(true);
      await signOut();
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
