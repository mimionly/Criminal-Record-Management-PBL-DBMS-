import React, { useState, useEffect, useRef } from 'react';
import { Users, UserCheck, Map, AlertCircle, Plus, Send, RefreshCw, BarChart3, Eye, FileSpreadsheet, CreditCard, LogOut } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import 'leaflet/dist/leaflet.css';

const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

// Fix Leaflet marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Red marker icon for SOS alerts
const redMarkerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface FIR {
  id: number;
  citizen_id: number;
  citizen_name?: string;
  title: string;
  description: string;
  location: string;
  crime_type: string;
  status: 'Submitted' | 'Pending Review' | 'Under Review' | 'Verified' | 'Investigation Started' | 'Resolved' | 'Rejected';
  remarks: string | null;
  accused_name: string | null;
  evidence_url: string | null;
  created_at: string;
}

interface Case {
  id: number;
  fir_id: number;
  criminal_id: number | null;
  officer_id: number | null;
  status: 'Active' | 'Under Investigation' | 'Solved' | 'Cold Case';
  remarks: string | null;
  created_at: string;
  fir_title: string;
  fir_description: string;
  fir_location: string;
  fir_crime_type: string;
  officer_name: string | null;
  officer_badge: string | null;
  criminal_name: string | null;
}

interface Officer {
  id: number;
  name: string;
  badge_number: string;
  station: string;
  rank: string;
  status: 'On Patrol' | 'Available' | 'On Leave';
  activeCases: number;
}

interface Criminal {
  id: number;
  name: string;
  age: number;
  crime_type: string;
  fir_id: number;
  created_at: string;
  fir_title?: string;
}

interface EmergencyRequest {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  latitude: number;
  longitude: number;
  request_type: string;
  status: 'Active' | 'Dispatched' | 'Resolved';
  created_at: string;
}

interface Challan {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  vehicle_no: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  issue_date: string;
}



interface Citizen {
  id: number;
  name: string;
  email: string;
}

export const PoliceDashboard: React.FC = () => {
  const { token, user, logout } = useAuth();
  
  // Sidebar tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'firs' | 'criminals' | 'roster' | 'challans' | 'reports'>('dashboard');
  
  // Data lists states loaded from MySQL
  const [firs, setFirs] = useState<FIR[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [criminals, setCriminals] = useState<Criminal[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([12.9716, 77.5946]);

  const socketRef = useRef<Socket | null>(null);



  // Review Status Form States
  const [selectedFIR, setSelectedFIR] = useState<FIR | null>(null);
  const [reviewStatus, setReviewStatus] = useState<FIR['status']>('Under Review');
  const [reviewRemarks, setReviewRemarks] = useState('');
  
  // Case Assignment States (linking FIR -> Officer -> Criminal)
  const [assignFIRId, setAssignFIRId] = useState<string>('');
  const [assignOfficerId, setAssignOfficerId] = useState<string>('');
  const [assignCriminalId, setAssignCriminalId] = useState<string>('');
  const [assignRemarks, setAssignRemarks] = useState('');

  // Deploy Officer States
  const [deployName, setDeployName] = useState('');
  const [deployBadge, setDeployBadge] = useState('');
  const [deployRank, setDeployRank] = useState('');
  const [deployStation] = useState('');

  // Criminal Form States (Add/Edit)
  const [isEditingCriminal, setIsEditingCriminal] = useState(false);
  const [selectedCriminalId, setSelectedCriminalId] = useState<string>('');
  const [suspectName, setSuspectName] = useState('');
  const [suspectAge, setSuspectAge] = useState('');
  const [suspectCrime, setSuspectCrime] = useState(''
    
  );
  const [suspectFIRId, setSuspectFIRId] = useState('');

  // Traffic Challan Form States
  const [challanVehicle, setChallanVehicle] = useState('');
  const [challanAmount, setChallanAmount] = useState('');
  const [challanUserId, setChallanUserId] = useState('');

  // Fetch all endpoints from MySQL database
  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch all endpoints in parallel
      const [firsRes, casesRes, officersRes, criminalsRes, emergenciesRes, challansRes, citizensRes] = await Promise.all([
        fetch('/api/firs', { headers }),
        fetch('/api/cases', { headers }),
        fetch('/api/officers', { headers }),
        fetch('/api/criminals', { headers }),
        fetch('/api/emergency', { headers }),
        fetch('/api/challans/all', { headers }),
        fetch('/api/auth/citizens', { headers })
      ]);

      let firsData: FIR[] = [];
      if (firsRes.ok) {
        firsData = await firsRes.json();
        setFirs(firsData);
      }

      if (casesRes.ok) {
        const data = await casesRes.json();
        setCases(data);
      }

      if (officersRes.ok) {
        const data = await officersRes.json();
        setOfficers(data);
        if (data.length > 0 && !assignOfficerId) {
          setAssignOfficerId(data[0].id.toString());
        }
      }

      if (criminalsRes.ok) {
        const data = await criminalsRes.json();
        const enriched = data.map((c: Criminal) => {
          const linkedFir = firsData.find((f: any) => f.id === c.fir_id);
          return {
            ...c,
            fir_title: linkedFir ? linkedFir.title : `FIR Incident #${c.fir_id}`
          };
        });
        setCriminals(enriched);
      }

      if (emergenciesRes.ok) {
        const data = await emergenciesRes.json();
        setEmergencies(data);
      }

      if (challansRes.ok) {
        const data = await challansRes.json();
        setChallans(data);
      }

      if (citizensRes.ok) {
        const data = await citizensRes.json();
        setCitizens(data);
      }

    } catch (err) {
      console.error('Error fetching dashboard database details:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();

      // Socket receiver for real-time updates
      const socket = io('http://localhost:5000');
      socketRef.current = socket;

      socket.on('db_change', (data: { table: string }) => {
        console.log('Real-time database update intercepted for table:', data.table);
        fetchDashboardData(true); // Silent background synchronization
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  // Dispatch Force and update emergency beacon status in MySQL
  const handleDispatchResponder = async (requestId: number, status: 'Dispatched' | 'Resolved') => {
    try {
      const res = await fetch(`/api/emergency/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        alert(`Distress Alert #${requestId} marked as ${status} in MySQL.`);
        fetchDashboardData();
      } else {
        alert('Failed to dispatch responder.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating responder status.');
    }
  };

  // Update FIR status
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFIR) return;

    try {
      const res = await fetch(`/api/firs/${selectedFIR.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: reviewStatus,
          remarks: reviewRemarks
        })
      });

      if (res.ok) {
        alert('Incident status updated in MySQL.');
        setReviewRemarks('');
        setSelectedFIR(null);
        fetchDashboardData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update FIR.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating incident.');
    }
  };

  // Case Assignment
  const handleAssignCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFIRId || !assignOfficerId) {
      alert('FIR and Officer selections required.');
      return;
    }

    try {
      const res = await fetch('/api/cases/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firId: parseInt(assignFIRId, 10),
          officerId: parseInt(assignOfficerId, 10),
          criminalId: assignCriminalId ? parseInt(assignCriminalId, 10) : null,
          remarks: assignRemarks || 'Case assignment docket'
        })
      });

      if (res.ok) {
        alert('Case assigned and linked successfully.');
        setAssignFIRId('');
        setAssignCriminalId('');
        setAssignRemarks('');
        fetchDashboardData();
      } else {
        const data = await res.json();
        alert(data.error || 'Assignment failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error assigning case.');
    }
  };

  // Deploy new officer
  const handleDeployOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployName || !deployBadge) {
      alert('Officer name and badge number required.');
      return;
    }

    try {
      const res = await fetch('/api/officers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: deployName,
          badgeNumber: deployBadge.toUpperCase(),
          rank: deployRank,
          station: deployStation
        })
      });

      if (res.ok) {
        alert('Officer deployed successfully.');
        setDeployName('');
        setDeployBadge('');
        fetchDashboardData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to deploy officer.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deploying officer.');
    }
  };

  // Add / Edit Criminal Suspect particulars
  const handleSaveCriminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectName || !suspectAge || !suspectFIRId) {
      alert('Please fill out all fields.');
      return;
    }

    try {
      const url = isEditingCriminal ? `/api/criminals/${selectedCriminalId}` : '/api/criminals';
      const method = isEditingCriminal ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: suspectName,
          age: parseInt(suspectAge, 10),
          crimeType: suspectCrime,
          firId: parseInt(suspectFIRId, 10)
        })
      });

      if (res.ok) {
        alert(isEditingCriminal ? 'Suspect details updated.' : 'New suspect logged in MySQL.');
        setSuspectName('');
        setSuspectAge('');
        setSuspectFIRId('');
        setIsEditingCriminal(false);
        setSelectedCriminalId('');
        fetchDashboardData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save suspect.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving criminal details.');
    }
  };

  const startEditCriminal = (c: Criminal) => {
    setIsEditingCriminal(true);
    setSelectedCriminalId(c.id.toString());
    setSuspectName(c.name);
    setSuspectAge(c.age.toString());
    setSuspectCrime(c.crime_type);
    setSuspectFIRId(c.fir_id.toString());
  };

  // Issue new Traffic Challan in MySQL
  const handleIssueChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanVehicle || !challanAmount) {
      alert('Vehicle number and fine amount required.');
      return;
    }

    try {
      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: challanUserId ? parseInt(challanUserId, 10) : null,
          vehicleNo: challanVehicle,
          amount: parseFloat(challanAmount),
          status: 'Unpaid'
        })
      });

      if (res.ok) {
        alert('Challan traffic memo issued successfully in MySQL.');
        setChallanVehicle('');
        setChallanAmount('');
        setChallanUserId('');
        fetchDashboardData();
      } else {
        alert('Failed to issue challan.');
      }
    } catch (err) {
      console.error(err);
      alert('Error issuing challan.');
    }
  };



  // Color mappings
  const getStatusBadge = (status: FIR['status']) => {
    switch (status) {
      case 'Submitted':
      case 'Pending Review':
      case 'Under Review':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FFFBEB] text-[#F59E0B] border border-[#FDE68A]">
            Pending
          </span>
        );
      case 'Verified':
      case 'Investigation Started':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            Under Investigation
          </span>
        );
      case 'Resolved':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">
            Closed
          </span>
        );
      case 'Rejected':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  const getCrimeTypeChartData = () => {
    const counts: { [key: string]: number } = {};
    firs.forEach(f => {
      const type = f.crime_type || 'Others';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      count: counts[key]
    }));
  };

  // Combine db emergencies with socket alerts to prevent delays
  const activeSOSList: EmergencyRequest[] = emergencies.map(e => ({
    ...e,
    latitude: Number(e.latitude),
    longitude: Number(e.longitude)
  }));


  return (
    <div className="min-h-screen bg-background text-foreground flex selection:bg-primary/20 font-sans">
      
      {/* 1. Sleek Dashboard Sidebar */}
      <aside className="w-64 bg-card text-muted-foreground flex flex-col justify-between shrink-0 border-r border-border">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-border flex items-center gap-3 bg-slate-50/70">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0 bg-card flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground leading-none">Criminal Record Control</h2>
              <p className="text-[9px] text-primary font-bold uppercase mt-1 tracking-wider">Precinct Admin</p>
            </div>
          </div>

          {/* Sidebar Nav links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <Map className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('firs')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'firs' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <FileSpreadsheet className="w-4 h-4" /> FIR Incidents
            </button>
            <button
              onClick={() => setActiveTab('criminals')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'criminals' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <UserCheck className="w-4 h-4" /> Criminals
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'roster' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <Users className="w-4 h-4" /> Roster Force
            </button>
            <button
              onClick={() => setActiveTab('challans')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'challans' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <CreditCard className="w-4 h-4" /> Challans
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'reports' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <BarChart3 className="w-4 h-4" /> Reports
            </button>
          </nav>
        </div>

        {/* Footer profile info */}
        <div className="p-4 border-t border-border bg-slate-50/70">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground uppercase select-none animate-pulse">
              {user?.name.slice(0, 2)}
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground line-clamp-1">{user?.name}</p>
              <p className="text-[9px] text-muted-foreground font-medium">Police Officer</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border border-border hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all duration-200"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navbar */}
        <header className="h-16 bg-card border-b border-border px-8 flex justify-between items-center shadow-sm shrink-0">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
            {activeTab === 'dashboard' && 'Precinct Operations Command'}
            {activeTab === 'firs' && 'FIR Incidents & Assign Queue'}
            {activeTab === 'criminals' && 'Criminal Registry database'}
            {activeTab === 'roster' && 'On-Duty Station Officer Roster'}
            {activeTab === 'challans' && 'Traffic violations & fine logs'}
            {activeTab === 'reports' && 'Precinct Analytics & crime charts'}
          </h2>
            <Button variant="secondary" size="sm" onClick={() => fetchDashboardData()} className="px-2 border border-border text-foreground hover:bg-muted">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
        </header>

        {/* Scrollable Main content area */}
        <main className="flex-1 p-8 overflow-y-auto space-y-8 w-full">
          
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 animate-pulse">Synchronizing database...</div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  {/* Status counters */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-white border border-[#E2E8F0] p-4 text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Outstanding complaints</p>
                      <p className="text-2xl font-black text-[#F59E0B] mt-1">{firs.filter(f => f.status === 'Submitted' || f.status === 'Under Review').length}</p>
                    </Card>
                    <Card className="bg-white border border-[#E2E8F0] p-4 text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Active Investigations</p>
                      <p className="text-2xl font-black text-[#2563EB] mt-1">{cases.filter(c => c.status === 'Active' || c.status === 'Under Investigation').length}</p>
                    </Card>
                    <Card className="bg-white border border-[#E2E8F0] p-4 text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Deployed Patrol Units</p>
                      <p className="text-2xl font-black text-[#10B981] mt-1">{officers.filter(o => o.status !== 'On Leave').length}</p>
                    </Card>
                    <Card className="bg-white border border-[#E2E8F0] p-4 text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Logged Suspects</p>
                      <p className="text-2xl font-black text-slate-800 mt-1">{criminals.length}</p>
                    </Card>
                  </div>

                  {/* SOS beacons section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    
                    {/* SOS distress list */}
                    <Card className="lg:col-span-1 bg-white border border-[#E2E8F0]">
                      <CardHeader className="border-b border-[#E2E8F0]">
                        <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-4.5 h-4.5 text-[#DC2626]" /> Active Emergency SOS Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 max-h-[300px] overflow-y-auto divide-y divide-[#E2E8F0]">
                        {activeSOSList.length > 0 ? (
                          activeSOSList.map(e => (
                            <div key={e.id} className="p-4 hover:bg-slate-50/50 flex justify-between items-center text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#DC2626] uppercase text-[9px]">{e.request_type}</span>
                                  <span className="text-[9px] text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="font-semibold text-slate-800">Alert #{e.id}: {e.user_name || 'Citizen'}</p>
                                <p className="text-[9px] text-slate-400 font-mono">GPS: {e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}</p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {e.status === 'Active' ? (
                                  <Button variant="danger" size="sm" onClick={() => handleDispatchResponder(e.id, 'Dispatched')} className="bg-[#DC2626] text-white text-[10px] font-bold py-1 px-2.5 rounded">
                                    Dispatch
                                  </Button>
                                ) : e.status === 'Dispatched' ? (
                                  <Button variant="primary" size="sm" onClick={() => handleDispatchResponder(e.id, 'Resolved')} className="bg-[#2563EB] text-white text-[10px] font-bold py-1 px-2.5 rounded">
                                    Resolve
                                  </Button>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold rounded-full">Resolved</span>
                                )}
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => setMapCenter([e.latitude, e.longitude])}
                                  className="text-[#1E40AF] border border-[#E2E8F0] text-[10px] font-bold py-1.5 px-2 rounded hover:bg-slate-50"
                                  type="button"
                                >
                                  Map
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-slate-400 text-xs">No active emergency logs.</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* SOS Map panel */}
                    <Card className="lg:col-span-2 bg-white border border-[#E2E8F0] h-[360px] overflow-hidden">
                      <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                        <RecenterMap center={mapCenter} />
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {activeSOSList
                          .filter(e => e.status !== 'Resolved')
                          .map(e => (
                            <Marker key={e.id} position={[e.latitude, e.longitude]} icon={redMarkerIcon}>
                              <Popup>
                                <div className="text-xs space-y-1">
                                  <p className="font-bold text-[#DC2626]">Distress Beacon #{e.id}</p>
                                  <p>Citizen: {e.user_name || 'Anonymous'}</p>
                                  <p>Status: {e.status}</p>
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                      </MapContainer>
                    </Card>

                  </div>
                </div>
              )}

              {activeTab === 'firs' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* FIR Table */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-[#1E40AF]" /> Active Assigned FIR Complaints
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase">
                              <th className="py-3 px-6">FIR ID</th>
                              <th className="py-3 px-6">Incident details</th>
                              <th className="py-3 px-6">Type</th>
                              <th className="py-3 px-6">Status</th>
                              <th className="py-3 px-6 text-right">Review</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {firs.map(f => (
                              <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3.5 px-6 font-mono font-bold text-slate-500">#{f.id}</td>
                                <td className="py-3.5 px-6">
                                  <p className="font-semibold text-slate-800">{f.title}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Location: {f.location}</p>
                                </td>
                                <td className="py-3.5 px-6 text-slate-600">{f.crime_type}</td>
                                <td className="py-3.5 px-6">{getStatusBadge(f.status)}</td>
                                <td className="py-3.5 px-6 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSelectedFIR(f); setReviewStatus(f.status); setReviewRemarks(f.remarks || ''); }}
                                    className="text-blue-600 hover:bg-blue-50 font-bold text-xs"
                                  >
                                    Review
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions column */}
                  <div className="space-y-8">
                    
                    {/* Status updater */}
                    <Card className="bg-white border border-[#E2E8F0]">
                      <CardHeader className="border-b border-[#E2E8F0]">
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-[#1E40AF]" /> Update Incident Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {selectedFIR ? (
                          <form onSubmit={handleUpdateStatus} className="space-y-4">
                            <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs space-y-1">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Active FIR docket</p>
                              <p className="font-bold text-slate-800">FIR #{selectedFIR.id}: {selectedFIR.title}</p>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Transition Status</label>
                              <Select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as FIR['status'])}>
                                <option value="Submitted">Pending</option>
                                <option value="Pending Review">Pending Review</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Verified">Verified</option>
                                <option value="Investigation Started">Under Investigation</option>
                                <option value="Resolved">Closed</option>
                                <option value="Rejected">Rejected</option>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Investigation remarks</label>
                              <textarea
                                rows={4}
                                required
                                placeholder="remarks details..."
                                className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-slate-800"
                                value={reviewRemarks}
                                onChange={(e) => setReviewRemarks(e.target.value)}
                              />
                            </div>

                            <div className="flex gap-2 justify-end">
                              <Button variant="secondary" size="sm" type="button" onClick={() => setSelectedFIR(null)}>
                                Cancel
                              </Button>
                              <Button variant="primary" size="sm" type="submit" className="bg-[#1E40AF] text-white">
                                Save updates
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="p-6 text-center text-xs text-slate-400">Select an incident from grid.</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Case assignment Attach FIR -> Criminal */}
                    <Card className="bg-white border border-[#E2E8F0]">
                      <CardHeader className="border-b border-[#E2E8F0]">
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                          <Send className="w-4 h-4 text-[#1E40AF]" /> Case assignment & Docket Linking
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <form onSubmit={handleAssignCase} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Attach FIR Incident</label>
                            <Select value={assignFIRId} onChange={(e) => setAssignFIRId(e.target.value)}>
                              <option value="">-- Choose FIR --</option>
                              {firs
                                .filter(f => !cases.some(c => c.fir_id === f.id))
                                .map(f => (
                                  <option key={f.id} value={f.id}>
                                    FIR #{f.id}: {f.title}
                                  </option>
                                ))}
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Link Suspect Criminal (Optional)</label>
                            <Select value={assignCriminalId} onChange={(e) => setAssignCriminalId(e.target.value)}>
                              <option value="">-- Choose suspect criminal --</option>
                              {criminals.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} (Crime: {c.crime_type})
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Deploy Officer</label>
                            <Select value={assignOfficerId} onChange={(e) => setAssignOfficerId(e.target.value)}>
                              {officers
                                .filter(o => o.status !== 'On Leave')
                                .map(o => (
                                  <option key={o.id} value={o.id}>
                                    {o.name} ({o.rank} - {o.activeCases} active cases)
                                  </option>
                                ))}
                            </Select>
                          </div>

                          <Button variant="primary" type="submit" className="w-full bg-[#1E40AF] text-white">
                            Dispatch docket
                          </Button>
                        </form>
                      </CardContent>
                    </Card>



                  </div>
                </div>
              )}

              {activeTab === 'criminals' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Suspect Registry Table */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-purple-600" /> Suspect Criminal History Registry
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {criminals.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase">
                                <th className="py-3 px-6">Suspect ID</th>
                                <th className="py-3 px-6">Name</th>
                                <th className="py-3 px-6">Age</th>
                                <th className="py-3 px-6">Offense Type</th>
                                <th className="py-3 px-6">Linked FIR</th>
                                <th className="py-3 px-6 text-right">Edit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                              {criminals.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3.5 px-6 font-mono font-bold text-slate-500">#CR-{c.id}</td>
                                  <td className="py-3.5 px-6 font-bold text-slate-800">{c.name}</td>
                                  <td className="py-3.5 px-6 text-slate-650">{c.age} Yrs</td>
                                  <td className="py-3.5 px-6 text-slate-650">{c.crime_type}</td>
                                  <td className="py-3.5 px-6 font-mono font-bold text-blue-600">FIR #{c.fir_id}</td>
                                  <td className="py-3.5 px-6 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startEditCriminal(c)}
                                      className="text-purple-600 hover:bg-purple-50 font-bold"
                                    >
                                      Modify
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-xs">No suspects logged.</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Add / Update Suspect Forms */}
                  <Card className="bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        {isEditingCriminal ? <Eye className="w-4.5 h-4.5 text-purple-600" /> : <Plus className="w-4.5 h-4.5 text-purple-600" />}
                        {isEditingCriminal ? 'Modify Suspect Record' : 'Log Suspect profile'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSaveCriminal} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Suspect Name</label>
                          <Input
                            type="text"
                            required
                            placeholder="Suspect Name"
                            value={suspectName}
                            onChange={(e) => setSuspectName(e.target.value)}
                            className="border-slate-200"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Age</label>
                            <Input
                              type="number"
                              required
                              placeholder="Age"
                              value={suspectAge}
                              onChange={(e) => setSuspectAge(e.target.value)}
                              className="border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Offense</label>
                            <Select value={suspectCrime} onChange={(e) => setSuspectCrime(e.target.value)}>
                              <option value="Theft">Theft</option>
                              <option value="Assault">Assault</option>
                              <option value="Cyber Crime">Cyber Crime</option>
                              <option value="Missing Person">Missing Person</option>
                              <option value="Traffic Violation">Traffic Violation</option>
                              <option value="Fraud">Fraud</option>
                              <option value="Others">Others</option>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Linked Incident (FIR)</label>
                          <Select value={suspectFIRId} onChange={(e) => setSuspectFIRId(e.target.value)}>
                            <option value="">-- Choose active FIR --</option>
                            {firs.map(f => (
                              <option key={f.id} value={f.id}>
                                FIR #{f.id}: {f.title}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="flex gap-2 pt-2">
                          {isEditingCriminal && (
                            <Button
                              variant="secondary"
                              type="button"
                              className="flex-1 text-xs font-bold"
                              onClick={() => {
                                setIsEditingCriminal(false);
                                setSuspectName('');
                                setSuspectAge('');
                                setSuspectFIRId('');
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                          <Button variant="primary" type="submit" className="flex-1 bg-[#1E40AF] text-white text-xs font-bold">
                            {isEditingCriminal ? 'Save updates' : 'Link Suspect'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'roster' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Deployed Officers */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" /> Active Roster Deployed Force
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                      {officers.map(o => (
                        <div key={o.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between h-[120px] shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">{o.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{o.rank} | Badge: {o.badge_number}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${o.status === 'Available' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : o.status === 'On Patrol' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                              {o.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-t border-[#E2E8F0] pt-2 text-[11px] text-slate-500">
                            <span>Investigation caseload:</span>
                            <span className="font-bold text-slate-800">{o.activeCases} Cases</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Deploy Officer Form */}
                  <Card className="bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-600" /> Deploy Officer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleDeployOfficer} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Officer Name</label>
                          <Input
                            type="text"
                            required
                            placeholder="Officer full name"
                            value={deployName}
                            onChange={(e) => setDeployName(e.target.value)}
                            className="border-slate-200"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Badge ID (Unique)</label>
                          <Input
                            type="text"
                            required
                            placeholder="E.g., BPD4312"
                            value={deployBadge}
                            onChange={(e) => setDeployBadge(e.target.value)}
                            className="border-slate-200"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Rank designation</label>
                          <Select value={deployRank} onChange={(e) => setDeployRank(e.target.value)}>
                            <option value="Constable">Constable</option>
                            <option value="Sub-Inspector">Sub-Inspector</option>
                            <option value="Inspector">Inspector</option>
                            <option value="Assistant Commissioner">Assistant Commissioner</option>
                          </Select>
                        </div>

                        <Button variant="primary" type="submit" className="w-full bg-[#1E40AF] text-white">
                          Deploy Officer
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'challans' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Challan table */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <CreditCard className="w-4.5 h-4.5 text-[#1E40AF]" /> Traffic violation challan Logs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {challans.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase">
                                <th className="py-3 px-6">Challan ID</th>
                                <th className="py-3 px-6">Vehicle No</th>
                                <th className="py-3 px-6">Fined User</th>
                                <th className="py-3 px-6">Fine Amount</th>
                                <th className="py-3 px-6">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                              {challans.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3.5 px-6 font-mono font-bold text-slate-500">#CH-{c.id}</td>
                                  <td className="py-3.5 px-6 font-bold text-slate-800">{c.vehicle_no}</td>
                                  <td className="py-3.5 px-6 text-slate-600">{c.user_name || `Anonymous (ID ${c.user_id})`}</td>
                                  <td className="py-3.5 px-6 text-amber-600 font-extrabold">₹{c.amount}</td>
                                  <td className="py-3.5 px-6">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${c.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                                      {c.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-xs">No traffic challans logged.</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Issue Challan Form */}
                  <Card className="bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#1E40AF]" /> Issue Traffic Challan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleIssueChallan} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Vehicle Registration Number</label>
                          <Input
                            type="text"
                            required
                            placeholder="E.g., KA-03-MX-8432"
                            value={challanVehicle}
                            onChange={(e) => setChallanVehicle(e.target.value)}
                            className="border-slate-200"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Fine Penalty Amount (INR)</label>
                          <Input
                            type="number"
                            required
                            placeholder="Amount in ₹"
                            value={challanAmount}
                            onChange={(e) => setChallanAmount(e.target.value)}
                            className="border-slate-200"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Link Driver User Profile (Optional)</label>
                          <Select value={challanUserId} onChange={(e) => setChallanUserId(e.target.value)}>
                            <option value="">-- Choose citizen driver --</option>
                            {citizens.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.email})
                              </option>
                            ))}
                          </Select>
                        </div>

                        <Button variant="primary" type="submit" className="w-full bg-[#1E40AF] text-white">
                          Issue traffic memo
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white border border-[#E2E8F0] p-6 flex flex-col h-[360px]">
                      <h4 className="text-xs font-extrabold text-slate-700 mb-6 uppercase tracking-wider">Crime Category Distribution</h4>
                      <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getCrimeTypeChartData()}>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                            <YAxis stroke="#64748b" fontSize={9} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }} />
                            <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="bg-white border border-[#E2E8F0] p-6 flex flex-col h-[360px]">
                      <h4 className="text-xs font-extrabold text-slate-700 mb-6 uppercase tracking-wider">Officer Workload caseloads</h4>
                      <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={officers.map(o => ({ name: o.name.split(' ')[0], cases: o.activeCases }))}>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                            <YAxis stroke="#64748b" fontSize={9} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }} />
                            <Line type="monotone" dataKey="cases" stroke="#10B981" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}

        </main>
      </div>

    </div>
  );
};
