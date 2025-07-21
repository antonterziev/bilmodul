
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const FortnoxCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Ansluter till Fortnox...');

  useEffect(() => {
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
        setTimeout(() => navigate('/dashboard'), 5000);
        return;
      }

      if (!code || !state) {
        console.error('Missing code or state in OAuth callback');
        setStatus('error');
        setMessage('Felaktig återkallnings-URL. Saknar auktoriseringskod.');
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      if (!user) {
        console.error('User not authenticated during OAuth callback');
        setStatus('error');
        setMessage('Du måste vara inloggad för att slutföra anslutningen.');
        setTimeout(() => navigate('/login-or-signup'), 3000);
        return;
      }

      try {
        console.log('Calling Fortnox OAuth function to exchange code for tokens...');
        const { data, error: functionError } = await supabase.functions.invoke('fortnox-oauth', {
          body: { 
            action: 'handle_callback',
            code,
            state,
            user_id: user.id
          }
        });

        if (functionError) {
          console.error('Function error:', functionError);
          throw functionError;
        }

        if (!data?.success) {
          console.error('OAuth callback failed:', data);
          throw new Error('OAuth callback failed');
        }

        console.log('Fortnox integration successful');
        setStatus('success');
        setMessage('Fortnox-anslutning lyckad! Omdirigerar till översikten...');
        setTimeout(() => navigate('/dashboard'), 2000);

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('Ett fel uppstod vid anslutning till Fortnox. Försök igen.');
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, user]);

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
          <button 
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Tillbaka till översikten
          </button>
        )}
      </div>
    </div>
  );
};

export default FortnoxCallback;
