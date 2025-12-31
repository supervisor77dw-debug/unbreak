import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// Prevent static generation
export async function getServerSideProps() {
  return { props: {} };
}

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.push('/admin');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin Login - UNBREAK ONE</title>
      </Head>
      <div className="admin-login-container">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <h1>UNBREAK ONE</h1>
            <p>Admin Panel</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-login-form">
            {error && (
              <div className="admin-login-error">
                {error}
              </div>
            )}

            <div className="admin-form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@unbreak-one.com"
                required
                disabled={loading}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="admin-login-button"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <style jsx>{`
          .admin-login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0a1f1f 0%, #0a4d4d 100%);
            padding: 20px;
          }

          .admin-login-card {
            background: #1a1a1a;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            padding: 40px;
            width: 100%;
            max-width: 420px;
          }

          .admin-login-header {
            text-align: center;
            margin-bottom: 30px;
          }

          .admin-login-header h1 {
            color: #0a4d4d;
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
          }

          .admin-login-header p {
            color: #999;
            font-size: 14px;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .admin-login-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .admin-login-error {
            background: rgba(224, 0, 0, 0.1);
            border: 1px solid #e00;
            color: #ff4444;
            padding: 12px;
            border-radius: 6px;
            font-size: 14px;
            text-align: center;
          }

          .admin-form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .admin-form-group label {
            color: #ddd;
            font-size: 14px;
            font-weight: 500;
          }

          .admin-form-group input {
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 6px;
            color: #fff;
            font-size: 16px;
            padding: 12px 16px;
            transition: all 0.2s;
          }

          .admin-form-group input:focus {
            outline: none;
            border-color: #0a4d4d;
            box-shadow: 0 0 0 3px rgba(10, 77, 77, 0.1);
          }

          .admin-form-group input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .admin-login-button {
            background: #0a4d4d;
            border: none;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            padding: 14px;
            margin-top: 10px;
            transition: all 0.2s;
          }

          .admin-login-button:hover:not(:disabled) {
            background: #0d6666;
            transform: translateY(-1px);
          }

          .admin-login-button:active:not(:disabled) {
            transform: translateY(0);
          }

          .admin-login-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 480px) {
            .admin-login-card {
              padding: 30px 20px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
