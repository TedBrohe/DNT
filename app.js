// ========== MAIN APP ==========

class DeadReckoningApp {
  constructor() {
    // Canvas elements
    this.hsiCanvas = document.getElementById('hsiCanvas');
    this.mapCanvas = document.getElementById('mapCanvas');
    
    // Renderer
    this.renderer = new Renderer(this.hsiCanvas, this.mapCanvas);
    
    // Aircraft state
    this.aircraft = new AircraftState();
    
    // Game state
    this.started = false;
    this.startTime = 0;
    this.currentTime = 0;
    this.lastFrameTime = 0;
    this.paused = false;
    
    // Wind state
    this.planWindDir = 0;
    this.planWindSpd = 0;
    this.actualWindDir = 0;
    this.actualWindSpd = 0;
    this.baseWindDir = 0; // fluctuation 기준
    this.baseWindSpd = 0; // fluctuation 기준
    this.lastWindChangeTime = 0;
    this.windChangeInterval = 3; // 3초마다 바람 변화
    
    // Flight log
    this.flightLog = [];
    this.ataRecords = {};
    
    // Event log
    this.eventLog = [];
    
    // UI state
    this.currentUpperTab = 'hsi'; // 'hsi' or 'map'
    this.currentLowerTab = 'log'; // 'log', 'control', 'calculator', 'events'
    this.showHistory = true;
    this.routeMode = 'default'; // 'default' or 'custom'
    
    // Custom route state
    this.customRoute = [];
    this.customLegs = [];
    this.maxLegs = 10;
    
    // Selected NAVAID (for HSI)
    this.selectedNavaid = null;
    
    this.initializeUI();
    this.setupEventListeners();
    this.startGameLoop();
  }
  
  /**
   * Initialize UI
   */
  initializeUI() {
    // Set canvas sizes
    this.resizeCanvases();
    
    // Initialize flight log table
    this.updateFlightLog();
    
    // Set default values
    document.getElementById('windDir').value = '';
    document.getElementById('windSpd').value = '';
    document.getElementById('tasInput').value = '240';
    document.getElementById('recommendHdg').value = '';
    document.getElementById('recommendTas').value = '';
  }
  
  /**
   * Resize canvases for mobile
   */
  resizeCanvases() {
    const container = document.querySelector('.upper-display');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    this.hsiCanvas.width = width;
    this.hsiCanvas.height = height;
    this.mapCanvas.width = width;
    this.mapCanvas.height = height;
    
    // Reinitialize map after resize
    if (this.renderer) {
      this.renderer.initializeMap();
    }
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        const group = e.target.dataset.group;
        
        if (group === 'upper') {
          this.switchUpperTab(tab);
        } else {
          this.switchLowerTab(tab);
        }
      });
    });
    
    // Wind decision button
    document.getElementById('windDecideBtn').addEventListener('click', () => {
      this.decideWind();
    });
    
    // Start button
    document.getElementById('startBtn').addEventListener('click', () => {
      this.startTraining();
    });
    
    // Control buttons
    document.getElementById('controlClearBtn').addEventListener('click', () => {
      document.getElementById('recommendHdg').value = '';
      document.getElementById('recommendTas').value = '';
    });
    
    document.getElementById('controlSubmitBtn').addEventListener('click', () => {
      this.submitControl();
    });
    
    // MB4 Calculator buttons
    document.getElementById('calcDistBtn').addEventListener('click', () => this.calculateMB4('distance'));
    document.getElementById('calcWindBtn').addEventListener('click', () => this.calculateMB4('wind'));
    document.getElementById('calcCourseBtn').addEventListener('click', () => this.calculateMB4('course'));
    document.getElementById('calcHeadingBtn').addEventListener('click', () => this.calculateMB4('heading'));
    
    // Route Mode buttons
    document.getElementById('defaultRouteBtn').addEventListener('click', () => this.switchRouteMode('default'));
    document.getElementById('customRouteBtn').addEventListener('click', () => this.switchRouteMode('custom'));
    
    // Custom Route buttons
    document.getElementById('addLegBtn').addEventListener('click', () => this.addCustomLeg());
    document.getElementById('calculateCustomBtn').addEventListener('click', () => this.calculateCustomRoute());
    document.getElementById('startCustomBtn').addEventListener('click', () => this.startCustomTraining());
    
    // Map touch controls
    this.setupMapControls();
    
    // Window resize
    window.addEventListener('resize', () => this.resizeCanvases());
  }
  
  /**
   * Setup map touch/mouse controls
   */
  setupMapControls() {
    const canvas = this.mapCanvas;
    let lastTouchDist = 0;
    
    // Mouse drag
    canvas.addEventListener('mousedown', (e) => {
      this.renderer.mapDragging = true;
      this.renderer.mapLastTouchX = e.clientX;
      this.renderer.mapLastTouchY = e.clientY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (this.renderer.mapDragging) {
        const dx = e.clientX - this.renderer.mapLastTouchX;
        const dy = e.clientY - this.renderer.mapLastTouchY;
        this.renderer.mapOffsetX += dx;
        this.renderer.mapOffsetY += dy;
        this.renderer.mapLastTouchX = e.clientX;
        this.renderer.mapLastTouchY = e.clientY;
      }
    });
    
    canvas.addEventListener('mouseup', () => {
      this.renderer.mapDragging = false;
    });
    
    // Touch drag
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.renderer.mapDragging = true;
        this.renderer.mapLastTouchX = e.touches[0].clientX;
        this.renderer.mapLastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.renderer.mapDragging = false;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastTouchDist = Math.sqrt(dx * dx + dy * dy);
      }
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 1 && this.renderer.mapDragging) {
        const dx = e.touches[0].clientX - this.renderer.mapLastTouchX;
        const dy = e.touches[0].clientY - this.renderer.mapLastTouchY;
        this.renderer.mapOffsetX += dx;
        this.renderer.mapOffsetY += dy;
        this.renderer.mapLastTouchX = e.touches[0].clientX;
        this.renderer.mapLastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (lastTouchDist > 0) {
          const scale = dist / lastTouchDist;
          this.renderer.mapScale *= scale;
          this.renderer.mapScale = Math.max(0.5, Math.min(3.0, this.renderer.mapScale));
        }
        
        lastTouchDist = dist;
      }
    });
    
    canvas.addEventListener('touchend', () => {
      this.renderer.mapDragging = false;
      lastTouchDist = 0;
    });
  }
  
  /**
   * Switch upper tab
   */
  switchUpperTab(tab) {
    this.currentUpperTab = tab;
    
    // Update button states
    document.querySelectorAll('.tab-btn[data-group="upper"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Show/hide canvases
    document.getElementById('hsiCanvas').style.display = tab === 'hsi' ? 'block' : 'none';
    document.getElementById('mapCanvas').style.display = tab === 'map' ? 'block' : 'none';
  }
  
  /**
   * Switch lower tab
   */
  switchLowerTab(tab) {
    // Don't allow switching before start
    if (!this.started && tab !== 'log') {
      return;
    }
    
    this.currentLowerTab = tab;
    
    // Update button states
    document.querySelectorAll('.tab-btn[data-group="lower"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Show/hide panels
    document.querySelectorAll('.control-panel').forEach(panel => {
      panel.style.display = 'none';
    });
    document.getElementById(`${tab}Panel`).style.display = 'block';
  }
  
  /**
   * Decide wind and calculate flight log
   */
  decideWind() {
    const windDir = parseInt(document.getElementById('windDir').value) || 0;
    const windSpd = parseInt(document.getElementById('windSpd').value) || 0;
    const tas = parseInt(document.getElementById('tasInput').value) || 240;
    
    if (windDir < 0 || windDir > 360 || windSpd < 0 || windSpd > 100) {
      alert('Invalid wind input. Direction: 0-360, Speed: 0-100');
      return;
    }
    
    this.planWindDir = windDir;
    this.planWindSpd = windSpd;
    
    // Calculate flight log
    this.calculateFlightLog(tas, windDir, windSpd);
    
    // Lock wind inputs
    document.getElementById('windDir').disabled = true;
    document.getElementById('windSpd').disabled = true;
    document.getElementById('tasInput').disabled = true;
    
    // Show log
    this.updateFlightLog();
    
    this.addEventLog(`WIND DECIDED: ${windDir.toString().padStart(3, '0')}/${windSpd.toString().padStart(2, '0')}, TAS: ${tas}`);
  }
  
  /**
   * Calculate complete flight log
   */
  calculateFlightLog(tas, windDir, windSpd) {
    this.flightLog = [];
    let cumulativeTime = 0;
    
    // START
    this.flightLog.push({
      remark: 'START',
      navaid: 'KWA',
      tc: '-',
      mc: '-',
      th: '-',
      mh: '-',
      da: '-',
      gs: '-',
      dist: '-',
      ete: '-',
      eta: '-',
      ata: '-'
    });
    
    // Calculate each leg
    const legs = [
      { leg: LEGS.KWA_TGU, navaid: 'TGU', remark: '1' },
      { leg: LEGS.TGU_PSN, navaid: 'PSN', remark: '2' },
      { leg: LEGS.PSN_KWA, navaid: 'KWA', remark: 'END' }
    ];
    
    legs.forEach(({ leg, navaid, remark }) => {
      const mc = leg.mc;
      let tc = mc - MAGNETIC_VARIATION;
      tc = normalizeAngle(tc); // 0-359 범위로
      const dist = leg.distance;
      
      // Calculate required heading
      const result = calculateRequiredHeading(mc, tas, windDir, windSpd);
      const mh = result.heading;
      let th = mh - MAGNETIC_VARIATION;
      th = normalizeAngle(th); // 0-359 범위로
      const gs = result.groundSpeed;
      const da = mc - mh;
      
      // Calculate time
      const ete = calculateETE(dist, gs);
      cumulativeTime += ete;
      
      this.flightLog.push({
        remark,
        navaid,
        tc: Math.round(tc).toString().padStart(3, '0'),
        mc: mc.toString().padStart(3, '0'),
        th: Math.round(th).toString().padStart(3, '0'),
        mh: mh.toString().padStart(3, '0'),
        da: (da >= 0 ? '+' : '') + da.toString(),
        gs: gs.toString(),
        dist: dist.toString(),
        ete: this.formatTime(ete),
        eta: '-', // Will be calculated after start
        ata: '-'
      });
    });
  }
  
  /**
   * Update flight log display
   */
  updateFlightLog() {
    // Determine which table to update
    const tableId = this.customRoute && this.customRoute.length > 0 
      ? '#flightLogTableCustom' 
      : '#flightLogTable';
    
    const tbody = document.querySelector(`${tableId} tbody`);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    this.flightLog.forEach(entry => {
      const row = tbody.insertRow();
      
      ['remark', 'navaid', 'tc', 'mc', 'th', 'mh', 'da', 'gs', 'dist', 'ete', 'eta', 'ata'].forEach(key => {
        const cell = row.insertCell();
        cell.textContent = entry[key] || '-';
      });
    });
  }
  
  /**
   * Start training
   */
  startTraining() {
    if (this.flightLog.length === 0) {
      alert('바람을 먼저 [결정]해주세요!');
      return;
    }
    
    // Reset aircraft
    this.aircraft = new AircraftState();
    
    // Spawn aircraft near KWA
    const kwaPos = this.renderer.navaidPositions['KWA'];
    const spawnDist = (2 + Math.random() * 2) * this.renderer.nmToPixels; // 2-4 NM
    const courseOffset = (Math.random() - 0.5) * 60; // ±30 degrees
    const spawnAngle = (LEGS.KWA_TGU.mc + courseOffset) * Math.PI / 180;
    
    this.aircraft.x = kwaPos.x + spawnDist * Math.sin(spawnAngle);
    this.aircraft.y = kwaPos.y - spawnDist * Math.cos(spawnAngle);
    this.aircraft.heading = LEGS.KWA_TGU.mc + (Math.random() - 0.5) * 60;
    this.aircraft.heading = normalizeAngle(this.aircraft.heading);
    this.aircraft.tas = 240;
    
    // Set actual wind (random variation from plan)
    this.actualWindDir = this.planWindDir + (Math.random() - 0.5) * 80; // ±40 degrees
    this.actualWindDir = normalizeAngle(this.actualWindDir);
    this.actualWindSpd = Math.max(0, this.planWindSpd + (Math.random() - 0.5) * 20); // ±10 knots
    
    // Base wind for fluctuation
    this.baseWindDir = this.actualWindDir;
    this.baseWindSpd = this.actualWindSpd;
    this.lastWindChangeTime = 0;
    
    // Calculate initial track and ground speed
    const initialResult = calculateTrackAndGS(this.aircraft.heading, this.aircraft.tas, this.actualWindDir, this.actualWindSpd);
    this.aircraft.track = initialResult.track;
    this.aircraft.groundSpeed = initialResult.groundSpeed;
    this.aircraft.windDir = this.actualWindDir;
    this.aircraft.windSpd = this.actualWindSpd;
    
    // Start time
    this.started = true;
    this.startTime = performance.now() / 1000;
    this.currentTime = 0;
    this.lastFrameTime = this.startTime;
    
    // Initialize ATA records
    this.ataRecords = {
      TGU: { closest: Infinity, time: null, passed: false },
      PSN: { closest: Infinity, time: null, passed: false },
      KWA_END: { closest: Infinity, time: null, passed: false }
    };
    
    // Enable other tabs
    this.switchLowerTab('control');
    
    // Lock route mode tabs
    document.getElementById('defaultRouteBtn').disabled = false;
    document.getElementById('customRouteBtn').disabled = true;
    
    // Center aircraft on MAP
    this.centerAircraftOnMap();
    
    // Update start time in log
    const startEntry = this.flightLog[0];
    startEntry.ata = this.formatTime(0);
    
    // Calculate initial ETA for all waypoints
    this.updateETA();
    
    this.addEventLog(`TRAINING STARTED`);
    this.addEventLog(`ACTUAL WIND: ${Math.round(this.actualWindDir).toString().padStart(3, '0')}/${Math.round(this.actualWindSpd).toString().padStart(2, '0')}`);
    this.addEventLog(`INITIAL HDG: ${Math.round(this.aircraft.heading).toString().padStart(3, '0')}, TAS: ${Math.round(this.aircraft.tas)}`);
  }
  
  /**
   * Submit control input (빈칸은 현재 값 유지)
   */
  submitControl() {
    if (!this.started) return;
    
    const hdgInput = document.getElementById('recommendHdg').value;
    const tasInput = document.getElementById('recommendTas').value;
    
    // 둘 다 비어있으면 경고
    if (hdgInput === '' && tasInput === '') {
      alert('Please enter at least one value (Heading or TAS)');
      return;
    }
    
    // 입력된 값만 적용, 빈칸은 현재 값 유지
    if (hdgInput !== '') {
      const hdg = parseInt(hdgInput);
      if (hdg < 0 || hdg > 360) {
        alert('Heading must be 0-360');
        return;
      }
      this.aircraft.setHeading(hdg, this.currentTime);
      
      const timeStr = this.formatTime(Math.round(this.currentTime / 60));
      this.addEventLog(`${timeStr} | HDG ${hdg.toString().padStart(3, '0')}(M) ENTERED`);
    }
    
    if (tasInput !== '') {
      const tas = parseInt(tasInput);
      if (tas < 100 || tas > 300) {
        alert('TAS must be 100-300');
        return;
      }
      this.aircraft.setTAS(tas, this.currentTime);
      
      const timeStr = this.formatTime(Math.round(this.currentTime / 60));
      this.addEventLog(`${timeStr} | TAS ${tas} ENTERED`);
    }
  }
  
  /**
   * Calculate MB4 (각 계산기별 결과창)
   */
  calculateMB4(type) {
    let resultId = '';
    
    try {
      if (type === 'distance') {
        resultId = 'calcResult1';
        const result = document.getElementById(resultId);
        
        // Time/Distance/Speed: any two inputs calculate the third
        const time = parseFloat(document.getElementById('calcTime').value) || null;
        const dist = parseFloat(document.getElementById('calcDist').value) || null;
        const speed = parseFloat(document.getElementById('calcSpeed').value) || null;
        
        let filled = [time !== null, dist !== null, speed !== null].filter(x => x).length;
        
        if (filled !== 2) {
          result.textContent = '2개 입력 필요';
          return;
        }
        
        if (time === null) {
          const calcTime = calculateTime(dist, speed);
          result.textContent = `${calcTime.toFixed(1)} 분`;
        } else if (dist === null) {
          const calcDist = calculateDistance(time, speed);
          result.textContent = `${calcDist.toFixed(1)} NM`;
        } else if (speed === null) {
          const calcSpeed = (dist / time) * 60;
          result.textContent = `${calcSpeed.toFixed(1)} kts`;
        }
        
      } else if (type === 'wind') {
        resultId = 'calcResult2';
        const result = document.getElementById(resultId);
        
        const mh = parseFloat(document.getElementById('calcTH').value) || 0;
        const tas = parseFloat(document.getElementById('calcTAS').value) || 0;
        const trk = parseFloat(document.getElementById('calcTRK').value) || 0;
        const gs = parseFloat(document.getElementById('calcGS').value) || 0;
        
        const wind = calculateWind(mh, tas, trk, gs);
        result.textContent = `${wind.windDir.toString().padStart(3, '0')}°/${wind.windSpd} kts`;
        
      } else if (type === 'course') {
        resultId = 'calcResult3';
        const result = document.getElementById(resultId);
        
        const mh = parseFloat(document.getElementById('calcTH2').value) || 0;
        const tas = parseFloat(document.getElementById('calcTAS2').value) || 0;
        const wdir = parseFloat(document.getElementById('calcWDir').value) || 0;
        const wspd = parseFloat(document.getElementById('calcWSpd').value) || 0;
        
        const result2 = calculateTrackAndGS(mh, tas, wdir, wspd);
        result.textContent = `TRK ${result2.track.toString().padStart(3, '0')}° / GS ${result2.groundSpeed} kts`;
        
      } else if (type === 'heading') {
        resultId = 'calcResult4';
        const result = document.getElementById(resultId);
        
        const crs = parseFloat(document.getElementById('calcCRS').value) || 0;
        const tas = parseFloat(document.getElementById('calcTAS3').value) || 0;
        const wdir = parseFloat(document.getElementById('calcWDir2').value) || 0;
        const wspd = parseFloat(document.getElementById('calcWSpd2').value) || 0;
        
        const hdgResult = calculateRequiredHeading(crs, tas, wdir, wspd);
        result.textContent = `MH ${hdgResult.heading.toString().padStart(3, '0')}° / GS ${hdgResult.groundSpeed} kts`;
      }
    } catch (e) {
      if (resultId) {
        document.getElementById(resultId).textContent = '입력 오류';
      }
    }
  }
  
  /**
   * Add event log entry (with timestamp HH:MM:SS)
   */
  addEventLog(message) {
    const timestamp = this.formatTimeHMS(Math.floor(this.currentTime));
    const logEntry = `${timestamp} | ${message}`;
    this.eventLog.push(logEntry);
    
    // Update display
    const logDiv = document.getElementById('eventLogContent');
    logDiv.innerHTML = this.eventLog.slice(-20).reverse().map((msg, i) => 
      `<div class="log-entry ${i === 0 ? 'latest' : ''}">${msg}</div>`
    ).join('');
  }
  
  /**
   * Format time as HH:MM:SS
   */
  formatTimeHMS(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Update game state
   */
  update(deltaTime) {
    if (!this.started) return;
    
    this.currentTime += deltaTime;
    
    // Wind fluctuation (every 3 seconds)
    if (this.currentTime - this.lastWindChangeTime >= this.windChangeInterval) {
      this.updateWind();
      this.lastWindChangeTime = this.currentTime;
    }
    
    // Update aircraft
    this.aircraft.update(deltaTime, this.currentTime, this.actualWindDir, this.actualWindSpd);
    this.aircraft.updatePosition(deltaTime, this.renderer.nmToPixels);
    this.aircraft.saveHistory(this.currentTime);
    
    // Update ETA in flight log
    this.updateETA();
    
    // Check ATA
    this.checkATA();
    
    // Select nearest operative NAVAID for HSI
    this.selectNearestNavaid();
  }
  
  /**
   * Update wind with natural fluctuation
   */
  updateWind() {
    // Direction: ±0~5 degrees from base
    const dirVar = Math.floor(Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1);
    this.actualWindDir = normalizeAngle(this.baseWindDir + dirVar);
    
    // Speed: ±5 knots from base, clamp to 20-70
    const spdVar = Math.floor(Math.random() * 11) - 5;
    this.actualWindSpd = Math.max(20, Math.min(70, this.baseWindSpd + spdVar));
  }
  
  /**
   * Update ETA for each waypoint (real-time during flight)
   */
  updateETA() {
    if (!this.started || this.flightLog.length === 0) return;
    
    const elapsedMinutes = Math.floor(this.currentTime / 60);
    
    // Update START entry ATA if not set
    if (this.flightLog[0].ata === '-') {
      this.flightLog[0].ata = this.formatTime(0);
    }
    
    // Calculate ETA for each waypoint based on cumulative ETE
    let cumulativeMinutes = 0;
    
    for (let i = 1; i < this.flightLog.length; i++) {
      const entry = this.flightLog[i];
      
      // Parse ETE (format: HH+MM)
      if (entry.ete && entry.ete !== '-') {
        const [hours, mins] = entry.ete.split('+').map(x => parseInt(x) || 0);
        const eteMinutes = hours * 60 + mins;
        cumulativeMinutes += eteMinutes;
        
        // Set ETA (start time + cumulative ETE)
        entry.eta = this.formatTime(cumulativeMinutes);
      }
    }
    
    this.updateFlightLog();
  }
  
  /**
   * Check if aircraft passed closest point to NAVAID
   */
  checkATA() {
    // Get waypoints based on route mode
    const waypoints = this.customRoute 
      ? this.customRoute.slice(1) // Skip START
      : ['TGU', 'PSN', 'KWA'];
    
    waypoints.forEach((navaid, index) => {
      const navPos = this.renderer.navaidPositions[navaid];
      if (!navPos) return;
      
      const dist = distanceBetween(this.aircraft.x, this.aircraft.y, navPos.x, navPos.y) / this.renderer.nmToPixels;
      
      const record = this.ataRecords[navaid];
      if (!record) return;
      
      if (dist < record.closest) {
        record.closest = dist;
        record.time = this.currentTime;
      } else if (dist > record.closest && !record.passed && record.time !== null) {
        // Passed the closest point
        record.passed = true;
        
        // Update ATA in flight log
        const logIndex = index + 1; // +1 for START row
        if (this.flightLog[logIndex]) {
          this.flightLog[logIndex].ata = this.formatTime(Math.round(record.time / 60));
          this.updateFlightLog();
          
          this.addEventLog(`${navaid} PASSED - ATA: ${this.flightLog[logIndex].ata}`);
        }
      }
    });
  }
  
  /**
   * Center aircraft on MAP
   */
  centerAircraftOnMap() {
    const canvas = this.renderer.mapCanvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate offset needed to center aircraft
    this.renderer.mapOffsetX = centerX - this.aircraft.x * this.renderer.mapScale;
    this.renderer.mapOffsetY = centerY - this.aircraft.y * this.renderer.mapScale;
  }
  
  /**
   * Select nearest operative NAVAID
   */
  selectNearestNavaid() {
    let minDist = Infinity;
    let nearest = null;
    
    // Get operative status (custom or default)
    const operativeMap = this.customOperative || {};
    
    for (let key in NAVAID_DATABASE) {
      const navData = NAVAID_DATABASE[key];
      
      // Skip FIX (no DME/방위)
      if (navData.type === "FIX") continue;
      
      // Check if operative
      const isOperative = this.customOperative 
        ? operativeMap[key] 
        : navData.operative;
      
      if (!isOperative) continue;
      
      const pos = this.renderer.navaidPositions[key];
      if (!pos) continue;
      
      const dist = distanceBetween(this.aircraft.x, this.aircraft.y, pos.x, pos.y);
      
      if (dist < minDist) {
        minDist = dist;
        nearest = key;
      }
    }
    
    this.selectedNavaid = nearest;
  }
  
  /**
   * Render frame
   */
  render() {
    // Calculate DME distance
    let dmeDistance = 0;
    if (this.selectedNavaid) {
      const navPos = this.renderer.navaidPositions[this.selectedNavaid];
      dmeDistance = distanceBetween(this.aircraft.x, this.aircraft.y, navPos.x, navPos.y) / this.renderer.nmToPixels;
    }
    
    // Render HSI
    this.renderer.drawHSI(this.aircraft, this.selectedNavaid, dmeDistance);
    
    // Render MAP
    const selectedRoute = this.customRoute && this.customRoute.length > 0 
      ? this.customRoute 
      : ['KWA', 'TGU', 'PSN', 'KWA'];
    this.renderer.drawMAP(this.aircraft, this.showHistory, selectedRoute);
  }
  
  // ========== CUSTOM ROUTE FUNCTIONS ==========
  
  /**
   * Switch between default and custom route mode
   */
  switchRouteMode(mode) {
    this.routeMode = mode;
    
    document.getElementById('defaultRouteBtn').classList.toggle('active', mode === 'default');
    document.getElementById('customRouteBtn').classList.toggle('active', mode === 'custom');
    
    document.getElementById('defaultRouteSection').style.display = mode === 'default' ? 'block' : 'none';
    document.getElementById('customRouteSection').style.display = mode === 'custom' ? 'block' : 'none';
  }
  
  addCustomLeg() {
    const tbody = document.getElementById('customRouteBody');
    const currentLegs = tbody.querySelectorAll('tr[data-leg]').length;
    
    if (currentLegs >= this.maxLegs + 1) {
      alert(`최대 ${this.maxLegs}개 구간까지만 추가할 수 있습니다.`);
      return;
    }
    
    const legNumber = currentLegs;
    const row = document.createElement('tr');
    row.dataset.leg = legNumber;
    
    row.innerHTML = `
      <td>${legNumber}</td>
      <td style="position: relative;">
        <input type="text" class="navaid-input" data-index="${legNumber}" placeholder="NAVAID" maxlength="3">
        <div class="navaid-suggestions"></div>
      </td>
      <td>
        <input type="checkbox" class="operative-checkbox" data-index="${legNumber}" checked>
      </td>
      <td class="leg-mc">-</td>
      <td class="leg-dist">-</td>
      <td>
        <button class="leg-remove-btn" onclick="window.app.removeCustomLeg(${legNumber})">삭제</button>
      </td>
    `;
    
    tbody.appendChild(row);
    
    const input = row.querySelector('.navaid-input');
    this.setupNavaidAutocomplete(input);
  }
  
  removeCustomLeg(legNumber) {
    const tbody = document.getElementById('customRouteBody');
    const row = tbody.querySelector(`tr[data-leg="${legNumber}"]`);
    if (row && legNumber > 0) {
      row.remove();
      this.renumberCustomLegs();
    }
  }
  
  renumberCustomLegs() {
    const tbody = document.getElementById('customRouteBody');
    const rows = tbody.querySelectorAll('tr[data-leg]');
    
    rows.forEach((row, index) => {
      if (index === 0) return;
      
      row.dataset.leg = index;
      row.querySelector('td:first-child').textContent = index;
      const input = row.querySelector('.navaid-input');
      input.dataset.index = index;
      const removeBtn = row.querySelector('.leg-remove-btn');
      removeBtn.onclick = () => this.removeCustomLeg(index);
    });
  }
  
  setupNavaidAutocomplete(input) {
    const suggestionsDiv = input.nextElementSibling;
    const index = parseInt(input.dataset.index);
    
    input.addEventListener('input', (e) => {
      const value = e.target.value.toUpperCase();
      input.value = value;
      
      if (value.length === 0) {
        suggestionsDiv.classList.remove('show');
        return;
      }
      
      let previousNavaid = null;
      if (index > 0) {
        const prevInput = document.querySelector(`.navaid-input[data-index="${index - 1}"]`);
        previousNavaid = prevInput ? prevInput.value.toUpperCase() : null;
      }
      
      const available = this.getAvailableNavaids(previousNavaid);
      const matches = available.filter(n => n.startsWith(value));
      
      if (matches.length > 0) {
        this.showSuggestions(suggestionsDiv, matches, input);
      } else {
        suggestionsDiv.classList.remove('show');
      }
    });
    
    input.addEventListener('blur', () => {
      setTimeout(() => suggestionsDiv.classList.remove('show'), 200);
    });
    
    input.addEventListener('change', () => {
      this.validateNavaidInput(input);
    });
  }
  
  getAvailableNavaids(previousNavaid) {
    if (!previousNavaid || !NAVAID_DATABASE[previousNavaid]) {
      return Object.keys(NAVAID_DATABASE);
    }
    
    const connections = NAVAID_DATABASE[previousNavaid].connectedTo;
    return Object.keys(connections);
  }
  
  showSuggestions(suggestionsDiv, matches, input) {
    suggestionsDiv.innerHTML = matches.map(navaid => {
      const data = NAVAID_DATABASE[navaid];
      return `<div class="suggestion-item" data-navaid="${navaid}">
        ${navaid} - ${data.name}
      </div>`;
    }).join('');
    
    suggestionsDiv.classList.add('show');
    
    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.navaid;
        suggestionsDiv.classList.remove('show');
        this.validateNavaidInput(input);
        
        const index = parseInt(input.dataset.index);
        if (index > 0) {
          this.updateLegInfo(index);
        }
      });
    });
  }
  
  validateNavaidInput(input) {
    const value = input.value.toUpperCase();
    const index = parseInt(input.dataset.index);
    
    if (value.length !== 3) {
      input.classList.remove('valid', 'error');
      return false;
    }
    
    if (!NAVAID_DATABASE[value]) {
      input.classList.remove('valid');
      input.classList.add('error');
      console.log(`ERROR: ${value} not in database`);
      return false;
    }
    
    if (index > 0) {
      const prevInput = document.querySelector(`.navaid-input[data-index="${index - 1}"]`);
      const prevValue = prevInput ? prevInput.value.toUpperCase() : null;
      
      if (prevValue && prevValue.length === 3 && NAVAID_DATABASE[prevValue]) {
        const connections = NAVAID_DATABASE[prevValue].connectedTo;
        if (!connections[value]) {
          input.classList.remove('valid');
          input.classList.add('error');
          console.log(`ERROR: ${prevValue} → ${value} not connected`);
          return false;
        }
      } else if (!prevValue || prevValue.length !== 3) {
        // Previous NAVAID not entered yet
        input.classList.remove('valid', 'error');
        console.log(`WAIT: Previous NAVAID not entered`);
        return false;
      }
    }
    
    input.classList.remove('error');
    input.classList.add('valid');
    
    // Enable/disable operative checkbox based on type
    const checkbox = document.querySelector(`.operative-checkbox[data-index="${index}"]`);
    if (checkbox) {
      const navaid = NAVAID_DATABASE[value];
      if (navaid.type === "FIX") {
        checkbox.disabled = true;
        checkbox.checked = true;
      } else {
        checkbox.disabled = false;
        checkbox.checked = navaid.operative;
      }
    }
    
    return true;
  }
  
  updateLegInfo(index) {
    const currentInput = document.querySelector(`.navaid-input[data-index="${index}"]`);
    const prevInput = document.querySelector(`.navaid-input[data-index="${index - 1}"]`);
    
    if (!currentInput || !prevInput) return;
    
    const from = prevInput.value.toUpperCase();
    const to = currentInput.value.toUpperCase();
    
    if (!from || !to || !NAVAID_DATABASE[from] || !NAVAID_DATABASE[to]) return;
    
    const connection = NAVAID_DATABASE[from].connectedTo[to];
    if (!connection) return;
    
    const row = document.querySelector(`tr[data-leg="${index}"]`);
    if (row) {
      row.querySelector('.leg-mc').textContent = connection.mc + '°';
      row.querySelector('.leg-dist').textContent = connection.distance + ' NM';
    }
  }
  
  calculateCustomRoute() {
    const windDir = parseInt(document.getElementById('windDirCustom').value) || 0;
    const windSpd = parseInt(document.getElementById('windSpdCustom').value) || 0;
    const tas = parseInt(document.getElementById('tasInputCustom').value) || 240;
    
    if (windDir < 0 || windDir > 360 || windSpd < 0 || windSpd > 100) {
      alert('Invalid wind input. Direction: 0-360, Speed: 0-100');
      return;
    }
    
    const inputs = document.querySelectorAll('.navaid-input');
    const checkboxes = document.querySelectorAll('.operative-checkbox');
    const route = [];
    const operativeStatus = {};
    
    // Validate and collect route (순서대로!)
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const value = input.value.toUpperCase().trim();
      
      // Check if empty
      if (value.length === 0) {
        alert(`NAVAID ${i === 0 ? 'START' : i}을(를) 입력해주세요.`);
        return;
      }
      
      // Check if exists in database
      if (!NAVAID_DATABASE[value]) {
        alert(`${value}은(는) 존재하지 않는 NAVAID입니다.`);
        input.classList.add('error');
        return;
      }
      
      // Check connection to previous NAVAID
      if (i > 0) {
        const prevValue = route[i - 1];
        const connections = NAVAID_DATABASE[prevValue].connectedTo;
        if (!connections[value]) {
          alert(`${prevValue}에서 ${value}(으)로 가는 항로가 없습니다.`);
          input.classList.add('error');
          return;
        }
      }
      
      route.push(value);
      
      // Store operative status
      const checkbox = checkboxes[i];
      const navaid = NAVAID_DATABASE[value];
      operativeStatus[value] = navaid.type === "FIX" ? true : checkbox.checked;
    }
    
    if (route.length < 2) {
      alert('최소 2개 이상의 NAVAID를 입력해주세요.');
      return;
    }
    
    this.customRoute = route;
    this.customOperative = operativeStatus;
    this.customLegs = [];
    
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i];
      const to = route[i + 1];
      const connection = NAVAID_DATABASE[from].connectedTo[to];
      
      this.customLegs.push({
        from: from,
        to: to,
        mc: connection.mc,
        distance: connection.distance
      });
    }
    
    this.planWindDir = windDir;
    this.planWindSpd = windSpd;
    
    this.calculateFlightLogCustom(tas, windDir, windSpd);
    
    // Hide custom route builder
    document.querySelector('.custom-route-builder').style.display = 'none';
    document.querySelector('.custom-route-info').style.display = 'none';
    document.getElementById('calculateCustomBtn').style.display = 'none';
    
    // Show flight log table in Custom Route section
    const customLogContainer = document.querySelector('#customRouteSection .flight-log-table-container');
    customLogContainer.style.display = 'block';
    document.getElementById('startCustomBtn').disabled = false;
    
    this.addEventLog(`CUSTOM ROUTE: ${route.join(' → ')}`);
    this.addEventLog(`WIND: ${windDir.toString().padStart(3, '0')}/${windSpd.toString().padStart(2, '0')}, TAS: ${tas}`);
  }
  
  calculateFlightLogCustom(tas, windDir, windSpd) {
    this.flightLog = [];
    let cumulativeTime = 0;
    
    this.flightLog.push({
      remark: 'START',
      navaid: this.customRoute[0],
      tc: '-',
      mc: '-',
      th: '-',
      mh: '-',
      da: '-',
      gs: '-',
      dist: '-',
      ete: '-',
      eta: '-',
      ata: '-'
    });
    
    this.customLegs.forEach((leg, index) => {
      const mc = leg.mc;
      let tc = mc - MAGNETIC_VARIATION;
      tc = normalizeAngle(tc);
      const dist = leg.distance;
      
      const result = calculateRequiredHeading(mc, tas, windDir, windSpd);
      const mh = result.heading;
      let th = mh - MAGNETIC_VARIATION;
      th = normalizeAngle(th);
      const gs = result.groundSpeed;
      const da = mc - mh;
      
      const ete = calculateETE(dist, gs);
      cumulativeTime += ete;
      
      this.flightLog.push({
        remark: (index + 1).toString(),
        navaid: leg.to,
        tc: Math.round(tc).toString().padStart(3, '0'),
        mc: mc.toString().padStart(3, '0'),
        th: Math.round(th).toString().padStart(3, '0'),
        mh: mh.toString().padStart(3, '0'),
        da: (da >= 0 ? '+' : '') + da.toString(),
        gs: gs.toString(),
        dist: dist.toString(),
        ete: this.formatTime(ete),
        eta: '-',
        ata: '-'
      });
    });
    
    this.updateFlightLog();
  }
  
  startCustomTraining() {
    if (this.customLegs.length === 0) {
      alert('먼저 경로를 계산해주세요!');
      return;
    }
    
    // Reset aircraft
    this.aircraft = new AircraftState();
    
    // Spawn aircraft near first NAVAID
    const firstNavaid = this.customRoute[0];
    const firstPos = this.renderer.navaidPositions[firstNavaid];
    
    if (!firstPos) {
      alert(`${firstNavaid}의 위치를 찾을 수 없습니다.`);
      return;
    }
    
    const spawnDist = (2 + Math.random() * 2) * this.renderer.nmToPixels;
    const firstLeg = this.customLegs[0];
    const courseOffset = (Math.random() - 0.5) * 60;
    const spawnAngle = (firstLeg.mc + courseOffset) * Math.PI / 180;
    
    this.aircraft.x = firstPos.x + spawnDist * Math.sin(spawnAngle);
    this.aircraft.y = firstPos.y - spawnDist * Math.cos(spawnAngle);
    this.aircraft.heading = firstLeg.mc + (Math.random() - 0.5) * 60;
    this.aircraft.heading = normalizeAngle(this.aircraft.heading);
    this.aircraft.tas = 240;
    
    // Set actual wind
    this.actualWindDir = this.planWindDir + (Math.random() - 0.5) * 80;
    this.actualWindDir = normalizeAngle(this.actualWindDir);
    this.actualWindSpd = Math.max(0, this.planWindSpd + (Math.random() - 0.5) * 20);
    
    this.baseWindDir = this.actualWindDir;
    this.baseWindSpd = this.actualWindSpd;
    this.lastWindChangeTime = 0;
    
    // Calculate initial track and GS
    const initialResult = calculateTrackAndGS(this.aircraft.heading, this.aircraft.tas, this.actualWindDir, this.actualWindSpd);
    this.aircraft.track = initialResult.track;
    this.aircraft.groundSpeed = initialResult.groundSpeed;
    this.aircraft.windDir = this.actualWindDir;
    this.aircraft.windSpd = this.actualWindSpd;
    
    // Start time
    this.started = true;
    this.startTime = performance.now() / 1000;
    this.currentTime = 0;
    this.lastFrameTime = this.startTime;
    
    // Initialize ATA records for custom route
    this.ataRecords = {};
    this.customRoute.forEach((navaid, index) => {
      if (index > 0) { // Skip START
        this.ataRecords[navaid] = { closest: Infinity, time: null, passed: false };
      }
    });
    
    // Enable control tab
    this.switchLowerTab('control');
    
    // Lock route mode tabs
    document.getElementById('defaultRouteBtn').disabled = true;
    document.getElementById('customRouteBtn').disabled = false;
    
    // Center aircraft on MAP
    this.centerAircraftOnMap();
    
    // Update start time in log
    const startEntry = this.flightLog[0];
    startEntry.ata = this.formatTime(0);
    
    // Calculate initial ETA for all waypoints
    this.updateETA();
    
    this.addEventLog(`CUSTOM TRAINING STARTED`);
    this.addEventLog(`ACTUAL WIND: ${Math.round(this.actualWindDir).toString().padStart(3, '0')}/${Math.round(this.actualWindSpd).toString().padStart(2, '0')}`);
    this.addEventLog(`INITIAL HDG: ${Math.round(this.aircraft.heading).toString().padStart(3, '0')}, TAS: ${Math.round(this.aircraft.tas)}`);
  }
  
  // ========== END CUSTOM ROUTE FUNCTIONS ==========
  
  /**
   * Game loop
   */
  startGameLoop() {
    const loop = () => {
      const now = performance.now() / 1000;
      const deltaTime = Math.min(now - this.lastFrameTime, 0.1); // Cap at 100ms
      this.lastFrameTime = now;
      
      if (!this.paused) {
        this.update(deltaTime);
        this.render();
      }
      
      requestAnimationFrame(loop);
    };
    
    loop();
  }
  
  /**
   * Format time as HH+MM
   */
  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}+${mins.toString().padStart(2, '0')}`;
  }
}

// Start app when page loads
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DeadReckoningApp();
});
