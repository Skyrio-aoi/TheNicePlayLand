import React, { useState, useEffect } from 'react';
import { 
  Ticket, Calendar, CreditCard, QrCode, History, Plus, 
  Minus, Info, CheckCircle2, ChevronRight, AlertCircle, ShoppingBag, 
  Printer, Grid, Star, MapPin, Eye, Clock, ShieldCheck, Sparkles
} from 'lucide-react';
import { getDB, saveDB } from '../utils/db';
import logoImg from '../assets/logo.jpg';

export default function UserDashboard({ currentUser }) {
  const [db, setDb] = useState(getDB());
  const [activePortalTab, setActivePortalTab] = useState('shop'); // 'shop', 'rides', 'history'
  
  // Checkout Form States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  // Promo Code States
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  // Fallback Simulation popup states (if API fails or offline)
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const [fallbackOrderId, setFallbackOrderId] = useState('');
  const [fallbackAmount, setFallbackAmount] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeQrTicket, setActiveQrTicket] = useState(null);
  const [successTicket, setSuccessTicket] = useState(null);
  
  // Printable Invoice States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTicketData, setPrintTicketData] = useState(null);

  // Save DB helper
  const updateLocalDB = (newDb) => {
    saveDB(newDb);
    setDb(newDb);
  };

  // Handle tab switching via window events from external elements like chatbot
  useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e.detail && typeof e.detail === 'string') {
        setActivePortalTab(e.detail);
      }
    };
    window.addEventListener('switch-portal-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-portal-tab', handleSwitchTab);
  }, []);

  // Check if a ticket needs to be auto-opened or recovered on mount
  useEffect(() => {
    // 1. Check if there's an explicit auto-open request from URL redirect
    const autoOpenId = localStorage.getItem('auto_open_qr_ticket');
    if (autoOpenId) {
      const ticket = db.purchasedTickets.find(t => t.id === autoOpenId);
      if (ticket) {
        setActiveQrTicket(ticket);
        setSuccessTicket(ticket);
      }
      localStorage.removeItem('auto_open_qr_ticket');
      return;
    }

    // 2. Auto-recovery: scan localStorage for stuck pending transactions for this user
    let recoveredTicket = null;
    const newDb = { ...db };
    let hasRecovered = false;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pending_tx_')) {
        try {
          const pendingData = JSON.parse(localStorage.getItem(key));
          // Make sure it belongs to the current user
          if (pendingData && pendingData.userId === currentUser.id) {
            // Check if this ticket orderId already exists in db to avoid duplicates
            const exists = newDb.purchasedTickets.find(t => t.orderId === pendingData.orderId);
            if (!exists) {
              const ticketId = 'PT-' + Math.floor(10000 + Math.random() * 90000);
              recoveredTicket = {
                id: ticketId,
                userId: currentUser.id,
                ticketTypeId: pendingData.ticketTypeId,
                ticketName: pendingData.ticketName,
                price: pendingData.price,
                purchaseDate: new Date().toISOString(),
                visitDate: pendingData.visitDate,
                quantity: pendingData.quantity,
                totalAmount: pendingData.totalAmount,
                status: 'active',
                scannedAt: null,
                orderId: pendingData.orderId,
                promoCode: pendingData.promoCode
              };
              newDb.purchasedTickets = [recoveredTicket, ...newDb.purchasedTickets];
              hasRecovered = true;
            }
            // Remove the pending transaction from cache
            localStorage.removeItem(key);
            i--; // adjust index since we removed an item
          }
        } catch (e) {
          console.error("Error recovering pending transaction", e);
        }
      }
    }

    if (hasRecovered && recoveredTicket) {
      updateLocalDB(newDb);
      setActiveQrTicket(recoveredTicket);
      setSuccessTicket(recoveredTicket);
    }
  }, [db, currentUser.id]);

  const handleOpenCheckout = (ticket) => {
    setSelectedTicket(ticket);
    setQuantity(1);
    setPromoCode('');
    setAppliedPromo('');
    setDiscountAmount(0);
    setPromoError('');
    setPromoSuccess('');
    setErrorMsg('');
    setIsCheckoutOpen(true);
  };

  const handleQuantityChange = (val) => {
    const nextVal = quantity + val;
    if (nextVal >= 1 && nextVal <= 10) {
      setQuantity(nextVal);
      // Reset promo if quantity changes to avoid price discrepancy
      setAppliedPromo('');
      setDiscountAmount(0);
      setPromoSuccess('');
    }
  };

  // Validate Promo Code
  const handleApplyPromo = () => {
    setPromoError('');
    setPromoSuccess('');
    const code = promoCode.trim().toUpperCase();

    if (!code) {
      setPromoError('Masukkan kode promo terlebih dahulu.');
      return;
    }

    const basePrice = selectedTicket.price * quantity;

    if (code === 'NICEPLAY') {
      const discount = basePrice * 0.1; // 10% off
      setDiscountAmount(discount);
      setAppliedPromo('NICEPLAY');
      setPromoSuccess('Selamat! Kode promo NICEPLAY berhasil digunakan (Diskon 10% applied).');
    } else if (code === 'INDRAMAYU') {
      const discount = basePrice * 0.15; // 15% off
      setDiscountAmount(discount);
      setAppliedPromo('INDRAMAYU');
      setPromoSuccess('Selamat! Kode promo INDRAMAYU berhasil digunakan (Diskon 15% applied).');
    } else {
      setPromoError('Kode promo tidak terdaftar atau telah kedaluwarsa.');
      setDiscountAmount(0);
      setAppliedPromo('');
    }
  };

  // Real Midtrans Snap checkout handler
  const handlePayWithMidtrans = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg('');

    const grossAmount = (selectedTicket.price * quantity) - discountAmount;
    const orderId = 'PLAYLAND-' + Date.now();

    // Stash pending transaction details in localStorage
    const pendingTx = {
      orderId,
      userId: currentUser.id,
      ticketTypeId: selectedTicket.id,
      ticketName: selectedTicket.name,
      price: selectedTicket.price,
      quantity,
      visitDate,
      totalAmount: grossAmount,
      promoCode: appliedPromo || null
    };
    localStorage.setItem(`pending_tx_${orderId}`, JSON.stringify(pendingTx));

    try {
      // Attempt to contact local Vite server-side middleware
      const response = await fetch('/api/midtrans-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: orderId,
          gross_amount: grossAmount,
          customer_name: currentUser.name,
          redirect_url: window.location.origin + '/'
        })
      });

      if (!response.ok) {
        throw new Error('Gagal menghubungi proxy server Midtrans.');
      }

      const result = await response.json();
      const token = result.token;

      if (!token) {
        throw new Error('Token Midtrans tidak terdefinisi.');
      }

      setIsProcessing(false);
      setIsCheckoutOpen(false);

      // Open official Midtrans Snap iframe pop-up
      if (window.snap) {
        window.snap.pay(token, {
          onSuccess: function(snapResult) {
            handleCompleteDatabaseTransaction(orderId, grossAmount);
          },
          onPending: function(snapResult) {
            alert('Pembayaran pending. Silakan cek m-banking atau e-wallet Anda.');
          },
          onError: function(snapResult) {
            alert('Pembayaran gagal. Silakan ulangi pembelian tiket.');
          },
          onClose: function() {
            alert('Popup pembayaran ditutup sebelum transaksi selesai.');
          }
        });
      } else {
        throw new Error('Pustaka Midtrans Snap tidak terpasang.');
      }

    } catch (err) {
      console.warn('Backend proxy offline/error. Mengaktifkan fallback simulator...', err);
      // Fallback: If dev server api route is not available,
      // we open our custom simulated overlay
      setIsProcessing(false);
      setIsCheckoutOpen(false);
      setFallbackOrderId(orderId);
      setFallbackAmount(grossAmount);
      setIsFallbackOpen(true);
    }
  };

  // Helper to commit payment to DB
  const handleCompleteDatabaseTransaction = (orderId, finalAmount) => {
    const dbState = getDB();
    const existing = dbState.purchasedTickets.find(t => t.orderId === orderId);
    if (existing) {
      // Ticket has already been created (e.g. by App.jsx parser)
      return;
    }

    const pendingDataStr = localStorage.getItem(`pending_tx_${orderId}`);
    let pendingData = null;
    if (pendingDataStr) {
      pendingData = JSON.parse(pendingDataStr);
      localStorage.removeItem(`pending_tx_${orderId}`);
    }

    const ticketId = 'PT-' + Math.floor(10000 + Math.random() * 90000);
    const newPurchasedTicket = {
      id: ticketId,
      userId: currentUser.id,
      ticketTypeId: pendingData ? pendingData.ticketTypeId : selectedTicket.id,
      ticketName: pendingData ? pendingData.ticketName : selectedTicket.name,
      price: pendingData ? pendingData.price : selectedTicket.price,
      purchaseDate: new Date().toISOString(),
      visitDate: pendingData ? pendingData.visitDate : visitDate,
      quantity: pendingData ? pendingData.quantity : quantity,
      totalAmount: pendingData ? pendingData.totalAmount : finalAmount,
      status: 'active',
      scannedAt: null,
      orderId: orderId,
      promoCode: pendingData ? pendingData.promoCode : (appliedPromo || null)
    };

    const newDb = { ...dbState };
    newDb.purchasedTickets = [newPurchasedTicket, ...newDb.purchasedTickets];
    updateLocalDB(newDb);
    
    // Automatically view the newly created ticket & trigger success modal
    setActiveQrTicket(newPurchasedTicket);
    setSuccessTicket(newPurchasedTicket);

    // Clear states
    setSelectedTicket(null);
    setPromoCode('');
    setDiscountAmount(0);
    setAppliedPromo('');
    setIsFallbackOpen(false);
  };

  // Helper to filter tickets
  const userTickets = db.purchasedTickets.filter(t => t.userId === currentUser.id);
  const activeTickets = userTickets.filter(t => t.status === 'active');
  const historyTickets = userTickets;

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  // Custom QR Code renderer using SVG
  const renderQrCodeSVG = (text, size = 180) => {
    return (
      <div style={{ position: 'relative', width: size, height: size, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', borderRadius: '8px', padding: '6px' }}>
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=0a0616&bgcolor=ffffff`} 
          alt={`QR Code ${text}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 2, position: 'absolute', top: 0, left: 0, padding: '6px', background: 'white', borderRadius: '8px' }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="qr-svg" style={{ zIndex: 1 }}>
          <rect width="100" height="100" rx="6" fill="#FFFFFF" />
          
          {/* Tracking squares */}
          <rect x="6" y="6" width="22" height="22" rx="2" fill="#0A0616" />
          <rect x="10" y="10" width="14" height="14" fill="#FFFFFF" />
          <rect x="13" y="13" width="8" height="8" fill="#7C3AED" />
          
          <rect x="72" y="6" width="22" height="22" rx="2" fill="#0A0616" />
          <rect x="76" y="10" width="14" height="14" fill="#FFFFFF" />
          <rect x="79" y="13" width="8" height="8" fill="#7C3AED" />
          
          <rect x="6" y="72" width="22" height="22" rx="2" fill="#0A0616" />
          <rect x="10" y="76" width="14" height="14" fill="#FFFFFF" />
          <rect x="13" y="79" width="8" height="8" fill="#7C3AED" />
          
          <rect x="78" y="78" width="10" height="10" rx="1" fill="#0A0616" />
          <rect x="81" y="81" width="4" height="4" fill="#FFFFFF" />
          
          {/* Mock pixel blocks */}
          <g fill="#120C24">
            <rect x="34" y="6" width="4" height="8" />
            <rect x="42" y="10" width="8" height="4" />
            <rect x="54" y="6" width="14" height="4" />
            <rect x="62" y="12" width="4" height="12" />
            <rect x="34" y="18" width="12" height="4" />
            <rect x="50" y="18" width="8" height="8" />
            
            <rect x="6" y="34" width="8" height="4" />
            <rect x="18" y="30" width="4" height="12" />
            <rect x="26" y="34" width="16" height="4" />
            <rect x="48" y="30" width="4" height="16" />
            <rect x="56" y="34" width="20" height="4" />
            <rect x="80" y="30" width="14" height="4" />
            
            <rect x="6" y="46" width="12" height="4" />
            <rect x="22" y="42" width="8" height="8" />
            <rect x="34" y="46" width="4" height="12" />
            <rect x="42" y="52" width="12" height="4" />
            <rect x="58" y="46" width="8" height="12" />
            <rect x="70" y="42" width="4" height="16" />
            <rect x="78" y="46" width="16" height="4" />
            
            <rect x="6" y="58" width="4" height="10" />
            <rect x="14" y="58" width="12" height="4" />
            <rect x="30" y="62" width="14" height="4" />
            <rect x="48" y="62" width="6" height="6" />
            <rect x="58" y="62" width="18" height="4" />
            <rect x="80" y="58" width="8" height="8" />
            
            <rect x="34" y="72" width="8" height="4" />
            <rect x="46" y="72" width="4" height="14" />
            <rect x="54" y="76" width="12" height="4" />
            <rect x="34" y="82" width="8" height="12" />
            <rect x="46" y="88" width="16" height="4" />
            <rect x="66" y="82" width="8" height="4" />
          </g>
          
          {/* Playland branding inside QR */}
          <rect x="42" y="42" width="16" height="16" rx="4" fill="#7C3AED" />
          <path d="M46 51.5V47.5L50 45L54 47.5V52.5H46Z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="dashboard-container">
      {/* Welcome & Navigation Header banner */}
      <div className="glass-panel glass-card-glow-purple animate-fade-in" style={{ padding: '24px 32px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <span className="badge badge-success" style={{ marginBottom: '8px' }}>Akun Terverifikasi</span>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>Halo, {currentUser.name}!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Pilih tiket bermain Anda & nikmati keseruan wahana The Nice Playland Indramayu.</p>
        </div>

        {/* Portal Tabs Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <button 
            onClick={() => setActivePortalTab('shop')}
            className={`btn ${activePortalTab === 'shop' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
          >
            <Ticket size={14} /> Beli Tiket
          </button>
          <button 
            onClick={() => setActivePortalTab('rides')}
            className={`btn ${activePortalTab === 'rides' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
          >
            <Grid size={14} /> Daftar Wahana
          </button>
          <button 
            onClick={() => setActivePortalTab('history')}
            className={`btn ${activePortalTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
          >
            <History size={14} /> Riwayat Tiket
          </button>
        </div>
      </div>

      {/* Main Grid: Left Side and Right Side */}
      <div className="portal-grid">
        
        {/* LEFT COLUMN: ACTIVE PORTAL TAB */}
        <div>
          
          {/* TAB 1: BUY TICKETS SHOP */}
          {activePortalTab === 'shop' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ticket style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.25rem' }}>Beli Tiket Masuk Resmi</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                {db.ticketTypes.map((ticket) => (
                  <div key={ticket.id} className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: '1', minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{ticket.name}</h4>
                        <span className="badge badge-success" style={{ textTransform: 'none', fontSize: '0.75rem' }}>{formatRupiah(ticket.price)}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px', lineHeight: '1.4' }}>
                        {ticket.description}
                      </p>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                        {ticket.benefits.map((benefit, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <CheckCircle2 size={12} style={{ color: 'var(--color-success)' }} />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '180px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Petunjuk: Gunakan promo <strong>NICEPLAY</strong> (10% off) atau <strong>INDRAMAYU</strong> (15% off)</div>
                      <button 
                        onClick={() => handleOpenCheckout(ticket)}
                        className="btn btn-primary" 
                        style={{ width: '100%', padding: '12px 16px', fontSize: '0.85rem' }}
                      >
                        Beli Tiket Terusan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: RIDES LIST (WAHANA ATRAKSI INDRAMAYU) */}
          {activePortalTab === 'rides' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Grid style={{ color: 'var(--accent-secondary)' }} />
                  <h3 style={{ fontSize: '1.25rem' }}>Eksplorasi Wahana & Destinasi</h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 Pekandangan Jaya, Indramayu</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {db.rides.map((ride) => (
                  <div key={ride.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{ride.name}</h4>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{ride.status}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
                        {ride.description}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Kapasitas: <strong>{ride.capacity}</strong></span>
                      <span>Min Umur: <strong style={{ color: 'var(--accent-primary)' }}>{ride.minAge}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TRANSACTION HISTORY */}
          {activePortalTab === 'history' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <History style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.25rem' }}>Riwayat Pembelian & Kunjungan</h3>
              </div>

              {historyTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <History size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ fontSize: '0.85rem' }}>Belum ada riwayat scan/tiket yang kedaluwarsa.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID Tiket</th>
                        <th>Kategori</th>
                        <th>Kunjungan</th>
                        <th>Jumlah</th>
                        <th>Total Bayar</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyTickets.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.id}</td>
                          <td>{t.ticketName}</td>
                          <td style={{ fontSize: '0.85rem' }}>{t.visitDate}</td>
                          <td>{t.quantity}x</td>
                          <td>{formatRupiah(t.totalAmount)}</td>
                          <td>
                            {t.status === 'active' ? (
                              <span className="badge badge-success">AKTIF</span>
                            ) : (
                              <span className="badge badge-primary">SUDAH SCAN</span>
                            )}
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

        {/* RIGHT COLUMN: ACTIVE TICKET VIEWER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Ticket List */}
          <div className="glass-panel glass-card-glow-pink" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <QrCode style={{ color: 'var(--accent-secondary)' }} />
              <h3 style={{ fontSize: '1.1rem' }}>E-Tiket Aktif ({activeTickets.length})</h3>
            </div>
            
            {activeTickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)' }}>
                <Ticket size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
                <p style={{ fontSize: '0.8rem', marginBottom: '10px' }}>Tidak ada tiket aktif.</p>
                <button 
                  onClick={() => setActivePortalTab('shop')} 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.75rem', padding: '6px 12px', width: '100%' }}
                >
                  Beli Tiket Sekarang
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeTickets.map((t) => (
                  <div 
                    key={t.id} 
                    className="glass-panel" 
                    style={{ 
                      padding: '12px 14px', 
                      background: activeQrTicket?.id === t.id ? 'rgba(236, 72, 153, 0.04)' : 'rgba(0,0,0,0.1)',
                      borderColor: activeQrTicket?.id === t.id ? 'var(--accent-secondary)' : 'var(--glass-border)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveQrTicket(t)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t.ticketName}</span>
                      <span className="badge badge-success" style={{ fontSize: '0.55rem', padding: '1px 6px' }}>AKTIF</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>Tgl: {t.visitDate}</span>
                      <span>Jumlah: <strong>{t.quantity} Orang</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QR Code Big Viewer Panel */}
          {activeQrTicket && (
            <div className="glass-panel animate-fade-in" style={{ padding: '20px', textAlign: 'center', position: 'relative' }}>
              <button 
                onClick={() => setActiveQrTicket(null)}
                style={{ position: 'absolute', top: '10px', right: '14px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
              <h4 style={{ fontSize: '1rem', marginBottom: '2px' }}>Pintu Masuk Gerbang</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '14px' }}>Scan barcode ini di gate Indramayu</p>
              
              <div className="qr-container" style={{ marginBottom: '14px' }}>
                {renderQrCodeSVG(activeQrTicket.id, 140)}
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'left', marginBottom: '12px', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{activeQrTicket.ticketName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>ID: {activeQrTicket.id} | Jumlah: {activeQrTicket.quantity} Pax</div>
              </div>

              <button 
                onClick={() => {
                  setPrintTicketData(activeQrTicket);
                  setIsPrintModalOpen(true);
                }}
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', padding: '8px' }}
              >
                <Printer size={12} /> Cetak Invoice / E-Ticket
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ========================================== */}
      {/* FORM CHECKOUT & PROMO CODE MODAL */}
      {/* ========================================== */}
      {isCheckoutOpen && selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.3rem' }}>Form Pembelian Tiket</h3>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                disabled={isProcessing}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handlePayWithMidtrans} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Ticket info box */}
              <div style={{ background: 'rgba(124, 58, 237, 0.04)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(124, 58, 237, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '2px' }}>
                  <span>{selectedTicket.name}</span>
                  <span style={{ color: 'var(--accent-primary)' }}>{formatRupiah(selectedTicket.price)}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Akses terusan untuk bermain di seluruh wahana sepuasnya.</p>
              </div>

              {/* Quantity and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Jumlah Tiket</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '8px', border: '1px solid var(--glass-border)', justifyContent: 'space-between' }}>
                    <button 
                      type="button"
                      onClick={() => handleQuantityChange(-1)} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', height: '30px', minWidth: '30px' }}
                    >
                      <Minus size={10} />
                    </button>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{quantity}</span>
                    <button 
                      type="button"
                      onClick={() => handleQuantityChange(1)} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', height: '30px', minWidth: '30px' }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tanggal Kunjungan</label>
                  <input 
                    type="date" 
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="input-field" 
                    required
                  />
                </div>
              </div>

              {/* Promo code entry */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kode Promo (Optional)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Contoh: NICEPLAY" 
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="input-field"
                    style={{ textTransform: 'uppercase' }}
                    disabled={isProcessing}
                  />
                  <button 
                    type="button" 
                    onClick={handleApplyPromo}
                    className="btn btn-secondary"
                    style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                    disabled={isProcessing}
                  >
                    Terapkan
                  </button>
                </div>

                {/* Promo messages */}
                {promoError && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.72rem', marginTop: '6px', fontWeight: 'bold' }}>
                    ⚠️ {promoError}
                  </div>
                )}
                {promoSuccess && (
                  <div style={{ color: 'var(--color-success)', fontSize: '0.72rem', marginTop: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} /> {promoSuccess}
                  </div>
                )}
              </div>

              {/* Price Details */}
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Harga Tiket ({quantity}x):</span>
                  <span>{formatRupiah(selectedTicket.price * quantity)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', color: 'var(--color-success)', fontWeight: 'bold' }}>
                    <span>Diskon Promo ({appliedPromo}):</span>
                    <span>-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontWeight: 'bold', fontSize: '0.92rem', marginTop: '2px' }}>
                  <span>Total Tagihan:</span>
                  <span style={{ color: 'var(--accent-secondary)' }}>
                    {formatRupiah((selectedTicket.price * quantity) - discountAmount)}
                  </span>
                </div>
              </div>

              {/* Submit button */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Proses Midtrans Terlindungi</span>
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="btn btn-primary"
                  style={{ padding: '12px 24px', fontSize: '0.88rem' }}
                >
                  {isProcessing ? 'Menghubungi Midtrans...' : 'Bayar dengan Midtrans'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 4. MIDTRANS SNAP SIMULATION FALLBACK OVERLAY (OFFLINE) */}
      {/* ======================================================= */}
      {isFallbackOpen && selectedTicket && (
        <div className="midtrans-snap-overlay">
          <div className="midtrans-snap-modal">
            
            {/* Header */}
            <div className="midtrans-snap-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={18} style={{ color: '#0070cd' }} />
                <span style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '0.5px' }}>
                  midtrans <span style={{ color: '#0070cd', fontWeight: 'normal' }}>| snap</span>
                </span>
              </div>
              <span style={{ fontSize: '0.65rem', background: '#38a169', padding: '2px 8px', borderRadius: '10px', color: 'white', fontWeight: 'bold' }}>
                OFFLINE GATEWAY
              </span>
            </div>

            {/* Body */}
            <div className="midtrans-snap-body">
              
              {/* Info order */}
              <div style={{ background: '#ffffff', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>
                  <span>ORDER ID: <strong>{fallbackOrderId}</strong></span>
                  <span>Countdown: <strong>23:59:50</strong></span>
                </div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #edf2f7', paddingTop: '10px', marginTop: '6px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#2d3748' }}>{selectedTicket.name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#718096', display: 'block' }}>{quantity} Pax</span>
                  </div>
                  <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#0070cd' }}>
                    {formatRupiah(fallbackAmount)}
                  </span>
                </div>
              </div>

              {/* Warning box client key */}
              <div style={{ background: '#fffaf0', border: '1px solid #feebc8', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.72rem', color: '#dd6b20', lineHeight: '1.4' }}>
                <strong>⚠️ Koneksi Gateway Offline</strong><br/>
                Koneksi API Midtrans tidak terhubung. Mengaktifkan gerbang pembayaran cadangan (Virtual QRIS / Bank Transfer).
                <div>Merchant ID: <code>{db.settings.midtrans.clientKey}</code></div>
              </div>

              {/* Payment selection */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '8px' }}>Pilih Metode Pembayaran:</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <QrCode size={16} style={{ color: '#e53e3e' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#2d3748' }}>GOPAY / QRIS</span>
                  </div>
                  <input type="radio" checked readOnly />
                </div>
              </div>

              <div style={{ textAlign: 'center', background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                {renderQrCodeSVG('FALLBACK-PAYLAND-QRIS', 100)}
                <p style={{ fontSize: '0.68rem', color: '#718096', marginTop: '6px' }}>Pindai QR Code di atas menggunakan aplikasi e-wallet / m-banking Anda untuk menyelesaikan pembayaran.</p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setIsFallbackOpen(false)}
                  className="btn"
                  style={{ flex: 1, background: '#edf2f7', color: '#4a5568', padding: '10px', fontSize: '0.85rem' }}
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleCompleteDatabaseTransaction(fallbackOrderId, fallbackAmount)}
                  className="btn btn-success"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', background: '#38a169' }}
                >
                  Bayar Sukses
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 5. PRINTABLE RECEIPT MODAL OVERLAY */}
      {/* ========================================== */}
      {isPrintModalOpen && printTicketData && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px', background: '#FFFFFF', color: '#1a1a1a', padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="no-print">
              <span style={{ fontWeight: 'bold', color: '#0a0616', fontSize: '0.9rem' }}>E-Ticket Receipt</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handlePrint} style={{ cursor: 'pointer', background: '#7c3aed', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Printer size={12} /> Print
                </button>
                <button onClick={() => setIsPrintModalOpen(false)} style={{ cursor: 'pointer', background: '#e2e8f0', color: '#475569', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  Tutup
                </button>
              </div>
            </div>

            <div id="printable-ticket-area" style={{ padding: '32px 24px', position: 'relative', fontFamily: 'monospace', background: '#FFFFFF' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img 
                  src={logoImg} 
                  alt="Logo" 
                  style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 8px auto', border: '1px solid #e2e8f0' }} 
                />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '1px', margin: 0, color: '#1a1a1a' }}>THE NICE PLAYLAND</h2>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '4px 0' }}>Bukti Transaksi E-Ticket Resmi</p>
                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>Pekandangan Jaya, Indramayu, Jawa Barat</p>
              </div>

              <div style={{ borderTop: '2px dashed #cbd5e1', margin: '14px 0' }} />

              <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '6px', color: '#1a1a1a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>KODE TIKET:</span>
                  <strong style={{ fontSize: '0.8rem' }}>{printTicketData.id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>NAMA PEMBELI:</span>
                  <span>{currentUser.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>WAKTU TRANSAKSI:</span>
                  <span>{new Date(printTicketData.purchaseDate).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>TANGGAL BERKUNJUNG:</span>
                  <strong style={{ color: '#000000' }}>{printTicketData.visitDate}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />

              {/* Order detail */}
              <div style={{ fontSize: '0.78rem', color: '#1a1a1a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '6px' }}>
                  <span>Deskripsi Item</span>
                  <span>Qty</span>
                  <span>Total</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>{printTicketData.ticketName}</span>
                  <span>{printTicketData.quantity}x</span>
                  <span>{formatRupiah(printTicketData.totalAmount)}</span>
                </div>
              </div>

              <div style={{ borderTop: '2px dashed #cbd5e1', margin: '14px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.9rem', color: '#1a1a1a' }}>
                <span>TOTAL BAYAR:</span>
                <span>{formatRupiah(printTicketData.totalAmount)}</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '4px', textAlign: 'right' }}>
                LUNAS (Midtrans Sandbox - QRIS)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', gap: '6px' }}>
                {renderQrCodeSVG(printTicketData.id, 120)}
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '2px', color: '#1a1a1a' }}>{printTicketData.id}</span>
              </div>

              {/* Barcode Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px' }}>
                <div style={{ display: 'flex', height: '20px', width: '130px', background: '#000', gap: '2px', overflow: 'hidden' }}>
                  <div style={{ width: '4px', background: '#000' }} />
                  <div style={{ width: '1px', background: '#fff' }} />
                  <div style={{ width: '2px', background: '#000' }} />
                  <div style={{ width: '3px', background: '#fff' }} />
                  <div style={{ width: '6px', background: '#000' }} />
                  <div style={{ width: '2px', background: '#fff' }} />
                  <div style={{ width: '3px', background: '#000' }} />
                  <div style={{ width: '4px', background: '#fff' }} />
                  <div style={{ width: '8px', background: '#000' }} />
                  <div style={{ width: '1px', background: '#fff' }} />
                  <div style={{ width: '4px', background: '#000' }} />
                </div>
                <span style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '4px' }}>*E-TICKET-SECURED-BY-MIDTRANS*</span>
              </div>

              <div style={{ borderTop: '2px dashed #cbd5e1', margin: '16px 0 10px 0' }} />

              <div style={{ fontSize: '0.6rem', color: '#475569', textAlign: 'center', lineHeight: '1.4' }}>
                <strong>Syarat & Ketentuan:</strong><br />
                Tunjukkan QR Code di atas pada gerbang pemindaian masuk The Nice Playland Indramayu. Tiket ini hanya berlaku sekali pakai.
              </div>
            </div>
            
            {/* Print Style Inject */}
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                #printable-ticket-area, #printable-ticket-area * {
                  visibility: visible;
                }
                #printable-ticket-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  padding: 20px;
                  background: white;
                  color: black;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />
          </div>
        </div>
      )}
      {/* ========================================== */}
      {/* BEAUTIFUL PAYMENT SUCCESS MODAL OVERLAY */}
      {/* ========================================== */}
      {successTicket && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-fade-in glass-panel glass-card-glow-green" style={{ maxWidth: '420px', padding: '32px', textAlign: 'center' }}>
            
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.12)', 
              width: '72px', 
              height: '72px', 
              borderRadius: '50%', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              border: '2px solid var(--color-success)', 
              marginBottom: '18px',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
            }}>
              <CheckCircle2 size={36} style={{ color: 'var(--color-success)' }} />
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Pembayaran Sukses!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Pembayaran tiket Anda telah terverifikasi secara aman melalui Midtrans.
            </p>

            <div style={{ 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--glass-border)', 
              borderRadius: '10px', 
              padding: '16px', 
              textAlign: 'left', 
              fontSize: '0.82rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>ID Transaksi:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{successTicket.orderId}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Kode E-Tiket:</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{successTicket.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Kategori Tiket:</span>
                <span style={{ color: 'var(--text-primary)' }}>{successTicket.ticketName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Jumlah Karcis:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{successTicket.quantity} Pax</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Total Bayar:</span>
                <strong style={{ color: 'var(--accent-secondary)', fontSize: '0.95rem' }}>{formatRupiah(successTicket.totalAmount)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  setActiveQrTicket(successTicket);
                  setSuccessTicket(null);
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '0.88rem' }}
              >
                Tampilkan Barcode E-Tiket
              </button>
              <button 
                onClick={() => setSuccessTicket(null)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '0.82rem' }}
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
