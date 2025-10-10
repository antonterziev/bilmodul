# Admin System Security Architecture

## 🔒 Security Overview

This document outlines the comprehensive security architecture implemented for the admin system, following enterprise best practices.

## Critical Security Fixes Implemented

### 1. **Privilege Escalation Prevention** ✅
**Problem:** Users could grant themselves admin privileges via direct database access.

**Solution:**
- Removed self-service RLS policy on `user_permissions` table
- Created secure RPCs (`assign_user_permission`, `revoke_user_permission`) with server-side admin validation
- All permission changes now logged to audit trail

**Code:**
```sql
-- Users can ONLY view their own permissions
CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- NO INSERT/UPDATE/DELETE policies - must use secure RPCs
```

### 2. **Server-Side Admin Validation** ✅
**Problem:** Admin checks were client-side only and could be bypassed.

**Solution:**
- All admin operations now use `SECURITY DEFINER` functions
- Admin status validated server-side before any sensitive operation
- Functions check `is_admin()` before executing

**Frontend Implementation:**
```typescript
// ❌ INSECURE - Direct client access
await supabase.from('user_permissions').insert({...})

// ✅ SECURE - Server-side RPC with admin validation
await supabase.rpc('assign_user_permission', {
  target_user_id: userId,
  new_permission: 'admin'
})
```

### 3. **Last Admin Protection** ✅
**Problem:** Could accidentally remove the last admin from an organization.

**Solution:**
- Database-level triggers prevent last admin removal
- Both DELETE and UPDATE operations protected
- Server-side validation in all admin RPCs

### 4. **Comprehensive Audit Logging** ✅
**Problem:** No audit trail for admin actions.

**Solution:**
- Every admin action logged to `security_audit_log` table
- Includes: actor, action, target, timestamp, metadata
- Immutable audit trail (no UPDATE/DELETE policies)

**Logged Events:**
- `permission_assigned`
- `permission_revoked`
- `user_deleted`
- `invitation_sent`
- `invitation_revoked`

## Security Architecture

### Admin Access Control Flow

```
User Request
    ↓
Frontend Admin Component
    ↓
Check: Is Admin? (client-side pre-check)
    ↓
Call Secure RPC via Supabase Client
    ↓
Edge Function / Database RPC
    ↓
Validate: Is Admin? (server-side enforcement) ← CRITICAL
    ↓
Check: Last Admin Protection
    ↓
Execute Operation
    ↓
Log to Audit Trail
    ↓
Return Success/Error
```

### Secure RPC Functions

#### `assign_user_permission(target_user_id, new_permission, target_org_id)`
- Validates caller is admin
- Prevents self-privilege escalation checks
- Logs permission assignment
- Returns boolean success

#### `revoke_user_permission(target_user_id, permission_to_revoke)`
- Validates caller is admin
- Prevents last admin removal
- Logs permission revocation
- Returns boolean success

#### `admin_delete_user(target_user_id, reason)`
- Validates caller is admin
- Prevents self-deletion
- Prevents last admin deletion
- Logs deletion with reason
- Returns boolean success

#### `admin_list_users(filter_org_id)`
- Validates caller is admin
- Returns user list with permissions
- Includes last sign-in timestamps
- Organization-aware filtering

#### `admin_list_invitations(filter_org_id, filter_status)`
- Validates caller is admin
- Returns invitation details
- Supports status filtering
- Shows inviter information

## Security Best Practices

### ✅ DO:
- Always use secure RPCs for admin operations
- Validate admin status server-side in all RPCs
- Log every sensitive action to audit trail
- Use `SECURITY DEFINER` for privilege elevation
- Set `search_path = public` to prevent schema attacks
- Require reason/justification for destructive actions
- Implement "confirm" dialogs for irreversible operations

### ❌ DON'T:
- Never check admin status only on client-side
- Never allow direct INSERT/UPDATE/DELETE on `user_permissions`
- Never skip audit logging for admin actions
- Never allow users to delete themselves
- Never store admin status in localStorage or client state
- Never expose service role key to frontend
- Never trust user_metadata for permissions

## Database Security Layers

### Layer 1: RLS Policies
- Users can only view their own data
- Admins have read access via `is_admin()` check
- NO write policies - forces use of secure RPCs

### Layer 2: Security Definer Functions
- Execute with elevated privileges
- Validate admin status before executing
- Implement business logic safeguards
- Log all actions

### Layer 3: Database Triggers
- Prevent last admin removal
- Validate permission changes
- Enforce data integrity

### Layer 4: Audit Logging
- Immutable audit trail
- Captures who, what, when, where
- Stores action metadata
- Searchable and exportable

## Pre-Existing Security Issues (Requires Manual Fix)

### ⚠️ 1. Leaked Password Protection Disabled
**Risk:** Users can set passwords found in breach databases

**Fix:**
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Password Strength"
3. Enable "Leaked Password Protection"

**Reference:** https://supabase.com/docs/guides/auth/password-security

### ⚠️ 2. PostgreSQL Security Patches Available
**Risk:** Database may have known vulnerabilities

**Fix:**
1. Go to Supabase Dashboard → Settings → Infrastructure
2. Review available updates
3. Schedule and apply PostgreSQL upgrade
4. Test thoroughly after upgrade

## Recommended Next Steps

### Phase 2: Enhanced Admin Features
- [ ] Separate admin route structure (`/admin/*`)
- [ ] Admin dashboard with metrics
- [ ] User activity monitoring
- [ ] Invitation management UI
- [ ] Bulk permission operations
- [ ] Export user/audit data to CSV

### Phase 3: Advanced Security
- [ ] MFA enforcement for admin accounts
- [ ] IP allowlisting for super admins
- [ ] Session management and forced logout
- [ ] Impersonation with guardrails
- [ ] Rate limiting on admin actions
- [ ] Break-glass account with U2F

### Phase 4: Compliance
- [ ] GDPR data export functionality
- [ ] Right to deletion workflows
- [ ] Data retention policies
- [ ] Compliance reports
- [ ] Audit log retention (7 years)

## Testing Admin Security

### Test Cases:
1. **Privilege Escalation Test**
   - Try to grant self admin via console
   - Expected: Error "Only admins can assign permissions"

2. **Last Admin Protection Test**
   - Try to remove admin role from last admin
   - Expected: Error "Cannot remove the last admin"

3. **Self-Deletion Test**
   - Admin tries to delete their own account
   - Expected: Error "Cannot delete your own account"

4. **Audit Trail Test**
   - Perform admin action
   - Check `security_audit_log` for entry
   - Expected: Action logged with metadata

5. **RLS Bypass Test**
   - Try direct INSERT to `user_permissions`
   - Expected: Policy violation error

## Monitoring and Alerts

### Key Metrics to Monitor:
- Failed admin authentication attempts
- Permission changes (especially admin grants)
- User deletions
- Last admin near-misses
- Abnormal bulk operations
- API error rates on admin endpoints

### Recommended Alerts:
- New admin permission granted
- Admin account deleted
- Last admin role change attempted
- Multiple failed admin logins
- Bulk user modifications (>10 users)

## Support and Questions

For security concerns or questions about this implementation:
1. Review this document first
2. Check the database migration code
3. Review the RPC function implementations
4. Test in a staging environment
5. Contact security team if concerns persist

**Last Updated:** 2025-10-10
**Version:** 1.0.0
**Classification:** Internal Use Only
