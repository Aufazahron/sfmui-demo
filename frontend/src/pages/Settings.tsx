import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { changePassword, updateProfile } from '@/services/usersApi';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  const field = (label: string, children: React.ReactNode) => (
    <div className="space-y-1.5">
      <label className="sfm-label-caps block">{label}</label>
      {children}
    </div>
  );

  const handleSaveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSavingProfile(true);
    try {
      const data = await updateProfile({ name: name.trim(), email: email.trim() });
      setUser(data.user);
      toast.success('Account updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password confirmation does not match');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#0d1c2d', letterSpacing: '-0.01em' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: '#45474c' }}>
          Update your account information or reset your password.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
      <div className="sfm-card p-6 flex flex-col">
        <h2 className="font-semibold text-base mb-1" style={{ color: '#0d1c2d' }}>Account information</h2>
        <p className="text-sm mb-5" style={{ color: '#75777d' }}>Name and email shown in the dashboard.</p>
        <div className="grid grid-cols-1 gap-4 flex-1">
          {field('Name', (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama"
              className="h-10 placeholder:text-[#9aa0a6]"
              style={{ borderColor: '#e2e8f0' }}
            />
          ))}
          {field('Email', (
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan email"
              className="h-10 placeholder:text-[#9aa0a6]"
              style={{ borderColor: '#e2e8f0' }}
            />
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <Button
            onClick={() => void handleSaveProfile()}
            disabled={savingProfile}
            className="gap-2 font-semibold px-6"
            style={{ background: '#57dffe', color: '#091426', border: 'none' }}
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Saving…' : 'Save account'}
          </Button>
        </div>
      </div>

      <div className="sfm-card p-6 flex flex-col">
        <h2 className="font-semibold text-base mb-1" style={{ color: '#0d1c2d' }}>Reset password</h2>
        <p className="text-sm mb-5" style={{ color: '#75777d' }}>Enter your current password, then a new one.</p>
        <div className="grid grid-cols-1 gap-4 flex-1">
          {field('Current password', (
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              className="h-10 placeholder:text-[#9aa0a6]"
              style={{ borderColor: '#e2e8f0' }}
            />
          ))}
          {field('New password', (
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="h-10 placeholder:text-[#9aa0a6]"
              style={{ borderColor: '#e2e8f0' }}
            />
          ))}
          {field('Confirm new password', (
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="h-10 placeholder:text-[#9aa0a6]"
              style={{ borderColor: '#e2e8f0' }}
            />
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <Button
            onClick={() => void handleChangePassword()}
            disabled={savingPassword}
            className="gap-2 font-semibold px-6"
            style={{ background: '#091426', color: '#ffffff', border: 'none' }}
          >
            {savingPassword ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
