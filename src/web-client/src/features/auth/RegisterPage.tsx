import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      navigate('/profile', { state: { newUser: true } });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } };
      const messages = axiosErr?.response?.data?.errors;
      setError(messages?.length ? messages.join(' ') : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-headline text-4xl font-bold tracking-tighter text-[#cffc00] uppercase">RunTracker</h1>
          <p className="font-label text-[10px] tracking-[0.2em] text-zinc-600 mt-1 uppercase">Elite Performance Lab</p>
          <p className="font-label text-sm text-zinc-400 mt-6">Create your account</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="border border-[#ff734a]/30 bg-[#ff734a]/10 text-[#ff734a] px-4 py-3 font-label text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="font-label text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#131313] border border-[#484847] text-white px-4 py-3 font-body text-sm focus:outline-none focus:border-[#cffc00] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="font-label text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#131313] border border-[#484847] text-white px-4 py-3 font-body text-sm focus:outline-none focus:border-[#cffc00] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="font-label text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#131313] border border-[#484847] text-white px-4 py-3 font-body text-sm focus:outline-none focus:border-[#cffc00] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#cffc00] text-[#3b4a00] font-label font-bold uppercase tracking-widest text-sm hover:bg-[#c2ed00] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
          <p className="text-center font-label text-sm text-zinc-600">
            Already have an account?{' '}
            <Link to="/login" className="text-[#cffc00] hover:text-[#c2ed00] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
