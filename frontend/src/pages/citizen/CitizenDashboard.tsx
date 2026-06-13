import React, { useState, useEffect, useRef } from 'react';
import { FileText, MapPin, Upload, CheckCircle2, AlertCircle, LogOut, Home, PlusCircle, User, AlertOctagon, X, CreditCard, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface FIR {
  id: number;
  citizen_id?: number;
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
  officer_name?: string | null;
  officer_badge?: string | null;
}

interface Challan {
  id: number;
  user_id?: number | null;
  vehicle_no: string;
  reason?: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  issue_date: string;
}

// Map Click Listener to select coordinates
const MapClickListener = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to dynamically center the map on position updates
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

export const CitizenDashboard: React.FC = () => {
  const { token, user, logout } = useAuth();
  
  // Tab control matching user request
  const [activeTab, setActiveTab] = useState<'dashboard' | 'firs' | 'file' | 'emergency' | 'profile' | 'fines'>('dashboard');
  const [firs, setFirs] = useState<FIR[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFIR, setSelectedFIR] = useState<FIR | null>(null);
  
  // Payment gateway states
  const [selectedChallanForPayment, setSelectedChallanForPayment] = useState<Challan | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Real-time status update alert states
  interface FIRStatusNotification {
    firId: number;
    title: string;
    status: string;
    remarks: string;
  }
  const [notification, setNotification] = useState<FIRStatusNotification | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // New Complaint Form States
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('Mobile Theft');
  const [formLocation, setFormLocation] = useState('');
  const [latLng, setLatLng] = useState<[number, number]>([12.9716, 77.5946]); // Bangalore default
  const [accusedName, setAccusedName] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Complainant Details
  const [complainantName, setComplainantName] = useState('');
  const [complainantAge, setComplainantAge] = useState('');
  const [complainantPhone, setComplainantPhone] = useState('');
  const [complainantAddress, setComplainantAddress] = useState('');
  const [complainantCitizenId, setComplainantCitizenId] = useState('');

  // Incident Details
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [incidentPriority, setIncidentPriority] = useState('Medium');

  // Suspect Information
  const [suspectGender, setSuspectGender] = useState('Male');
  const [suspectAge, setSuspectAge] = useState('');
  const [suspectHeight, setSuspectHeight] = useState('');
  const [suspectClothing, setSuspectClothing] = useState('');
  const [suspectDetails, setSuspectDetails] = useState('');

  // Witness Details
  const [witnessName, setWitnessName] = useState('');
  const [witnessPhone, setWitnessPhone] = useState('');
  const [witnessStatement, setWitnessStatement] = useState('');

  useEffect(() => {
    if (user) {
      setComplainantName(user.name || '');
      setComplainantCitizenId(`CIT-${1000 + user.id}`);
    }
  }, [user]);



  // Fetch FIRs from database
  const fetchFIRs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/firs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        // Parallel call to fetch cases and map officer allocations
        const casesRes = await fetch('/api/cases', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        let casesData = [];
        if (casesRes.ok) {
          casesData = await casesRes.json();
        }

        const enriched = data.map((f: FIR) => {
          const linkedCase = casesData.find((c: any) => c.fir_id === f.id);
          return {
            ...f,
            officer_name: linkedCase ? linkedCase.officer_name : null,
            officer_badge: linkedCase ? linkedCase.officer_badge : null
          };
        });
        setFirs(enriched);
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Challans from MySQL database
  const fetchChallans = async () => {
    try {
      const res = await fetch('/api/challans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChallans(data);
      }
    } catch (err) {
      console.error('Error fetching challans:', err);
    }
  };

  const handlePayChallan = async (challanId: number) => {
    try {
      setPaymentProcessing(true);
      // Simulate network request to payment gateway / banking system
      await new Promise(resolve => setTimeout(resolve, 1500));

      const res = await fetch(`/api/challans/${challanId}/pay`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert('Payment processed successfully. Fines registry updated.');
        setSelectedChallanForPayment(null);
        fetchChallans(); // Reload list
      } else {
        alert('Failed to clear traffic fine.');
      }
    } catch (err) {
      console.error(err);
      alert('Payment processing error. Please retry.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleDownloadReceipt = (challan: Challan) => {
    const receiptContent = `
===================================================
      PRECINCT TRAFFIC VIOLATION PAYMENT RECEIPT
===================================================
Receipt Transaction ID: REC-CH-${challan.id}-${Math.floor(1000 + Math.random() * 9000)}
Challan ID: CH-${challan.id}
Vehicle Registration No: ${challan.vehicle_no}
Violation Reason: ${challan.reason || 'Traffic Violation'}
Complainant / Driver ID: USER-${challan.user_id || 'ANON'}
Fine Violation Amount: INR ${challan.amount}
Payment Ledger Status: PAID / ARCHIVED CLEARANCE

Authorized Stamp: Precinct Precinct Administration
===================================================
Thank you for your transaction. Keep this receipt copy
safe for any verification by traffic control patrols.
===================================================
    `;
    const element = document.createElement("a");
    const file = new Blob([receiptContent.trim()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `receipt_challan_CH${challan.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  useEffect(() => {
    if (token) {
      fetchFIRs();
      fetchChallans();

      // Establish Socket connections for real-time status change alerts
      const socket = io('http://localhost:5000');
      socketRef.current = socket;

      socket.on('fir_status_update', (data: { firId: number; citizenId: number; title: string; status: string; remarks: string }) => {
        // Only trigger popup if this is the citizen's own FIR complaint
        if (user && data.citizenId === user.id) {
          setNotification({
            firId: data.firId,
            title: data.title,
            status: data.status,
            remarks: data.remarks
          });
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token, user]);

  // Fetch address from latitude and longitude (Reverse Geocoding)
  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: {
          'User-Agent': 'cipms-app/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setFormLocation(data.display_name);
          return;
        }
      }
    } catch (err) {
      console.error('Error in reverse geocoding:', err);
    }
    setFormLocation(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
  };

  // Search address and update map coordinates (Forward Geocoding)
  const syncMapFromAddress = async (address: string) => {
    if (!address || address.trim().length < 3) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
        headers: {
          'User-Agent': 'cipms-app/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          setLatLng([lat, lon]);
        }
      }
    } catch (err) {
      console.error('Error in forward geocoding:', err);
    }
  };

  // Handle map coordinates selection
  const handleMapClick = (lat: number, lng: number) => {
    setLatLng([lat, lng]);
    setFormLocation('Detecting address...');
    fetchAddressFromCoords(lat, lng);
  };

  // Get current GPS position
  const triggerCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setLatLng([latitude, longitude]);
          setFormLocation('Detecting address...');
          fetchAddressFromCoords(latitude, longitude);
        },
        (err) => {
          console.error(err);
          alert('GPS access denied. Select incident spot on map.');
        }
      );
    }
  };

  // Upload evidence attachments (multiple files)
  const handleMultipleFileUploads = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    try {
      setUploading(true);
      for (const file of files) {
        const formData = new FormData();
        formData.append('evidence', file);
        const res = await fetch('/api/firs/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          urls.push(data.fileUrl);
        } else {
          console.error('File upload failed for', file.name);
        }
      }
    } catch (err) {
      console.error('Error during file uploads:', err);
    } finally {
      setUploading(false);
    }
    return urls;
  };

  // Submit Complaint
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formDesc || !formLocation) {
      alert('All required fields must be complete.');
      return;
    }

    try {
      setSubmitting(true);
      
      // Upload evidence files
      let evidenceUrls: string[] = [];
      if (evidenceFiles.length > 0) {
        evidenceUrls = await handleMultipleFileUploads(evidenceFiles);
      }

      // Serialize structured details into description JSON
      const structuredDescription = JSON.stringify({
        narrative: formDesc,
        complainant: {
          name: complainantName,
          age: parseInt(complainantAge, 10) || null,
          phone: complainantPhone || null,
          address: complainantAddress || null,
          citizenIdCode: complainantCitizenId || null
        },
        incident: {
          date: incidentDate || null,
          time: incidentTime || null,
          priority: incidentPriority || 'Medium'
        },
        suspect: {
          gender: suspectGender || 'Unknown',
          age: suspectAge || null,
          height: suspectHeight || null,
          clothing: suspectClothing || null,
          details: suspectDetails || null
        },
        witness: {
          name: witnessName || null,
          phone: witnessPhone || null,
          statement: witnessStatement || null
        },
        evidenceUrls
      });

      const res = await fetch('/api/firs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formTitle,
          description: structuredDescription,
          crimeType: formType,
          location: formLocation,
          accusedName: accusedName || null,
          evidenceUrl: evidenceUrls.length > 0 ? evidenceUrls[0] : null
        })
      });

      if (res.ok) {
        alert('Complaint registered successfully.');
        setFormTitle('');
        setFormDesc('');
        setAccusedName('');
        setFormLocation('');
        setEvidenceFiles([]);
        setComplainantAge('');
        setComplainantPhone('');
        setComplainantAddress('');
        setIncidentDate('');
        setIncidentTime('');
        setIncidentPriority('Medium');
        setSuspectGender('');
        setSuspectAge('');
        setSuspectHeight('');
        setSuspectClothing('');
        setSuspectDetails('');
        setWitnessName('');
        setWitnessPhone('');
        setWitnessStatement('');
        
        // Reset file input element
        const fileInput = document.getElementById('evidence-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        fetchFIRs();
        setActiveTab('firs');
      } else {
        const data = await res.json();
        alert(data.error || 'Registration failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting incident.');
    } finally {
      setSubmitting(false);
    }
  };



  // Trigger emergency SOS distress beacon
  const handleTriggerSOS = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const res = await fetch('/api/emergency', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            latitude,
            longitude,
            requestType: 'SOS Alert'
          })
        });
        if (res.ok) {
          alert('🚨 Emergency SOS broadcasted! Police dispatch is active.');
        } else {
          alert('Failed to trigger emergency dispatch.');
        }
      }, () => {
        alert('Coordinates required for SOS dispatch. Please enable location permissions.');
      });
    } catch (err) {
      console.error(err);
      alert('Error triggering SOS beacon.');
    }
  };

  // Dynamic approachable status badge mapping
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
  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans relative">
      {notification && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm z-50 p-4">
          <Card className="max-w-md w-full bg-white border border-[#E2E8F0] shadow-2xl p-6 relative rounded-2xl">
            <button 
              onClick={() => setNotification(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 text-[#1E40AF] mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">Case File Status Alert</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time Precinct Broadcast</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    FIR-{notification.firId}
                  </span>
                  <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full ${
                    notification.status === 'Resolved' 
                      ? 'bg-emerald-55 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-55 text-blue-700 border border-blue-200'
                  }`}>
                    {notification.status === 'Resolved' ? 'Closed' : 'Under Investigation'}
                  </span>
                </div>
                <p className="font-extrabold text-slate-850 text-sm mt-1">{notification.title}</p>
                <p className="text-slate-600 font-medium leading-relaxed mt-1">
                  {notification.status === 'Resolved' 
                    ? 'Your FIR complaint has been resolved and closed by precinct officers.' 
                    : 'Precision investigation is underway. Officers are reviewing details.'}
                </p>
              </div>

              {notification.remarks && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Precinct Remarks</span>
                  <p className="text-xs text-slate-700 bg-slate-50 border-l-4 border-[#1E40AF] p-3 rounded-r-xl italic font-medium leading-relaxed">
                    "{notification.remarks}"
                  </p>
                </div>
              )}

              <Button 
                variant="primary" 
                onClick={() => {
                  setNotification(null);
                  fetchFIRs(); // Refresh citizen list immediately!
                }}
                className="w-full bg-[#1E40AF] text-white py-2.5 rounded-xl font-bold text-xs shadow-md mt-2"
              >
                Acknowledge & Sync
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* 1. Sidebar */}
      <aside className="w-64 bg-card text-muted-foreground flex flex-col justify-between shrink-0 border-r border-border">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-border flex items-center gap-3 bg-slate-50/70">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0 bg-card flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground leading-none">Criminal Record Management</h2>
              <p className="text-[9px] text-primary font-bold uppercase mt-1 tracking-wider">Citizen Service</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedFIR(null); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <Home className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => { setActiveTab('firs'); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'firs' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <FileText className="w-4 h-4" />My FIRs
            </button>
            <button
              onClick={() => { setActiveTab('file'); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'file' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <PlusCircle className="w-4 h-4" /> File FIR
            </button>
            <button
              onClick={() => { setActiveTab('emergency'); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'emergency' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <AlertOctagon className="w-4 h-4" />Emergency
            </button>
            <button
              onClick={() => { setActiveTab('fines'); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'fines' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <CreditCard className="w-4 h-4" /> Traffic Fines
            </button>
            <button
              onClick={() => { setActiveTab('profile'); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'profile' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
            >
              <User className="w-4 h-4" /> Profile
            </button>
          </nav>
        </div>

        {/* Footer profile info */}
        <div className="p-4 border-t border-border bg-slate-50/70">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground uppercase select-none">
              {user?.name?.slice(0, 2)}
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground line-clamp-1">{user?.name}</p>
              <p className="text-[9px] text-muted-foreground font-medium">Citizen Account</p>
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

      {/* 2. Main content container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="h-16 bg-card border-b border-border px-8 flex justify-between items-center shadow-sm shrink-0">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
            {activeTab === 'dashboard' && 'Welcome Dashboard'}
            {activeTab === 'firs' && 'Track filed FIRs & status updates'}
            {activeTab === 'file' && 'Register New Digital Complaint (Zero-FIR)'}
            {activeTab === 'emergency' && 'Emergency Distress SOS Center'}
            {activeTab === 'fines' && 'Traffic Violation Fines Ledger'}
            {activeTab === 'profile' && 'Citizen Security Credentials'}
          </h2>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground">
              Welcome, <span className="font-extrabold text-foreground">{user?.name}</span>
            </span>
          </div>
        </header>

        {/* Scrollable Content View */}
        <main className="flex-1 p-8 overflow-y-auto space-y-8 w-full bg-slate-50/30">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 animate-pulse">Syncing safety portal...</div>
          ) : (
            <>
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8 max-w-6xl mx-auto">
                  {/* Welcome banner */}
                  <div className="p-6 bg-white border border-[#E2E8F0] rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">Welcome, {user?.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">Easily file new complaints, track existing cases, and view status transparency updates.</p>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white border border-[#E2E8F0] p-6 text-center hover:shadow-md transition-shadow duration-200">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">My Filed FIRs</p>
                      <p className="text-4xl font-black text-primary mt-2">{firs.length}</p>
                    </Card>
                    <Card className="bg-white border border-[#E2E8F0] p-6 text-center hover:shadow-md transition-shadow duration-200">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Investigating Cases</p>
                      <p className="text-4xl font-black text-emerald-600 mt-2">
                        {firs.filter(f => f.officer_name !== null && f.status !== 'Resolved' && f.status !== 'Rejected').length}
                      </p>
                    </Card>
                  </div>

                  {/* Large File FIR action button/card */}
                  <div 
                    onClick={() => setActiveTab('file')}
                    className="p-8 border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 rounded-2xl cursor-pointer text-center transition-all duration-200 group"
                  >
                    <p className="text-base font-black text-primary group-hover:scale-105 transition-transform duration-200 flex items-center justify-center gap-2">
                      <PlusCircle className="w-5 h-5" /> + File New FIR
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Submit digital statement directly. Legally binding under Section 173 BNSS.</p>
                  </div>

                  {/* Recent FIRs & SOS Emergency split view */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Recent FIRs Table */}
                    <Card className="lg:col-span-2 bg-white border border-[#E2E8F0] shadow-sm">
                      <CardHeader className="border-b border-[#E2E8F0] py-4">
                        <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">Recent Filed Complaints</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {firs.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-4">FIR ID</th>
                                  <th className="py-2.5 px-4">Complaint Title</th>
                                  <th className="py-2.5 px-4">Status</th>
                                  <th className="py-2.5 px-4 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E2E8F0]">
                                {firs.slice(0, 5).map(f => (
                                  <tr key={f.id} className="hover:bg-slate-50/50">
                                    <td className="py-3 px-4 font-mono font-bold text-slate-500">FIR-{String(f.id).padStart(3, '0')}</td>
                                    <td className="py-3 px-4 font-semibold text-slate-800">{f.title}</td>
                                    <td className="py-3 px-4">{getStatusBadge(f.status)}</td>
                                    <td className="py-3 px-4 text-right">
                                      <button
                                        onClick={() => { setSelectedFIR(f); setActiveTab('firs'); }}
                                        className="text-xs font-bold text-primary hover:underline"
                                      >
                                        Track
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-8 text-center text-slate-400 text-xs">No FIR complaints filed.</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* SOS Beacon Emergency Panel */}
                    <Card className="bg-white border border-[#E2E8F0] shadow-sm flex flex-col justify-between p-6">
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Emergency Dispatch</p>
                        <h4 className="text-base font-extrabold text-slate-800">Need Immediate Assistance?</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Broadcasting SOS grabs coordinates and alerts local precinct command centers instantly for immediate responder dispatch.
                        </p>
                      </div>
                      <div className="pt-6">
                        <button
                          onClick={handleTriggerSOS}
                          className="w-full py-4 rounded-xl bg-red-650 hover:bg-red-700 text-white font-black text-sm uppercase tracking-wider shadow-lg hover:shadow-red-600/30 transition-all duration-200 animate-pulse flex items-center justify-center gap-2"
                        >
                          🚨 SOS Button
                        </button>
                      </div>
                    </Card>

                  </div>
                </div>
              )}

              {/* MY FIRS TAB */}
              {activeTab === 'firs' && (
                <div className="max-w-6xl mx-auto space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    
                    {/* List Table of Complaints */}
                    <Card className="lg:col-span-2 bg-white border border-[#E2E8F0] shadow-sm">
                      <CardHeader className="border-b border-[#E2E8F0]">
                        <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                          <FileText className="w-4.5 h-4.5 text-blue-600" /> Active Filed Complaint Dossiers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {firs.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-3 px-6">FIR ID</th>
                                  <th className="py-3 px-6">Title</th>
                                  <th className="py-3 px-6">Status</th>
                                  <th className="py-3 px-6 text-right">Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E2E8F0]">
                                {firs.map(f => (
                                  <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3.5 px-6 font-mono font-bold text-slate-500">FIR-{String(f.id).padStart(3, '0')}</td>
                                    <td className="py-3.5 px-6">
                                      <p className="font-semibold text-slate-800">{f.title}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{f.crime_type}</p>
                                    </td>
                                    <td className="py-3.5 px-6">{getStatusBadge(f.status)}</td>
                                    <td className="py-3.5 px-6 text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedFIR(f)}
                                        className="text-blue-600 hover:bg-blue-50 text-xs font-bold py-1 px-2.5 rounded-lg border border-transparent hover:border-blue-100"
                                      >
                                        Track
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-10 text-center text-slate-400 text-xs">No FIR complaints filed.</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Tracker / Detail View */}
                    <Card className="bg-white border border-[#E2E8F0] shadow-sm">
                      <CardHeader className="border-b border-[#E2E8F0]">
                        <CardTitle className="text-sm font-extrabold text-slate-800">Transparency Audit Tracker</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        {selectedFIR ? (
                          (() => {
                            let parsedFIRDesc: any = null;
                            try {
                              parsedFIRDesc = JSON.parse(selectedFIR.description);
                            } catch (e) {}

                            return (
                              <div className="space-y-6">
                                <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="font-mono text-[10px] text-slate-400 font-bold">
                                      FIR-{String(selectedFIR.id).padStart(3, '0')}
                                    </span>
                                    {getStatusBadge(selectedFIR.status)}
                                  </div>
                                  <h4 className="font-bold text-slate-800">{selectedFIR.title}</h4>
                                  
                                  {parsedFIRDesc ? (
                                    <div className="space-y-3 pt-2 text-[11px]">
                                      <div className="p-2.5 bg-white border border-slate-100 rounded-lg space-y-1">
                                        <p className="font-bold text-[9px] uppercase tracking-wide text-blue-600">Incident Narrative</p>
                                        <p className="text-slate-655 leading-relaxed">{parsedFIRDesc.narrative}</p>
                                      </div>

                                      <div className="p-2.5 bg-white border border-slate-100 rounded-lg space-y-1">
                                        <p className="font-bold text-[9px] uppercase tracking-wide text-blue-600">Complainant Details</p>
                                        <p className="text-slate-600"><strong>Name:</strong> {parsedFIRDesc.complainant?.name || selectedFIR.citizen_name}</p>
                                        <p className="text-slate-600"><strong>Age:</strong> {parsedFIRDesc.complainant?.age} | <strong>Phone:</strong> {parsedFIRDesc.complainant?.phone}</p>
                                        <p className="text-slate-600"><strong>Address:</strong> {parsedFIRDesc.complainant?.address}</p>
                                      </div>

                                      <div className="p-2.5 bg-white border border-slate-100 rounded-lg space-y-1">
                                        <p className="font-bold text-[9px] uppercase tracking-wide text-blue-600">Incident Specifications</p>
                                        <p className="text-slate-600"><strong>Date:</strong> {parsedFIRDesc.incident?.date} | <strong>Time:</strong> {parsedFIRDesc.incident?.time}</p>
                                        <p className="text-slate-655"><strong>Priority:</strong> <span className={`font-bold ${parsedFIRDesc.incident?.priority === 'High' ? 'text-red-500' : 'text-slate-600'}`}>{parsedFIRDesc.incident?.priority}</span></p>
                                      </div>

                                      {selectedFIR.accused_name && (
                                        <div className="p-2.5 bg-white border border-slate-100 rounded-lg space-y-1">
                                          <p className="font-bold text-[9px] uppercase tracking-wide text-blue-600">Suspect Information</p>
                                          <p className="text-slate-600"><strong>Accused Suspect:</strong> <span className="text-red-650 font-bold">{selectedFIR.accused_name}</span></p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-slate-500 leading-relaxed text-[11px]">{selectedFIR.description}</p>
                                      <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200 space-y-1">
                                        <p><strong>Category:</strong> {selectedFIR.crime_type}</p>
                                        <p><strong>Location:</strong> {selectedFIR.location}</p>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Timeline Visual */}
                                <div className="space-y-4 relative pl-5 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                                  <div className="relative text-xs">
                                    <div className="absolute -left-[23px] top-0.5 rounded-full p-0.5 bg-emerald-100 text-emerald-600">
                                      <CheckCircle2 className="w-3 h-3" />
                                    </div>
                                    <p className="font-bold text-slate-800">Complaint Submitted</p>
                                    <p className="text-[9px] text-slate-400">{new Date(selectedFIR.created_at).toLocaleString()}</p>
                                  </div>

                                  <div className="relative text-xs">
                                    <div className={`absolute -left-[23px] top-0.5 rounded-full p-0.5 ${['Under Review', 'Verified', 'Investigation Started', 'Resolved'].includes(selectedFIR.status) ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                      {['Under Review', 'Verified', 'Investigation Started', 'Resolved'].includes(selectedFIR.status) ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                    </div>
                                    <p className={`font-bold ${['Under Review', 'Verified', 'Investigation Started', 'Resolved'].includes(selectedFIR.status) ? 'text-slate-800' : 'text-slate-400'}`}>Under Review</p>
                                  </div>

                                  <div className="relative text-xs">
                                    <div className={`absolute -left-[23px] top-0.5 rounded-full p-0.5 ${['Verified', 'Investigation Started', 'Resolved'].includes(selectedFIR.status) ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                      {['Verified', 'Investigation Started', 'Resolved'].includes(selectedFIR.status) ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                    </div>
                                    <p className={`font-bold ${['Verified', 'Investigation Started', 'Resolved'].includes(selectedFIR.status) ? 'text-slate-800' : 'text-slate-400'}`}>Investigating Officer Assigned</p>
                                    {selectedFIR.officer_name ? (
                                      <p className="text-[10px] text-slate-500 mt-0.5">Officer: {selectedFIR.officer_name} (Badge: {selectedFIR.officer_badge})</p>
                                    ) : (
                                      <p className="text-[9px] text-slate-400">Waiting in queue</p>
                                    )}
                                  </div>

                                  <div className="relative text-xs">
                                    <div className={`absolute -left-[23px] top-0.5 rounded-full p-0.5 ${selectedFIR.status === 'Resolved' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                      {selectedFIR.status === 'Resolved' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                    </div>
                                    <p className={`font-bold ${selectedFIR.status === 'Resolved' ? 'text-emerald-600' : 'text-slate-400'}`}>Incident Closed</p>
                                    {selectedFIR.remarks && (
                                      <div className="mt-1 p-2 bg-slate-50 rounded text-[10px] text-slate-600 border border-slate-200">
                                        <p className="font-bold text-[8px] uppercase text-slate-400 font-sans">Official Action Remarks:</p>
                                        <p className="mt-0.5 font-mono">{selectedFIR.remarks}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-8 text-center text-xs text-slate-400">Select an incident complaint to view details.</div>
                        )}
                      </CardContent>
                    </Card>

                  </div>
                </div>
              )}

              {/* FILE NEW FIR TAB */}
              {activeTab === 'file' && (
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* BNSS Legal Notice Card */}
                  <Card className="bg-amber-50/50 border border-amber-200/80 rounded-2xl shadow-sm">
                    <CardContent className="pt-6 space-y-3">
                      <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" /> E-FIR & Legal Rights Notice (BNSS)
                      </h4>
                      <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-1.5 leading-relaxed">
                        <li>
                          <strong>Physical Signature (BNSS):</strong> E-FIRs submitted online must be physically signed within <strong>3 days</strong> at the police station or with an officer to complete the formal registration.
                        </li>
                        <li>
                          <strong>Zero FIR (Section 173 BNSS):</strong> You have the legal right to file a Zero FIR at <em>any</em> police station in India, regardless of where the incident occurred.
                        </li>
                        <li>
                          <strong>Escalation (Section 175 BNSS):</strong> If the officer-in-charge refuses to register your FIR, you can submit a written complaint to the Superintendent of Police (SP) or file an application to a Judicial Magistrate to command registration.
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border border-[#E2E8F0] shadow-sm">
                    <CardHeader className="border-b border-[#E2E8F0]">
                      <CardTitle className="text-base font-bold text-slate-800">File Incident Complaint (FIR)</CardTitle>
                      <CardDescription>File an official statement directly to the local police precinct. All filings are digitally signed using Clerk authentication.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSubmitComplaint} className="space-y-6">
                        
                        {/* Part 1: Complainant Details */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-extrabold text-[#1E40AF] uppercase tracking-wider border-b pb-1.5">1. Complainant Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Complainant Name</label>
                              <Input
                                type="text"
                                required
                                value={complainantName}
                                onChange={(e) => setComplainantName(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Age</label>
                              <Input
                                type="number"
                                required
                                placeholder="e.g. 21"
                                value={complainantAge}
                                onChange={(e) => setComplainantAge(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Phone Number</label>
                              <Input
                                type="tel"
                                required
                                placeholder="e.g. +91 9876543210"
                                value={complainantPhone}
                                onChange={(e) => setComplainantPhone(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Residential Address</label>
                              <Input
                                type="text"
                                required
                                placeholder="e.g. Bejai, Mangalore, Karnataka"
                                value={complainantAddress}
                                onChange={(e) => setComplainantAddress(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Citizen ID (Auto Generated)</label>
                              <Input
                                type="text"
                                disabled
                                value={complainantCitizenId}
                                className="border-slate-200 bg-slate-50 font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Part 2: Incident Details */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-extrabold text-[#1E40AF] uppercase tracking-wider border-b pb-1.5">2. Incident Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Incident Subject / Title</label>
                              <Input
                                type="text"
                                required
                                placeholder="e.g., Mobile Phone Theft at bus stop"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600">Crime Category</label>
                                <Select value={formType} onChange={(e) => setFormType(e.target.value)}>
                                  <option value="Mobile Theft">Mobile Theft</option>
                                  <option value="Theft">Theft</option>
                                  <option value="Assault">Assault</option>
                                  <option value="Cyber Crime">Cyber Crime</option>
                                  <option value="Missing Person">Missing Person</option>
                                  <option value="Traffic Violation">Traffic Violation</option>
                                  <option value="Others">Others</option>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600">Priority Level</label>
                                <Select value={incidentPriority} onChange={(e) => setIncidentPriority(e.target.value)}>
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                </Select>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600">Date of Incident</label>
                                <Input
                                  type="date"
                                  required
                                  value={incidentDate}
                                  onChange={(e) => setIncidentDate(e.target.value)}
                                  className="border-slate-200 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600">Time of Incident</label>
                                <Input
                                  type="time"
                                  required
                                  value={incidentTime}
                                  onChange={(e) => setIncidentTime(e.target.value)}
                                  className="border-slate-200 text-xs"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Incident Location Address</label>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  required
                                  placeholder="e.g. Central Market Bus Stop, Mangalore"
                                  value={formLocation}
                                  onChange={(e) => setFormLocation(e.target.value)}
                                  onBlur={() => syncMapFromAddress(formLocation)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      syncMapFromAddress(formLocation);
                                    }
                                  }}
                                  className="border-slate-200 text-xs"
                                />
                                <Button
                                  variant="secondary"
                                  type="button"
                                  onClick={triggerCurrentLocation}
                                  className="p-2 border border-slate-200 hover:bg-slate-50 shrink-0 text-blue-600"
                                >
                                  <MapPin className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col h-[200px]">
                            <label className="text-xs font-bold text-slate-600 mb-1">Pin Location Coordinates on Map</label>
                            <div className="flex-1 rounded-lg overflow-hidden border border-[#E2E8F0]">
                              <MapContainer center={latLng} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <RecenterMap center={latLng} />
                                <TileLayer
                                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                                <Marker position={latLng} />
                                <MapClickListener onMapClick={handleMapClick} />
                              </MapContainer>
                            </div>
                          </div>
                        </div>

                        {/* Part 3: Statement */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-extrabold text-[#1E40AF] uppercase tracking-wider border-b pb-1.5">3. Incident Description Statement</h3>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Complainant Narrative & Statement Details</label>
                            <textarea
                              required
                              rows={4}
                              placeholder="Provide a detailed, first-person statement of what occurred..."
                              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-slate-800"
                              value={formDesc}
                              onChange={(e) => setFormDesc(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Part 4: Suspect */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-extrabold text-[#1E40AF] uppercase tracking-wider border-b pb-1.5">4. Suspect Information (If Known)</h3>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Gender</label>
                              <Select value={suspectGender} onChange={(e) => setSuspectGender(e.target.value)}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Unknown">Unknown</option>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Approximate Age</label>
                              <Input
                                type="text"
                                placeholder="e.g. 20-25"
                                value={suspectAge}
                                onChange={(e) => setSuspectAge(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Height</label>
                              <Input
                                type="text"
                                placeholder={"e.g. Around 5'8\""}
                                value={suspectHeight}
                                onChange={(e) => setSuspectHeight(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Accused Name (Optional)</label>
                              <Input
                                type="text"
                                placeholder="e.g. Amit (If known)"
                                value={accusedName}
                                onChange={(e) => setAccusedName(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Clothing Details</label>
                              <Input
                                type="text"
                                placeholder="e.g. Black jacket, blue jeans"
                                value={suspectClothing}
                                onChange={(e) => setSuspectClothing(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Other Suspect Identifiers / Details</label>
                              <Input
                                type="text"
                                placeholder="e.g. Red scooter, tattoo on left arm"
                                value={suspectDetails}
                                onChange={(e) => setSuspectDetails(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Part 5: Witness */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-extrabold text-[#1E40AF] uppercase tracking-wider border-b pb-1.5">5. Witness Details (If Any)</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Witness Name</label>
                              <Input
                                type="text"
                                placeholder="e.g. Rahul Kumar"
                                value={witnessName}
                                onChange={(e) => setWitnessName(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600">Witness Contact Phone</label>
                              <Input
                                type="tel"
                                placeholder="e.g. +91 9123456780"
                                value={witnessPhone}
                                onChange={(e) => setWitnessPhone(e.target.value)}
                                className="border-slate-200"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Witness Statement Details</label>
                            <textarea
                              rows={2}
                              placeholder="Statement: e.g. Saw the man wearing black jacket running away..."
                              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 text-slate-800"
                              value={witnessStatement}
                              onChange={(e) => setWitnessStatement(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Part 6: Evidence */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-extrabold text-[#1E40AF] uppercase tracking-wider border-b pb-1.5">6. Evidence Attachments</h3>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600">Upload Location Photos, PDF Invoices, Screenshots</label>
                            <div className="border border-dashed border-slate-200 rounded-lg p-5 bg-slate-50 text-center hover:bg-slate-100/40 transition-colors flex flex-col items-center justify-center cursor-pointer">
                              <input
                                type="file"
                                id="evidence-file"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files) {
                                    setEvidenceFiles(Array.from(e.target.files));
                                  }
                                }}
                              />
                              <label htmlFor="evidence-file" className="cursor-pointer w-full flex flex-col items-center">
                                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                                <span className="text-xs font-bold text-slate-700">
                                  {evidenceFiles.length > 0 
                                    ? `${evidenceFiles.length} file(s) selected: ${evidenceFiles.map(f => f.name).join(', ')}` 
                                    : 'Upload files (Photos, PDFs, Screenshots)'}
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-[#E2E8F0]">
                          <Button variant="secondary" type="button" onClick={() => setActiveTab('dashboard')}>
                            Cancel
                          </Button>
                          <Button variant="primary" type="submit" disabled={submitting || uploading} className="bg-blue-600 text-white font-bold text-xs">
                            {submitting ? 'Submitting FIR...' : uploading ? 'Uploading evidence...' : 'Submit Incident'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* EMERGENCY DISTRESS SOS TAB */}
              {activeTab === 'emergency' && (
                <div className="max-w-xl mx-auto space-y-6">
                  <Card className="bg-white border border-[#E2E8F0] shadow-md p-8 text-center flex flex-col items-center">
                    <div className="p-4 bg-red-100 text-red-650 rounded-full mb-4 animate-pulse">
                      <AlertOctagon className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800">SOS distress Beacon</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Pressing the button below instantly grabs your current GPS location and triggers a priority alarm in the Police Operations Dashboard. Deploys closest available patrol vehicle.
                    </p>

                    <button
                      onClick={handleTriggerSOS}
                      className="w-44 h-44 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-lg shadow-2xl hover:shadow-red-600/40 border-8 border-red-150 transition-all duration-200 mt-8 hover:scale-105 active:scale-95 animate-ping-subtle flex items-center justify-center cursor-pointer"
                    >
                      🚨 SOS
                    </button>
                    
                    <div className="text-[10px] text-slate-400 mt-8 font-bold uppercase tracking-wider">
                      Zero delay transmission • Secured by SSL
                    </div>
                  </Card>
                </div>
              )}

              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <div className="max-w-md mx-auto">
                  <Card className="bg-white border border-[#E2E8F0] shadow-sm">
                    <CardHeader className="border-b border-[#E2E8F0] text-center pb-6">
                      <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-black flex items-center justify-center mx-auto mb-3">
                        {user?.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <CardTitle className="text-base font-extrabold text-slate-800">{user?.name}</CardTitle>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Citizen Identity Card</p>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4 text-xs">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-450">Account Role</span>
                        <span className="font-bold text-slate-800 capitalize">{user?.role || 'Citizen'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-450">Email Reference</span>
                        <span className="font-mono text-slate-800">{user?.email}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-450">Citizen ID Code</span>
                        <span className="font-mono text-slate-800 font-bold">{complainantCitizenId}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-450">Active Challans</span>
                        <span className="font-mono text-slate-800 font-bold">{challans.length}</span>
                      </div>
                      <div className="pt-4">
                        <button
                          onClick={logout}
                          className="w-full h-10 bg-red-50 hover:bg-red-100 text-red-650 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out from Portal
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TRAFFIC FINES TAB */}
              {activeTab === 'fines' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">Traffic Challan Registry</h3>
                      <p className="text-xs text-slate-500 mt-1">Review and settle your traffic violation fines issued to your vehicle records.</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600">
                      Total Fines: {challans.length}
                    </span>
                  </div>

                  {challans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {challans.map((c) => (
                        <Card key={c.id} className="bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col justify-between">
                          <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  #CH-{c.id}
                                </span>
                                <h4 className="text-sm font-bold text-slate-800 mt-2 font-mono">{c.vehicle_no}</h4>
                              </div>
                              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                                c.status === 'Paid'
                                  ? 'bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]'
                                  : 'bg-[#FFFBEB] text-[#F59E0B] border-[#FDE68A]'
                              }`}>
                                {c.status === 'Paid' ? 'Paid' : 'Unpaid'}
                              </span>
                            </div>

                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Violation Reason</p>
                              <p className="text-xs text-slate-700 font-semibold mt-0.5">{c.reason || 'Traffic Violation'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Issued Date</p>
                                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                                  {new Date(c.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fine Amount</p>
                                <p className="text-sm font-black text-rose-600 mt-0.5">₹{c.amount}</p>
                              </div>
                            </div>
                          </div>

                          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                            {c.status === 'Paid' ? (
                              <Button
                                variant="secondary"
                                onClick={() => handleDownloadReceipt(c)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all"
                              >
                                <Download className="w-3.5 h-3.5" /> Download Receipt
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                onClick={() => setSelectedChallanForPayment(c)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold bg-[#1E40AF] text-white rounded-xl shadow-sm hover:bg-[#1e3a8a] transition-all"
                              >
                                <CreditCard className="w-3.5 h-3.5" /> Pay Fine
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-white border border-[#E2E8F0] shadow-sm p-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Clear Records</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">No pending traffic fines or challans were found registered to your profile account.</p>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Payment Gateway Modal */}
      {selectedChallanForPayment && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <Card className="max-w-md w-full bg-white border border-[#E2E8F0] shadow-2xl p-6 relative rounded-2xl">
            <button 
              onClick={() => setSelectedChallanForPayment(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              disabled={paymentProcessing}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-[#1E40AF] mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">Secure Payment Gateway</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Precinct Digital Fine Clearance</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Challan Info Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex justify-between font-mono text-[10px] text-slate-400 font-bold">
                  <span>Challan Ref: #CH-{selectedChallanForPayment.id}</span>
                  <span>Vehicle: {selectedChallanForPayment.vehicle_no}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Violation Reason</span>
                  <span className="text-slate-800 font-bold">{selectedChallanForPayment.reason || 'Traffic Violation'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-600">Total Payable:</span>
                  <span className="text-base font-black text-rose-600">₹{selectedChallanForPayment.amount}</span>
                </div>
              </div>

              {/* Mock Payment Form */}
              <form onSubmit={(e) => { e.preventDefault(); handlePayChallan(selectedChallanForPayment.id); }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cardholder Name</label>
                  <Input
                    type="text"
                    required
                    placeholder="Minora Dias"
                    className="border-slate-200 text-xs py-2 h-10 rounded-xl"
                    disabled={paymentProcessing}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Card Number</label>
                  <Input
                    type="text"
                    required
                    maxLength={19}
                    placeholder="4111 2222 3333 4444"
                    className="border-slate-200 text-xs py-2 h-10 rounded-xl font-mono"
                    disabled={paymentProcessing}
                    onChange={(e) => {
                      // format to insert spaces after every 4 digits
                      const val = e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
                      e.target.value = val;
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expiry Date</label>
                    <Input
                      type="text"
                      required
                      maxLength={5}
                      placeholder="MM/YY"
                      className="border-slate-200 text-xs py-2 h-10 rounded-xl font-mono text-center"
                      disabled={paymentProcessing}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\//g, '');
                        if (val.length >= 2) {
                          e.target.value = val.slice(0, 2) + '/' + val.slice(2, 4);
                        } else {
                          e.target.value = val;
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CVV</label>
                    <Input
                      type="password"
                      required
                      maxLength={3}
                      placeholder="123"
                      className="border-slate-200 text-xs py-2 h-10 rounded-xl font-mono text-center"
                      disabled={paymentProcessing}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setSelectedChallanForPayment(null)}
                    className="flex-1 border border-slate-200 hover:bg-slate-50 py-2.5 rounded-xl text-xs font-bold text-slate-700"
                    disabled={paymentProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    className="flex-1 bg-[#1E40AF] text-white py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
                    disabled={paymentProcessing}
                  >
                    {paymentProcessing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Processing...
                      </>
                    ) : (
                      `Authorize ₹${selectedChallanForPayment.amount}`
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
