// src/hooks/useSessionKeepAlive.ts
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

export const useSessionKeepAlive = () => {
  const isRefreshing = useRef(false);
  
  useEffect(() => {
    const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
    
    const refreshSession = async () => {
      // Prevent concurrent refresh attempts
      if (isRefreshing.current) {
        console.log('Refresh already in progress, skipping...');
        return;
      }
      
      try {
        isRefreshing.current = true;
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          // Check if token actually needs refreshing (expires in less than 60 seconds)
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
          
          if (timeUntilExpiry < 60) {
            console.log('Token expiring soon, refreshing...');
            const { error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('Session refresh failed:', refreshError);
              // If refresh fails, user might need to re-login
              if (refreshError.message.includes('Refresh Token Not Found')) {
                // Clear invalid session
                await supabase.auth.signOut();
              }
            } else {
              console.log('Session refreshed successfully');
            }
          } else {
            console.log(`Session still valid for ${timeUntilExpiry} seconds`);
          }
        }
      } catch (error) {
        console.error('Session keep-alive error:', error);
      } finally {
        isRefreshing.current = false;
      }
    };

    // Don't refresh immediately on mount - let AuthContext handle initial session
    const intervalId = setInterval(refreshSession, REFRESH_INTERVAL);

    // Refresh on window focus
    const handleFocus = () => {
      const rememberMe = localStorage.getItem('smartcfo-remember-me');
      if (rememberMe === 'true') {
        // Debounce focus refresh
        setTimeout(refreshSession, 1000);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
};