import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (!axiosErr.response) {
        setError('Server cannot be reached. Please try again later.');
      } else {
        setError('Invalid email or password');
      }
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
          <p className="font-label text-sm text-zinc-400 mt-6">Sign in to your account</p>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#131313] border border-[#484847] text-white px-4 py-3 font-body text-sm focus:outline-none focus:border-[#cffc00] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#cffc00] text-[#3b4a00] font-label font-bold uppercase tracking-widest text-sm hover:bg-[#c2ed00] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center font-label text-sm text-zinc-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#cffc00] hover:text-[#c2ed00] font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
