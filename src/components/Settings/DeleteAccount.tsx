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
    
    if (confirmText.toLowerCase() !== 'delete') {
      toast({
        title: "Fel",
        description: "Du måste skriva 'delete' för att bekräfta",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    console.log('Starting account deletion process...');
    try {
      // Delete user data first (profiles, inventory items, etc.)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user?.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      }

      const { error: inventoryError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('user_id', user?.id);

      if (inventoryError) {
        console.error('Error deleting inventory:', inventoryError);
      }

      // Delete other user-related data
      const { error: fortnoxIntError } = await supabase
        .from('fortnox_integrations')
        .delete()
        .eq('user_id', user?.id);

      const { error: syncLogError } = await supabase
        .from('fortnox_sync_log')
        .delete()
        .eq('user_id', user?.id);

      const { error: articleSyncError } = await supabase
        .from('fortnox_article_sync')
        .delete()
        .eq('user_id', user?.id);

      const { error: correctionsError } = await supabase
        .from('fortnox_corrections')
        .delete()
        .eq('user_id', user?.id);

      const { error: errorsLogError } = await supabase
        .from('fortnox_errors_log')
        .delete()
        .eq('user_id', user?.id);

      const { error: oauthStatesError } = await supabase
        .from('fortnox_oauth_states')
        .delete()
        .eq('user_id', user?.id);

      const { error: userRolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user?.id);

      // Log any errors but continue with deletion
      if (fortnoxIntError) console.error('Error deleting fortnox_integrations:', fortnoxIntError);
      if (syncLogError) console.error('Error deleting fortnox_sync_log:', syncLogError);
      if (articleSyncError) console.error('Error deleting fortnox_article_sync:', articleSyncError);
      if (correctionsError) console.error('Error deleting fortnox_corrections:', correctionsError);
      if (errorsLogError) console.error('Error deleting fortnox_errors_log:', errorsLogError);
      if (oauthStatesError) console.error('Error deleting fortnox_oauth_states:', oauthStatesError);
      if (userRolesError) console.error('Error deleting user_roles:', userRolesError);

      // Note: We cannot delete the user account from the client side
      // The user account deletion must be handled through Supabase admin API
      // For now, we'll sign the user out after deleting their data

      toast({
        title: "Data raderad",
        description: "All din data har raderats. Du loggas nu ut.",
      });

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = '/auth';
      
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
              Skriv "delete" för att bekräfta att du vill radera ditt konto:
            </label>
            <Input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Skriv 'delete' här"
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
              disabled={confirmText.toLowerCase() !== 'delete' || isDeleting}
            >
              {isDeleting ? 'Raderar...' : 'Radera konto permanent'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};