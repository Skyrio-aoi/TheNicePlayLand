import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Clock, LogIn, LogOut, Info, CheckCircle2, 
  Navigation, AlertTriangle, Calendar, AlertCircle, RefreshCw,
  QrCode, ShieldCheck, ShieldAlert, Search, Eye
} from 'lucide-react';
import { getDB, saveDB, calculateDistance } from '../utils/db';

export default function KaryawanDashboard({ currentUser }) {
  const [db, setDb] = useState(getDB());
  const [activeTab, setActiveTab] = useState('gps'); // 'gps', 'scanner', 'history'
  
  // GPS/Attendance states
  const [gpsLoading, setGpsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeCoords, setActiveCoords] = useState(null);
  const [currentDistance, setCurrentDistance] = useState(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);

  // Ticket Scanner states
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const html5QrCodeRef = useRef(null);

  const radiusLimit = db.settings.attendanceRadiusMeters || 150;
  const targetCoords = db.settings.playlandLocation;
  const todayStr = new Date().toISOString().split('T')[0];

  // Recalculate distance whenever coordinates or target change
  useEffect(() => {
    if (activeCoords) {
      const dist = calculateDistance(
        activeCoords.latitude,
        activeCoords.longitude,
        targetCoords.latitude,
        targetCoords.longitude
      );
      setCurrentDistance(dist);
      setIsWithinRadius(dist <= radiusLimit);
    }
  }, [activeCoords, targetCoords, radiusLimit]);

  // Load employee's check-in record for today
  useEffect(() => {
    const record = db.attendance.find(
      (a) => a.employeeId === currentUser.id && a.date === todayStr
    );
    setTodayRecord(record || null);
  }, [db, currentUser.id, todayStr]);

  // Automatically fetch GPS on mount
  useEffect(() => {
    fetchRealGPS();
  }, []);

  // Stop camera when component unmounts
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
    window.addEventListener('switch-karyawan-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-karyawan-tab', handleSwitchTab);
  }, []);

  // Fetch actual browser GPS coordinates
  const fetchRealGPS = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Browser atau perangkat Anda tidak mendukung sensor GPS.');
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    setErrorMessage(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setActiveCoords(coords);
        setGpsLoading(false);
      },
      (error) => {
        let msg = 'Gagal mengakses sensor GPS perangkat.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Izin lokasi/GPS ditolak. Harap izinkan akses lokasi pada browser Anda untuk dapat melakukan absensi.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Informasi lokasi sensor tidak tersedia.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Waktu permintaan lokasi habis.';
        }
        setErrorMessage(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Clock In operation
  const handleClockIn = () => {
    if (!isWithinRadius || !activeCoords) return;

    const recordId = 'att_' + Math.floor(10000 + Math.random() * 90000);
    const checkInTime = new Date();
    const isLate = checkInTime.getHours() > 8 || (checkInTime.getHours() === 8 && checkInTime.getMinutes() > 0);
    const attendanceStatus = isLate ? 'Terlambat' : 'Tepat Waktu';

    const newRecord = {
      id: recordId,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      date: todayStr,
      clockIn: checkInTime.toISOString(),
      clockOut: null,
      distanceInMeters: currentDistance,
      status: attendanceStatus,
      coordinates: { ...activeCoords }
    };

    const newDb = { ...db };
    newDb.attendance = [newRecord, ...newDb.attendance];
    saveDB(newDb);
    setDb(newDb);
  };

  // Clock Out operation
  const handleClockOut = () => {
    if (!todayRecord) return;

    const newDb = { ...db };
    const recordIndex = newDb.attendance.findIndex((a) => a.id === todayRecord.id);
    if (recordIndex !== -1) {
      newDb.attendance[recordIndex] = {
        ...newDb.attendance[recordIndex],
        clockOut: new Date().toISOString()
      };
      saveDB(newDb);
      setDb(newDb);
    }
  };

  // Play Beep Sound
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

  // Ticket Scanner logic
  const processTicketScan = (ticketId, scannerName = currentUser.name) => {
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
            scannedBy: ticket.scannedBy || 'Sistem'
          }
        });
        return;
      }

      const isDateMismatch = ticket.visitDate !== todayStr;
      
      ticket.status = 'used';
      ticket.scannedAt = new Date().toISOString();
      ticket.scannedBy = scannerName;
      saveDB(newDb);
      setDb(newDb);

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

  const startCameraScan = () => {
    setCameraError('');
    setIsCameraActive(true);
    
    setTimeout(() => {
      try {
        if (!window.Html5Qrcode) {
          setCameraError('Pemindai QR belum termuat. Sambungkan internet.');
          return;
        }

        const html5QrCode = new window.Html5Qrcode("reader-karyawan");
        html5QrCodeRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            playBeep();
            setSelectedTicketId(decodedText);
            stopCameraScan();
            processTicketScan(decodedText, currentUser.name);
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

  const handleResetTicketStatus = (ticketId) => {
    const newDb = { ...db };
    const ticket = newDb.purchasedTickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = 'active';
      ticket.scannedAt = null;
      ticket.scannedBy = null;
      saveDB(newDb);
      setDb(newDb);
      setScanResult(null);
    }
  };

  // Get employee logs
  const employeeLogs = db.attendance.filter((a) => a.employeeId === currentUser.id);

  // Get tickets scanned by this employee
  const myScannedTickets = db.purchasedTickets.filter((t) => t.scannedBy === currentUser.name);
  const activeTicketsForScan = db.purchasedTickets.filter(t => t.status === 'active');

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="dashboard-container">
      {/* Welcome banner */}
      <div className="glass-panel glass-card-glow-cyan animate-fade-in" style={{ padding: '24px 32px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <span className="badge badge-info" style={{ marginBottom: '8px' }}>Portal Karyawan</span>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>Halo, {currentUser.name}!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Kelola kehadiran kerja Anda & layani scan e-tiket pengunjung The Nice Playland.</p>
        </div>
        <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '50%', border: '1px dashed var(--accent-cyan)' }}>
          <Clock size={28} className="text-glow-cyan" style={{ color: 'var(--accent-cyan)' }} />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="glass-panel animate-fade-in" style={{ display: 'flex', gap: '8px', padding: '10px 16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => { stopCameraScan(); setActiveTab('gps'); }}
          className={`btn ${activeTab === 'gps' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          <MapPin size={14} /> Absensi GPS
        </button>
        <button 
          onClick={() => { stopCameraScan(); setActiveTab('scanner'); }}
          className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          <QrCode size={14} /> Scan QR Tiket Pengunjung
        </button>
        <button 
          onClick={() => { stopCameraScan(); setActiveTab('history'); }}
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          <Calendar size={14} /> Riwayat Absensi Staf
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: GPS ATTENDANCE */}
      {/* ========================================== */}
      {activeTab === 'gps' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Attendance Action Panel */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
              Clock Absensi Kerja
            </h3>

            {/* Shift hours rule warning banner */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', background: 'rgba(124, 58, 237, 0.04)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.1)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              <AlertCircle size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
              <span>Jadwal Absen Masuk: <strong>08:00 WIB</strong>. Clock-in melewati jam masuk akan otomatis dicatat <strong>Terlambat</strong>.</span>
            </div>

            {/* Distance Gauge */}
            <div style={{ 
              background: 'rgba(0,0,0,0.15)', 
              borderRadius: '10px', 
              padding: '16px', 
              border: '1px solid',
              borderColor: activeCoords && isWithinRadius ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Jarak Anda Ke Target Gerbang:</span>
              
              {errorMessage ? (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.82rem', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={20} />
                  <span>{errorMessage}</span>
                </div>
              ) : gpsLoading ? (
                <div style={{ padding: '10px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Menghubungi sensor GPS...
                </div>
              ) : (
                <div style={{ 
                  fontSize: '1.8rem', 
                  fontWeight: 'bold', 
                  color: isWithinRadius ? 'var(--color-success)' : 'var(--color-danger)',
                  margin: '6px 0',
                  textShadow: isWithinRadius ? '0 0 10px rgba(16, 185, 129, 0.2)' : '0 0 10px rgba(239, 68, 68, 0.2)'
                }}>
                  {currentDistance >= 1000 
                    ? `${(currentDistance / 1000).toFixed(2)} km` 
                    : `${currentDistance} m`
                  }
                </div>
              )}

              {activeCoords && !gpsLoading ? (
                isWithinRadius ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    <CheckCircle2 size={12} /> Dalam Radius Valid (&le; {radiusLimit}m)
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    <AlertTriangle size={12} /> Di Luar Radius Toleransi (&gt; {radiusLimit}m)
                  </span>
                )
              ) : null}
            </div>

            {/* Attendance Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Clock In */}
              {!todayRecord ? (
                <button 
                  onClick={handleClockIn}
                  disabled={!isWithinRadius || !activeCoords || gpsLoading}
                  className="btn btn-success" 
                  style={{ width: '100%', padding: '14px', fontSize: '0.95rem', opacity: (isWithinRadius && activeCoords) ? 1 : 0.4 }}
                >
                  <LogIn size={16} /> Kirim Absen Masuk (Clock In)
                </button>
              ) : (
                <div style={{ 
                  background: 'rgba(16, 185, 129, 0.04)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  borderRadius: '8px', 
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Jam Masuk Kerja</span>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--color-success)', marginTop: '2px' }}>
                      {formatTime(todayRecord.clockIn)}
                    </div>
                  </div>
                  <span className={`badge ${todayRecord.status === 'Terlambat' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem' }}>
                    {todayRecord.status}
                  </span>
                </div>
              )}

              {/* Clock Out */}
              {todayRecord && (
                <>
                  {!todayRecord.clockOut ? (
                    <button 
                      onClick={handleClockOut}
                      className="btn btn-danger" 
                      style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
                    >
                      <LogOut size={16} /> Kirim Absen Pulang (Clock Out)
                    </button>
                  ) : (
                    <div style={{ 
                      background: 'rgba(239, 68, 68, 0.04)', 
                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                      borderRadius: '8px', 
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Jam Pulang Kerja</span>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                          {formatTime(todayRecord.clockOut)}
                        </div>
                      </div>
                      <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>Shift Selesai</span>
                    </div>
                  )}
                </>
              )}

              {/* Refresh GPS Button */}
              <button 
                onClick={fetchRealGPS}
                disabled={gpsLoading}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '12px' }}
              >
                <RefreshCw size={14} className={gpsLoading ? 'animate-spin' : ''} /> {gpsLoading ? 'Mendeteksi GPS...' : 'Deteksi Ulang Lokasi'}
              </button>

              {activeCoords && !isWithinRadius && !todayRecord && (
                <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.15)', fontSize: '0.75rem', color: 'var(--color-warning)', textAlign: 'left' }}>
                  <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                  Absensi dikunci karena lokasi GPS Anda berada di luar jangkauan radius {radiusLimit}m dari gerbang utama Pekandangan Jaya.
                </div>
              )}
            </div>
          </div>

          {/* GPS Coordinates Info Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} style={{ color: 'var(--accent-cyan)' }} />
                Lokasi Kantor & Geofence
              </h3>
              
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '10px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Titik Pusat Gerbang (Playland):</div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px', fontSize: '0.92rem' }}>
                  {targetCoords.name}
                </div>
                <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '12px', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>Latitude: <code>{targetCoords.latitude}</code></div>
                  <div>Longitude: <code>{targetCoords.longitude}</code></div>
                </div>
              </div>

              {activeCoords && (
                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  📍 Koordinat perangkat Anda saat ini: 
                  <code style={{ display: 'block', color: 'var(--accent-cyan)', marginTop: '4px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                    Lat: {activeCoords.latitude.toFixed(6)}, Lng: {activeCoords.longitude.toFixed(6)}
                  </code>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: QR CODE TICKET SCANNER */}
      {/* ========================================== */}
      {activeTab === 'scanner' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Scanner Panel */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
              <QrCode size={20} style={{ color: 'var(--accent-secondary)' }} />
              Pemindai E-Tiket Pengunjung
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '18px', lineHeight: '1.4' }}>
              Verifikasi dan lakukan pemindaian e-ticket pengunjung di pintu gerbang masuk playground.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); processTicketScan(selectedTicketId, currentUser.name); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  <div id="reader-karyawan" style={{ width: '100%', minHeight: '250px' }}></div>
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

            {/* Riwayat Verifikasi Tiket oleh Karyawan ini */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '0.92rem', marginBottom: '10px' }}>Verifikasi Tiket oleh Anda ({myScannedTickets.length})</h4>
              {myScannedTickets.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Anda belum memindai tiket hari ini.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {myScannedTickets.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.78rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{t.id}</strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>({t.quantity} Pax)</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                        {new Date(t.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scanner Result Card */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '300px' }}>
            {!scanResult ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <QrCode size={40} style={{ margin: '0 auto 10px auto', opacity: 0.3 }} />
                <h4 style={{ fontSize: '0.95rem' }}>Menunggu Pindai Tiket</h4>
                <p style={{ fontSize: '0.75rem', maxWidth: '240px', margin: '4px auto 0 auto' }}>
                  Arahkan kamera ke e-ticket pengunjung atau pilih/ketik manual kode tiket di sebelah kiri.
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
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>Tiket valid. Pengunjung diperbolehkan masuk area.</p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', width: '100%', textAlign: 'left', fontSize: '0.8rem' }}>
                      <div>Kode Tiket: <strong>{scanResult.details.id}</strong></div>
                      <div>Kategori: <strong>{scanResult.details.name}</strong></div>
                      <div>Jumlah Pax: <strong>{scanResult.details.quantity} Orang</strong></div>
                      <div>Tgl Rencana: <strong>{scanResult.details.visitDate}</strong></div>
                      <div>Petugas Scan: <strong>{scanResult.details.scannedBy}</strong></div>
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
                        <div style={{ color: 'var(--color-warning)' }}>Petugas Scan: <strong>{scanResult.details.scannedBy}</strong></div>
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
                      <AlertTriangle size={36} />
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
      {/* TAB 3: PERSONAL ATTENDANCE LOGS */}
      {/* ========================================== */}
      {activeTab === 'history' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} style={{ color: 'var(--accent-cyan)' }} />
            Jurnal Kehadiran Pribadi Anda
          </h3>

          {employeeLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '32px' }}>
              Belum ada riwayat pencatatan absen di sistem ini.
            </p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Clock In (Masuk)</th>
                    <th>Clock Out (Pulang)</th>
                    <th>Jarak Radius (In)</th>
                    <th>Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.date}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: '500', fontSize: '0.85rem' }}>
                        {formatTime(log.clockIn)}
                      </td>
                      <td style={{ color: log.clockOut ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: '500', fontSize: '0.85rem' }}>
                        {log.clockOut ? formatTime(log.clockOut) : '--:--'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {log.distanceInMeters >= 1000 
                          ? `${(log.distanceInMeters / 1000).toFixed(2)} km` 
                          : `${log.distanceInMeters} m`
                        }
                      </td>
                      <td>
                        <span className={`badge ${
                          log.status === 'Terlambat' 
                            ? 'badge-warning' 
                            : 'badge-success'
                        }`} style={{ fontSize: '0.6rem', padding: '2px 8px' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
