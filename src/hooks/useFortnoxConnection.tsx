import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFortnoxConnection = () => {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { toast } = useToast();

  const handleFortnoxError = useCallback(async (error: any) => {
    // Check if this is a token expiration error
    if (error?.requiresReconnection || 
        (error?.message && error.message.includes('Fortnox-anslutningen har gått ut'))) {
      
      toast({
        title: "Fortnox-anslutning utgången",
        description: "Din Fortnox-anslutning har gått ut. Du kommer att omdirigeras för att ansluta igen.",
        variant: "destructive",
      });

      // Redirect to integrations page after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard?tab=settings&subtab=integrations';
      }, 2000);
      
      return true; // Indicates this was a reconnection error
    }
    
    // Check if this is an account validation error
    if (error?.requiresAccountFix || error?.invalidAccounts) {
      toast({
        title: "Kontokonfiguration problem",
        description: error.error || error.message || "Kontrollera dina kontomappningar i inställningarna.",
        variant: "destructive",
        duration: 10000, // Show longer for complex error messages
      });
      
      return true; // Indicates this was an account validation error
    }
    
    return false; // Not a reconnection error
  }, [toast]);

  const reconnectFortnox = useCallback(async (userId: string) => {
    setIsReconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { 
          action: 'get_auth_url',
          user_id: userId
        }
      });

      if (error) throw error;

      if (!data?.auth_url) {
        throw new Error('No auth URL received');
      }

      // Open Fortnox OAuth in popup
      const popup = window.open(
        data.auth_url, 
        'fortnox-oauth', 
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
      
      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Refresh the page to check for updated connection status
          window.location.reload();
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Fortnox reconnection error:', error);
      toast({
        title: "Anslutningsfel",
        description: "Kunde inte ansluta till Fortnox. Försök igen senare.",
        variant: "destructive",
      });
    } finally {
      setIsReconnecting(false);
    }
  }, [toast]);

  return {
    isReconnecting,
    handleFortnoxError,
    reconnectFortnox
  };
};