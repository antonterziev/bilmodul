import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users } from "lucide-react";
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

const AVAILABLE_ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'lager', label: 'Lager' },
  { key: 'ekonomi', label: 'Ekonomi' },
  { key: 'inkop', label: 'Inköp' },
  { key: 'pakostnad', label: 'Påkostnad' },
  { key: 'forsaljning', label: 'Försäljning' }
];

export const OrganizationUserManagement = () => {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);


  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // First get current user's organization
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      
      const orgId = currentUserProfile?.organization_id;
      setCurrentUserOrgId(orgId);

      // Get all profiles in the same organization
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          first_name,
          last_name,
          organization_id,
          created_at,
          organizations!inner(id, name)
        `)
        .eq('organization_id', orgId);

      if (profilesError) throw profilesError;

      // Get user roles for all users in the organization
      const userIds = profilesData?.map(p => p.user_id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combine the data
      const formattedUsers: UserWithProfile[] = profilesData?.map((profile: any) => {
        const userRoles = rolesData?.filter(role => role.user_id === profile.user_id).map(r => r.role) || [];
        return {
          user_id: profile.user_id,
          email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          organization_name: profile.organizations.name,
          organization_id: profile.organization_id,
          roles: userRoles,
          created_at: profile.created_at
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];

      setUsers(formattedUsers);
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

  const toggleUserRole = async (userId: string, role: string, organizationId: string) => {
    setUpdating(userId);
    try {
      const userToUpdate = users.find(u => u.user_id === userId);
      if (!userToUpdate) return;

      const hasRole = userToUpdate.roles.includes(role);

      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role as any)
          .eq('organization_id', organizationId);

        if (error) throw error;
      } else {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: role as any,
            organization_id: organizationId
          } as any);

        if (error) throw error;
      }

      // Update local state
      setUsers(users.map(user => {
        if (user.user_id === userId) {
          const newRoles = hasRole 
            ? user.roles.filter(r => r !== role)
            : [...user.roles, role];
          return { ...user, roles: newRoles };
        }
        return user;
      }));

      toast({
        title: "Uppdaterat",
        description: `Användarens ${role} behörighet har ${hasRole ? 'tagits bort' : 'lagts till'}`
      });
    } catch (error) {
      console.error('Error toggling user role:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera användarens behörigheter",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Laddar användare...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Användare</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="space-y-4">
              {/* Matrix Header */}
              <div className="grid grid-cols-[200px_1fr] gap-4 items-center border-b pb-2">
                <div className="font-medium">Användare</div>
                <div className="grid grid-cols-6 gap-2">
                  {AVAILABLE_ROLES.map((role) => (
                    <div key={role.key} className="text-center font-medium text-sm">
                      {role.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* User Matrix */}
              {users.map((userRow) => (
                <div key={userRow.user_id} className="grid grid-cols-[200px_1fr] gap-4 items-center py-2 border-b border-muted">
                  <div>
                    <div className="font-medium">{getDisplayName(userRow)}</div>
                    <div className="text-sm text-muted-foreground">{userRow.email}</div>
                  </div>

                  <div className="grid grid-cols-6 gap-2 relative">
                    {AVAILABLE_ROLES.map((role) => (
                      <div key={role.key} className="flex justify-center">
                        <Checkbox
                          checked={userRow.roles.includes(role.key)}
                          onCheckedChange={() => toggleUserRole(userRow.user_id, role.key, userRow.organization_id)}
                          disabled={updating === userRow.user_id}
                          className="w-5 h-5"
                        />
                      </div>
                    ))}

                    {updating === userRow.user_id && (
                      <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Inga användare hittades i din organisation
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};