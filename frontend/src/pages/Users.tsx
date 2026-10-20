import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { roleLabel, type UserRole } from '@/types/auth';
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type ManagedUser,
} from '@/services/usersApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormMode = 'create' | 'edit';

export default function UsersPage() {
  const { isSuperAdmin, user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setUsers(data.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [isSuperAdmin, load]);

  if (!isSuperAdmin) {
    return <Navigate to="/settings" replace />;
  }

  const openCreate = () => {
    setFormMode('create');
    setEditing(null);
    setName('');
    setEmail('');
    setRole('operator');
    setPassword('');
    setFormOpen(true);
  };

  const openEdit = (target: ManagedUser) => {
    setFormMode('edit');
    setEditing(target);
    setName(target.name);
    setEmail(target.email);
    setRole(target.role);
    setPassword('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (formMode === 'create' && password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (formMode === 'edit' && password && password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      if (formMode === 'create') {
        await createUser({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });
        toast.success('User created');
      } else if (editing) {
        await updateUser(editing.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          password: password || undefined,
        });
        toast.success(password ? 'User updated and password reset' : 'User updated');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#0d1c2d', letterSpacing: '-0.01em' }}>
            User management
          </h1>
          <p className="text-sm mt-1" style={{ color: '#45474c' }}>
            Create operators and admins, reset passwords, or remove accounts.
          </p>
        </div>
        <Button
          className="gap-2 font-semibold"
          style={{ background: '#57dffe', color: '#091426', border: 'none' }}
          onClick={openCreate}
        >
          <Plus className="w-4 h-4" /> Add user
        </Button>
      </div>

      <div className="sfm-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-sm" style={{ color: '#75777d' }}>Loading…</TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-sm" style={{ color: '#75777d' }}>No users yet.</TableCell>
              </TableRow>
            )}
            {users.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: '#00687a' }} />
                    {row.name}
                    {row.id === me?.id && (
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: '#75777d' }}>(you)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{roleLabel(row.role)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={row.id === me?.id}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Add user' : 'Edit user'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? 'Create a dashboard login for an operator or admin.'
                : 'Update account details. Leave password empty to keep the current one.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="sfm-label-caps">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama" className="h-10 placeholder:text-[#9aa0a6]" />
            </div>
            <div className="space-y-1.5">
              <label className="sfm-label-caps">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Masukkan email" className="h-10 placeholder:text-[#9aa0a6]" />
            </div>
            <div className="space-y-1.5">
              <label className="sfm-label-caps">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="sfm-label-caps">{formMode === 'create' ? 'Password' : 'Reset password (optional)'}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={formMode === 'create' ? 'Minimal 8 karakter' : 'Kosongkan jika tidak diubah'}
                className="h-10 placeholder:text-[#9aa0a6]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              className="font-semibold"
              style={{ background: '#57dffe', color: '#091426', border: 'none' }}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>This account will no longer be able to sign in.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
