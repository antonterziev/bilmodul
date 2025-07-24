
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const FortnoxCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processar anslutning...');

  useEffect(() => {
    
    const handleCallback = () => {
      const statusParam = searchParams.get('status');
      const messageParam = searchParams.get('message');

      

      if (statusParam === 'success') {
        setStatus('success');
        setMessage(messageParam || 'Fortnox-anslutning lyckad!');
        toast({
          title: "Anslutning lyckad!",
          description: messageParam || 'Fortnox-anslutning lyckad!',
        });
        // Close the window after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else if (statusParam === 'error') {
        setStatus('error');
        setMessage(messageParam || 'Ett okänt fel uppstod');
        toast({
          title: "Anslutning misslyckad",
          description: messageParam || 'Ett okänt fel uppstod',
          variant: "destructive",
        });
        // Close the window after a longer delay for error messages
        setTimeout(() => {
          window.close();
        }, 5000);
      } else {
        // If no status parameter, this might be an old-style callback
        // Check for code parameter to determine if it's a callback
        const code = searchParams.get('code');
        if (code) {
          setStatus('error');
          setMessage('Anslutningen kunde inte slutföras. Försök igen.');
          toast({
            title: "Anslutning misslyckad",
            description: 'Anslutningen kunde inte slutföras. Försök igen.',
            variant: "destructive",
          });
          setTimeout(() => {
            window.close();
          }, 5000);
        } else {
          // No callback parameters, redirect to dashboard
          navigate('/dashboard');
        }
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

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
          {status === 'loading' && 'Processar anslutning'}
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
              Stänger automatiskt om 5 sekunder...
            </p>
          </div>
        )}
        
        {status === 'success' && (
          <p className="text-sm text-muted-foreground">
            Stänger automatiskt om 2 sekunder...
          </p>
        )}
      </div>
    </div>
  );
};

export default FortnoxCallback;
