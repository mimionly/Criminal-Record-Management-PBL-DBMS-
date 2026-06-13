import React from 'react';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';
import { PoliceDashboard } from './pages/police/PoliceDashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { useAuth } from './context/AuthContext';
import { OrganizationList, SignOutButton } from '@clerk/clerk-react';

const NoOrganizationScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 selection:bg-primary/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.04),transparent_45%)]" />
      
      <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl p-8 shadow-2xl shadow-indigo-950/30 flex flex-col items-center">
        
        {/* Brand details */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4 overflow-hidden rounded-2xl shadow-lg shadow-primary/10 border border-border flex items-center justify-center w-16 h-16 bg-card">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black text-[#EF4444] tracking-tight leading-none text-center">Access Denied</h1>
          <p className="text-[10px] text-destructive font-bold uppercase mt-2 tracking-wider">Not a Member of any Organization</p>
        </div>

        <p className="text-center text-xs text-muted-foreground leading-relaxed px-4 mb-6">
          You are not currently registered as a member of any organization in this workspace. 
          To enter, you must either join an existing organization or create a new precinct/station organization.
        </p>

        <div className="w-full overflow-hidden flex justify-center mb-6">
          <OrganizationList 
            afterCreateOrganizationUrl="/"
            afterSelectOrganizationUrl="/"
          />
        </div>

        <div className="w-full border-t border-border pt-6 flex justify-center">
          <SignOutButton>
            <button className="h-10 px-6 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-slate-800 text-xs font-bold rounded-xl transition-all duration-200">
              Sign Out
            </button>
          </SignOutButton>
        </div>

      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading secure session...</div>
      </div>
    );
  }

  // Handle register route before checking logged in status
  if (!user && window.location.pathname === '/register') {
    return <Register />;
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === 'unauthorized') {
    return <NoOrganizationScreen />;
  }

  if (user.role === 'police') {
    return <PoliceDashboard />;
  }

  return <CitizenDashboard />;
};

export default App;
