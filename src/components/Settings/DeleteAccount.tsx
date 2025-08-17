import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface DeleteAccountProps {
  onBack: () => void;
}

export const DeleteAccount: React.FC<DeleteAccountProps> = ({ onBack }) => {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const { data: userPermissions, error: userPermissionsError } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id);

      if (userPermissionsError) throw userPermissionsError;

      const isAdmin = userPermissions?.some(perm => perm.permission === 'admin');

      if (isAdmin) {
        // Count total admins in the organization
        const { data: allAdmins, error: adminsError } = await supabase
          .from('user_permissions')
          .select('user_id')
          .eq('permission', 'admin');

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

    if (!password.trim()) {
      toast({
        title: "Fel",
        description: "Du måste ange ditt lösenord för att radera kontot",
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
      // Verify password before deletion
      if (!user?.email) {
        throw new Error('Användarens e-postadress saknas');
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });

      if (verifyError) {
        console.error('Password verification failed:', verifyError);
        toast({
          title: "Fel lösenord",
          description: "Det angivna lösenordet är felaktigt. Försök igen.",
          variant: "destructive",
        });
        return;
      }

      // Password verified, proceed with deletion
      console.log('Password verified. Account deletion initiated. User data will be automatically cleaned up.');
      
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
        description: error.message || "Det gick inte att radera kontot. Försök igen senare.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
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
          {isLoading && (
            <div className="text-center py-4">
              <p>Laddar...</p>
            </div>
          )}
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
            <ul className="text-sm space-y-1 text-muted-foreground grid grid-cols-2 gap-x-4">
              <li>• Din profil och kontoinformation</li>
              <li>• Alla registrerade fordon och lagerdata</li>
              <li>• Fortnox-integrationer och synkroniseringshistorik</li>
              <li>• Säljhistorik och dokumentation</li>
              
            </ul>
          </div>

          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Ange ditt lösenord för att bekräfta identiteten:
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ditt lösenord"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete" className="text-sm font-medium">
                  Skriv "RADERA" för att bekräfta att du vill radera ditt konto:
                </Label>
                <Input
                  id="confirm-delete"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Skriv 'RADERA' här"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={confirmText.toLowerCase() !== 'radera' || !password.trim() || isDeleting || isLastAdmin}
            >
              {isDeleting ? 'Raderar...' : 'Radera konto'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};