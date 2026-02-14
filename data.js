// ========== NAVIGATION DATA ==========

// Magnetic Variation
const MAGNETIC_VARIATION = 8; // 8°W

// Map scale
const MAP_HEIGHT_NM = 155; // Canvas height in nautical miles

// NAVAID Positions (actual coordinates)
const NAVAIDS = {
  KWA: {
    name: 'KWA',
    channel: '91X',
    lat: 35.1267,
    lon: 126.8089,
    operative: true
  },
  TGU: {
    name: 'TGU',
    channel: '59X',
    lat: 35.8947,
    lon: 128.6586,
    operative: true
  },
  PSN: {
    name: 'PSN',
    channel: 'NA',
    lat: 35.1796,
    lon: 129.0756,
    operative: false // PSN is inoperative
  }
};

// LEG Information (Magnetic Course and Distance)
const LEGS = {
  KWA_TGU: {
    from: 'KWA',
    to: 'TGU',
    distance: 97, // NM
    mc: 72 // Magnetic Course
  },
  TGU_PSN: {
    from: 'TGU',
    to: 'PSN',
    distance: 45, // NM
    mc: 162 // Magnetic Course
  },
  PSN_KWA: {
    from: 'PSN',
    to: 'KWA',
    distance: 111, // NM
    mc: 277 // Magnetic Course
  }
};

// Route sequence
const ROUTE = ['KWA', 'TGU', 'PSN', 'KWA'];

// Aircraft performance
const AIRCRAFT = {
  defaultTAS: 240, // knots
  turnRate: 3, // degrees per second (2 min for 360° turn)
  accelTime: 10, // seconds to change speed
  bankDelay: 5 // seconds before starting turn
};

// Colors
const COLORS = {
  background: '#000000',
  panel: '#282828',
  white: '#FFFFFF',
  green: '#00FF00',
  yellow: '#FFFF00',
  darkGreen: '#003200',
  darkGrey: '#141414',
  lightGrey: '#5A5A5A',
  navy: '#000A32',
  lightNavy: '#006EA0',
  red: '#C80000'
};
