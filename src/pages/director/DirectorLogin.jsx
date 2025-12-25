// src/pages/director/DirectorLogin.jsx
import { useState } from 'react';
import { signInDirector, signUpDirector } from '../../utils/auth';
import { supabase } from '../../supabaseClient'; // Import for potential future use

export default function DirectorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let res;
    if (isSignup) {
      res = await signUpDirector(email, password, fullName);
    } else {
      res = await signInDirector(email, password);
    }

    if (res.error) {
      setError(res.error.message || 'An error occurred. Please try again.');
      setLoading(false);
      return;
    }

    // Success! Force full page reload to ensure session is properly restored
    // This bypasses the known Supabase quirk where the session isn't immediately detectable
    window.location.href = '/race-directors-hub';
  };

  return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center text-text-dark mb-8">
          {isSignup ? 'Create Director Account' : 'Director Login'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignup && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
          />
          {error && <p className="text-red-600 text-center font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-text-light py-5 rounded-full text-xl font-bold hover:bg-primary/90 transition disabled:opacity-70"
          >
            {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        <p className="text-center mt-8 text-text-muted">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="text-accent font-bold hover:underline"
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}