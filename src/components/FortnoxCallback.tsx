
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const FortnoxCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Ansluter till Fortnox...');

  useEffect(() => {
    console.log('FortnoxCallback component mounted');
    console.log('Current URL:', window.location.href);
    
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle error from Fortnox
      if (error) {
        console.error('Fortnox OAuth error:', { error, errorDescription });
        setStatus('error');
        setMessage(`Fel vid anslutning: ${errorDescription || error}`);
        toast({
          title: "Anslutning misslyckad",
          description: `Fel vid anslutning: ${errorDescription || error}`,
          variant: "destructive",
        });
        setTimeout(() => navigate('/dashboard'), 5000);
        return;
      }

      if (!code || !state) {
        console.error('Missing code or state in OAuth callback');
        setStatus('error');
        setMessage('Felaktig återkallnings-URL. Saknar auktoriseringskod.');
        toast({
          title: "Anslutning misslyckad",
          description: 'Felaktig återkallnings-URL. Saknar auktoriseringskod.',
          variant: "destructive",
        });
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      if (!user) {
        console.error('User not authenticated during OAuth callback');
        setStatus('error');
        setMessage('Du måste vara inloggad för att slutföra anslutningen.');
        toast({
          title: "Anslutning misslyckad",
          description: 'Du måste vara inloggad för att slutföra anslutningen.',
          variant: "destructive",
        });
        setTimeout(() => navigate('/login-or-signup'), 3000);
        return;
      }

      try {
        console.log('Calling Fortnox OAuth function to exchange code for tokens...', {
          action: 'handle_callback',
          code,
          state,
          user_id: user.id
        });
        
        const { data, error: functionError } = await supabase.functions.invoke('fortnox-oauth', {
          body: { 
            action: 'handle_callback',
            code,
            state,
            user_id: user.id
          }
        });

        console.log('Fortnox OAuth function response:', { data, error: functionError });

        if (functionError) {
          console.error('Function error details:', {
            message: functionError.message,
            status: functionError.status,
            details: functionError
          });
          setStatus('error');
          setMessage(`Ett fel uppstod: ${functionError.message}`);
          toast({
            title: "Anslutning misslyckad",
            description: `Ett fel uppstod: ${functionError.message}`,
            variant: "destructive",
          });
          setTimeout(() => window.close(), 5000);
          return;
        }

        // Check if the response indicates success
        if (data?.success) {
          console.log('Fortnox integration successful');
          setStatus('success');
          setMessage('Fortnox-anslutning lyckad! Stänger fönstret...');
          toast({
            title: "Anslutning lyckad!",
            description: 'Fortnox-anslutning lyckad!',
          });
          setTimeout(() => window.close(), 2000);
        } else {
          // Handle specific error from the edge function
          const errorMessage = data?.error || 'Okänt fel vid anslutning till Fortnox';
          const technicalDetails = data?.technical_details;
          
          console.error('OAuth callback failed:', {
            error: errorMessage,
            technical_details: technicalDetails
          });
          
          setStatus('error');
          setMessage(errorMessage);
          
          // Show detailed error in toast for debugging
          toast({
            title: "Anslutning misslyckad",
            description: errorMessage,
            variant: "destructive",
          });
          
          // Log technical details if available
          if (technicalDetails) {
            console.error('Technical details:', technicalDetails);
          }
          
          setTimeout(() => window.close(), 5000);
        }

      } catch (error: any) {
        console.error('OAuth callback error details:', {
          error,
          message: error?.message,
          stack: error?.stack
        });
        setStatus('error');
        setMessage(`Ett fel uppstod vid anslutning till Fortnox: ${error?.message || 'Okänt fel'}`);
        toast({
          title: "Anslutning misslyckad",
          description: `Ett fel uppstod vid anslutning till Fortnox: ${error?.message || 'Okänt fel'}`,
          variant: "destructive",
        });
        setTimeout(() => window.close(), 5000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, user, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-6 max-w-md">
        {status === 'loading' && (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        )}
        
        {status === 'success' && (
          <div className="text-green-600 text-5xl">✓</div>
        )}
        
        {status === 'error' && (
          <div className="text-red-600 text-5xl">✗</div>
        )}
        
        <h1 className="text-2xl font-bold">
          {status === 'loading' && 'Ansluter till Fortnox'}
          {status === 'success' && 'Anslutning lyckad!'}
          {status === 'error' && 'Anslutning misslyckad'}
        </h1>
        
        <p className="text-muted-foreground">{message}</p>
        
        {status === 'error' && (
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Tillbaka till översikten
            </button>
            <p className="text-sm text-muted-foreground">
              Tips: Kontrollera att redirect URI i Fortnox-appen är korrekt inställd till: https://lagermodulen.se/fortnox-callback
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FortnoxCallback;
