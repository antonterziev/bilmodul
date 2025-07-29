import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
interface UserWithProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  organization_id: string;
  roles: string[];
  created_at: string;
}
const AVAILABLE_PERMISSIONS = [{
  key: 'admin',
  label: 'Admin'
}, {
  key: 'lager',
  label: 'Lager'
}, {
  key: 'ekonomi',
  label: 'Ekonomi'
}, {
  key: 'inkop',
  label: 'Inköp'
}, {
  key: 'pakostnad',
  label: 'Påkostnad'
}, {
  key: 'forsaljning',
  label: 'Försäljning'
}];
export const OrganizationUserManagement = () => {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{[userId: string]: string[]}>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadUsers();
  }, []);
  const loadUsers = async () => {
    try {
      setLoading(true);

      // First get current user's organization
      const {
        data: currentUserProfile,
        error: profileError
      } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
      if (profileError) throw profileError;
      const orgId = currentUserProfile?.organization_id;
      setCurrentUserOrgId(orgId);

      // Get all profiles in the same organization
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from('profiles').select(`
          user_id,
          email,
          first_name,
          last_name,
          organization_id,
          created_at
        `).eq('organization_id', orgId);
      if (profilesError) throw profilesError;

      // Get user permissions for all users in the organization
      const userIds = profilesData?.map(p => p.user_id) || [];
      const {
        data: permissionsData,
        error: permissionsError
      } = await supabase.from('user_permissions').select('user_id, permission').in('user_id', userIds);
      if (permissionsError) throw permissionsError;

      // Combine the data
      const formattedUsers: UserWithProfile[] = profilesData?.map((profile: any) => {
        const userPermissions = permissionsData?.filter(perm => perm.user_id === profile.user_id).map(r => r.permission) || [];
        const userData = {
          user_id: profile.user_id,
          email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          organization_name: '',
          organization_id: profile.organization_id,
          roles: userPermissions,
          created_at: profile.created_at
        };
        console.log('User data:', userData);
        return userData;
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];
      console.log('All permissions data:', permissionsData);
      console.log('Final formatted users:', formattedUsers);
      setUsers(formattedUsers);
      
      // Check if current user is admin
      const currentUserPermissions = permissionsData?.filter(perm => perm.user_id === user?.id).map(r => r.permission) || [];
      setIsCurrentUserAdmin(currentUserPermissions.includes('admin'));
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda användare",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const getDisplayName = (user: UserWithProfile) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }

    // Extract name from email if database fields are empty
    const emailPart = user.email.split('@')[0];
    const nameParts = emailPart.split('.');
    if (nameParts.length >= 2) {
      const firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
      const lastName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);
      return `${firstName} ${lastName}`;
    }
    return user.email;
  };
  const getAdminCount = () => {
    return users.filter(user => user.roles.includes('admin')).length;
  };
  const wouldRemoveLastAdmin = (userId: string, role: string) => {
    if (role === 'admin') {
      const userToUpdate = users.find(u => u.user_id === userId);
      const hasAdminRole = userToUpdate?.roles.includes('admin');
      // If user currently has admin role and there's only 1 admin total, prevent removal
      return hasAdminRole && getAdminCount() === 1;
    }
    return false;
  };
  const toggleUserRole = (userId: string, role: string) => {
    // Prevent removing the last admin
    if (wouldRemoveLastAdmin(userId, role)) {
      toast({
        title: "Fel",
        description: "Kan inte ta bort den sista administratören från organisationen",
        variant: "destructive"
      });
      return;
    }

    const userToUpdate = users.find(u => u.user_id === userId);
    if (!userToUpdate) return;

    const currentRoles = pendingChanges[userId] || userToUpdate.roles;
    const hasRole = currentRoles.includes(role);
    
    let newRoles;
    if (hasRole) {
      newRoles = currentRoles.filter(r => r !== role);
    } else {
      newRoles = [...currentRoles, role];
    }

    setPendingChanges(prev => ({
      ...prev,
      [userId]: newRoles
    }));
    
    setHasUnsavedChanges(true);
  };

  const saveChanges = async () => {
    setSaving(true);
    let hasErrors = false;

    try {
      // Process each user's role changes
      for (const [userId, newRoles] of Object.entries(pendingChanges)) {
        const userToUpdate = users.find(u => u.user_id === userId);
        if (!userToUpdate || !currentUserOrgId) continue;

        const originalRoles = userToUpdate.roles;
        const rolesToAdd = newRoles.filter(role => !originalRoles.includes(role));
        const rolesToRemove = originalRoles.filter(role => !newRoles.includes(role));

        // Remove permissions
        for (const role of rolesToRemove) {
          const { error } = await supabase
            .from('user_permissions')
            .delete()
            .eq('user_id', userId)
            .eq('permission', role as any);

          if (error) {
            console.error('Error removing role:', error);
            hasErrors = true;
          }
        }

        // Add permissions
        for (const role of rolesToAdd) {
          const { error } = await supabase
            .from('user_permissions')
            .insert({
              user_id: userId,
              permission: role as any
            } as any);

          if (error) {
            console.error('Error adding role:', error);
            hasErrors = true;
          }
        }

        // Update local state
        setUsers(prev => prev.map(user => {
          if (user.user_id === userId) {
            return { ...user, roles: newRoles };
          }
          return user;
        }));
      }

      if (!hasErrors) {
        setPendingChanges({});
        setHasUnsavedChanges(false);
        toast({
          title: "Ändringar sparade",
          description: "Behörigheterna har uppdaterats",
        });
      } else {
        toast({
          title: "Delvis fel",
          description: "Vissa ändringar kunde inte sparas",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara ändringar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setPendingChanges({});
    setHasUnsavedChanges(false);
    toast({
      title: "Ändringar borttagna",
      description: "Alla osparade ändringar har tagits bort",
    });
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    // Prevent removing the last admin
    const userToRemove = users.find(u => u.user_id === userId);
    if (userToRemove?.roles.includes('admin') && getAdminCount() === 1) {
      toast({
        title: "Fel",
        description: "Kan inte ta bort den sista administratören från organisationen",
        variant: "destructive"
      });
      return;
    }

    // Don't allow users to remove themselves
    if (userId === user?.id) {
      toast({
        title: "Fel",
        description: "Du kan inte ta bort dig själv",
        variant: "destructive"
      });
      return;
    }

    setUserToDelete({ id: userId, name: userName });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    const { id: userId, name: userName } = userToDelete;
    setUpdating(userId);
    
    try {
      // Get user's email for invitation cleanup
      const userToRemove = users.find(u => u.user_id === userId);
      const userEmail = userToRemove?.email;

      // First remove all user permissions
      const { error: permissionsError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (permissionsError) throw permissionsError;

      // Remove any accepted invitations for this user's email
      if (userEmail) {
        const { error: invitationsError } = await supabase
          .from('invitations')
          .delete()
          .eq('email', userEmail)
          .eq('organization_id', currentUserOrgId)
          .eq('status', 'accepted');

        if (invitationsError) {
          console.error('Error removing accepted invitations:', invitationsError);
          // Continue execution as this is not critical
        }
      }

      // Then remove the user's profile from the organization
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', currentUserOrgId);

      if (profileError) throw profileError;

      // Finally, delete the user from Supabase auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error('Error deleting user from auth:', authError);
        // Continue execution as the user has been removed from the organization
      }

      // Update local state
      setUsers(users.filter(u => u.user_id !== userId));

      toast({
        title: "Användare borttagen",
        description: `${userName} har tagits bort från systemet`,
      });
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort användaren",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Laddar användare...</span>
      </div>;
  }
  return <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Behörigheter</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? <div className="space-y-4">
              {/* Matrix Header */}
              <div className={`grid gap-4 items-center border-b pb-2 ${isCurrentUserAdmin ? 'grid-cols-[200px_1fr_80px]' : 'grid-cols-[200px_1fr]'}`}>
                <div className="font-medium">Namn</div>
                <div className="grid grid-cols-6 gap-2">
                  {AVAILABLE_PERMISSIONS.map(permission => <div key={permission.key} className="text-center font-medium text-sm">
                      {permission.label}
                    </div>)}
                </div>
                {isCurrentUserAdmin && <div className="font-medium text-center text-sm">Åtgärder</div>}
              </div>

              {/* User Matrix */}
              {users.map(userRow => <div key={userRow.user_id} className={`grid gap-4 items-center py-2 border-b border-muted relative ${isCurrentUserAdmin ? 'grid-cols-[200px_1fr_80px]' : 'grid-cols-[200px_1fr]'}`}>
                  <div>
                    <div className="font-medium">{getDisplayName(userRow)}</div>
                    <div className="text-sm text-muted-foreground">{userRow.email}</div>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {AVAILABLE_PERMISSIONS.map(permission => <div key={permission.key} className="flex justify-center">
                         <Checkbox 
                           checked={(pendingChanges[userRow.user_id] || userRow.roles).includes(permission.key)} 
                           onCheckedChange={() => toggleUserRole(userRow.user_id, permission.key)} 
                           disabled={updating === userRow.user_id || wouldRemoveLastAdmin(userRow.user_id, permission.key)} 
                           className="w-5 h-5" 
                           title={wouldRemoveLastAdmin(userRow.user_id, permission.key) ? "Kan inte ta bort den sista administratören" : undefined} 
                         />
                      </div>)}
                  </div>

                  {isCurrentUserAdmin && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(userRow.user_id, getDisplayName(userRow))}
                        disabled={updating === userRow.user_id || userRow.user_id === user?.id}
                        className="text-destructive hover:text-destructive"
                        title={userRow.user_id === user?.id ? "Du kan inte ta bort dig själv" : "Ta bort användare"}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {updating === userRow.user_id && <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>}
                </div>)}
              
              {/* Save/Discard buttons - always visible */}
              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={saveChanges}
                  disabled={saving || !hasUnsavedChanges}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Sparar...
                    </>
                  ) : (
                    'Spara ändringar'
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={discardChanges}
                  disabled={saving || !hasUnsavedChanges}
                >
                  Ångra
                </Button>
              </div>
            </div> : <p className="text-muted-foreground text-center py-8">
              Inga användare hittades i din organisation
            </p>}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort användare</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{userToDelete?.name}</strong> från systemet? 
              Denna åtgärd kommer att permanent ta bort användarens konto och alla relaterade data.
              <br /><br />
              <strong>Denna åtgärd kan inte ångras.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort användare
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};