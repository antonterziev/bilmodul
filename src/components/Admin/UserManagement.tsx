import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Building } from "lucide-react";

interface UserWithProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  organization_id: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadOrganizations();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          first_name,
          last_name,
          organization_id,
          organizations!inner(name),
          user_roles!inner(role)
        `);

      if (error) throw error;

      const formattedUsers: UserWithProfile[] = data?.map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        organization_name: user.organizations.name,
        organization_id: user.organization_id,
        role: user.user_roles.role
      })) || [];

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

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const updateUserRole = async (userId: string, newRole: "administrator" | "bilhandel" | "ekonomi") => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.user_id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: "Uppdaterat",
        description: "Användarens roll har uppdaterats"
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera användarens roll",
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

      // Refresh users list
      await loadUsers();

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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'administrator': return 'destructive';
      case 'ekonomi': return 'secondary';
      case 'bilhandel': return 'default';
      default: return 'outline';
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
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Användarhantering</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla användare</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Användare</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.first_name} {user.last_name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      {user.organization_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role === 'administrator' ? 'Administration' :
                       user.role === 'ekonomi' ? 'Ekonomi' : 'Bilhandel'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateUserRole(user.user_id, value as "administrator" | "bilhandel" | "ekonomi")}
                        disabled={updating === user.user_id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="administrator">Administration</SelectItem>
                          <SelectItem value="ekonomi">Ekonomi</SelectItem>
                          <SelectItem value="bilhandel">Bilhandel</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={user.organization_id}
                        onValueChange={(value) => updateUserOrganization(user.user_id, value)}
                        disabled={updating === user.user_id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {updating === user.user_id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};