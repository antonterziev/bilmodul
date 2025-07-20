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
        console.log('Auth state change:', event, !!session);
        
        if (session) {
          // Only validate session on sign-in, not on every auth state change
          if (event === 'SIGNED_IN') {
            try {
              const isValid = await validateUserSession(session);
              if (!isValid) {
                console.error('Invalid session detected, signing out');
                await supabase.auth.signOut({ scope: 'global' });
                setSession(null);
                setUser(null);
                setIsLoading(false);
                return;
              }
            } catch (error) {
              console.error('Session validation error:', error);
              // Don't block on validation errors - proceed with session
            }
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', !!session);
      
      if (session) {
        try {
          // Quick validation for existing sessions
          const isValid = await validateUserSession(session);
          if (!isValid) {
            console.error('Invalid existing session detected, signing out');
            await supabase.auth.signOut({ scope: 'global' });
            setSession(null);
            setUser(null);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Session validation error:', error);
          // Don't block on validation errors - proceed with session
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
      // Simple validation with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Validation timeout')), 3000)
      );
      
      const validationPromise = supabase
        .from('profiles')
        .select('user_id, email')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const { data: profile, error } = await Promise.race([validationPromise, timeoutPromise]) as any;
        
      if (error) {
        console.error('Profile validation failed:', error);
        return true; // Allow login even if validation fails
      }
      
      // If profile doesn't exist, that's okay for new users
      if (!profile) {
        console.log('No profile found for user, allowing login');
        return true;
      }
      
      // Check if email matches (optional check)
      if (profile.email && profile.email !== session.user.email) {
        console.error('Email mismatch detected:', {
          sessionEmail: session.user.email,
          profileEmail: profile.email
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return true; // Allow login even if validation fails due to network issues
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