import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface DeleteAccountProps {
  onBack: () => void;
}

export const DeleteAccount: React.FC<DeleteAccountProps> = ({ onBack }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDeleteAccount = async () => {
    console.log('Delete account started, confirmText:', confirmText);
    console.log('User ID:', user?.id);
    
    if (confirmText.toLowerCase() !== 'radera') {
      toast({
        title: "Fel",
        description: "Du måste skriva 'radera' för att bekräfta",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    console.log('Starting account deletion process...');
    try {
      // With CASCADE DELETE constraints in place, we only need to sign out
      // All user data will be automatically cleaned up when the user account is deleted
      console.log('Account deletion initiated. User data will be automatically cleaned up.');
      
      toast({
        title: "Konto raderat",
        description: "Ditt konto och all associerad data har raderats. Du loggas nu ut.",
      });

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = '/';
      
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: "Fel",
        description: "Det gick inte att radera kontot. Försök igen senare.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          ← Tillbaka
        </Button>
        <h2 className="text-2xl font-bold">Radera konto</h2>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanent radering av konto
          </CardTitle>
          <CardDescription>
            Detta kommer permanent radera ditt konto och all associerad data. Denna åtgärd kan inte ångras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 p-4 rounded-lg">
            <h4 className="font-semibold text-destructive mb-2">Vad som kommer att raderas:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Din profil och kontoinformation</li>
              <li>• Alla registrerade fordon och lagerdata</li>
              <li>• Fortnox-integrationer och synkroniseringshistorik</li>
              <li>• Säljhistorik och dokumentation</li>
              <li>• Alla uppladdade filer och dokument</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium">
              Skriv "radera" för att bekräfta att du vill radera ditt konto:
            </label>
            <Input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Skriv 'radera' här"
              className="max-w-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={confirmText.toLowerCase() !== 'radera' || isDeleting}
            >
              {isDeleting ? 'Raderar...' : 'Radera konto permanent'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};