// src/hooks/useSessionKeepAlive.ts
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const useSessionKeepAlive = () => {
  useEffect(() => {
    // Set up interval to refresh session every 30 minutes
    // (Supabase JWT tokens expire after 1 hour by default)
    const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    const refreshSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          // Only refresh if we have an active session
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Session refresh failed:', refreshError);
          } else {
            console.log('Session refreshed successfully');
          }
        }
      } catch (error) {
        console.error('Session keep-alive error:', error);
      }
    };

    // Initial refresh
    refreshSession();

    // Set up interval
    const intervalId = setInterval(refreshSession, REFRESH_INTERVAL);

    // Also refresh on window focus (when user returns to tab)
    const handleFocus = () => {
      const rememberMe = localStorage.getItem('smartcfo-remember-me');
      if (rememberMe === 'true') {
        refreshSession();
      }
    };

    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
};  