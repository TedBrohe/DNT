// ========== NAVAID DATABASE ==========

const NAVAID_DATABASE = {
  "KWA": {
    name: "GWANGJU",
    fullName: "Gwangju VOR-DME",
    type: "VOR-DME",
    frequency: "114.40",
    channel: "91X",
    lat: 35.1267,
    lon: 126.8089,
    operative: true,
    connectedTo: {
      "TGU": { mc: 72, distance: 96.3 },
      "CJU": { mc: 193, distance: 104.7 },
      "PSN": { mc: 98, distance: 107.6 },
      "SOT": { mc: 13, distance: 118.4 }
      // TODO: ENROUTE CHART 확인 후 추가
    }
  },
  
  "TGU": {
    name: "DAEGU",
    fullName: "Dalsung VORTAC",
    type: "VORTAC",
    frequency: "112.20",
    channel: "59X",
    lat: 35.8947,
    lon: 128.6586,
    operative: true,
    connectedTo: {
      "KPO": { mc: 86, distance: 44.2},
      "PSN": { mc: 163, distance: 45.8},
      "KWA": { mc: 254, distance: 96.3},
      "KUZ": { mc: 283, distance: 96.7},
      "SOT": { mc: 325, distance: 107.8}
      // TODO: ENROUTE CHART 확인 후 추가
    }
  },
  
  "CJU": {
    name: "JEJU",
    fullName: "Jeju VORTAC",
    type: "VORTAC",
    frequency: "116.10",
    channel: "108X",
    lat: 33.3894,
    lon: 126.63,
    operative: true,
    connectedTo: {
      "KWA": { mc: 13, distance: 104.7 },
      "PSN": { mc: 55, distance: 157.4 }
      // TODO: ENROUTE CHART 확인 후 추가
    }
  },

  "PSN": {
    name: "BUSAN",
    fullName: "Busan VORTAC",
    type: "VORTAC",
    frequency: "114.00",
    channel: "82X",
    lat: 35.1796,
    lon: 129.0756,
    operative: true,
    connectedTo: {
      "KWA": { mc: 278, distance: 107.6 },
      "TGU": { mc: 342, distance: 45.8 },
      "CJU": { mc: 235, distance: 157.4 },
      "KPO": { mc: 32, distance: 56.2 }
      // TODO: ENROUTE CHART 확인 후 추가
    }
  },

  "KPO": {
    name: "POHANG",
    fullName: "Pohang VORTAC",
    type: "VORTAC",
    frequency: "112.50",
    channel: "72X",
    lat: 35.9775,
    lon:  129.474,
    operative: true,
    connectedTo: {
      "PSN": { mc: 213, distance: 56.2 },
      "TGU": { mc: 265, distance: 44.2 },
      "CUN": { mc: 313, distance: 68.2 },
      "PILIT": { mc: 2, distance: 88.2 }
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },

  "KUZ": {
    name: "KUNSAN",
    fullName: "Kunsan VORTAC",
    type: "VORTAC",
    frequency: "112.80",
    channel: "75X",
    lat: 35.9104,
    lon: 126.611,
    operative: true,
    connectedTo: {
      "TGU": { mc: 100, distance: 96.7}
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },  

  "KAE": {
    name: "GANGWON",
    fullName: "Gangwon VORTAC",
    type: "VORTAC",
    frequency: "115.60",
    channel: "103X",
    lat: 37.7006,
    lon: 128.754,
    operative: true,
    connectedTo: {
      "PILIT": { mc: 130, distance: 30},
      "SEL": { mc: 268, distance: 88.8}
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },  
    
  "SEL": {
    name: "ANYANG",
    fullName: "Anyang VORTAC",
    type: "VORTAC",
    frequency: "115.50",
    channel: "98X",
    lat: 37.4139,
    lon: 126.929,
    operative: true,
    connectedTo: {
      "KAE": { mc: 86, distance: 88.8},
      "SOT": { mc: 173, distance: 19.8},
      "CUN": { mc: 133, distance: 81.8}
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },

  "SOT": {
    name: "SONGTAN",
    fullName: "Songtan VORTAC",
    type: "VORTAC",
    frequency: "116.9",
    channel: "116X",
    lat: 37.094444,
    lon: 127.031667,
    operative: true,
    connectedTo: {
      "TGU": { mc: 143, distance: 107.8},
      "KWA": { mc: 193, distance: 118.4},
      "SEL": { mc: 353, distance: 19.8}
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },

  "CUN": {
    name: "YECHEON",
    fullName: "Yecheon VOR-DME",
    type: "VOR-DME",
    frequency: "114.8",
    channel: "95X",
    lat: 36.631944,
    lon: 128.325278,
    operative: true,
    connectedTo: {
      "KPO": { mc: 133, distance: 68.2},
      "SEL": { mc: 313, distance: 81.8}
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },
  
  "PILIT": {
    name: "PILIT",
    fullName: "PILIT",
    type: "FIX",
    frequency: null,
    channel: null,
    lat: 37.442,
    lon: 129.292,
    operative: true,
    connectedTo: {
      "KPO": { mc: 182, distance: 88.2},
      "KAE": { mc: 310, distance: 30}
      // TODO: ENROUTE CHART 확인 후 입력
    }
  },  
};

// ========== CONNECTION 검증 헬퍼 ==========
// ENROUTE CHART를 보고 실제 airway connection을 확인하세요

/*
검증 예시:
1. AIP ENROUTE CHART 열기
2. 각 NAVAID 간 직선 연결(airway) 확인
3. 차트에서 MC와 거리 측정
4. connectedTo에 입력

주의사항:
- MC는 Magnetic Course (자북 기준)
- 거리는 NM (Nautical Miles)
- 양방향 확인 (A→B와 B→A는 별도)
- 실제 항로가 없으면 연결하지 말 것
*/

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NAVAID_DATABASE };
}
