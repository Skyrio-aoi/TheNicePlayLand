import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, User, LogOut, Ticket, Shield, UserCheck, 
  MapPin, HelpCircle, AlertCircle, Sun, Moon, 
  MessageSquare, Send, Sparkles, X, Bot, Landmark, UserPlus
} from 'lucide-react';
import { initDB, getDB } from './utils/db';
import UserDashboard from './components/UserDashboard';
import KaryawanDashboard from './components/KaryawanDashboard';
import AdminDashboard from './components/AdminDashboard';
import logoImg from './assets/logo.jpg';

export default function App() {
  const [db, setDb] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Theme state: light (default, clean design) or dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('the_nice_playland_theme') || 'light';
  });

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  // Forgot Password states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotMatchedUser, setForgotMatchedUser] = useState(null);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');

  // CS AI Chatbot states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { 
      id: 'm1', 
      sender: 'bot', 
      text: 'Selamat datang di The Nice Playland Indramayu! 👋 Saya NiceBot, asisten virtual Anda. Ada yang bisa saya bantu hari ini?',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Initialize DB, pull from Cloud, & apply theme on mount
  useEffect(() => {
    const syncAndInit = async () => {
      let activeDb = initDB();
      
      // Pull latest database from cloud to synchronize across devices
      try {
        const response = await fetch('https://jsonblob.com/api/jsonBlob/019eab04-eb75-74f7-8dcd-d0438937df4f');
        if (response.ok) {
          const cloudDb = await response.json();
          if (cloudDb && cloudDb.settings && cloudDb.users) {
            localStorage.setItem('the_nice_playland_db', JSON.stringify(cloudDb));
            activeDb = cloudDb;
            console.log("Database synced from cloud successfully!");
          }
        } else {
          // If not initialized on cloud, push our local default database to cloud
          fetch('https://jsonblob.com/api/jsonBlob/019eab04-eb75-74f7-8dcd-d0438937df4f', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(activeDb)
          }).catch(console.error);
        }
      } catch (e) {
        console.warn("Could not reach cloud database, running in offline/local-only mode", e);
      }

      setDb(activeDb);
      
      // Check if session exists in localStorage
      const savedUser = localStorage.getItem('the_nice_playland_session');
      let loggedInUser = null;
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          const matchedUser = activeDb.users.find(u => u.id === parsedUser.id);
          if (matchedUser) {
            loggedInUser = matchedUser;
            setCurrentUser(matchedUser);
          }
        } catch (e) {
          console.error("Error parsing saved session", e);
        }
      }

      // Process Midtrans redirect query parameters
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get('order_id');
      const statusCode = params.get('status_code');
      const transactionStatus = params.get('transaction_status');

      if (orderId && (statusCode === '200' || statusCode === '201' || transactionStatus === 'settlement' || transactionStatus === 'capture')) {
        const pendingDataStr = localStorage.getItem(`pending_tx_${orderId}`);
        if (pendingDataStr) {
          try {
            const pendingData = JSON.parse(pendingDataStr);
            const existing = activeDb.purchasedTickets.find(t => t.orderId === orderId);
            if (!existing) {
              const ticketId = 'PT-' + Math.floor(10000 + Math.random() * 90000);
              const userId = pendingData.userId || (loggedInUser ? loggedInUser.id : 'u_cust1');
              
              const newPurchasedTicket = {
                id: ticketId,
                userId: userId,
                ticketTypeId: pendingData.ticketTypeId,
                ticketName: pendingData.ticketName,
                price: pendingData.price,
                purchaseDate: new Date().toISOString(),
                visitDate: pendingData.visitDate,
                quantity: pendingData.quantity,
                totalAmount: pendingData.totalAmount,
                status: 'active',
                scannedAt: null,
                orderId: orderId,
                promoCode: pendingData.promoCode
              };

              const updatedTicketsDb = {
                ...activeDb,
                purchasedTickets: [newPurchasedTicket, ...activeDb.purchasedTickets]
              };

              // Save locally
              localStorage.setItem('the_nice_playland_db', JSON.stringify(updatedTicketsDb));
              setDb(updatedTicketsDb);
              
              // Push to cloud
              fetch('https://jsonblob.com/api/jsonBlob/019eab04-eb75-74f7-8dcd-d0438937df4f', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedTicketsDb)
              }).catch(console.error);
              
              localStorage.removeItem(`pending_tx_${orderId}`);
              localStorage.setItem('auto_open_qr_ticket', ticketId);
            }
          } catch (e) {
            console.error("Error processing pending transaction redirect", e);
          }
        }
        
        // Clean query parameters from URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    syncAndInit();
  }, []);

  // Poll cloud database for updates every 8 seconds to synchronize laptop & mobile screens
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('https://jsonblob.com/api/jsonBlob/019eab04-eb75-74f7-8dcd-d0438937df4f');
        if (response.ok) {
          const cloudDb = await response.json();
          const currentLocalStr = localStorage.getItem('the_nice_playland_db');
          const cloudDbStr = JSON.stringify(cloudDb);
          
          if (currentLocalStr !== cloudDbStr && cloudDb && cloudDb.settings && cloudDb.users) {
            localStorage.setItem('the_nice_playland_db', cloudDbStr);
            setDb(cloudDb);
            console.log("Database synchronized from cloud (background update)!");
          }
        }
      } catch (e) {
        console.warn("Background cloud sync poll failed:", e);
      }
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);

  // Apply CSS theme class
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('the_nice_playland_theme', theme);
  }, [theme]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    setRegSuccessMsg('');

    if (!db) return;

    // Simple authentication against seeded or registered users
    const matchedUser = db.users.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (matchedUser) {
      const expectedPassword = matchedUser.password || matchedUser.username;
      if (password === expectedPassword) {
        localStorage.setItem('the_nice_playland_session', JSON.stringify(matchedUser));
        setCurrentUser(matchedUser);
        setUsername('');
        setPassword('');
      } else {
        setLoginError('Password salah.');
      }
    } else {
      setLoginError('Username tidak terdaftar. Silakan daftar akun baru di bawah.');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setLoginError('');
    setRegSuccessMsg('');

    if (!db) return;

    const usernameTrimmed = regUsername.trim().toLowerCase();
    const nameTrimmed = regName.trim();

    if (!usernameTrimmed || !nameTrimmed || !regPassword) {
      setLoginError('Semua kolom pendaftaran wajib diisi.');
      return;
    }

    // Check if username is already taken
    const existUser = db.users.find(
      u => u.username.toLowerCase() === usernameTrimmed
    );

    if (existUser) {
      setLoginError('Username sudah digunakan! Gunakan username lain.');
      return;
    }

    // Create new user account with stored password
    const newUser = {
      id: 'u_' + Math.floor(10000 + Math.random() * 90000),
      username: usernameTrimmed,
      role: 'user',
      name: nameTrimmed,
      password: regPassword
    };

    const newDb = {
      ...db,
      users: [...db.users, newUser]
    };

    // Save database & local state
    localStorage.setItem('the_nice_playland_db', JSON.stringify(newDb));
    setDb(newDb);

    // Reset fields & switch back to login
    setRegName('');
    setRegUsername('');
    setRegPassword('');
    setIsRegistering(false);
    setRegSuccessMsg('Registrasi berhasil! Silakan masuk dengan username & password baru Anda.');
  };

  const handleVerifyForgotUsername = (e) => {
    e.preventDefault();
    setForgotError('');
    if (!db) return;

    const matched = db.users.find(
      u => u.username.toLowerCase() === forgotUsername.trim().toLowerCase()
    );

    if (matched) {
      setForgotMatchedUser(matched);
      setForgotStep(2);
    } else {
      setForgotError('Username tidak terdaftar.');
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    setForgotError('');

    if (forgotNewPassword.length < 4) {
      setForgotError('Password minimal 4 karakter.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Konfirmasi password tidak cocok.');
      return;
    }

    if (!db || !forgotMatchedUser) return;

    const newDb = { ...db };
    const userIndex = newDb.users.findIndex(u => u.id === forgotMatchedUser.id);
    if (userIndex !== -1) {
      newDb.users[userIndex] = {
        ...newDb.users[userIndex],
        password: forgotNewPassword
      };
      localStorage.setItem('the_nice_playland_db', JSON.stringify(newDb));
      setDb(newDb);
      
      setRegSuccessMsg('Password berhasil diperbarui! Silakan login dengan password baru.');
      setIsForgotPassword(false);
      setForgotStep(1);
      setForgotUsername('');
      setForgotMatchedUser(null);
      setForgotNewPassword('');
      setForgotConfirmPassword('');
    } else {
      setForgotError('Terjadi kesalahan sistem.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('the_nice_playland_session');
    setCurrentUser(null);
  };

  // Smart Interactive Bot response logic
  const chatContext = useRef({ lastRideId: null, lastTopic: null });

  const handleInlineAction = (actionType) => {
    if (actionType === 'buy_ticket') {
      if (!currentUser) {
        setIsChatOpen(false);
        setIsRegistering(false);
        setIsForgotPassword(false);
        setRegSuccessMsg('Silakan masuk (login) atau daftar akun baru untuk membeli tiket.');
        const loginInput = document.querySelector('input[placeholder="Masukkan username..."]');
        if (loginInput) {
          loginInput.focus();
          loginInput.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        const event = new CustomEvent('switch-portal-tab', { detail: 'shop' });
        window.dispatchEvent(event);
      }
    } else if (actionType === 'view_rides') {
      if (currentUser && currentUser.role === 'user') {
        const event = new CustomEvent('switch-portal-tab', { detail: 'rides' });
        window.dispatchEvent(event);
      } else {
        // If not logged in, show rides by sending a chat message to list them
        handleSendMessage(null, "Daftar Wahana");
      }
    } else if (actionType === 'login_focus') {
      setIsChatOpen(false);
      setIsRegistering(false);
      setIsForgotPassword(false);
      const loginInput = document.querySelector('input[placeholder="Masukkan username..."]');
      if (loginInput) {
        loginInput.focus();
        loginInput.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (actionType === 'view_tickets') {
      if (currentUser && currentUser.role === 'user') {
        const event = new CustomEvent('switch-portal-tab', { detail: 'history' });
        window.dispatchEvent(event);
      }
    } else if (actionType === 'karyawan_gps') {
      if (currentUser && currentUser.role === 'karyawan') {
        const event = new CustomEvent('switch-karyawan-tab', { detail: 'gps' });
        window.dispatchEvent(event);
      }
    } else if (actionType === 'karyawan_scan') {
      if (currentUser && currentUser.role === 'karyawan') {
        const event = new CustomEvent('switch-karyawan-tab', { detail: 'scanner' });
        window.dispatchEvent(event);
      }
    }
  };

  const handleSendMessage = (e, customText = null) => {
    if (e) e.preventDefault();
    const textToSend = customText || chatInput.trim();
    if (!textToSend) return;

    // Add user message
    const userMsg = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    if (!customText) setChatInput('');

    // Trigger bot typing indicator
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let replyText = '';
      let replyActions = null;
      let replyChips = null;
      
      const text = textToSend.toLowerCase().trim();
      const userGreeting = currentUser ? `, ${currentUser.name}` : "";

      // 1. INTENT MATCH: TICKETS OR MY TICKETS
      if (text.includes("tiket saya") || text.includes("kode tiket") || text.includes("punya tiket") || text.includes("tiket aktif") || text.includes("lihat tiket")) {
        if (!currentUser) {
          replyText = "🔒 Untuk melihat tiket Anda, silakan masuk (login) terlebih dahulu menggunakan akun Anda di halaman masuk.";
          replyActions = [{ label: '🔑 Masuk Ke Akun Anda', actionType: 'login_focus' }];
        } else if (currentUser.role !== 'user') {
          replyText = `Halo${userGreeting}, fitur melihat e-tiket hanya tersedia untuk pelanggan (role user). Akun Anda saat ini memiliki role *${currentUser.role}*.`;
        } else {
          const myTickets = db.purchasedTickets.filter(t => t.userId === currentUser.id);
          const activeTickets = myTickets.filter(t => t.status === 'active');
          
          if (activeTickets.length === 0) {
            replyText = `🎫 Halo${userGreeting}, Anda belum memiliki tiket aktif saat ini.\n\nAnda bisa membeli **Tiket Masuk Terusan** seharga **Rp 25.000** sekarang!`;
            replyActions = [{ label: '🎟️ Beli Tiket Sekarang', actionType: 'buy_ticket' }];
          } else {
            replyText = `🎫 Halo${userGreeting}, Anda memiliki **${activeTickets.length} tiket aktif**:\n\n` + 
              activeTickets.map(t => `- **${t.id}**: ${t.ticketName} (${t.quantity} Pax) - Kunjungan: **${t.visitDate}**`).join('\n') + 
              `\n\nSilakan tunjukkan QR Code tiket tersebut di panel samping kanan untuk dipindai oleh petugas!`;
            replyActions = [{ label: '📂 Lihat Riwayat Transaksi', actionType: 'view_tickets' }];
          }
        }
        chatContext.current.lastTopic = "tickets";
      }
      
      // 2. INTENT MATCH: BUY TICKET HELP
      else if (text.includes("beli tiket") || text.includes("cara beli") || text.includes("pesan tiket") || text.includes("harga tiket") || text.includes("tarif") || text.includes("bayar")) {
        replyText = `🎟️ **Harga Tiket Terusan**: **Rp 25.000** per orang.\n\n**Cara membeli online**:\n1. Masuk ke akun Anda (atau daftar baru jika belum punya).\n2. Di menu utama, pilih tab **Beli Tiket**.\n3. Masukkan jumlah tiket dan tanggal kunjungan.\n4. Masukkan kode promo (jika ada) dan klik **Bayar dengan Midtrans**.\n5. Selesaikan pembayaran sandbox via QRIS/Bank Transfer. Tiket Anda akan langsung aktif!`;
        replyActions = [{ label: '🎟️ Beli Tiket Terusan - Rp25.000', actionType: 'buy_ticket' }];
        replyChips = [
          { label: '✨ Info Promo Diskon', textToSend: 'Info Promo' },
          { label: '🕒 Jam Operasional?', textToSend: 'Jam Buka?' }
        ];
        chatContext.current.lastTopic = "buy_ticket";
      }

      // 3. INTENT MATCH: PROMO CODES
      else if (text.includes("promo") || text.includes("diskon") || text.includes("niceplay") || text.includes("indramayu")) {
        replyText = `✨ **Kode Promo Aktif Hari Ini**:\n- **NICEPLAY**: Diskon 10% untuk semua pengunjung.\n- **INDRAMAYU**: Diskon 15% (Promo Spesial Warga Lokal).\n\n*Masukkan kode promo di atas pada form checkout sebelum menekan tombol bayar.*`;
        replyActions = [{ label: '🎟️ Gunakan Promo & Beli', actionType: 'buy_ticket' }];
        chatContext.current.lastTopic = "promo";
      }

      // 4. INTENT MATCH: WAHANA LIST
      else if (text.includes("wahana") || text.includes("permainan") || text.includes("fasilitas") || text.includes("ada apa saja") || text.includes("wahana buka")) {
        const openRides = db.rides.filter(r => r.status === 'Buka');
        replyText = `🎡 **Wahana yang Buka Hari Ini (${openRides.length} Wahana)**:\n` +
          openRides.map(r => `- **${r.name}** (Min: ${r.minAge})`).join('\n') +
          `\n\nKlik nama wahana di bawah untuk melihat batas umur, kapasitas, dan deskripsi keselamatan lengkapnya!`;
        
        replyChips = [
          { label: '🌈 Rainbow Slide', textToSend: 'Detail Rainbow Slide' },
          { label: '🎡 Giant Swing', textToSend: 'Detail Giant Swing' },
          { label: '🐰 Mini Zoo', textToSend: 'Detail Mini Zoo' },
          { label: '🎪 Ontang-anting', textToSend: 'Detail Ontang-anting' }
        ];
        
        if (currentUser && currentUser.role === 'user') {
          replyActions = [{ label: '🎡 Buka Tab Daftar Wahana', actionType: 'view_rides' }];
        }
        chatContext.current.lastTopic = "rides_list";
      }

      // 5. INTENT MATCH: SPECIFIC RIDES DETAILS
      else if (text.includes("rainbow slide") || (text.includes("perosotan") && text.includes("pelangi"))) {
        const r = db.rides.find(w => w.id === 'w1');
        replyText = `🌈 **Rainbow Slide (${r.status})**:\n${r.description}\n\n- **Batas Umur**: Minimal ${r.minAge}\n- **Kapasitas**: ${r.capacity}\n\n*Wahana peluncuran pelangi terpopuler! Harap patuhi instruksi staf.*`;
        chatContext.current.lastRideId = 'w1';
        chatContext.current.lastTopic = "ride_detail";
        replyChips = [
          { label: '🎡 Wahana Lainnya', textToSend: 'Daftar Wahana' },
          { label: '🎟️ Beli Tiket', textToSend: 'Beli Tiket' }
        ];
      } else if (text.includes("giant swing") || (text.includes("ayunan") && text.includes("raksasa"))) {
        const r = db.rides.find(w => w.id === 'w2');
        replyText = `🎡 **Giant Swing (${r.status})**:\n${r.description}\n\n- **Batas Umur**: Minimal ${r.minAge}\n- **Kapasitas**: ${r.capacity}\n\n*Adrenalin tinggi! Tidak disarankan bagi penderita penyakit jantung atau fobia ketinggian.*`;
        chatContext.current.lastRideId = 'w2';
        chatContext.current.lastTopic = "ride_detail";
        replyChips = [
          { label: '🌈 Rainbow Slide', textToSend: 'Detail Rainbow Slide' },
          { label: '🎡 Wahana Lainnya', textToSend: 'Daftar Wahana' }
        ];
      } else if (text.includes("flying fox") || text.includes("outbound")) {
        const r = db.rides.find(w => w.id === 'w3');
        replyText = `🌲 **Flying Fox & Mini Outbound (${r.status})**:\n${r.description}\n\n- **Batas Umur**: Minimal ${r.minAge}\n- **Kapasitas**: ${r.capacity}`;
        chatContext.current.lastRideId = 'w3';
        chatContext.current.lastTopic = "ride_detail";
      } else if (text.includes("skybridge") || text.includes("jembatan gantung")) {
        const r = db.rides.find(w => w.id === 'w4');
        replyText = `🌉 **Skybridge & Hanging Steps (${r.status})**:\n${r.description}\n\n- **Batas Umur**: Minimal ${r.minAge}\n- **Kapasitas**: ${r.capacity}`;
        chatContext.current.lastRideId = 'w4';
        chatContext.current.lastTopic = "ride_detail";
      } else if (text.includes("ontang-anting") || text.includes("ontang anting")) {
        const r = db.rides.find(w => w.id === 'w5');
        replyText = `🎪 **Ontang-anting (${r.status})**:\n${r.description}\n\n- **Batas Umur**: Minimal ${r.minAge}\n- **Kapasitas**: ${r.capacity}`;
        chatContext.current.lastRideId = 'w5';
        chatContext.current.lastTopic = "ride_detail";
      } else if (text.includes("mini zoo") || text.includes("kebun binatang") || text.includes("hewan")) {
        const r = db.rides.find(w => w.id === 'w6');
        replyText = `🐰 **Mini Zoo & Feeding Zone (${r.status})**:\n${r.description}\n\n- **Batas Umur**: ${r.minAge}\n- **Kapasitas**: ${r.capacity}\n\n*Cocok untuk sarana edukasi anak-anak berinteraksi dan memberi makan kelinci, kambing mini, & burung.*`;
        chatContext.current.lastRideId = 'w6';
        chatContext.current.lastTopic = "ride_detail";
        replyChips = [
          { label: '🧸 Playground Indoor', textToSend: 'Detail Playground' },
          { label: '🎡 Wahana Lainnya', textToSend: 'Daftar Wahana' }
        ];
      } else if (text.includes("playground") || text.includes("indoor")) {
        const r = db.rides.find(w => w.id === 'w7');
        replyText = `🧸 **Playground Indoor & Outdoor (${r.status})**:\n${r.description}\n\n- **Batas Umur**: ${r.minAge}\n- **Kapasitas**: ${r.capacity}`;
        chatContext.current.lastRideId = 'w7';
        chatContext.current.lastTopic = "ride_detail";
      }

      // 6. INTENT MATCH: CONTEXTUAL FOLLOW-UP FOR RIDES (Age or capacity)
      else if (chatContext.current.lastTopic === "ride_detail" && chatContext.current.lastRideId && (text.includes("umur berapa") || text.includes("anak kecil") || text.includes("boleh") || text.includes("syarat"))) {
        const r = db.rides.find(w => w.id === chatContext.current.lastRideId);
        replyText = `Syarat umur untuk wahana **${r.name}** adalah **minimal ${r.minAge}** demi keselamatan pengunjung.`;
      } else if (chatContext.current.lastTopic === "ride_detail" && chatContext.current.lastRideId && (text.includes("kapasitas") || text.includes("muat berapa") || text.includes("orang"))) {
        const r = db.rides.find(w => w.id === chatContext.current.lastRideId);
        replyText = `Kapasitas maksimal wahana **${r.name}** sekali jalan adalah **${r.capacity}**.`;
      }

      // 7. INTENT MATCH: HOURS & SCHEDULE
      else if (text.includes("jam buka") || text.includes("operasional") || text.includes("jadwal") || text.includes("buka jam") || text.includes("hari apa")) {
        replyText = "🕒 **Jam Operasional The Nice Playland Indramayu**:\n- **Weekday (Senin - Jumat)**: 09:00 - 17:45 WIB\n- **Weekend & Libur Nasional**: 08:00 - 17:45 WIB\n\n*Kami buka setiap hari sepanjang tahun, termasuk hari raya libur keagamaan!*";
        replyChips = [
          { label: '📍 Alamat Rute Lokasi?', textToSend: 'Alamat Lokasi?' },
          { label: '🎟️ Harga Tiket Masuk?', textToSend: 'Beli Tiket' }
        ];
        chatContext.current.lastTopic = "hours";
      }

      // 8. INTENT MATCH: LOCATION & ADDRESS
      else if (text.includes("lokasi") || text.includes("alamat") || text.includes("rute") || text.includes("di mana") || text.includes("jalan") || text.includes("maps")) {
        replyText = "📍 **Alamat Lengkap**:\nJl. Soekarno Hatta No.14a, Pekandangan Jaya, Kec. Indramayu, Kabupaten Indramayu, Jawa Barat 45211.\n\n*Petunjuk Arah: Sangat dekat dari Masjid Islamic Center Syekh Abdul Manan Indramayu (kurang dari 3 menit).*";
        replyChips = [
          { label: '🕒 Jam Buka?', textToSend: 'Jam Buka?' },
          { label: '🎟️ Harga Tiket?', textToSend: 'Beli Tiket' }
        ];
        chatContext.current.lastTopic = "location";
      }

      // 9. INTENT MATCH: EMPLOYEE ATTENDANCE GEOFENCE
      else if (text.includes("absen") || text.includes("karyawan") || text.includes("clock") || text.includes("radius") || text.includes("geofence")) {
        const radiusVal = db.settings.attendanceRadiusMeters || 150;
        const targetVal = db.settings.playlandLocation;
        replyText = `💼 **Panduan Absensi Staf Karyawan**:\nAbsensi dilakukan dengan mencocokkan koordinat GPS browser. Jarak radius maksimal toleransi adalah **${radiusVal} meter** dari koordinat gerbang utama Pekandangan Jaya (\`${targetVal.latitude}, ${targetVal.longitude}\`).\n\nStaf wajib Clock In sebelum jam **08:00 WIB**, jika tidak status kehadiran Anda akan otomatis tercatat Terlambat.`;
        
        if (currentUser && currentUser.role === 'karyawan') {
          replyActions = [
            { label: '📍 Buka Dashboard Absen GPS', actionType: 'karyawan_gps' },
            { label: '📸 Buka QR Scanner Tiket', actionType: 'karyawan_scan' }
          ];
        }
        chatContext.current.lastTopic = "attendance_help";
      }

      // 10. INTENT MATCH: SMALL TALK & GREETINGS
      else if (text === "halo" || text === "hai" || text === "hey" || text === "hi" || text === "pagi" || text === "siang" || text === "sore" || text === "malam") {
        replyText = `👋 Halo${userGreeting}! Saya **NiceBot**, asisten AI resmi The Nice Playland Indramayu.\n\nAda yang bisa saya bantu hari ini? Tanyakan info tiket, wahana, promo, rute, atau panduan absensi karyawan!`;
        replyChips = [
          { label: '🎟️ Harga Tiket Terusan?', textToSend: 'Beli Tiket' },
          { label: '🎡 Wahana yang Buka?', textToSend: 'Daftar Wahana' },
          { label: '🕒 Jam Operasional?', textToSend: 'Jam Buka?' }
        ];
        chatContext.current.lastTopic = "greeting";
      } else if (text.includes("terima kasih") || text.includes("thanks") || text.includes("makasih") || text.includes("nuhun") || text.includes("suwun")) {
        replyText = `Sama-sama${userGreeting}! 😊 Senang bisa membantu Anda. Selamat bersenang-senang dan menikmati hari Anda di The Nice Playland Indramayu!`;
        chatContext.current.lastTopic = "thanks";
      } else if (text.includes("apa kabar") || text.includes("how are you")) {
        replyText = "Kabar baik, terima kasih! 🤖 Saya siap 24/7 membantu menjawab pertanyaan Anda seputar The Nice Playland Indramayu. Bagaimana kabar Anda hari ini?";
        chatContext.current.lastTopic = "smalltalk";
      } else if (text.includes("siapa kamu") || text.includes("namamu") || text.includes("bot") || text.includes("nama bot")) {
        replyText = "Saya **NiceBot** 🤖, asisten AI Customer Service resmi yang diprogram khusus untuk melayani pertanyaan Anda seputar portal The Nice Playland Indramayu!";
        chatContext.current.lastTopic = "identity";
      } else if (text.includes("cuaca") || text.includes("hujan") || text.includes("panas")) {
        replyText = "Saat ini cuaca di Indramayu terpantau berawan hangat 🌤️. Wahana indoor kami beroperasi penuh seperti biasa, jadi rencana liburan Anda tetap aman dan nyaman!";
        chatContext.current.lastTopic = "weather";
      } else if (text.includes("batal") || text.includes("refund") || text.includes("kembali uang")) {
        replyText = "Mohon maaf, tiket terusan yang sudah berhasil dibeli melalui gateway Midtrans bersifat final dan tidak dapat dibatalkan atau direfund uang kembali. Namun, tiket Anda tetap valid sesuai tanggal kunjungan.";
        chatContext.current.lastTopic = "refund";
      }
      
      // FALLBACK
      else {
        replyText = `🤖 Maaf, saya belum memahami pertanyaan atau instruksi "${textToSend}".\n\nCoba tanyakan seperti:\n- *"Berapa harga tiket masuk?"*\n- *"Wahana Rainbow Slide syaratnya apa?"*\n- *"Jam operasional hari libur?"*\n- *"Di mana alamat lokasinya?"*`;
        replyChips = [
          { label: '🎟️ Tanya Harga Tiket', textToSend: 'Harga Tiket?' },
          { label: '🕒 Tanya Jam Buka', textToSend: 'Jam Buka?' },
          { label: '📍 Tanya Lokasi Maps', textToSend: 'Lokasi?' }
        ];
        chatContext.current.lastTopic = "fallback";
      }

      const botMsg = {
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        sender: 'bot',
        text: replyText,
        timestamp: new Date(),
        actions: replyActions,
        chips: replyChips
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  if (!db) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s infinite linear' }} />
        <p>Memuat database...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Main Header / Navbar */}
      <header className="glass-panel" style={{ 
        borderRadius: 0, 
        borderLeft: 'none', 
        borderRight: 'none', 
        borderTop: 'none', 
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: theme === 'dark' ? 'rgba(18, 12, 36, 0.45)' : 'rgba(255, 255, 255, 0.75)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logoImg} alt="The Nice Playland Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--accent-primary)' }} />
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              THE NICE PLAYLAND
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 'bold' }}>
              INDRAMAYU PORTAL SYSTEM
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Light/Dark mode switcher */}
          <button 
            onClick={handleToggleTheme}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={theme === 'dark' ? "Mode Terang" : "Mode Gelap"}
          >
            {theme === 'dark' ? <Sun size={18} style={{ color: 'var(--color-warning)' }} /> : <Moon size={18} style={{ color: 'var(--accent-primary)' }} />}
          </button>

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{currentUser.name}</span>
                <span className={`badge ${
                  currentUser.role === 'admin' 
                    ? 'badge-primary' 
                    : currentUser.role === 'karyawan' 
                      ? 'badge-info' 
                      : 'badge-success'
                }`} style={{ fontSize: '0.65rem', padding: '2px 8px', marginTop: '2px' }}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
              
              <button 
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={14} /> Keluar
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={12} style={{ color: 'var(--accent-cyan)' }} />
              Indramayu Absen: <strong style={{ color: 'var(--text-primary)' }}>{db.settings.playlandLocation.latitude}, {db.settings.playlandLocation.longitude}</strong>
            </div>
          )}
        </div>
      </header>

      {/* Main Body Content */}
      <main style={{ minHeight: 'calc(100vh - 120px)', paddingBottom: '48px' }}>
        {currentUser ? (
          <>
            {currentUser.role === 'user' && <UserDashboard currentUser={currentUser} />}
            {currentUser.role === 'karyawan' && <KaryawanDashboard currentUser={currentUser} />}
            {currentUser.role === 'admin' && <AdminDashboard />}
          </>
        ) : (
          /* Sleek Glassmorphism Login / Register Panel */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 160px)', padding: '24px' }}>
            <div className="glass-panel glass-card-glow-purple animate-fade-in" style={{ padding: '36px', width: '100%', maxWidth: '420px' }}>
              
              {/* Logo display */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img 
                  src={logoImg} 
                  alt="The Nice Playland Logo" 
                  style={{ width: '85px', height: '85px', borderRadius: '50%', objectFit: 'cover', border: '3.5px solid var(--accent-primary)', display: 'inline-block', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.25)' }} 
                />
              </div>

              {/* Header Toggles */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.1)', width: '42px', height: '42px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '8px' }}>
                  {isRegistering ? (
                    <UserPlus size={20} style={{ color: 'var(--accent-secondary)' }} />
                  ) : isForgotPassword ? (
                    <Lock size={18} style={{ color: 'var(--accent-cyan)' }} />
                  ) : (
                    <Lock size={18} style={{ color: 'var(--accent-primary)' }} />
                  )}
                </div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
                  {isRegistering ? 'Daftar Akun Baru' : isForgotPassword ? 'Lupa Password' : 'Portal Masuk'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  {isRegistering ? 'Lengkapi detail untuk mendaftar sebagai pelanggan' : isForgotPassword ? 'Atur ulang kata sandi akun Anda' : 'Silakan masuk untuk mengelola tiket & absensi'}
                </p>
              </div>

              {/* Status messages */}
              {loginError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{loginError}</span>
                </div>
              )}

              {regSuccessMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ flexShrink: 0, color: 'var(--color-success)' }} />
                  <span>{regSuccessMsg}</span>
                </div>
              )}

              {/* FORM: REGISTER */}
              {isRegistering ? (
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Lengkap</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Contoh: Dian Wijaya" 
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                        required
                      />
                      <UserCheck size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Username Login</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Username untuk login..." 
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                        required
                      />
                      <User size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="password" 
                        placeholder="Kata sandi akun..." 
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                        required
                      />
                      <Lock size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '6px' }}
                  >
                    Daftar Akun Baru
                  </button>

                  <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Sudah punya akun?{' '}
                    <span 
                      onClick={() => { setIsRegistering(false); setIsForgotPassword(false); setLoginError(''); }}
                      style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Masuk di sini
                    </span>
                  </p>
                </form>
              ) : isForgotPassword ? (
                /* FORM: FORGOT PASSWORD */
                <form onSubmit={forgotStep === 1 ? handleVerifyForgotUsername : handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {forgotError && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  {forgotStep === 1 ? (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Username Akun</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="text" 
                            placeholder="Masukkan username Anda..." 
                            value={forgotUsername}
                            onChange={(e) => setForgotUsername(e.target.value)}
                            className="input-field"
                            style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                            required
                          />
                          <User size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '6px' }}
                      >
                        Verifikasi Akun
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.15)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Mereset password untuk: <strong style={{ color: 'var(--text-primary)' }}>{forgotMatchedUser?.name} ({forgotMatchedUser?.username})</strong>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Password Baru</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="password" 
                            placeholder="Masukkan password baru..." 
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            className="input-field"
                            style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                            required
                          />
                          <Lock size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Konfirmasi Password Baru</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="password" 
                            placeholder="Ulangi password baru..." 
                            value={forgotConfirmPassword}
                            onChange={(e) => setForgotConfirmPassword(e.target.value)}
                            className="input-field"
                            style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                            required
                          />
                          <Lock size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '6px' }}
                      >
                        Reset Password
                      </button>
                    </>
                  )}

                  <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Kembali ke{' '}
                    <span 
                      onClick={() => { setIsForgotPassword(false); setForgotStep(1); setForgotUsername(''); setForgotError(''); }}
                      style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Masuk di sini
                    </span>
                  </p>
                </form>
              ) : (
                /* FORM: LOGIN */
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Username</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Masukkan username..." 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                        required
                      />
                      <User size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Password</label>
                      <span 
                        onClick={() => { setIsForgotPassword(true); setIsRegistering(false); setLoginError(''); setRegSuccessMsg(''); }}
                        style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500' }}
                      >
                        Lupa password?
                      </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="password" 
                        placeholder="Masukkan password..." 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                        required
                      />
                      <Lock size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '6px' }}
                  >
                    Masuk Halaman
                  </button>

                  <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Belum punya akun?{' '}
                    <span 
                      onClick={() => { setIsRegistering(true); setIsForgotPassword(false); setLoginError(''); setRegSuccessMsg(''); }}
                      style={{ color: 'var(--accent-secondary)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Daftar Baru
                    </span>
                  </p>
                </form>
              )}



            </div>
          </div>
        )}
      </main>

      {/* Floating CS AI Chat Bot Bubble */}
      <div 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="chatbot-bubble animate-fade-in"
        title="Hubungi CS AI Playland"
      >
        {isChatOpen ? <X size={26} /> : <MessageSquare size={26} />}
      </div>

      {/* CS AI Chatbot Window Drawer */}
      {isChatOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)', padding: '16px 20px', color: 'white', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={logoImg} 
                alt="NiceBot" 
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid white' }} 
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  NiceBot CS <Sparkles size={12} fill="white" />
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="bot-status-dot"></span> Online • AI Assistant
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsChatOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message ${m.sender}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                
                {/* Render inline chips inside bot bubble if any */}
                {m.chips && m.chips.length > 0 && (
                  <div className="chat-inline-chips">
                    {m.chips.map((chip, idx) => (
                      <button 
                        key={idx} 
                        className="chat-inline-chip"
                        onClick={() => handleSendMessage(null, chip.textToSend)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Render inline action buttons inside bot bubble if any */}
                {m.actions && m.actions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    {m.actions.map((act, idx) => (
                      <button 
                        key={idx} 
                        className="chat-inline-btn"
                        onClick={() => handleInlineAction(act.actionType)}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: '0.65rem', textAlign: 'right', marginTop: '6px', opacity: 0.6 }}>
                  {m.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-message bot" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>NiceBot sedang mengetik</span>
                <span className="dot-typing" style={{ display: 'flex', gap: '2px' }}>
                  <span style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  <span style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }} />
                  <span style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }} />
                </span>
                <style>{`
                  @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                  }
                `}</style>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="chat-suggestions">
            <button className="chat-suggestion-chip" onClick={() => handleSendMessage(null, "🕒 Jam Buka?")}>
              🕒 Jam Buka?
            </button>
            <button className="chat-suggestion-chip" onClick={() => handleSendMessage(null, "🎟️ Harga Tiket?")}>
              🎟️ Harga Tiket?
            </button>
            <button className="chat-suggestion-chip" onClick={() => handleSendMessage(null, "🎡 Daftar Wahana?")}>
              🎡 Daftar Wahana?
            </button>
            <button className="chat-suggestion-chip" onClick={() => handleSendMessage(null, "📍 Lokasi Playland?")}>
              📍 Lokasi?
            </button>
            <button className="chat-suggestion-chip" onClick={() => handleSendMessage(null, "💼 Absensi Karyawan?")}>
              💼 Absen Karyawan?
            </button>
          </div>

          {/* Send Input */}
          <form 
            onSubmit={handleSendMessage}
            style={{ padding: '12px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '10px', background: 'var(--bg-secondary)' }}
          >
            <input 
              type="text" 
              placeholder="Tanyakan sesuatu pada AI..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.85rem', padding: '10px 14px', borderRadius: '12px' }}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '10px', borderRadius: '12px', minWidth: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Footer */}
      <footer style={{ 
        textAlign: 'center', 
        padding: '24px', 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)', 
        borderTop: '1px solid var(--glass-border)',
        background: 'rgba(5, 3, 10, 0.4)'
      }}>
        &copy; 2026 The Nice Playland Indramayu. Dibuat dengan &hearts; untuk Pengalaman Wahana Terbaik.
      </footer>
    </div>
  );
}
