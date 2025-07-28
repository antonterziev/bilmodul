import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Building, Plus, RefreshCw, ChevronDown, ChevronRight, Trash2 } from "lucide-react";

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

interface Organization {
  id: string;
  name: string;
  created_at: string;
  user_count: number;
  users: UserWithProfile[];
}

const AVAILABLE_ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'lager', label: 'Lager' },
  { key: 'ekonomi', label: 'Ekonomi' },
  { key: 'inkop', label: 'Inköp' },
  { key: 'pakostnad', label: 'Påkostnad' },
  { key: 'forsaljning', label: 'Försäljning' }
];

export const UserManagement = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizations();
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: roleData } = await supabase.rpc('get_current_user_role');
      setUserRole(roleData);
    } catch (error) {
      console.error('Error checking user role:', error);
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

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Get organizations with user count
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          created_at,
          profiles(count)
        `)
        .order('name');

      if (orgError) throw orgError;

      // Get all profiles with their roles and organizations
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
        `);

      if (profilesError) throw profilesError;

      // Get user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Group users by organization
      const formattedOrgs: Organization[] = orgData?.map((org: any) => {
        const orgUsers = profilesData
          ?.filter((profile: any) => profile.organization_id === org.id)
          .map((profile: any) => {
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
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];

        return {
          id: org.id,
          name: org.name,
          created_at: org.created_at,
          user_count: orgUsers.length,
          users: orgUsers
        };
      }) || [];

      setOrganizations(formattedOrgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda organisationer och användare",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserRole = async (userId: string, role: string, organizationId: string) => {
    setUpdating(userId);
    try {
      // Check if user already has this role
      const user = organizations
        .flatMap(org => org.users)
        .find(u => u.user_id === userId);
      
      if (!user) return;

      const hasRole = user.roles.includes(role);

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
      setOrganizations(organizations.map(org => ({
        ...org,
        users: org.users.map(user => {
          if (user.user_id === userId) {
            const newRoles = hasRole 
              ? user.roles.filter(r => r !== role)
              : [...user.roles, role];
            return { ...user, roles: newRoles };
          }
          return user;
        })
      })));

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

  const updateUserOrganization = async (userId: string, newOrgId: string) => {
    setUpdating(userId);
    try {
      // Update profile organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrgId })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Update user role organization
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ organization_id: newOrgId })
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Expand the target organization to show the moved user
      const newExpanded = new Set(expandedOrgs);
      newExpanded.add(newOrgId);
      setExpandedOrgs(newExpanded);

      // Refresh organizations list
      await loadOrganizations();

      toast({
        title: "Uppdaterat",
        description: "Användarens organisation har uppdaterats"
      });
    } catch (error) {
      console.error('Error updating user organization:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera användarens organisation",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const removeUser = async (userId: string, userName: string, organizationId: string) => {
    setUpdating(userId);
    try {
      // First remove all user roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (rolesError) throw rolesError;

      // Then remove the user's profile from the organization
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (profileError) throw profileError;

      // Update local state
      setOrganizations(organizations.map(org => ({
        ...org,
        users: org.users.filter(user => user.user_id !== userId),
        user_count: org.id === organizationId ? org.user_count - 1 : org.user_count
      })));

      toast({
        title: "Användare borttagen",
        description: `${userName} har tagits bort från organisationen`,
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
    }
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) return;
    
    setCreatingOrg(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .insert({ name: newOrgName.trim() });

      if (error) throw error;

      await loadOrganizations();
      setNewOrgName("");
      
      toast({
        title: "Skapat",
        description: "Ny organisation har skapats"
      });
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa organisation",
        variant: "destructive"
      });
    } finally {
      setCreatingOrg(false);
    }
  };

  const toggleOrganization = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Laddar organisationer och användare...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Användarhantering</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadOrganizations}
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Uppdatera
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organisationer och Behörigheter</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Namn</TableHead>
                <TableHead>Antal användare</TableHead>
                <TableHead>Skapad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <Collapsible 
                  key={org.id}
                  open={expandedOrgs.has(org.id)} 
                  onOpenChange={() => toggleOrganization(org.id)}
                  asChild
                >
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="w-8">
                          {expandedOrgs.has(org.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{org.user_count}</TableCell>
                        <TableCell>
                          {new Date(org.created_at).toLocaleDateString('sv-SE')}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <div className="border-t bg-muted/30 p-4">
                            {org.users.length > 0 ? (
                              <div className="space-y-4">
                                {/* Matrix Header */}
                                <div className="grid grid-cols-[200px_150px_1fr_80px] gap-4 items-center border-b pb-2">
                                  <div className="font-medium">Användare</div>
                                  <div className="font-medium">Organisation</div>
                                  <div className="grid grid-cols-6 gap-2">
                                    {AVAILABLE_ROLES.map((role) => (
                                      <div key={role.key} className="text-center font-medium text-sm">
                                        {role.label}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="font-medium text-center">Åtgärder</div>
                                </div>

                                {/* User Matrix */}
                                {org.users.map((user) => (
                                  <div key={user.user_id} className="grid grid-cols-[200px_150px_1fr_80px] gap-4 items-center py-2 border-b border-muted relative">
                                    <div>
                                      <div className="font-medium">{getDisplayName(user)}</div>
                                      <div className="text-sm text-muted-foreground">{user.email}</div>
                                    </div>
                                    
                                    <Select
                                      value={user.organization_id}
                                      onValueChange={(value) => updateUserOrganization(user.user_id, value)}
                                      disabled={updating === user.user_id}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {organizations.map((orgOption) => (
                                          <SelectItem key={orgOption.id} value={orgOption.id}>
                                            {orgOption.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <div className="grid grid-cols-6 gap-2">
                                      {AVAILABLE_ROLES.map((role) => (
                                        <div key={role.key} className="flex justify-center">
                                          <Checkbox
                                            checked={user.roles.includes(role.key)}
                                            onCheckedChange={() => toggleUserRole(user.user_id, role.key, user.organization_id)}
                                            disabled={updating === user.user_id}
                                            className="w-5 h-5"
                                          />
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex justify-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeUser(user.user_id, getDisplayName(user), user.organization_id)}
                                        disabled={updating === user.user_id}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>

                                    {updating === user.user_id && (
                                      <div className="absolute right-4">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-center py-4">
                                Inga användare i denna organisation
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(userRole === 'superuser' || userRole === 'admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Skapa Organisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label htmlFor="orgName" className="text-sm font-medium">
                  Organisationsnamn
                </label>
                <Input
                  id="orgName"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ange organisationsnamn"
                  disabled={creatingOrg}
                />
              </div>
              <Button 
                onClick={createOrganization}
                disabled={!newOrgName.trim() || creatingOrg}
              >
                {creatingOrg ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Skapa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};