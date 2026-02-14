// ========== RENDERER ==========

class Renderer {
  constructor(hsiCanvas, mapCanvas) {
    this.hsiCanvas = hsiCanvas;
    this.mapCanvas = mapCanvas;
    this.hsiCtx = hsiCanvas.getContext('2d');
    this.mapCtx = mapCanvas.getContext('2d');
    
    // Map state
    this.mapScale = 1.0;
    this.mapOffsetX = 0;
    this.mapOffsetY = 0;
    this.mapDragging = false;
    this.mapLastTouchX = 0;
    this.mapLastTouchY = 0;
    
    // NAVAID pixel positions (calculated from lat/lon)
    this.navaidPositions = {};
    this.nmToPixels = 1;
    
    this.initializeMap();
  }
  
  /**
   * Calculate NAVAID positions on map (uses NAVAID_DATABASE connections)
   */
  initializeMap() {
    const width = this.mapCanvas.width;
    const height = this.mapCanvas.height;
    
    // Calculate nm to pixels ratio
    this.nmToPixels = height / MAP_HEIGHT_NM;
    
    // Start with first NAVAID as reference point
    const firstNavaid = Object.keys(NAVAID_DATABASE)[0];
    const referenceX = width * 0.5;
    const referenceY = height * 0.5;
    
    this.navaidPositions = {};
    const positioned = new Set();
    const toPosition = [{ id: firstNavaid, x: referenceX, y: referenceY }];
    
    // Build map using connections (BFS)
    while (toPosition.length > 0) {
      const current = toPosition.shift();
      
      if (positioned.has(current.id)) continue;
      
      this.navaidPositions[current.id] = { x: current.x, y: current.y };
      positioned.add(current.id);
      
      const navaid = NAVAID_DATABASE[current.id];
      if (!navaid || !navaid.connectedTo) continue;
      
      // Position all connected NAVAIDs
      for (let connectedId in navaid.connectedTo) {
        if (positioned.has(connectedId)) continue;
        
        const connection = navaid.connectedTo[connectedId];
        const vec = getVector(connection.mc);
        const distance = connection.distance * this.nmToPixels;
        
        toPosition.push({
          id: connectedId,
          x: current.x + vec.dx * distance,
          y: current.y + vec.dy * distance
        });
      }
    }
  }
  
  /**
   * Draw HSI (Horizontal Situation Indicator)
   */
  drawHSI(aircraft, selectedNavaid, dmeDistance) {
    const ctx = this.hsiCtx;
    const canvas = this.hsiCanvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 60; // 콤파스 카드 확대
    
    // Clear canvas
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw rotating compass card
    this.drawCompassCard(ctx, centerX, centerY, radius, aircraft.heading);
    
    // Draw NAVAID needle (if operative)
    if (selectedNavaid && NAVAID_DATABASE[selectedNavaid]) {
      const navData = NAVAID_DATABASE[selectedNavaid];
      if (navData.operative && navData.type !== "FIX") {
        const navPos = this.navaidPositions[selectedNavaid];
        const bearing = bearingBetween(aircraft.x, aircraft.y, navPos.x, navPos.y);
        this.drawNavaidNeedle(ctx, centerX, centerY, radius, aircraft.heading, bearing);
      }
    }
    
    // Draw center aircraft symbol (no circle)
    this.drawAircraftSymbol(ctx, centerX, centerY);
    
    // Draw heading window (triangle touches compass card circle)
    const headingY = centerY - radius - 50;
    this.drawHeadingWindow(ctx, centerX, headingY, radius, centerY, aircraft.heading);
    
    // Draw DME window (top left)
    this.drawDMEWindow(ctx, 20, 20, dmeDistance, selectedNavaid);
    
    // Draw NAVAID reference (bottom right)
    this.drawNavaidReference(ctx, canvas.width - 120, canvas.height - 80);
  }
  
  /**
   * Draw rotating compass card
   */
  drawCompassCard(ctx, centerX, centerY, radius, heading) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((-heading * Math.PI) / 180);
    
    // Draw outer circle
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw tick marks and numbers
    ctx.fillStyle = COLORS.white;
    ctx.strokeStyle = COLORS.white;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < 360; i += 5) {
      const angle = (i * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      if (i % 30 === 0) {
        // Major tick (30-degree marks)
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sin * radius, -cos * radius);
        ctx.lineTo(sin * (radius - 20), -cos * (radius - 20));
        ctx.stroke();
        
        // Numbers
        const num = i === 0 ? 36 : i / 10;
        ctx.save();
        ctx.translate(sin * (radius - 35), -cos * (radius - 35));
        ctx.rotate((i * Math.PI) / 180);
        ctx.fillText(num.toString(), 0, 0);
        ctx.restore();
        
        // Draw triangle for 45-degree marks (N, E, S, W + 45s)
        if (i % 45 === 0) {
          ctx.fillStyle = COLORS.white;
          ctx.beginPath();
          ctx.moveTo(sin * (radius - 5), -cos * (radius - 5));
          ctx.lineTo(sin * (radius - 15) - 5 * cos, -cos * (radius - 15) + 5 * sin);
          ctx.lineTo(sin * (radius - 15) + 5 * cos, -cos * (radius - 15) - 5 * sin);
          ctx.closePath();
          ctx.fill();
        }
      } else if (i % 10 === 0) {
        // Medium tick (10-degree marks)
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sin * radius, -cos * radius);
        ctx.lineTo(sin * (radius - 15), -cos * (radius - 15));
        ctx.stroke();
      } else {
        // Minor tick (5-degree marks)
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sin * radius, -cos * radius);
        ctx.lineTo(sin * (radius - 10), -cos * (radius - 10));
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }
  
  /**
   * Draw NAVAID needle (full length, bidirectional, straight line tail)
   */
  drawNavaidNeedle(ctx, centerX, centerY, radius, heading, bearing) {
    ctx.save();
    ctx.translate(centerX, centerY);
    
    // Rotate to bearing relative to heading
    const relBearing = bearing - heading;
    ctx.rotate((relBearing * Math.PI) / 180);
    
    // Draw green needle
    ctx.strokeStyle = COLORS.green;
    ctx.fillStyle = COLORS.green;
    ctx.lineWidth = 3;
    
    const needleLength = radius - 5;
    const arrowWidth = 12;
    
    // Full line from tail to head
    ctx.beginPath();
    ctx.moveTo(0, -needleLength);
    ctx.lineTo(0, needleLength);
    ctx.stroke();
    
    // TO arrow head (pointing up to NAVAID)
    ctx.beginPath();
    ctx.moveTo(0, -needleLength);
    ctx.lineTo(-arrowWidth, -needleLength + arrowWidth * 1.5);
    ctx.lineTo(arrowWidth, -needleLength + arrowWidth * 1.5);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
  
  /**
   * Draw fixed aircraft symbol in center (no center circle)
   */
  drawAircraftSymbol(ctx, centerX, centerY) {
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 4;
    
    // Vertical line (fuselage)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 40);
    ctx.lineTo(centerX, centerY + 40);
    ctx.stroke();
    
    // Horizontal line (wings)
    ctx.beginPath();
    ctx.moveTo(centerX - 40, centerY + 10);
    ctx.lineTo(centerX + 40, centerY + 10);
    ctx.stroke();
    
    // Short horizontal line (tail)
    ctx.beginPath();
    ctx.moveTo(centerX - 25, centerY + 30);
    ctx.lineTo(centerX + 25, centerY + 30);
    ctx.stroke();
  }
  
  /**
   * Draw heading window (triangle touches compass card circle)
   */
  drawHeadingWindow(ctx, centerX, y, radius, centerY, heading) {
    const width = 75;
    const height = 38;
    const x = centerX - width / 2;
    
    // Background
    ctx.fillStyle = COLORS.darkGrey;
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // MAG label
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('MAG', x - 5, y + 15);
    
    // Heading value
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(heading).toString().padStart(3, '0'), centerX, y + height / 2);
    
    // Heading bug (triangle pointing DOWN - tip touches compass circle)
    const triangleTop = y + height;
    const triangleTip = centerY - radius; // Touch the compass circle
    
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.moveTo(centerX, triangleTip);
    ctx.lineTo(centerX - 8, triangleTop);
    ctx.lineTo(centerX + 8, triangleTop);
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * Draw DME window (top left, 75% size)
   */
  drawDMEWindow(ctx, x, y, distance, navaid) {
    const width = 75;
    const height = 38;
    
    // Background
    ctx.fillStyle = COLORS.darkGrey;
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // DME label
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('DME', x + 4, y - 5);
    
    // Distance value
    if (navaid && NAVAID_DATABASE[navaid]) {
      const navData = NAVAID_DATABASE[navaid];
      if (navData.operative && navData.type !== "FIX") {
        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(distance.toFixed(1), x + width / 2, y + height / 2);
        
        // Channel
        ctx.font = 'bold 11px Arial';
        ctx.fillText(navData.channel, x + width / 2, y + height + 12);
      } else {
        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('---', x + width / 2, y + height / 2);
      }
    } else {
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('---', x + width / 2, y + height / 2);
    }
  }
  
  /**
   * Draw wind window (bottom left, with on/off toggle)
   */
  drawWindWindow(ctx, x, y, windDir, windSpd, showWind) {
    const width = 98;
    const height = 38;
    
    // Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // WIND label
    ctx.fillStyle = COLORS.green;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('WIND(M)', x + 4, y - 5);
    
    // Wind value (show only if toggle is on)
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (showWind) {
      const windText = `${Math.round(windDir).toString().padStart(3, '0')} / ${Math.round(windSpd).toString().padStart(2, '0')}`;
      ctx.fillText(windText, x + width / 2, y + height / 2);
    } else {
      ctx.fillText('--- / --', x + width / 2, y + height / 2);
    }
  }
  
  /**
   * Draw NAVAID reference indicator
   */
  drawNavaidReference(ctx, x, y) {
    // Green arrow
    ctx.fillStyle = COLORS.green;
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x + 30, y + 10);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 10);
    ctx.lineTo(x + 20, y + 5);
    ctx.lineTo(x + 20, y + 15);
    ctx.closePath();
    ctx.fill();
    
    // Label
    ctx.fillStyle = COLORS.green;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('NAVAID', x, y + 30);
  }
  
  /**
   * Draw MAP
   */
  drawMAP(aircraft, showHistory, selectedRoute = null) {
    const ctx = this.mapCtx;
    const canvas = this.mapCanvas;
    
    ctx.save();
    
    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply transformations
    ctx.translate(canvas.width / 2 + this.mapOffsetX, canvas.height / 2 + this.mapOffsetY);
    ctx.scale(this.mapScale, this.mapScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    // Draw route lines (with selected route highlighted)
    this.drawRouteLines(ctx, selectedRoute);
    
    // Draw NAVAIDs (dimmed if not in selected route)
    this.drawNAVAIDs(ctx, selectedRoute);
    
    // Draw aircraft history
    if (showHistory && aircraft.positionHistory.length > 0) {
      this.drawHistory(ctx, aircraft);
    }
    
    // Draw aircraft
    this.drawAircraft(ctx, aircraft);
    
    // Draw TRK/GS and W/V info
    ctx.restore();
    this.drawTrackInfo(ctx, aircraft, 10, canvas.height - 60);
  }
  
  /**
   * Draw route lines between NAVAIDs (from NAVAID_DATABASE connections)
   * Highlights selected route in yellow, others in gray
   */
  drawRouteLines(ctx, selectedRoute = null) {
    const drawnConnections = new Set();
    
    // Build selected route connections
    const selectedConnections = new Set();
    if (selectedRoute && selectedRoute.length > 1) {
      for (let i = 0; i < selectedRoute.length - 1; i++) {
        const key1 = [selectedRoute[i], selectedRoute[i + 1]].sort().join('-');
        selectedConnections.add(key1);
      }
    }
    
    for (let fromId in NAVAID_DATABASE) {
      const from = this.navaidPositions[fromId];
      if (!from) continue;
      
      const navaid = NAVAID_DATABASE[fromId];
      if (!navaid.connectedTo) continue;
      
      for (let toId in navaid.connectedTo) {
        const to = this.navaidPositions[toId];
        if (!to) continue;
        
        const connectionKey = [fromId, toId].sort().join('-');
        if (drawnConnections.has(connectionKey)) continue;
        drawnConnections.add(connectionKey);
        
        // Check if this is part of selected route
        const isSelected = selectedConnections.has(connectionKey);
        
        ctx.strokeStyle = isSelected ? COLORS.yellow : COLORS.lightGrey;
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.globalAlpha = isSelected ? 1.0 : 0.4;
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    
    ctx.globalAlpha = 1.0;
  }
  
  /**
   * Draw NAVAID and FIX symbols
   * Dims NAVAIDs not in selected route
   */
  drawNAVAIDs(ctx, selectedRoute = null) {
    const selectedSet = selectedRoute ? new Set(selectedRoute) : null;
    
    for (let key in this.navaidPositions) {
      const pos = this.navaidPositions[key];
      const navaid = NAVAID_DATABASE[key];
      
      if (!navaid) continue;
      
      const isSelected = !selectedSet || selectedSet.has(key);
      ctx.globalAlpha = isSelected ? 1.0 : 0.3;
      
      if (navaid.type === "FIX") {
        // Draw FIX (triangle)
        ctx.fillStyle = isSelected ? COLORS.white : COLORS.lightGrey;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 10);
        ctx.lineTo(pos.x - 9, pos.y + 7);
        ctx.lineTo(pos.x + 9, pos.y + 7);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = isSelected ? COLORS.yellow : COLORS.lightGrey;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Draw NAVAID (square with color)
        if (isSelected) {
          ctx.fillStyle = navaid.operative ? COLORS.green : COLORS.red;
        } else {
          ctx.fillStyle = COLORS.lightGrey;
        }
        ctx.fillRect(pos.x - 10, pos.y - 10, 20, 20);
        
        ctx.strokeStyle = isSelected ? COLORS.yellow : COLORS.lightGrey;
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x - 10, pos.y - 10, 20, 20);
      }
      
      // Label
      ctx.fillStyle = isSelected ? COLORS.white : COLORS.lightGrey;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(key, pos.x, pos.y - 15);
    }
    
    ctx.globalAlpha = 1.0;
  }
  
  /**
   * Draw aircraft position history
   */
  drawHistory(ctx, aircraft) {
    ctx.fillStyle = COLORS.lightNavy;
    
    // Draw dots every 60 seconds
    for (let i = 0; i < aircraft.positionHistory.length; i++) {
      if (i % 60 === 0) {
        const pos = aircraft.positionHistory[i];
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  /**
   * Draw aircraft symbol (track 방향으로 표시)
   */
  drawAircraft(ctx, aircraft) {
    ctx.save();
    ctx.translate(aircraft.x, aircraft.y);
    ctx.rotate((aircraft.track * Math.PI) / 180); // Track 방향
    
    // Aircraft circle
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    
    // Track line (진행 방향)
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -25);
    ctx.stroke();
    
    ctx.restore();
  }
  
  /**
   * Draw track/gs and wind info
   */
  drawTrackInfo(ctx, aircraft, x, y) {
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    
    // TRK / GS
    const trkText = `TRK: ${Math.round(aircraft.track).toString().padStart(3, '0')}°  GS: ${Math.round(aircraft.groundSpeed)} kts`;
    ctx.fillText(trkText, x, y);
    
    // W/V
    ctx.fillStyle = COLORS.green;
    const windText = `W/V: ${Math.round(aircraft.windDir).toString().padStart(3, '0')}° / ${Math.round(aircraft.windSpd)} kts`;
    ctx.fillText(windText, x, y + 20);
  }
}
