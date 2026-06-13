export type UserRole = 'citizen' | 'police'

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

export interface Officer {
  id: number;
  name: string;
  badgeNumber: string;
  station: string;
  rank: string;
}

export interface Criminal {
  id: number;
  name: string;
  age: number;
  address: string;
  crimeCount: number;
  wantedStatus: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Wanted';
  photoUrl: string;
}

export interface FIR {
  id: number;
  citizen_id: number;
  title: string;
  description: string;
  location: string;
  status: 'Submitted' | 'Pending Review' | 'Under Review' | 'Verified' | 'Investigation Started' | 'Resolved' | 'Rejected';
  remarks: string | null;
  accused_name: string | null;
  evidence_url: string | null;
  created_at: string;
}

export interface Case {
  id: number;
  firId: number;
  criminalId: number | null;
  officerId: number | null;
  status: 'Active' | 'Under Investigation' | 'Solved' | 'Cold Case';
  remarks: string;
  fir?: FIR;
  officer?: Officer;
  criminal?: Criminal;
}

export interface Challan {
  id: number;
  vehicleNo: string;
  amount: number;
  status: 'Unpaid' | 'Paid';
  issueDate: string;
}

export interface EmergencyRequest {
  id: number;
  userId: number | null;
  latitude: number;
  longitude: number;
  requestType: string;
  status: 'Active' | 'Dispatched' | 'Resolved';
  createdAt: string;
}
