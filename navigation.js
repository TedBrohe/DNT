// ========== NAVIGATION CALCULATIONS ==========

/**
 * Get direction vector from course angle
 * @param {number} course - Course in degrees (0-360)
 * @returns {object} {dx, dy} normalized direction vector
 */
function getVector(course) {
  if (course < 0 || course > 360) course = 0;
  
  const rad = (90 - course) * Math.PI / 180;
  return {
    dx: Math.cos(rad),
    dy: -Math.sin(rad)
  };
}

/**
 * Calculate distance between two points
 * @param {number} x1, y1 - First point
 * @param {number} x2, y2 - Second point
 * @returns {number} Distance in pixels
 */
function distanceBetween(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate bearing from point A to point B
 * @param {number} x1, y1 - From point
 * @param {number} x2, y2 - To point
 * @returns {number} Bearing in degrees (0-360)
 */
function bearingBetween(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  
  return Math.round(angle);
}

/**
 * Calculate Track and Ground Speed from Heading, TAS, and Wind
 * Uses vector addition: TAS vector + Wind vector = GS vector
 * @param {number} heading - Magnetic Heading (degrees)
 * @param {number} tas - True Airspeed (knots)
 * @param {number} windDir - Wind direction FROM (degrees, magnetic)
 * @param {number} windSpd - Wind speed (knots)
 * @returns {object} {track, groundSpeed}
 */
function calculateTrackAndGS(heading, tas, windDir, windSpd) {
  // TAS vector
  const tasVec = getVector(heading);
  const tasX = tasVec.dx * tas;
  const tasY = tasVec.dy * tas;
  
  // Wind vector (wind blows FROM windDir, so aircraft drifts TO opposite direction)
  const windTo = (windDir + 180) % 360;
  const windVec = getVector(windTo);
  const windX = windVec.dx * windSpd;
  const windY = windVec.dy * windSpd;
  
  // Ground speed vector
  const gsX = tasX + windX;
  const gsY = tasY + windY;
  
  // Calculate track and ground speed
  const groundSpeed = Math.round(Math.sqrt(gsX * gsX + gsY * gsY));
  let track = Math.atan2(gsX, -gsY) * 180 / Math.PI;
  if (track < 0) track += 360;
  
  return {
    track: Math.round(track),
    groundSpeed: groundSpeed
  };
}

/**
 * Calculate required heading to fly a desired course
 * Uses vector triangle: TAS + Wind = GS (on desired course)
 * @param {number} course - Desired magnetic course
 * @param {number} tas - True Airspeed
 * @param {number} windDir - Wind direction FROM (magnetic)
 * @param {number} windSpd - Wind speed
 * @returns {object} {heading, groundSpeed, driftAngle}
 */
function calculateRequiredHeading(course, tas, windDir, windSpd) {
  // Wind blows FROM windDir, so wind vector points TO (windDir + 180)
  const windTo = (windDir + 180) % 360;
  const windVec = getVector(windTo);
  const windX = windVec.dx * windSpd;
  const windY = windVec.dy * windSpd;
  
  // Desired ground track vector (unit)
  const crsVec = getVector(course);
  const crsX = crsVec.dx;
  const crsY = crsVec.dy;
  
  // We need: TAS_vector + Wind_vector = GS_vector (along course)
  // So: TAS_vector = GS_vector - Wind_vector
  
  // Wind component perpendicular to course (crosswind)
  // Project wind onto perpendicular to course
  const perpX = -crsY; // perpendicular to course
  const perpY = crsX;
  const crossWind = windX * perpX + windY * perpY;
  
  // Wind component along course (headwind/tailwind)
  const alongWind = windX * crsX + windY * crsY;
  
  // To maintain course, TAS must have:
  // - Component perpendicular to course = -crossWind (to cancel it)
  // - Component along course such that total TAS = given TAS
  
  const tasPerp = -crossWind;
  
  // Check if wind is too strong
  if (Math.abs(tasPerp) > tas) {
    // Cannot make this course with this TAS
    return { heading: course, groundSpeed: 0, driftAngle: 0 };
  }
  
  // Remaining TAS component along course
  const tasAlong = Math.sqrt(tas * tas - tasPerp * tasPerp);
  
  // TAS vector = tasAlong * course_direction + tasPerp * perpendicular
  const tasX = tasAlong * crsX + tasPerp * perpX;
  const tasY = tasAlong * crsY + tasPerp * perpY;
  
  // Heading is direction of TAS vector
  let heading = Math.atan2(tasX, -tasY) * 180 / Math.PI;
  if (heading < 0) heading += 360;
  
  // Ground speed = tasAlong + alongWind (component along course)
  const groundSpeed = tasAlong + alongWind;
  
  // Drift angle = course - heading
  let driftAngle = course - heading;
  if (driftAngle > 180) driftAngle -= 360;
  if (driftAngle < -180) driftAngle += 360;
  
  return {
    heading: Math.round(heading),
    groundSpeed: Math.round(groundSpeed),
    driftAngle: Math.round(driftAngle)
  };
}

/**
 * Calculate wind vector from heading/TAS and track/GS
 * @param {number} heading - Magnetic heading
 * @param {number} tas - True airspeed
 * @param {number} track - Magnetic track
 * @param {number} gs - Ground speed
 * @returns {object} {windDir, windSpd}
 */
function calculateWind(heading, tas, track, gs) {
  // TAS vector
  const tasVec = getVector(heading);
  const tasX = tasVec.dx * tas;
  const tasY = tasVec.dy * tas;
  
  // GS vector
  const gsVec = getVector(track);
  const gsX = gsVec.dx * gs;
  const gsY = gsVec.dy * gs;
  
  // Wind vector = GS - TAS
  const windX = gsX - tasX;
  const windY = gsY - tasY;
  
  // Calculate wind direction and speed
  const windSpd = Math.round(Math.sqrt(windX * windX + windY * windY));
  let windTo = Math.atan2(windX, -windY) * 180 / Math.PI;
  if (windTo < 0) windTo += 360;
  
  // Wind direction is FROM, so add 180
  const windDir = Math.round((windTo + 180) % 360);
  
  return {
    windDir: windDir,
    windSpd: windSpd
  };
}

/**
 * Calculate ETE (Estimated Time Enroute)
 * @param {number} distance - Distance in NM
 * @param {number} groundSpeed - Ground speed in knots
 * @returns {number} Time in minutes
 */
function calculateETE(distance, groundSpeed) {
  if (groundSpeed === 0) return 0;
  return Math.round(distance / groundSpeed * 60);
}

/**
 * Calculate distance from time and speed
 * @param {number} time - Time in minutes
 * @param {number} speed - Speed in knots
 * @returns {number} Distance in NM
 */
function calculateDistance(time, speed) {
  return Math.round((time / 60) * speed * 10) / 10;
}

/**
 * Calculate time from distance and speed
 * @param {number} distance - Distance in NM
 * @param {number} speed - Speed in knots
 * @returns {number} Time in minutes
 */
function calculateTime(distance, speed) {
  if (speed === 0) return 0;
  return Math.round((distance / speed) * 60);
}

/**
 * Convert magnetic to true
 * @param {number} magnetic - Magnetic course/heading
 * @returns {number} True course/heading
 */
function magneticToTrue(magnetic) {
  return magnetic - MAGNETIC_VARIATION;
}

/**
 * Convert true to magnetic
 * @param {number} trueValue - True course/heading
 * @returns {number} Magnetic course/heading
 */
function trueToMagnetic(trueValue) {
  return trueValue + MAGNETIC_VARIATION;
}

/**
 * Normalize angle to 0-360 range
 * @param {number} angle - Angle in degrees
 * @returns {number} Normalized angle
 */
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Calculate shortest angular difference
 * @param {number} from - Starting angle
 * @param {number} to - Target angle
 * @returns {number} Difference (-180 to +180, positive = right turn)
 */
function angleDifference(from, to) {
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// ========== AIRCRAFT PHYSICS ==========

class AircraftState {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.heading = 0; // Magnetic heading
    this.tas = AIRCRAFT.defaultTAS;
    this.track = 0;
    this.groundSpeed = 0;
    this.windDir = 0;
    this.windSpd = 0;
    
    // Turn state
    this.targetHeading = 0;
    this.turning = false;
    this.turnStartTime = 0;
    this.turnDelayTime = 0;
    
    // Speed change state
    this.targetTAS = AIRCRAFT.defaultTAS;
    this.speedChanging = false;
    this.speedChangeStartTime = 0;
    this.speedChangeDelayTime = 0;
    
    // History for ATA calculation
    this.positionHistory = [];
    this.lastHistorySave = 0;
  }
  
  /**
   * Set new heading command
   */
  setHeading(newHeading, currentTime) {
    this.targetHeading = normalizeAngle(newHeading);
    this.turning = true;
    this.turnStartTime = currentTime;
    this.turnDelayTime = AIRCRAFT.bankDelay;
  }
  
  /**
   * Set new TAS command
   */
  setTAS(newTAS, currentTime) {
    this.targetTAS = newTAS;
    this.speedChanging = true;
    this.speedChangeStartTime = currentTime;
    this.speedChangeDelayTime = AIRCRAFT.bankDelay;
  }
  
  /**
   * Update aircraft state
   */
  update(deltaTime, currentTime, actualWindDir, actualWindSpd) {
    // Update heading (with delay and turn rate)
    if (this.turning) {
      const timeSinceStart = currentTime - this.turnStartTime;
      
      if (timeSinceStart < this.turnDelayTime) {
        // Still in delay period
      } else {
        // Calculate turn
        const turnTime = timeSinceStart - this.turnDelayTime;
        const diff = angleDifference(this.heading, this.targetHeading);
        const maxTurn = AIRCRAFT.turnRate * turnTime;
        
        if (Math.abs(diff) <= AIRCRAFT.turnRate * deltaTime) {
          this.heading = this.targetHeading;
          this.turning = false;
        } else {
          this.heading += Math.sign(diff) * AIRCRAFT.turnRate * deltaTime;
          this.heading = normalizeAngle(this.heading);
        }
      }
    }
    
    // Update speed (with delay and acceleration)
    if (this.speedChanging) {
      const timeSinceStart = currentTime - this.speedChangeStartTime;
      
      if (timeSinceStart < this.speedChangeDelayTime) {
        // Still in delay period
      } else {
        // Calculate acceleration
        const accelTime = timeSinceStart - this.speedChangeDelayTime;
        const speedDiff = this.targetTAS - this.tas;
        const accelRate = speedDiff / AIRCRAFT.accelTime;
        
        if (accelTime >= AIRCRAFT.accelTime) {
          this.tas = this.targetTAS;
          this.speedChanging = false;
        } else {
          this.tas += accelRate * deltaTime;
        }
      }
    }
    
    // Store actual wind
    this.windDir = actualWindDir;
    this.windSpd = actualWindSpd;
    
    // Calculate track and ground speed
    const result = calculateTrackAndGS(this.heading, this.tas, actualWindDir, actualWindSpd);
    this.track = result.track;
    this.groundSpeed = result.groundSpeed;
  }
  
  /**
   * Update position based on track and ground speed
   */
  updatePosition(deltaTime, nmToPixels) {
    const vec = getVector(this.track);
    const speedPixelsPerSec = (this.groundSpeed * nmToPixels) / 3600;
    
    this.x += vec.dx * speedPixelsPerSec * deltaTime;
    this.y += vec.dy * speedPixelsPerSec * deltaTime;
  }
  
  /**
   * Save position to history (every 1 second for ATA calculation)
   */
  saveHistory(currentTime) {
    if (currentTime - this.lastHistorySave >= 1.0) {
      this.positionHistory.push({
        x: this.x,
        y: this.y,
        time: currentTime
      });
      this.lastHistorySave = currentTime;
      
      // Keep only last 1 hour of history
      if (this.positionHistory.length > 3600) {
        this.positionHistory.shift();
      }
    }
  }
}
