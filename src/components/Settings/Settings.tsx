import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Settings as SettingsIcon, ExternalLink } from "lucide-react";
import { FortnoxIntegration } from "./FortnoxIntegration";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  company_name: string;
}

interface SettingsProps {}

export const Settings = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
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

      // Try to load from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        // If no profile exists, create one with data from user metadata
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user?.id,
              email: user?.email || '',
              first_name: userMetadata.first_name || '',
              last_name: userMetadata.last_name || '',
              company_name: userMetadata.company_name || ''
            })
            .select()
            .single();

          if (createError) throw createError;
          setProfile(newProfile);
        } else {
          throw error;
        }
      } else {
        setProfile(data);
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

  // Check if there are unsaved changes
  const hasChanges = firstName !== originalFirstName || lastName !== originalLastName;
  
  if (loading) {
    return <div>Laddar inställningar...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Inställningar</h2>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profilinställningar
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Lösenord
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
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

              <div>
                <Label htmlFor="companyName">Företagsnamn</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  disabled
                  className="bg-muted"
                  placeholder="Företagsnamn från registrering"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Företagsnamnet kan inte ändras efter registrering
                </p>
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

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Ändra lösenord</CardTitle>
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


      </Tabs>
    </div>
  );
};