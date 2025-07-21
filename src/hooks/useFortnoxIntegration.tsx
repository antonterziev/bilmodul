
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

interface FortnoxIntegrationState {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  lastAttempt: number | null;
}

export const useFortnoxIntegration = () => {
  const [state, setState] = useState<FortnoxIntegrationState>({
    isConnecting: false,
    isConnected: false,
    error: null,
    lastAttempt: null
  });
  
  const { toast } = useToast();

  // Debounce the connect function to prevent rapid clicking
  const debouncedConnect = useDebounce(async () => {
    const now = Date.now();
    
    // Prevent multiple attempts within 5 seconds
    if (state.lastAttempt && (now - state.lastAttempt) < 5000) {
      console.log('Preventing rapid connection attempts');
      toast({
        title: "Vänta lite",
        description: "Vänta några sekunder innan du försöker igen.",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null,
      lastAttempt: now 
    }));

    try {
      console.log('Initiating Fortnox connection...');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Användaren är inte inloggad');
      }

      console.log('Getting auth URL for user:', user.id);

      // Get authorization URL from edge function
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: {
          action: 'get_auth_url',
          user_id: user.id
        }
      });

      if (error) {
        console.error('Error getting auth URL:', error);
        throw new Error(`Kunde inte starta anslutning: ${error.message}`);
      }

      if (!data?.auth_url) {
        console.error('No auth URL in response:', data);
        throw new Error('Ingen auktoriserings-URL mottagen från servern');
      }

      console.log('Opening Fortnox authorization window...');
      
      // Open popup window for authorization
      const popup = window.open(
        data.auth_url,
        'fortnox-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Kunde inte öppna popup-fönster. Kontrollera att popup-blockerare är inaktiverad.');
      }

      // Monitor popup window
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setState(prev => ({ 
            ...prev, 
            isConnecting: false 
          }));
          
          // Check if integration was successful
          setTimeout(() => {
            checkIntegrationStatus();
          }, 1000);
        }
      }, 1000);

      // Set timeout for popup
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
          clearInterval(checkClosed);
          setState(prev => ({ 
            ...prev, 
            isConnecting: false,
            error: 'Anslutningen tog för lång tid. Försök igen.'
          }));
        }
      }, 300000); // 5 minute timeout

    } catch (error) {
      console.error('Error connecting to Fortnox:', error);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error.message || 'Ett oväntat fel uppstod'
      }));
      
      toast({
        title: "Anslutning misslyckad",
        description: error.message || 'Ett oväntat fel uppstod',
        variant: "destructive",
      });
    }
  }, 1000); // 1 second debounce

  const connectToFortnox = useCallback(() => {
    console.log('Connect to Fortnox called');
    debouncedConnect();
  }, [debouncedConnect]);

  const checkIntegrationStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: integration } = await supabase
        .from('fortnox_integrations')
        .select('is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const isConnected = !!integration;
      
      setState(prev => ({ 
        ...prev, 
        isConnected,
        error: isConnected ? null : prev.error
      }));

      if (isConnected) {
        toast({
          title: "Anslutning lyckad!",
          description: "Fortnox är nu anslutet till ditt konto.",
        });
      }
    } catch (error) {
      console.error('Error checking integration status:', error);
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        error: null 
      }));

      toast({
        title: "Frånkopplad",
        description: "Fortnox-anslutningen har inaktiverats.",
      });
    } catch (error) {
      console.error('Error disconnecting Fortnox:', error);
      toast({
        title: "Fel vid frånkoppling",
        description: error.message || 'Kunde inte koppla från Fortnox',
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    ...state,
    connectToFortnox,
    disconnect,
    checkIntegrationStatus
  };
};
