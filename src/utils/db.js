// The Nice Playland Database with localStorage persistence - Indramayu Version

const DB_KEY = 'the_nice_playland_db';

const DEFAULT_DATABASE = {
  settings: {
    playlandLocation: {
      latitude: -6.3529, // Target coordinates for Indramayu Pekandangan Jaya
      longitude: 108.3231,
      name: 'The Nice Playland, Indramayu (Absen 1)'
    },
    attendanceRadiusMeters: 150,
    midtrans: {
      clientKey: import.meta.env.VITE_MIDTRANS_CLIENT_KEY || 'YOUR_MIDTRANS_CLIENT_KEY',
      serverKey: import.meta.env.VITE_MIDTRANS_SERVER_KEY || 'YOUR_MIDTRANS_SERVER_KEY'
    }
  },
  
  // Available Ticket Types - Single 25,000 IDR Ticket as requested
  ticketTypes: [
    {
      id: 't1',
      name: 'Tiket Masuk Terusan (Semua Wahana)',
      price: 25000,
      description: 'Akses masuk gerbang utama, playground indoor/outdoor, spot foto instagramable, area mini zoo, serta bebas mencoba semua wahana permainan sepuasnya!',
      benefits: ['Akses Semua Wahana & Permainan', 'Akses Playground Utama & Outbound', 'Spot Foto Instagramable & Mini Zoo', 'Minuman Sambutan (Teh Botol)']
    }
  ],

  // Wahana/Rides Seed
  rides: [
    {
      id: 'w1',
      name: 'Rainbow Slide',
      description: 'Perosotan pelangi raksasa yang merupakan wahana ikonik terfavorit. Rasakan sensasi meluncur cepat penuh warna!',
      status: 'Buka',
      minAge: '5 Tahun',
      capacity: '1 Orang per luncuran'
    },
    {
      id: 'w2',
      name: 'Giant Swing',
      description: 'Ayunan raksasa yang akan mengayun Anda tinggi ke udara. Menguji nyali dengan pemandangan Indramayu yang indah.',
      status: 'Buka',
      minAge: '12 Tahun',
      capacity: '2 Orang'
    },
    {
      id: 'w3',
      name: 'Flying Fox & Mini Outbound',
      description: 'Meluncur bebas menggunakan tali pengaman dari ketinggian di atas area taman outbound.',
      status: 'Buka',
      minAge: '7 Tahun',
      capacity: '1 Orang'
    },
    {
      id: 'w4',
      name: 'Skybridge & Hanging Steps',
      description: 'Tantangan menyeberangi jembatan gantung tali dan kayu di atas ketinggian.',
      status: 'Buka',
      minAge: '8 Tahun',
      capacity: 'Max 5 Orang di jembatan'
    },
    {
      id: 'w5',
      name: 'Ontang-anting (Hanging Swing)',
      description: 'Kursi terbang berputar yang menyenangkan dan mendebarkan, cocok untuk anak-anak dan dewasa.',
      status: 'Buka',
      minAge: '6 Tahun',
      capacity: '24 Kursi'
    },
    {
      id: 'w6',
      name: 'Mini Zoo & Feeding Zone',
      description: 'Area interaktif memberi makan hewan unik: Domba Merino, Kelinci, Meerkat, Marmoset, dan Kura-kura raksasa.',
      status: 'Buka',
      minAge: 'Semua Umur',
      capacity: 'Tidak Dibatasi'
    },
    {
      id: 'w7',
      name: 'Playground Indoor & Outdoor',
      description: 'Area motorik ramah anak dengan istana balon, lego raksasa, kolam bola, ayunan, dan jungkat-jungkit.',
      status: 'Buka',
      minAge: 'Semua Umur (Di bawah 5 tahun wajib didampingi)',
      capacity: 'Tidak Dibatasi'
    }
  ],

  // Users Accounts (Authentication seed)
  users: [
    { id: 'u_admin', username: 'admin', role: 'admin', name: 'Super Admin Playland', password: 'admin' },
    { id: 'u_emp1', username: 'karyawan', role: 'karyawan', name: 'Budi Santoso', password: 'karyawan' },
    { id: 'u_emp2', username: 'karyawan2', role: 'karyawan', name: 'Siti Aminah', password: 'karyawan2' },
    { id: 'u_cust1', username: 'user', role: 'user', name: 'Dian Wijaya', password: 'user' }
  ],

  // Purchased Tickets History
  purchasedTickets: [
    {
      id: 'PT-89410',
      userId: 'u_cust1',
      ticketTypeId: 't1',
      ticketName: 'Tiket Masuk Terusan (Semua Wahana)',
      price: 25000,
      purchaseDate: '2026-06-08T08:00:00Z',
      visitDate: '2026-06-08',
      quantity: 2,
      totalAmount: 50000,
      status: 'used',
      scannedAt: '2026-06-08T09:15:32Z'
    },
    {
      id: 'PT-10394',
      userId: 'u_cust1',
      ticketTypeId: 't1',
      ticketName: 'Tiket Masuk Terusan (Semua Wahana)',
      price: 25000,
      purchaseDate: '2026-06-09T02:00:00Z',
      visitDate: '2026-06-09',
      quantity: 1,
      totalAmount: 25000,
      status: 'active',
      scannedAt: null
    }
  ],

  // Employee Attendance Records
  attendance: [
    {
      id: 'att_52814',
      employeeId: 'u_emp1',
      employeeName: 'Budi Santoso',
      date: '2026-06-08',
      clockIn: '2026-06-08T07:45:12Z',
      clockOut: '2026-06-08T17:02:40Z',
      distanceInMeters: 45.2,
      status: 'Tepat Waktu',
      coordinates: { latitude: -6.3526, longitude: 108.3229 }
    },
    {
      id: 'att_61902',
      employeeId: 'u_emp2',
      employeeName: 'Siti Aminah',
      date: '2026-06-08',
      clockIn: '2026-06-08T08:05:44Z',
      clockOut: '2026-06-08T17:05:15Z',
      distanceInMeters: 12.8,
      status: 'Terlambat',
      coordinates: { latitude: -6.3529, longitude: 108.3232 }
    }
  ]
};

// Initialize DB if not already present or reset to ensure new pricing/location/structure is applied
export const initDB = (forceReset = false) => {
  const data = localStorage.getItem(DB_KEY);
  if (!data || forceReset) {
    localStorage.setItem(DB_KEY, JSON.stringify(DEFAULT_DATABASE));
    return DEFAULT_DATABASE;
  }
  
  // Reset if location coordinates mismatch or if ticketTypes contains more/less than 1 ticket
  const currentDb = JSON.parse(data);
  if (
    !currentDb.settings ||
    !currentDb.settings.playlandLocation ||
    currentDb.settings.playlandLocation.latitude !== -6.3529 ||
    !currentDb.rides ||
    !currentDb.ticketTypes ||
    currentDb.ticketTypes.length !== 1 ||
    currentDb.ticketTypes[0].price !== 25000
  ) {
    localStorage.setItem(DB_KEY, JSON.stringify(DEFAULT_DATABASE));
    return DEFAULT_DATABASE;
  }

  return currentDb;
};

// Get current database state
export const getDB = () => {
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : initDB();
};

// Save database state
export const saveDB = (dbState) => {
  localStorage.setItem(DB_KEY, JSON.stringify(dbState));
  
  // Push changes to the cloud database in the background
  try {
    fetch('https://jsonblob.com/api/jsonBlob/019eab04-eb75-74f7-8dcd-d0438937df4f', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dbState)
    }).catch(err => console.warn("Cloud database sync error:", err));
  } catch (e) {
    console.warn("Cloud database sync exception:", e);
  }
};

// Haversine formula to calculate distance in meters between two points
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return parseFloat(d.toFixed(1));
};
