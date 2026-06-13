import React, { useState, useEffect, useRef } from 'react';
import { Users, UserCheck, Map, AlertCircle, Plus, Send, RefreshCw, BarChart3, Eye, FileSpreadsheet, CreditCard, LogOut, Menu, X, ArrowLeft, Download, Paperclip, MessageSquare, Clock, ShieldAlert, FileText, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { OrganizationSwitcher } from '@clerk/clerk-react';
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
  citizen_email?: string;
  citizen_phone?: string;
  title: string;
  description: string;
  location: string;
  crime_type: string;
  status: 'Submitted' | 'Pending Review' | 'Under Review' | 'Verified' | 'Investigation Started' | 'Resolved' | 'Rejected';
  remarks: string | null;
  accused_name: string | null;
  evidence_url: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  investigation_notes: string | null;
  assigned_officer_id?: number | null;
  assigned_officer_name?: string | null;
  linked_criminal_id?: number | null;
  linked_criminal_name?: string | null;
  created_at: string;
}

interface FIRComment {
  id: number;
  fir_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  user_name: string;
  user_role: string;
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
  reason?: string;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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





  // Deploy Officer States
  const [deployName, setDeployName] = useState('');
  const [deployBadge, setDeployBadge] = useState('');
  const [deployRank, setDeployRank] = useState('');
  const [deployStation] = useState('');

  // Criminal Form States (Add/Edit)
  const [isEditingCriminal, setIsEditingCriminal] = useState(false);
  const [selectedCriminalId, setSelectedCriminalId] = useState<string>('');

  // FIR details view states
  const [selectedFIRDetail, setSelectedFIRDetail] = useState<FIR | null>(null);
  const [comments, setComments] = useState<FIRComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    if (selectedFIRDetail) {
      setNotesText(selectedFIRDetail.investigation_notes || '');
    }
  }, [selectedFIRDetail]);

  const fetchComments = async (firId: number) => {
    try {
      const res = await fetch(`/api/firs/${firId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  useEffect(() => {
    if (selectedFIRDetail) {
      fetchComments(selectedFIRDetail.id);
    }
  }, [selectedFIRDetail]);

  useEffect(() => {
    if (selectedFIRDetail && firs.length > 0) {
      const updated = firs.find(f => f.id === selectedFIRDetail.id);
      if (updated) {
        setSelectedFIRDetail(updated);
      }
    }
  }, [firs]);

  const handleAssignOfficerDetail = async (officerId: number) => {
    if (!selectedFIRDetail) return;
    try {
      const res = await fetch(`/api/firs/${selectedFIRDetail.id}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ officerId })
      });
      if (res.ok) {
        alert('Officer assigned successfully.');
        await fetchDashboardData(true);
      } else {
        alert('Failed to assign officer.');
      }
    } catch (err) {
      console.error(err);
      alert('Error assigning officer.');
    }
  };

  const handleLinkCriminalDetail = async (criminalId: number) => {
    if (!selectedFIRDetail) return;
    try {
      const res = await fetch(`/api/firs/${selectedFIRDetail.id}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ criminalId })
      });
      if (res.ok) {
        alert('Criminal linked successfully.');
        await fetchDashboardData(true);
      } else {
        alert('Failed to link criminal.');
      }
    } catch (err) {
      console.error(err);
      alert('Error linking criminal.');
    }
  };

  const handleUpdateStatusDetail = async (status: FIR['status']) => {
    if (!selectedFIRDetail) return;
    try {
      const res = await fetch(`/api/firs/${selectedFIRDetail.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, remarks: `Status updated to ${status}` })
      });
      if (res.ok) {
        alert('Status updated successfully.');
        await fetchDashboardData(true);
      } else {
        alert('Failed to update status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    }
  };

  const handleUpdatePriorityDetail = async (priority: FIR['priority']) => {
    if (!selectedFIRDetail) return;
    try {
      const res = await fetch(`/api/firs/${selectedFIRDetail.id}/priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ priority })
      });
      if (res.ok) {
        alert('Priority updated successfully.');
        await fetchDashboardData(true);
      } else {
        alert('Failed to update priority.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating priority.');
    }
  };

  const handleSaveNotesDetail = async (notes: string) => {
    if (!selectedFIRDetail) return;
    try {
      const res = await fetch(`/api/firs/${selectedFIRDetail.id}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });
      if (res.ok) {
        await fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFIRDetail || !newCommentText.trim()) return;
    try {
      const res = await fetch(`/api/firs/${selectedFIRDetail.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comment: newCommentText })
      });
      if (res.ok) {
        setNewCommentText('');
        fetchComments(selectedFIRDetail.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadEvidence = (url: string) => {
    const filename = url.split('/').pop() || 'evidence';
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const blobURL = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobURL;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobURL);
        document.body.removeChild(a);
      })
      .catch(err => {
        console.error('Download failed:', err);
        // Fallback to direct window open / navigation
        window.open(url, '_blank');
      });
  };
  const [suspectName, setSuspectName] = useState('');
  const [suspectAge, setSuspectAge] = useState('');
  const [suspectCrime, setSuspectCrime] = useState(''
    
  );
  const [suspectFIRId, setSuspectFIRId] = useState('');

  // Traffic Challan Form States
  const [challanVehicle, setChallanVehicle] = useState('');
  const [challanAmount, setChallanAmount] = useState('');
  const [challanUserId, setChallanUserId] = useState('');
  const [challanReason, setChallanReason] = useState('');

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
          reason: challanReason || 'Traffic Violation',
          amount: parseFloat(challanAmount),
          status: 'Unpaid'
        })
      });

      if (res.ok) {
        alert('Challan traffic memo issued successfully in MySQL.');
        setChallanVehicle('');
        setChallanAmount('');
        setChallanUserId('');
        setChallanReason('');
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

  const getPriorityBadge = (priority: FIR['priority']) => {
    switch (priority) {
      case 'Low':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Low
          </span>
        );
      case 'Medium':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Medium
          </span>
        );
      case 'High':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            High
          </span>
        );
      case 'Emergency':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200 animate-pulse">
            Emergency
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-50 text-slate-700 border border-slate-200">
            Low
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

  const renderEvidenceItem = (url: string) => {
    if (!url) return null;
    const urls = url.split(',').map(u => u.trim()).filter(Boolean);
    return (
      <div className="space-y-2">
        {urls.map((singleUrl, idx) => {
          const isImg = /\.(jpg|jpeg|png|gif)$/i.test(singleUrl);
          const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(singleUrl);
          const filename = singleUrl.split('/').pop() || `Evidence File ${idx + 1}`;
          
          return (
            <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  {isImg ? (
                    <Eye className="w-5 h-5 text-blue-600" />
                  ) : isVideo ? (
                    <BarChart3 className="w-5 h-5 text-purple-650" />
                  ) : (
                    <FileText className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{filename}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Real-time database sync</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => window.open(singleUrl, '_blank')} 
                  className="text-blue-600 hover:bg-blue-50 py-1.5 px-2.5 rounded h-8 border border-slate-200 bg-white font-bold text-xs"
                >
                  View
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => handleDownloadEvidence(singleUrl)} 
                  className="text-slate-650 hover:bg-slate-50 py-1.5 px-2.5 rounded h-8 border border-slate-200 bg-white font-bold text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const buildTimeline = (fir: FIR) => {
    const steps = [];
    
    // 1. Created
    steps.push({
      title: 'FIR Created',
      date: new Date(fir.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      description: 'Complaint registered in database by citizen.',
      done: true
    });
    
    // 2. Assigned
    const hasOfficer = !!fir.assigned_officer_name;
    steps.push({
      title: 'Assigned to Officer',
      description: hasOfficer ? `Assigned to ${fir.assigned_officer_name}.` : 'Pending officer assignment.',
      date: hasOfficer ? 'Active' : null,
      done: hasOfficer
    });

    // 3. Investigation Started
    const isInvestigating = ['Investigation Started', 'Under Review', 'Verified', 'Resolved'].includes(fir.status);
    steps.push({
      title: 'Investigation Started',
      description: isInvestigating ? 'Officer has initiated field/CCTV inquiry.' : 'Awaiting status transition.',
      date: isInvestigating ? 'In Progress' : null,
      done: isInvestigating
    });

    // 4. Closed / Rejected
    const isClosed = fir.status === 'Resolved';
    const isRejected = fir.status === 'Rejected';
    steps.push({
      title: isRejected ? 'Case Rejected' : 'Case Closed',
      description: isClosed ? 'Resolution filed and docket archived.' : isRejected ? 'Case rejected based on verification.' : 'Awaiting final case closure.',
      date: (isClosed || isRejected) ? 'Completed' : null,
      done: isClosed || isRejected
    });

    return steps;
  };


  return (
    <div className="min-h-screen bg-background text-foreground flex selection:bg-primary/20 font-sans relative overflow-hidden">
      
      {/* Sidebar overlay backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* 1. Sleek Collapsible/Responsive Dashboard Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card text-muted-foreground flex flex-col justify-between shrink-0 border-r border-border transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0 bg-card flex items-center justify-center">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-sm font-black text-foreground leading-none">Criminal Record Control</h2>
                <p className="text-[9px] text-primary font-bold uppercase mt-1 tracking-wider">Precinct Admin</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Nav links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <Map className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => { setActiveTab('firs'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'firs' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <FileSpreadsheet className="w-4 h-4" /> FIR Incidents
            </button>
            <button
              onClick={() => { setActiveTab('criminals'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'criminals' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <UserCheck className="w-4 h-4" /> Criminals
            </button>
            <button
              onClick={() => { setActiveTab('roster'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'roster' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <Users className="w-4 h-4" /> Roster Force
            </button>
            <button
              onClick={() => { setActiveTab('challans'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'challans' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <CreditCard className="w-4 h-4" /> Challans
            </button>
            <button
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
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
        <header className="h-16 bg-card border-b border-border px-4 sm:px-6 lg:px-8 flex justify-between items-center shadow-sm shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground md:hidden shrink-0"
              aria-label="Open sidebar drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-foreground truncate">
              {activeTab === 'dashboard' && 'Precinct Operations Command'}
              {activeTab === 'firs' && 'FIR Incidents & Assign Queue'}
              {activeTab === 'criminals' && 'Criminal Registry database'}
              {activeTab === 'roster' && 'On-Duty Station Officer Roster'}
              {activeTab === 'challans' && 'Traffic violations & fine logs'}
              {activeTab === 'reports' && 'Precinct Analytics & crime charts'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <OrganizationSwitcher 
              appearance={{
                elements: {
                  rootBox: "text-xs font-medium",
                  organizationSwitcherTrigger: "border border-border rounded-xl px-2 sm:px-3 py-1.5 hover:bg-muted text-xs font-bold text-foreground h-9"
                }
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => fetchDashboardData()} className="h-9 px-2.5 border border-border text-foreground hover:bg-muted">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </header>

        {/* Scrollable Main content area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6 lg:space-y-8 w-full">
          
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 animate-pulse">Synchronizing database...</div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="space-y-6 lg:space-y-8">
                  {/* Status counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
                    
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
                            <div key={e.id} className="p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-[#DC2626] uppercase text-[9px]">{e.request_type}</span>
                                  <span className="text-[9px] text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="font-semibold text-slate-800 truncate">Alert #{e.id}: {e.user_name || 'Citizen'}</p>
                                <p className="text-[9px] text-slate-400 font-mono">GPS: {e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}</p>
                              </div>

                              <div className="flex items-center gap-1.5 sm:self-center self-end shrink-0">
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
                    <Card className="lg:col-span-2 bg-white border border-[#E2E8F0] h-[300px] sm:h-[360px] overflow-hidden">
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
                selectedFIRDetail ? (
                  /* --------------------- DETAILED WORKSPACE VIEW --------------------- */
                  <div className="space-y-6">
                    {/* Workspace Header Panel */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => setSelectedFIRDetail(null)}
                          className="flex items-center gap-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shrink-0 font-bold text-xs"
                        >
                          <ArrowLeft className="w-4 h-4" /> Back to List
                        </Button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              FIR-{selectedFIRDetail.id}
                            </span>
                            {getStatusBadge(selectedFIRDetail.status)}
                            {getPriorityBadge(selectedFIRDetail.priority)}
                          </div>
                          <h3 className="text-base font-extrabold text-slate-800 truncate mt-1">
                            {selectedFIRDetail.title}
                          </h3>
                        </div>
                      </div>
                      
                      {/* Case shortcut buttons */}
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                        {selectedFIRDetail.status !== 'Resolved' && (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleUpdateStatusDetail('Resolved')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-1 sm:flex-initial"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1 inline-block" /> Close Case
                          </Button>
                        )}
                        {selectedFIRDetail.status !== 'Rejected' && selectedFIRDetail.status !== 'Resolved' && (
                          <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={() => handleUpdateStatusDetail('Rejected')}
                            className="bg-red-650 hover:bg-red-700 text-white font-bold text-xs flex-1 sm:flex-initial"
                          >
                            <X className="w-3.5 h-3.5 mr-1 inline-block" /> Reject Case
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Main Split Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      
                      {/* Left Side Workspace (Citizen details, Statement, Evidence, Comments) */}
                      <div className="lg:col-span-2 space-y-6">
                        
                        {/* Complaint details card */}
                        <Card className="bg-white border border-[#E2E8F0]">
                          <CardHeader className="border-b border-[#E2E8F0] py-4">
                            <CardTitle className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                              Complaint & Citizen Contact Info
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Incident Date</span>
                                <p className="font-bold text-slate-800">
                                  {new Date(selectedFIRDetail.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Incident Location</span>
                                <p className="font-bold text-slate-800">{selectedFIRDetail.location}</p>
                              </div>
                            </div>

                            <div className="border-t border-slate-100 pt-6">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Citizen Info</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Name</span>
                                  <p className="font-bold text-slate-800">{selectedFIRDetail.citizen_name || 'Anonymous'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Phone</span>
                                  <p className="font-bold text-slate-800">{selectedFIRDetail.citizen_phone || 'Not Registered'}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Email</span>
                                  <p className="font-bold text-slate-800">{selectedFIRDetail.citizen_email || 'Not Registered'}</p>
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-slate-100 pt-6">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Statement / Incident Description</h4>
                              <div className="p-4 bg-slate-50 border-l-4 border-primary rounded-r-xl text-xs text-slate-700 italic font-medium leading-relaxed">
                                "{selectedFIRDetail.description}"
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Evidence Uploads Card */}
                        <Card className="bg-white border border-[#E2E8F0]">
                          <CardHeader className="border-b border-[#E2E8F0] py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Paperclip className="w-4 h-4 text-primary" /> Citizen Uploaded Evidence
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-3">
                            {/* Render actual uploaded media file if exists */}
                            {selectedFIRDetail.evidence_url ? (
                              renderEvidenceItem(selectedFIRDetail.evidence_url)
                            ) : (
                              <p className="text-xs text-slate-400 italic">No custom evidence documents uploaded by the citizen.</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Comments / Correspondence feed */}
                        <Card className="bg-white border border-[#E2E8F0] flex flex-col h-[400px]">
                          <CardHeader className="border-b border-[#E2E8F0] py-4 flex flex-row items-center justify-between shrink-0">
                            <CardTitle className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <MessageSquare className="w-4 h-4 text-primary" /> Police ↔ Citizen Comments Log
                            </CardTitle>
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-100 text-slate-500">
                              {comments.length} Messages
                            </span>
                          </CardHeader>
                          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/20 flex flex-col">
                            {comments.length > 0 ? (
                              comments.map(c => {
                                const isOfficer = ['police', 'inspector', 'admin'].includes(c.user_role);
                                return (
                                  <div 
                                    key={c.id}
                                    className={`flex flex-col max-w-[85%] p-3.5 rounded-2xl shadow-sm text-xs border ${
                                      isOfficer 
                                        ? 'bg-blue-50/80 text-slate-800 border-blue-200 rounded-tr-none self-end ml-auto'
                                        : 'bg-white text-slate-800 border-slate-200 rounded-tl-none self-start mr-auto'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span className="font-bold text-slate-700">{c.user_name}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                        isOfficer ? 'bg-blue-100 text-blue-800' : 'bg-slate-150 text-slate-600'
                                      }`}>
                                        {c.user_role}
                                      </span>
                                      <span className="text-[8px] text-slate-400 font-mono ml-auto">
                                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="leading-relaxed font-medium break-words">{c.comment}</p>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="m-auto text-slate-400 text-xs py-8 text-center">
                                No comments posted. Send a request or query to the citizen using the input field below.
                              </div>
                            )}
                          </CardContent>
                          <form onSubmit={handlePostComment} className="flex gap-2 p-3 border-t border-[#E2E8F0] bg-slate-50/40 shrink-0">
                            <Input
                              type="text"
                              placeholder="Message details..."
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              className="bg-white border-slate-200 text-xs py-2 h-10 rounded-xl"
                              required
                            />
                            <Button type="submit" variant="primary" className="bg-[#1E40AF] text-white py-2 px-4 h-10 rounded-xl flex items-center gap-1.5 shrink-0 font-bold text-xs shadow-md">
                              <Send className="w-3.5 h-3.5" /> Send
                            </Button>
                          </form>
                        </Card>
                      </div>

                      {/* Right Side Control Workspace (Actions, Notes, Timeline) */}
                      <div className="space-y-6">
                        
                        {/* Case management actions card */}
                        <Card className="bg-white border border-[#E2E8F0]">
                          <CardHeader className="border-b border-[#E2E8F0] py-4">
                            <CardTitle className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-primary" /> Incident Actions Panel
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-4">
                            {/* Update Status Selection */}
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Update Status</label>
                              <Select 
                                value={selectedFIRDetail.status} 
                                onChange={(e) => handleUpdateStatusDetail(e.target.value as FIR['status'])}
                                className="text-xs"
                              >
                                <option value="Submitted">Pending</option>
                                <option value="Pending Review">Need More Information</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Verified">Verified Case</option>
                                <option value="Investigation Started">Under Investigation</option>
                                <option value="Resolved">Closed</option>
                                <option value="Rejected">Rejected</option>
                              </Select>
                            </div>

                            {/* Update Priority Selection */}
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Priority Level</label>
                              <Select 
                                value={selectedFIRDetail.priority} 
                                onChange={(e) => handleUpdatePriorityDetail(e.target.value as FIR['priority'])}
                                className="text-xs"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Emergency">Emergency</option>
                              </Select>
                            </div>

                            {/* Officer Assignment Dropdown */}
                            <div className="space-y-1 pt-3 border-t border-slate-100">
                              <label className="text-xs font-bold text-slate-600">Assign Officer (assigned_officer_id)</label>
                              <Select 
                                value={selectedFIRDetail.assigned_officer_id?.toString() || ""} 
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignOfficerDetail(parseInt(e.target.value, 10));
                                  }
                                }}
                                className="text-xs font-semibold"
                              >
                                <option value="">-- Choose officer to assign --</option>
                                {officers.map(o => (
                                  <option key={o.id} value={o.id}>
                                    {o.name} ({o.rank} - {o.activeCases} cases)
                                  </option>
                                ))}
                              </Select>
                              {selectedFIRDetail.assigned_officer_name && (
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                                  In Charge: <span className="text-primary font-bold">{selectedFIRDetail.assigned_officer_name}</span>
                                </p>
                              )}
                            </div>

                            {/* Link Criminal Record Selector */}
                            <div className="space-y-1 pt-3 border-t border-slate-100">
                              <label className="text-xs font-bold text-slate-600">Link Suspect Criminal Record</label>
                              <div className="flex gap-2">
                                <Select 
                                  value={selectedCriminalId} 
                                  onChange={(e) => setSelectedCriminalId(e.target.value)}
                                  className="text-xs flex-1"
                                >
                                  <option value="">-- Select Suspect --</option>
                                  {criminals.map(c => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} (Offense: {c.crime_type})
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    if (selectedCriminalId) {
                                      handleLinkCriminalDetail(parseInt(selectedCriminalId, 10));
                                      setSelectedCriminalId("");
                                    } else {
                                      alert("Please choose a suspect criminal profile first.");
                                    }
                                  }}
                                  className="bg-[#1E40AF] text-white text-[10px] py-1.5 px-2.5 h-9 shrink-0 font-bold rounded-lg shadow-sm"
                                >
                                  Link Criminal
                                </Button>
                              </div>
                              {selectedFIRDetail.linked_criminal_name && (
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                                  Attached Suspect: <span className="text-purple-600 font-bold">{selectedFIRDetail.linked_criminal_name}</span>
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Investigation notes card */}
                        <Card className="bg-white border border-[#E2E8F0]">
                          <CardHeader className="border-b border-[#E2E8F0] py-4 flex items-center justify-between">
                            <CardTitle className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-primary" /> Investigation Notes
                            </CardTitle>
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1 py-0.5 rounded border border-slate-150">investigation_notes</span>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-4">
                            <textarea
                              rows={5}
                              placeholder="Write log notes here..."
                              className="flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-slate-800 font-medium leading-relaxed"
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                            />
                            <Button
                              variant="primary"
                              onClick={() => {
                                handleSaveNotesDetail(notesText);
                                alert("Investigation notes saved successfully.");
                              }}
                              className="w-full bg-[#1E40AF] hover:bg-[#1e3a8a] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md"
                            >
                              Add Note / Save
                            </Button>
                          </CardContent>
                        </Card>

                        {/* Case Timeline Stepper */}
                        <Card className="bg-white border border-[#E2E8F0]">
                          <CardHeader className="border-b border-[#E2E8F0] py-4">
                            <CardTitle className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-primary" /> Visual case Timeline
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <div className="relative pl-6 border-l-2 border-slate-100 space-y-5">
                              {buildTimeline(selectedFIRDetail).map((step, idx) => (
                                <div key={idx} className="relative">
                                  <span className={`absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full border-2 bg-white flex items-center justify-center ${
                                    step.done 
                                      ? 'border-emerald-500 text-emerald-500 font-bold' 
                                      : 'border-slate-200 text-slate-300'
                                  }`}>
                                    <span className={`w-2 h-2 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                  </span>
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <h5 className={`text-xs font-bold ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {step.title}
                                      </h5>
                                      {step.date && (
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                          step.date === 'Active' || step.date === 'In Progress'
                                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                            : step.date === 'Completed'
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {step.date}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">
                                      {step.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                    </div>
                  </div>
                ) : (
                  /* --------------------- COMPACT LEDGER TABLE VIEW --------------------- */
                  <Card className="bg-white border border-[#E2E8F0] overflow-hidden shadow-sm">
                    <CardHeader className="border-b border-[#E2E8F0] flex justify-between items-start sm:items-center px-6 py-4 flex-col sm:flex-row gap-4 bg-slate-50/40">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <FileSpreadsheet className="w-4.5 h-4.5 text-[#1E40AF]" /> Complaint FIR Ledger List
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Click any row below to open the dedicated officer workspace and investigate details</p>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-xs min-w-[600px] table-layout-fixed">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase select-none">
                              <th className="py-3.5 px-6 w-24">FIR ID</th>
                              <th className="py-3.5 px-6">Citizen</th>
                              <th className="py-3.5 px-6">Status</th>
                              <th className="py-3.5 px-6">Priority</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {firs.length > 0 ? (
                              firs.map(f => (
                                <tr 
                                  key={f.id} 
                                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                                  onClick={() => setSelectedFIRDetail(f)}
                                >
                                  <td className="py-4 px-6 font-mono font-bold text-slate-600">FIR-{f.id}</td>
                                  <td className="py-4 px-6 font-bold text-slate-800">
                                    {f.citizen_name || `Citizen ID: ${f.citizen_id}`}
                                  </td>
                                  <td className="py-4 px-6">{getStatusBadge(f.status)}</td>
                                  <td className="py-4 px-6">{getPriorityBadge(f.priority)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-12 text-center text-xs text-slate-400 font-semibold">
                                  No FIR complaints currently registered in database.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}

              {activeTab === 'criminals' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
                  {/* Suspect Registry Table */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0] overflow-hidden">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-purple-600" /> Suspect Criminal History Registry
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {criminals.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left text-xs min-w-[600px]">
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
                  {/* Deployed Officers */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0]">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" /> Active Roster Deployed Force
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                      {officers.map(o => (
                        <div key={o.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between min-h-[120px] h-auto shadow-sm gap-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-800 truncate">{o.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{o.rank} | Badge: {o.badge_number}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full shrink-0 ${o.status === 'Available' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : o.status === 'On Patrol' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
                  {/* Challan table */}
                  <Card className="lg:col-span-2 bg-white border border-[#E2E8F0] overflow-hidden">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <CreditCard className="w-4.5 h-4.5 text-[#1E40AF]" /> Traffic violation challan Logs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {challans.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead>
                              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase">
                                <th className="py-3 px-6">Challan ID</th>
                                <th className="py-3 px-6">Vehicle No</th>
                                <th className="py-3 px-6">Reason</th>
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
                                  <td className="py-3.5 px-6 text-slate-600">{c.reason || 'Traffic Violation'}</td>
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
                        <Plus className="w-4.5 h-4.5 text-[#1E40AF]" /> Issue Traffic Challan
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
                          <label className="text-xs font-bold text-slate-600">Violation Reason</label>
                          <Input
                            type="text"
                            required
                            placeholder="E.g., Speeding, No Helmet, Illegal Parking"
                            value={challanReason}
                            onChange={(e) => setChallanReason(e.target.value)}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-white border border-[#E2E8F0] p-6 flex flex-col h-[300px] sm:h-[360px]">
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

                    <Card className="bg-white border border-[#E2E8F0] p-6 flex flex-col h-[300px] sm:h-[360px]">
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
