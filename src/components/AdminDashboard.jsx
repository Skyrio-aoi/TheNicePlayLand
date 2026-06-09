import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Users, Ticket, Activity, QrCode, ShieldAlert, 
  ShieldCheck, Settings, Search, Filter, RefreshCw, MapPin, 
  Calendar, CheckCircle, Clock, UserPlus, UserCheck, Trash2, 
  Plus, Edit, Eye, ShieldAlert as AlertIcon, ToggleLeft, Grid, HelpCircle
} from 'lucide-react';
import { getDB, saveDB } from '../utils/db';

export default function AdminDashboard() {
  const [db, setDb] = useState(getDB());
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'scanner', 'tickets', 'rides', 'attendance', 'settings'
  
  // Scanner simulator states
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const html5QrCodeRef = useRef(null);

  // Search & Filters
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState('all'); // 'all', 'active', 'used'
  const [attendanceSearch, setAttendanceSearch] = useState('');
  
  // Settings Form States
  const [playlandLat, setPlaylandLat] = useState(db.settings.playlandLocation.latitude);
  const [playlandLng, setPlaylandLng] = useState(db.settings.playlandLocation.longitude);
  const [playlandName, setPlaylandName] = useState(db.settings.playlandLocation.name);
  const [attendanceRadius, setAttendanceRadius] = useState(db.settings.attendanceRadiusMeters);
  const [midtransClientKey, setMidtransClientKey] = useState(db.settings.midtrans?.clientKey || 'YOUR_MIDTRANS_CLIENT_KEY');
  const [midtransServerKey, setMidtransServerKey] = useState(db.settings.midtrans?.serverKey || 'YOUR_MIDTRANS_SERVER_KEY');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Add Employee Form States
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [empSuccessMsg, setEmpSuccessMsg] = useState('');
  const [empErrorMsg, setEmpErrorMsg] = useState('');

  // Ride Management CRUD States
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [rideFormMode, setRideFormMode] = useState('add'); // 'add' | 'edit'
  const [editingRideId, setEditingRideId] = useState(null);
  const [rideName, setRideName] = useState('');
  const [rideDesc, setRideDesc] = useState('');
  const [rideStatus, setRideStatus] = useState('Buka');
  const [rideCapacity, setRideCapacity] = useState('');
  const [rideMinAge, setRideMinAge] = useState('');
  const [rideSuccessMsg, setRideSuccessMsg] = useState('');

  // Sync DB helper
  const updateLocalDB = (newDb) => {
    saveDB(newDb);
    setDb(newDb);
  };

  // Calculate Metrics
  const totalRevenue = db.purchasedTickets.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalTicketsSold = db.purchasedTickets.reduce((sum, t) => sum + t.quantity, 0);
  const totalVisitorsToday = db.purchasedTickets.filter(t => t.status === 'used').length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const activeEmployeesToday = new Set(
    db.attendance.filter(a => a.date === todayStr).map(a => a.employeeId)
  ).size;

  // Scanner Logic (Direct processing)
  const processTicketScan = (ticketId, scannerName = "Admin") => {
    if (!ticketId) return;

    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      const newDb = { ...db };
      const ticket = newDb.purchasedTickets.find(t => t.id.trim().toUpperCase() === ticketId.trim().toUpperCase());

      if (!ticket) {
        setScanResult({
          status: 'error',
          message: 'Tiket Tidak Terdaftar!',
          details: { id: ticketId }
        });
        return;
      }

      if (ticket.status === 'used') {
        setScanResult({
          status: 'warning',
          message: 'Tiket Sudah Pernah Digunakan!',
          details: {
            id: ticket.id,
            name: ticket.ticketName,
            scannedAt: ticket.scannedAt,
            visitDate: ticket.visitDate,
            quantity: ticket.quantity,
            scannedBy: ticket.scannedBy || 'Admin'
          }
        });
        return;
      }

      const isDateMismatch = ticket.visitDate !== todayStr;
      
      ticket.status = 'used';
      ticket.scannedAt = new Date().toISOString();
      ticket.scannedBy = scannerName;
      updateLocalDB(newDb);

      setScanResult({
        status: isDateMismatch ? 'warning' : 'success',
        message: isDateMismatch 
          ? 'Scan Sukses (Peringatan: Tanggal Kunjungan Berbeda)!' 
          : 'E-Ticket Valid & Sukses Discan!',
        details: {
          id: ticket.id,
          name: ticket.ticketName,
          quantity: ticket.quantity,
          visitDate: ticket.visitDate,
          scannedAt: ticket.scannedAt,
          mismatch: isDateMismatch,
          scannedBy: scannerName
        }
      });
    }, 1000);
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 1000;
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Beep audio blocked", e);
    }
  };

  const startCameraScan = () => {
    setCameraError('');
    setIsCameraActive(true);
    
    setTimeout(() => {
      try {
        if (!window.Html5Qrcode) {
          setCameraError('Pemindai QR belum termuat. Sambungkan internet.');
          return;
        }

        const html5QrCode = new window.Html5Qrcode("reader-admin");
        html5QrCodeRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            playBeep();
            setSelectedTicketId(decodedText);
            stopCameraScan();
            processTicketScan(decodedText, "Admin Kamera");
          },
          () => {}
        ).catch((err) => {
          console.error("Gagal memulai kamera", err);
          setCameraError('Gagal mengakses kamera. Izinkan akses kamera.');
        });
      } catch (e) {
        console.error(e);
        setCameraError('Gagal menginisialisasi kamera.');
      }
    }, 300);
  };

  const stopCameraScan = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current = null;
        setIsCameraActive(false);
      }).catch((err) => {
        console.error("Gagal stop kamera", err);
        setIsCameraActive(false);
      });
    } else {
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Handle tab switching via window events from external elements like chatbot
  useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e.detail && typeof e.detail === 'string') {
        if (e.detail !== 'scanner') {
          stopCameraScan();
        }
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-admin-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-admin-tab', handleSwitchTab);
  }, []);

  // Reset ticket status helper (for easy re-testing)
  const handleResetTicketStatus = (ticketId) => {
    const newDb = { ...db };
    const ticket = newDb.purchasedTickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = 'active';
      ticket.scannedAt = null;
      updateLocalDB(newDb);
      setScanResult(null);
    }
  };

  // Save Settings Form
  const handleSaveSettings = (e) => {
    e.preventDefault();
    const newDb = { ...db };
    newDb.settings.playlandLocation = {
      latitude: parseFloat(playlandLat),
      longitude: parseFloat(playlandLng),
      name: playlandName
    };
    newDb.settings.attendanceRadiusMeters = parseInt(attendanceRadius);
    newDb.settings.midtrans = {
      clientKey: midtransClientKey,
      serverKey: midtransServerKey
    };
    updateLocalDB(newDb);
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 3000);
  };

  // Add Employee Form
  const handleAddEmployee = (e) => {
    e.preventDefault();
    setEmpErrorMsg('');
    setEmpSuccessMsg('');

    const usernameLower = newEmpUsername.trim().toLowerCase();
    
    // Check duplication
    const existUser = db.users.find(u => u.username.toLowerCase() === usernameLower);
    if (existUser) {
      setEmpErrorMsg('Username sudah terdaftar! Gunakan username lain.');
      return;
    }

    const newEmp = {
      id: 'u_emp_' + Math.floor(10000 + Math.random() * 90000),
      username: usernameLower,
      role: 'karyawan',
      name: newEmpName.trim(),
      password: usernameLower
    };

    const newDb = { ...db };
    newDb.users = [...newDb.users, newEmp];
    updateLocalDB(newDb);
    
    setEmpSuccessMsg(`Karyawan "${newEmp.name}" berhasil terdaftar! (Password login = username: "${newEmp.username}")`);
    setNewEmpName('');
    setNewEmpUsername('');
  };

  // Delete Employee account
  const handleDeleteEmployee = (userId) => {
    if (userId === 'u_emp1' || userId === 'u_emp2') {
      alert('Karyawan bawaan demo (Budi / Siti) tidak boleh dihapus.');
      return;
    }
    if (window.confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) {
      const newDb = { ...db };
      newDb.users = newDb.users.filter(u => u.id !== userId);
      updateLocalDB(newDb);
    }
  };

  // RIDE MANAGEMENT (CRUD) HANDLERS
  const handleOpenAddRide = () => {
    setRideFormMode('add');
    setEditingRideId(null);
    setRideName('');
    setRideDesc('');
    setRideStatus('Buka');
    setRideCapacity('');
    setRideMinAge('');
    setRideSuccessMsg('');
    setIsRideModalOpen(true);
  };

  const handleOpenEditRide = (ride) => {
    setRideFormMode('edit');
    setEditingRideId(ride.id);
    setRideName(ride.name);
    setRideDesc(ride.description);
    setRideStatus(ride.status);
    setRideCapacity(ride.capacity);
    setRideMinAge(ride.minAge);
    setRideSuccessMsg('');
    setIsRideModalOpen(true);
  };

  const handleSaveRide = (e) => {
    e.preventDefault();
    const newDb = { ...db };

    if (rideFormMode === 'add') {
      const newRide = {
        id: 'w_' + Math.floor(10000 + Math.random() * 90000),
        name: rideName.trim(),
        description: rideDesc.trim(),
        status: rideStatus,
        capacity: rideCapacity.trim() || 'Tidak Dibatasi',
        minAge: rideMinAge.trim() || 'Semua Umur'
      };
      newDb.rides = [...newDb.rides, newRide];
      setRideSuccessMsg('Wahana baru berhasil ditambahkan!');
    } else {
      newDb.rides = newDb.rides.map(r => r.id === editingRideId ? {
        ...r,
        name: rideName.trim(),
        description: rideDesc.trim(),
        status: rideStatus,
        capacity: rideCapacity.trim(),
        minAge: rideMinAge.trim()
      } : r);
      setRideSuccessMsg('Informasi wahana berhasil diperbarui!');
    }

    updateLocalDB(newDb);
    setTimeout(() => {
      setIsRideModalOpen(false);
      setRideSuccessMsg('');
    }, 1500);
  };

  const handleDeleteRide = (rideId) => {
    if (window.confirm('Hapus wahana ini dari daftar?')) {
      const newDb = { ...db };
      newDb.rides = newDb.rides.filter(r => r.id !== rideId);
      updateLocalDB(newDb);
    }
  };

  // Format Helper
  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Filter Lists
  const filteredTickets = db.purchasedTickets.filter(t => {
    const matchesSearch = t.id.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                          t.ticketName.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredAttendance = db.attendance.filter(a => {
    return a.employeeName.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
           a.date.includes(attendanceSearch);
  });

  const employeesList = db.users.filter(u => u.role === 'karyawan');
  const activeTicketsForScan = db.purchasedTickets.filter(t => t.status === 'active');

  return (
    <div className="dashboard-container">
      {/* Navigation tabs row */}
      <div className="glass-panel" style={{ display: 'flex', gap: '8px', padding: '10px 16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('scanner')}
          className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Scan QR Tiket
        </button>
        <button 
          onClick={() => setActiveTab('tickets')}
          className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Kelola Tiket ({db.purchasedTickets.length})
        </button>
        <button 
          onClick={() => setActiveTab('rides')}
          className={`btn ${activeTab === 'rides' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Kelola Wahana ({db.rides.length})
        </button>
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Absensi Karyawan ({db.attendance.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Pengaturan Sistem
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: DASHBOARD OVERVIEW */}
      {/* ========================================== */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stats Cards Grid */}
          <div className="grid-cols-4" style={{ gap: '16px' }}>
            
            {/* Revenue */}
            <div className="glass-panel glass-card-glow-purple" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-primary)' }}>
                <DollarSign size={22} className="text-glow-purple" />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Total Pendapatan Tiket</span>
                <h3 style={{ fontSize: '1.35rem', marginTop: '2px' }}>{formatRupiah(totalRevenue)}</h3>
              </div>
            </div>

            {/* Tickets Sold */}
            <div className="glass-panel glass-card-glow-pink" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(236, 72, 153, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-secondary)' }}>
                <Ticket size={22} className="text-glow-pink" />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Kuantitas Tiket Terjual</span>
                <h3 style={{ fontSize: '1.35rem', marginTop: '2px' }}>{totalTicketsSold} Tiket</h3>
              </div>
            </div>

            {/* Visitor count */}
            <div className="glass-panel glass-card-glow-cyan" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
                <Users size={22} className="text-glow-cyan" />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Pengunjung Masuk (Scan)</span>
                <h3 style={{ fontSize: '1.35rem', marginTop: '2px' }}>{totalVisitorsToday} Orang</h3>
              </div>
            </div>

            {/* Active employees */}
            <div className="glass-panel glass-card-glow-green" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px', color: 'var(--color-success)' }}>
                <Activity size={22} className="text-glow-green" />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Staf Masuk Hari Ini</span>
                <h3 style={{ fontSize: '1.35rem', marginTop: '2px' }}>{activeEmployeesToday} Orang</h3>
              </div>
            </div>

          </div>

          {/* Graph & Target Coordinates Info Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'stretch' }}>
            
            {/* Custom SVG Line Chart widget */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '1.05rem' }}>Visualisasi Tren Penjualan Tiket</h3>
              
              <div style={{ width: '100%', height: '180px', position: 'relative', overflow: 'hidden' }}>
                <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="0" y1="140" x2="500" y2="140" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="0" y1="180" x2="500" y2="180" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  
                  <path d="M 10 180 L 10 130 Q 90 95 90 95 T 170 115 T 250 85 T 330 60 T 410 75 T 490 40 L 490 180 Z" fill="url(#chartGlow)" />
                  <path d="M 10 130 Q 90 95 90 95 T 170 115 T 250 85 T 330 60 T 410 75 T 490 40" fill="none" stroke="var(--accent-primary)" strokeWidth="3.5" strokeLinecap="round" />

                  <circle cx="10" cy="130" r="4.5" fill="var(--accent-secondary)" />
                  <circle cx="90" cy="95" r="4.5" fill="var(--accent-secondary)" />
                  <circle cx="170" cy="115" r="4.5" fill="var(--accent-secondary)" />
                  <circle cx="250" cy="85" r="4.5" fill="var(--accent-secondary)" />
                  <circle cx="330" cy="60" r="4.5" fill="var(--accent-secondary)" />
                  <circle cx="410" cy="75" r="4.5" fill="var(--accent-secondary)" />
                  <circle cx="490" cy="40" r="4.5" fill="var(--accent-secondary)" />
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '10px' }}>
                <span>Senin</span><span>Selasa</span><span>Rabu</span><span>Kamis</span><span>Jumat</span><span>Sabtu</span><span>Minggu</span>
              </div>
            </div>

            {/* Target Location Card */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} style={{ color: 'var(--accent-cyan)' }} />
                  Target Geofence Lokasi
                </h3>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.8rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Gerbang Absen:</div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>{db.settings.playlandLocation.name}</div>
                  
                  <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '10px', paddingTop: '8px' }}>
                    <div>Lattitude: <code>{db.settings.playlandLocation.latitude}</code></div>
                    <div>Longitude: <code>{db.settings.playlandLocation.longitude}</code></div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', marginTop: '10px' }}>
                Radius toleransi diset: <strong>{db.settings.attendanceRadiusMeters} meter</strong> dari gerbang utama Pekandangan Jaya.
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: QR CODE TICKET SCANNER */}
      {/* ========================================== */}
      {activeTab === 'scanner' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
          
          {/* Scanner panel */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
              <QrCode size={20} style={{ color: 'var(--accent-secondary)' }} />
              Pemindai E-Tiket
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '18px', lineHeight: '1.4' }}>
              Validasi dan lakukan pemindaian e-ticket di pintu masuk gerbang utama playground Indramayu.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); processTicketScan(selectedTicketId, "Admin"); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kode E-Tiket (Ketik Manual / Pilih dari List):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Contoh: PT-89410" 
                    value={selectedTicketId}
                    onChange={(e) => setSelectedTicketId(e.target.value.toUpperCase())}
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                    required
                    disabled={isCameraActive}
                  />
                  <select 
                    value={selectedTicketId}
                    onChange={(e) => setSelectedTicketId(e.target.value)}
                    className="input-field select-field"
                    style={{ fontSize: '0.85rem', width: '160px', flexShrink: 0 }}
                    disabled={isCameraActive}
                  >
                    <option value="">-- Pilih E-Tiket --</option>
                    {activeTicketsForScan.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.id} ({t.quantity} Pax)
                      </option>
                    ))}
                    {db.purchasedTickets.filter(t => t.status === 'used').map(t => (
                      <option key={t.id} value={t.id} style={{ opacity: 0.5 }}>
                        [USED] {t.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="submit" 
                  disabled={isScanning || !selectedTicketId || isCameraActive}
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }}
                >
                  {isScanning ? 'Memverifikasi...' : 'Validasi Tiket'}
                </button>

                {isCameraActive ? (
                  <button 
                    type="button" 
                    onClick={stopCameraScan}
                    className="btn btn-danger"
                    style={{ padding: '12px', fontSize: '0.9rem' }}
                  >
                    Matikan Kamera
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={startCameraScan}
                    className="btn btn-secondary"
                    style={{ padding: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <QrCode size={16} style={{ color: 'var(--accent-cyan)' }} /> Scan Kamera
                  </button>
                )}
              </div>
            </form>

            {isCameraActive && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <div style={{ 
                  background: 'rgba(0,0,0,0.4)', 
                  border: '2px solid var(--accent-cyan)', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  position: 'relative', 
                  boxShadow: '0 0 25px var(--accent-cyan-glow)' 
                }}>
                  <div id="reader-admin" style={{ width: '100%', minHeight: '250px' }}></div>
                  <div style={{ 
                    position: 'absolute', top: '10px', left: '10px', 
                    background: 'rgba(0,0,0,0.6)', color: 'white', 
                    fontSize: '0.72rem', padding: '4px 8px', borderRadius: '4px',
                    zIndex: 10
                  }}>
                    Arahkan QR Code ke kamera
                  </div>
                  <div style={{ 
                    position: 'absolute', top: '0', left: '0', right: '0', height: '3px',
                    background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)', 
                    animation: 'scanLine 2s infinite linear', zIndex: 5, pointerEvents: 'none'
                  }}/>
                  <style>{`
                    @keyframes scanLine {
                      0% { top: 0%; }
                      50% { top: 100%; }
                      100% { top: 0%; }
                    }
                  `}</style>
                </div>
                {cameraError && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '10px', background: 'rgba(239, 68, 68, 0.08)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {cameraError}
                  </div>
                )}
              </div>
            )}

            {isScanning && !isCameraActive && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <div style={{ 
                  display: 'inline-block', width: '60px', height: '60px', 
                  border: '3px solid var(--accent-secondary)', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 1s infinite linear'
                }}/>
              </div>
            )}
          </div>

          {/* Scanner Result Card */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {!scanResult ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <QrCode size={40} style={{ margin: '0 auto 10px auto', opacity: 0.3 }} />
                <h4 style={{ fontSize: '0.95rem' }}>Menunggu Scan</h4>
                <p style={{ fontSize: '0.75rem', maxWidth: '240px', margin: '4px auto 0 auto' }}>
                  Pilih salah satu kode tiket di sebelah kiri dan klik tombol scan.
                </p>
              </div>
            ) : (
              <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                {scanResult.status === 'success' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--color-success)', color: 'var(--color-success)', padding: '10px', borderRadius: '50%' }}>
                      <ShieldCheck size={36} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--color-success)', fontSize: '1.15rem', fontWeight: 'bold' }}>{scanResult.message}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>Pintu gerbang terbuka, pengunjung silakan masuk.</p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', width: '100%', textAlign: 'left', fontSize: '0.8rem' }}>
                      <div>Kode Tiket: <strong>{scanResult.details.id}</strong></div>
                      <div>Jenis: <strong>{scanResult.details.name}</strong></div>
                      <div>Jumlah Pax: <strong>{scanResult.details.quantity} Orang</strong></div>
                      <div>Tgl Rencana: <strong>{scanResult.details.visitDate}</strong></div>
                      {scanResult.details.scannedBy && (
                        <div>Discan Oleh: <strong>{scanResult.details.scannedBy}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                {scanResult.status === 'warning' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '2px solid var(--color-warning)', color: 'var(--color-warning)', padding: '10px', borderRadius: '50%' }}>
                      <ShieldAlert size={36} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--color-warning)', fontSize: '1.1rem', fontWeight: 'bold' }}>{scanResult.message}</h4>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', width: '100%', textAlign: 'left', fontSize: '0.8rem' }}>
                      <div>Kode Tiket: <strong>{scanResult.details.id}</strong></div>
                      {scanResult.details.scannedAt && (
                        <div style={{ color: 'var(--color-danger)' }}>Waktu Scan: <strong>{new Date(scanResult.details.scannedAt).toLocaleTimeString('id-ID')}</strong></div>
                      )}
                      {scanResult.details.scannedBy && (
                        <div style={{ color: 'var(--color-warning)' }}>Discan Oleh: <strong>{scanResult.details.scannedBy}</strong></div>
                      )}
                      <div>Jenis: <strong>{scanResult.details.name}</strong></div>
                      {scanResult.details.mismatch && (
                        <div style={{ color: 'var(--color-warning)', marginTop: '4px', fontWeight: 'bold' }}>* Peringatan: Jadwal kunjungan berbeda dengan hari ini.</div>
                      )}
                    </div>
                    <button onClick={() => handleResetTicketStatus(scanResult.details.id)} className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '6px 12px' }}>
                      Reset Status Tiket Menjadi Aktif
                    </button>
                  </div>
                )}

                {scanResult.status === 'error' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '2px solid var(--color-danger)', color: 'var(--color-danger)', padding: '10px', borderRadius: '50%' }}>
                      <AlertIcon size={36} />
                    </div>
                    <h4 style={{ color: 'var(--color-danger)', fontSize: '1.15rem', fontWeight: 'bold' }}>{scanResult.message}</h4>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: MANAGE PURCHASED TICKETS LIST */}
      {/* ========================================== */}
      {activeTab === 'tickets' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3>Daftar Tiket Terbeli Pelanggan</h3>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Cari ID tiket..." 
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="input-field"
                  style={{ width: '180px', paddingLeft: '32px', paddingTop: '10px', paddingBottom: '10px' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              </div>
              <select value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)} className="input-field select-field" style={{ width: '140px', paddingTop: '10px', paddingBottom: '10px' }}>
                <option value="all">Semua</option>
                <option value="active">Aktif</option>
                <option value="used">Used</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID Tiket</th>
                  <th>Nama Tiket</th>
                  <th>Tgl Kunjungan</th>
                  <th>Jumlah</th>
                  <th>Total</th>
                  <th>Waktu Scan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: '600' }}>{t.id}</td>
                    <td>{t.ticketName}</td>
                    <td>{t.visitDate}</td>
                    <td>{t.quantity}x</td>
                    <td>{formatRupiah(t.totalAmount)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t.scannedAt ? new Date(t.scannedAt).toLocaleString('id-ID') : '-'}
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-primary'}`}>
                        {t.status === 'active' ? 'Aktif' : 'Used'}
                      </span>
                    </td>
                    <td>
                      {t.status === 'used' ? (
                        <button onClick={() => handleResetTicketStatus(t.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
                          Re-Aktif
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: WAHANA/RIDES MANAGEMENT CRUD */}
      {/* ========================================== */}
      {activeTab === 'rides' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3>Kelola Daftar Wahana & Permainan</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>Admin dapat menambah, menyunting, dan menghapus wahana permainan yang tampil di portal user.</p>
            </div>
            
            <button onClick={handleOpenAddRide} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: '0.8rem' }}>
              <Plus size={16} /> Tambah Wahana Baru
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nama Wahana</th>
                  <th>Deskripsi Permainan</th>
                  <th>Kapasitas</th>
                  <th>Batas Umur</th>
                  <th>Status Operasional</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {db.rides.map((ride) => (
                  <tr key={ride.id}>
                    <td style={{ fontWeight: '700', fontSize: '0.9rem' }}>{ride.name}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                      {ride.description}
                    </td>
                    <td>{ride.capacity}</td>
                    <td><span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{ride.minAge}</span></td>
                    <td>
                      <span className={`badge ${ride.status === 'Buka' ? 'badge-success' : 'badge-danger'}`}>
                        {ride.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleOpenEditRide(ride)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.72rem' }} title="Sunting Wahana">
                          <Edit size={12} /> Sunting
                        </button>
                        <button onClick={() => handleDeleteRide(ride.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.72rem', color: 'var(--color-danger)' }} title="Hapus Wahana">
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 5: EMPLOYEE MANAGEMENT & ATTENDANCE LOGS */}
      {/* ========================================== */}
      {activeTab === 'attendance' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Employee Directory */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3>Direktori Staf Karyawan ({employeesList.length})</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Password login staf disamakan dengan username.</p>
              </div>
              <button onClick={() => setIsAddEmployeeOpen(true)} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: '0.8rem' }}>
                <UserPlus size={16} /> Registrasi Karyawan
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama Karyawan</th>
                    <th>Username Login</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {employeesList.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emp.id}</td>
                      <td style={{ fontWeight: '600' }}>{emp.name}</td>
                      <td><code>{emp.username}</code></td>
                      <td>
                        <button onClick={() => handleDeleteEmployee(emp.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--color-danger)' }}>
                          Hapus Staf
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance Logs List */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Log Absensi Karyawan</h3>
              <input 
                type="text" 
                placeholder="Cari nama karyawan..." 
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                className="input-field"
                style={{ width: '180px', paddingTop: '8px', paddingBottom: '8px' }}
              />
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Staf Karyawan</th>
                    <th>Tanggal</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Jarak (In)</th>
                    <th>Koordinat Absen</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '600' }}>{log.employeeName}</td>
                      <td>{log.date}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: '500' }}>{formatTime(log.clockIn)}</td>
                      <td style={{ color: log.clockOut ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: '500' }}>{formatTime(log.clockOut)}</td>
                      <td>{log.distanceInMeters} m</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {log.coordinates ? `${log.coordinates.latitude.toFixed(5)}, ${log.coordinates.longitude.toFixed(5)}` : '-'}
                      </td>
                      <td>
                        <span className={`badge ${log.status === 'Terlambat' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* TAB 6: SYSTEM CONFIGURATION & MIDTRANS CONFIG */}
      {/* ========================================== */}
      {activeTab === 'settings' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
            <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
            Konfigurasi Sistem
          </h3>

          {settingsSuccess && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#a7f3d0', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              Pengaturan gerbang & Midtrans berhasil disimpan.
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Gerbang Playground</label>
              <input type="text" value={playlandName} onChange={(e) => setPlaylandName(e.target.value)} className="input-field" required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Lattitude Target</label>
                <input type="number" step="0.000001" value={playlandLat} onChange={(e) => setPlaylandLat(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Longitude Target</label>
                <input type="number" step="0.000001" value={playlandLng} onChange={(e) => setPlaylandLng(e.target.value)} className="input-field" required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Radius Toleransi Kehadiran (Meter)</label>
              <input type="number" value={attendanceRadius} onChange={(e) => setAttendanceRadius(e.target.value)} className="input-field" required min="10" />
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '10px' }}>Integrasi Midtrans Sandbox</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Client Key</label>
                  <input type="text" value={midtransClientKey} onChange={(e) => setMidtransClientKey(e.target.value)} className="input-field" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Server Key</label>
                  <input type="text" value={midtransServerKey} onChange={(e) => setMidtransServerKey(e.target.value)} className="input-field" required />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '8px' }}>
              Simpan Perubahan
            </button>
          </form>
        </div>
      )}

      {/* ========================================== */}
      {/* RIDE ADD / EDIT POPUP MODAL DIALOG */}
      {/* ========================================== */}
      {isRideModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ padding: '24px', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Grid size={18} style={{ color: 'var(--accent-secondary)' }} />
                {rideFormMode === 'add' ? 'Tambah Wahana Baru' : 'Sunting Informasi Wahana'}
              </h3>
              <button onClick={() => setIsRideModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            {rideSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#a7f3d0', padding: '10px 12px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '14px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                {rideSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveRide} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Wahana</label>
                <input type="text" value={rideName} onChange={(e) => setRideName(e.target.value)} className="input-field" placeholder="Contoh: Keranjang Sultan" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Deskripsi Permainan</label>
                <textarea value={rideDesc} onChange={(e) => setRideDesc(e.target.value)} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} placeholder="Tulis rincian wahana..." required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Kapasitas Wahana</label>
                  <input type="text" value={rideCapacity} onChange={(e) => setRideCapacity(e.target.value)} className="input-field" placeholder="Contoh: 1 Orang" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Batasan Umur / Tinggi</label>
                  <input type="text" value={rideMinAge} onChange={(e) => setRideMinAge(e.target.value)} className="input-field" placeholder="Contoh: Min 8 Tahun" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status Operasional</label>
                <select value={rideStatus} onChange={(e) => setRideStatus(e.target.value)} className="input-field select-field">
                  <option value="Buka">Buka (Operasional)</option>
                  <option value="Tutup">Tutup (Perbaikan/Maintenance)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsRideModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Simpan Wahana</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EMPLOYEE ADD MODAL POPUP DIALOG */}
      {/* ========================================== */}
      {isAddEmployeeOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ padding: '24px', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} style={{ color: 'var(--accent-primary)' }} />
                Registrasi Karyawan Baru
              </h3>
              <button onClick={() => { setIsAddEmployeeOpen(false); setEmpErrorMsg(''); setEmpSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            {empSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#a7f3d0', padding: '10px 12px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '14px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                {empSuccessMsg}
              </div>
            )}

            {empErrorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '10px 12px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {empErrorMsg}
              </div>
            )}

            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Lengkap Karyawan</label>
                <input type="text" placeholder="Contoh: Ahmad Zakaria" value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} className="input-field" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Username Login</label>
                <input type="text" placeholder="Contoh: ahmad123" value={newEmpUsername} onChange={(e) => setNewEmpUsername(e.target.value)} className="input-field" required />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>* Password login karyawan akan disamakan dengan username.</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setIsAddEmployeeOpen(false); setEmpErrorMsg(''); setEmpSuccessMsg(''); }} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Daftarkan Staf</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
