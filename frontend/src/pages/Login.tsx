import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';

export const Login: React.FC = () => {
  const { signIn, isLoaded } = useSignIn();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!isLoaded) return;
    setError('');
    setLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google authentication.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 selection:bg-primary/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.04),transparent_45%)]" />
      
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl shadow-indigo-950/30">
        
        {/* Brand details */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-4 overflow-hidden rounded-2xl shadow-lg shadow-primary/10 border border-border flex items-center justify-center w-16 h-16 bg-card">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black text-foreground tracking-tight leading-none text-center">Criminal Record Management</h1>
          <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-wider">Public Safety Network</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <p className="text-center text-xs text-muted-foreground leading-relaxed px-4">
            Authorized personnel and citizens must authenticate securely using their designated Google workspace accounts.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={!isLoaded || loading}
            className="w-full h-12 bg-card hover:bg-muted disabled:opacity-50 text-foreground text-sm font-bold rounded-2xl shadow-md border border-border flex items-center justify-center gap-3 transition-all duration-200 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>

          <div className="text-center pt-2">
            <span className="text-xs text-muted-foreground font-medium">New user? </span>
            <a 
              href="/register" 
              className="text-xs text-primary hover:text-primary/80 font-bold hover:underline transition-colors duration-200"
            >
              Create citizen account
            </a>
          </div>
        </div>

        <div className="mt-10 text-center text-[10px] text-muted-foreground font-bold tracking-wide uppercase">
          Secured by Clerk & Google Identity
        </div>
      </div>
    </div>
  );
};
