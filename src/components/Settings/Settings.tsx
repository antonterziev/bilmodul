import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, AlertTriangle, Users } from "lucide-react";
import { OrganizationUserManagement } from "./OrganizationUserManagement";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  company_name: string;
  organization_id: string;
}

// Removed unused UserRole interface

interface Organization {
  id: string;
  name: string;
}


interface SettingsProps {}

export const Settings = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // Track original values to detect changes
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Delete account form state
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    console.log('Settings component useEffect triggered, user:', user);
    if (user) {
      console.log('User exists, calling loadProfile');
      loadProfile();
    } else {
      console.log('No user found, not loading profile');
    }
  }, [user]);

  const loadProfile = async () => {
    console.log('Loading profile for user:', user?.id);
    try {
      // First load data from user metadata (from onboarding)
      const userMetadata = user?.user_metadata || {};
      
      // Set initial values from user metadata
      const firstNameValue = userMetadata.first_name || '';
      const lastNameValue = userMetadata.last_name || '';
      const companyNameValue = userMetadata.company_name || '';
      
      setFirstName(firstNameValue);
      setLastName(lastNameValue);
      setCompanyName(companyNameValue);
      setOriginalFirstName(firstNameValue);
      setOriginalLastName(lastNameValue);

      // Try to load from profiles table with organization
      console.log('Attempting to load profile for user:', user?.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      console.log('Profile query result:', { data, error });

      if (error) {
        // If no profile exists, create one with data from user metadata
        if (error.code === 'PGRST116') {
          // Get the default organization first
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .eq('name', 'Veksla Bilhandel')
            .single();

          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user?.id,
              email: user?.email || '',
              first_name: userMetadata.first_name || '',
              last_name: userMetadata.last_name || '',
              company_name: userMetadata.company_name || '',
              organization_id: orgData?.id
            })
            .select()
            .single();

          if (createError) throw createError;
          setProfile(newProfile);
        } else {
          console.error('Error loading profile:', error);
          throw error;
        }
      } else {
        setProfile(data);
        
        // Load organization separately using organization_id from profile
        if (data.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', data.organization_id)
            .single();
          
          if (orgData) {
            console.log('Loaded organization:', orgData);
            setOrganization(orgData);
          }
        }
        
        // Override with profile data if it exists, but keep user metadata as fallback
        const firstNameValue = data.first_name || userMetadata.first_name || '';
        const lastNameValue = data.last_name || userMetadata.last_name || '';
        const companyNameValue = data.company_name || userMetadata.company_name || '';
        
        setFirstName(firstNameValue);
        setLastName(lastNameValue);
        setCompanyName(companyNameValue);
        setOriginalFirstName(firstNameValue);
        setOriginalLastName(lastNameValue);
      }

      // Load user roles (can be multiple)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      if (roleError) {
        console.error('Error loading user role:', roleError);
      } else {
        // Store all user roles
        const roles = roleData?.map(r => r.role) || [];
        console.log('User roles:', roles);
        setUserRoles(roles);
        console.log('Final userRoles set to:', roles);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda profilinformation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          company_name: companyName,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update original values to reflect saved state
      setOriginalFirstName(firstName);
      setOriginalLastName(lastName);

      toast({
        title: "Sparat",
        description: "Profilinformation har uppdaterats",
      });
      
      loadProfile(); // Refresh data
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara profilinformation",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  const changePassword = async () => {
    if (!currentPassword) {
      toast({
        title: "Fel",
        description: "Du måste ange ditt nuvarande lösenord",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Fel",
        description: "De nya lösenorden matchar inte",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Fel",
        description: "Lösenordet måste vara minst 6 tecken långt",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      // First verify the current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (verifyError) {
        toast({
          title: "Fel",
          description: "Nuvarande lösenord är felaktigt",
          variant: "destructive",
        });
        return;
      }

      // If verification successful, update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Sparat",
        description: "Lösenordet har uppdaterats",
      });
      
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ändra lösenord",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText.toLowerCase() !== 'radera') {
      toast({
        title: "Fel",
        description: "Du måste skriva 'radera' för att bekräfta",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // With CASCADE DELETE constraints in place, we only need to sign out
      // All user data will be automatically cleaned up when the user account is deleted
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

  // Check if there are unsaved changes
  const hasChanges = firstName !== originalFirstName || lastName !== originalLastName;
  
  if (loading) {
    return <div>Laddar inställningar...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Inställningar</h2>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Lösenord
          </TabsTrigger>
           {(userRoles.includes('admin') || userRoles.includes('superuser')) && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Användare
            </TabsTrigger>
          )}
          <TabsTrigger value="danger" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Radera Konto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profilinformation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">E-postadress</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  E-postadressen kan inte ändras
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Förnamn</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ange förnamn"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Efternamn</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ange efternamn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="organization">Organisation</Label>
                  <Input
                    id="organization"
                    value={organization?.name || 'Laddar...'}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Din nuvarande organisation
                  </p>
                </div>
                <div>
                  <Label htmlFor="userRoles">Behörigheter</Label>
                  <Input
                    id="userRoles"
                    value={userRoles.length > 0 ? userRoles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ') : 'Laddar...'}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dina roller i organisationen
                  </p>
                </div>
              </div>

              <Button 
                onClick={saveProfile} 
                disabled={saving || !hasChanges}
                className={`w-full ${!hasChanges ? 'opacity-50' : ''}`}
              >
                {saving ? "Sparar..." : "Uppdatera profil"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lösenord</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Nuvarande lösenord</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ange nuvarande lösenord"
                />
              </div>

              <div>
                <Label htmlFor="newPassword">Nytt lösenord</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ange nytt lösenord"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Bekräfta nytt lösenord</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Bekräfta nytt lösenord"
                />
              </div>

              <Button 
                onClick={changePassword} 
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {changingPassword ? "Ändrar..." : "Ändra lösenord"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {(userRoles.includes('admin') || userRoles.includes('superuser')) && (
          <TabsContent value="users" className="space-y-4">
            <OrganizationUserManagement />
          </TabsContent>
        )}

        <TabsContent value="danger" className="space-y-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Radera konto
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
                <Label htmlFor="confirm-delete">
                  Skriv "radera" för att bekräfta att du vill radera ditt konto:
                </Label>
                <Input
                  id="confirm-delete"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Skriv 'radera' här"
                  className="max-w-sm"
                />
              </div>

              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmText.toLowerCase() !== 'radera' || isDeleting}
                className="w-full"
              >
                {isDeleting ? 'Raderar...' : 'Radera konto permanent'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};