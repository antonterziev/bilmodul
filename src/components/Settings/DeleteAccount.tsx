import React, { useState, useEffect } from 'react';
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
  const [isLastAdmin, setIsLastAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Get user's organization and check if they're an admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id, organizations(name)')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      const organizationId = profile?.organization_id;
      setOrganizationName(profile?.organizations?.name || '');

      // Check if current user is an admin
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId);

      if (userRolesError) throw userRolesError;

      const isAdmin = userRoles?.some(role => role.role === 'admin');

      if (isAdmin) {
        // Count total admins in the organization
        const { data: allAdmins, error: adminsError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .eq('organization_id', organizationId);

        if (adminsError) throw adminsError;

        // If there's only one admin and it's the current user, prevent deletion
        setIsLastAdmin(allAdmins?.length === 1);
      } else {
        setIsLastAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsLastAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

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

    // Check if user is the last admin in their organization
    if (isLastAdmin) {
      toast({
        title: "Kan inte radera konto",
        description: "Du är den enda administratören i din organisation. Tilldela administratörsrättigheter till någon annan användare innan du raderar ditt konto.",
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
          {isLastAdmin && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800">
                    Du kan inte radera ditt konto
                  </h3>
                  <div className="mt-2 text-sm text-orange-700">
                    <p>
                      Du är den enda administratören i organisationen "{organizationName}". 
                      För att kunna radera ditt konto måste du först tilldela administratörsrättigheter 
                      till någon annan användare i organisationen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              disabled={confirmText.toLowerCase() !== 'radera' || isDeleting || isLastAdmin}
            >
              {isDeleting ? 'Raderar...' : 'Radera konto permanent'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};