import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import LoginParticles from '@/components/auth/LoginParticles';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@sfm.local');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Signed in');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center lg:justify-end px-4 py-10 lg:px-16 xl:px-24"
      style={{
        backgroundColor: '#05070c',
        backgroundImage: 'url(/sfm-background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <LoginParticles />
      <div className="relative z-10 w-full max-w-md sfm-card p-8 shadow-2xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: '#0d1c2d' }}>
          Sign in
        </h1>
        <p className="text-sm mb-6" style={{ color: '#75777d' }}>
          Smart Flow Meter dashboard
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="sfm-label-caps block" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="h-10"
              style={{ borderColor: '#e2e8f0' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="sfm-label-caps block" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="h-10"
              style={{ borderColor: '#e2e8f0' }}
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-10 font-semibold"
            style={{ background: '#57dffe', color: '#091426', border: 'none' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-xs mt-5" style={{ color: '#75777d' }}>
          Use the account provided by your administrator.
        </p>
      </div>
    </div>
  );
}
