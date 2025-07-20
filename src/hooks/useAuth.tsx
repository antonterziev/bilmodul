import { useState, useEffect, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          // Validate the session before setting state
          const isValid = await validateUserSession(session);
          if (!isValid) {
            console.error('Invalid session detected, signing out');
            // Force sign out if session validation fails
            await supabase.auth.signOut({ scope: 'global' });
            setSession(null);
            setUser(null);
            setIsLoading(false);
            return;
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Validate the existing session
        const isValid = await validateUserSession(session);
        if (!isValid) {
          console.error('Invalid existing session detected, signing out');
          await supabase.auth.signOut({ scope: 'global' });
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Clean up auth state first
      const cleanupAuthState = () => {
        // Remove all Supabase auth keys from localStorage
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
        // Remove from sessionStorage if in use
        Object.keys(sessionStorage || {}).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      };

      // Clean up state
      cleanupAuthState();
      
      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
        console.warn('Sign out error:', err);
      }
      
      // Force page reload for a clean state
      window.location.href = "/login-or-signup";
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      window.location.href = "/login-or-signup";
    }
  };

  const validateUserSession = async (session: any) => {
    if (!session?.user?.id) return false;
    
    try {
      // Verify the user exists in our profiles table and matches
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
        
      if (error || !profile) {
        console.error('Profile validation failed:', error);
        return false;
      }
      
      // Check if email matches
      if (profile.email !== session.user.email) {
        console.error('Email mismatch detected:', {
          sessionEmail: session.user.email,
          profileEmail: profile.email
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut, isLoading }}>
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