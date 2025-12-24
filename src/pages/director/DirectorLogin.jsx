// src/pages/director/DirectorLogin.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInDirector, signUpDirector } from '../../utils/auth'; // Adjust path if needed

export default function DirectorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
      setError(res.error.message);
    } else {
      navigate('/race-directors-hub');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center text-gemini-dark-gray mb-8">
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
              className="w-full p-4 border rounded-lg"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-4 border rounded-lg"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-4 border rounded-lg"
          />
          {error && <p className="text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gemini-blue text-white py-4 rounded-full font-bold hover:bg-gemini-blue/90"
          >
            {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        <p className="text-center mt-6 text-gray-600">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="text-gemini-blue font-semibold"
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}