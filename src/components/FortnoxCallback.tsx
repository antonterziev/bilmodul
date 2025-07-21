
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const FortnoxCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processar anslutning...');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    console.log('FortnoxCallback component mounted');
    console.log('Current URL:', window.location.href);
    console.log('Search params:', Object.fromEntries(searchParams.entries()));
    
    const handleCallback = async () => {
      // Prevent multiple executions
      if (isProcessing) {
        console.log('Already processing callback, skipping...');
        return;
      }
      
      setIsProcessing(true);
      const statusParam = searchParams.get('status');
      const messageParam = searchParams.get('message');

      console.log('Callback parameters:', { statusParam, messageParam });

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
        // If no status parameter, this might be an OAuth callback with code
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        
        if (error) {
          console.error('OAuth error from Fortnox:', error);
          setStatus('error');
          setMessage('Fortnox avbröt anslutningen. Försök igen.');
          toast({
            title: "Anslutning avbruten",
            description: 'Fortnox avbröt anslutningen. Försök igen.',
            variant: "destructive",
          });
          setTimeout(() => {
            window.close();
          }, 5000);
        } else if (code && state) {
          // This is the actual OAuth callback - add a small delay before processing
          console.log('OAuth callback received, waiting 1 second before processing...');
          setMessage('Slutför anslutning...');
          
          setTimeout(() => {
            console.log('Processing OAuth callback after delay');
            // The edge function will handle the token exchange
            // Just show a processing message and let the redirect happen
            setMessage('Väntar på svar från Fortnox...');
          }, 1000);
          
          // Set a timeout to show error if processing takes too long
          setTimeout(() => {
            if (status === 'loading') {
              setStatus('error');
              setMessage('Anslutningen tog för lång tid. Stäng detta fönster och försök igen.');
              toast({
                title: "Timeout",
                description: 'Anslutningen tog för lång tid. Försök igen.',
                variant: "destructive",
              });
            }
          }, 30000); // 30 second timeout
        } else {
          // No callback parameters, redirect to dashboard
          console.log('No callback parameters, redirecting to dashboard');
          navigate('/dashboard');
        }
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast, isProcessing]);

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
            <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded">
              <p className="font-semibold">Tips för att lösa problemet:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Kontrollera att Fortnox-appen har rätt redirect URI</li>
                <li>Vänta några sekunder innan du försöker igen</li>
                <li>Stäng alla Fortnox-fönster och börja om</li>
              </ul>
            </div>
          </div>
        )}
        
        {status === 'success' && (
          <p className="text-sm text-muted-foreground">
            Stänger automatiskt om 2 sekunder...
          </p>
        )}
        
        {status === 'loading' && (
          <p className="text-sm text-muted-foreground">
            Detta kan ta upp till 30 sekunder...
          </p>
        )}
      </div>
    </div>
  );
};

export default FortnoxCallback;
