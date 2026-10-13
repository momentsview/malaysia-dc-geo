/**
 * 3D Interactive Map Visualization Engine for Malaysia Data Centers
 * Renders 3D extruded capacity towers, animated radar pulse rings,
 * fiber optic particle corridors, and interactive perspective camera.
 */

class DataCenter3DMap {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas with id '${canvasId}' not found.`);
      return;
    }
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.options = options;

    // Data references
    this.facilities = [];
    this.corridors = STRATEGIC_CORRIDORS || [];
    this.filteredFacilities = [];
    this.selectedFacility = null;
    this.hoveredFacility = null;

    // Color mode: "capacity" | "status"
    this.colorMode = "capacity";

    // 3D Camera Parameters
    this.camera = {
      centerLat: 2.35,
      centerLng: 102.6,
      zoom: 7.6,
      pitch: 56,        // Degrees tilt (0 = flat 2D, 75 = dramatic 3D)
      bearing: -15,     // Degrees rotation
      targetCenterLat: 2.35,
      targetCenterLng: 102.6,
      targetZoom: 7.6,
      targetPitch: 56,
      targetBearing: -15,
      isAnimating: false,
      isOrbiting: false,
      orbitSpeed: 0.18
    };

    // Interaction state
    this.isDragging = false;
    this.isRotating = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseScreenX = -1000;
    this.mouseScreenY = -1000;

    // Animation time & particle systems
    this.time = 0;
    this.particles = [];
    this.initParticles();

    // Map style
    this.theme = "cyber-dark"; // "cyber-dark", "midnight", "satellite"

    // Resize handling
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.handleResize();

    // Setup input listeners
    this.setupInteractions();

    // Start 60fps render loop
    this.render = this.render.bind(this);
    requestAnimationFrame(this.render);
  }

  setData(facilities) {
    this.facilities = facilities.map(f => ({
      ...f,
      currentHeightScale: 1.0,
      targetHeightScale: 1.0,
      hoverOffset: 0,
      pulsePhase: Math.random() * Math.PI * 2
    }));
    this.filteredFacilities = [...this.facilities];
  }

  setFilteredIds(activeIds) {
    const idSet = new Set(activeIds);
    this.facilities.forEach(f => {
      f.targetHeightScale = idSet.has(f.id) ? 1.0 : 0.05;
      f.isVisible = idSet.has(f.id);
    });
  }

  setColorMode(mode) {
    this.colorMode = mode;
  }

  setTheme(themeName) {
    this.theme = themeName;
  }

  toggleOrbit() {
    this.camera.isOrbiting = !this.camera.isOrbiting;
    return this.camera.isOrbiting;
  }

  flyTo(target) {
    this.camera.targetCenterLat = target.center[0];
    this.camera.targetCenterLng = target.center[1];
    this.camera.targetZoom = target.zoom;
    this.camera.targetPitch = target.pitch !== undefined ? target.pitch : this.camera.pitch;
    this.camera.targetBearing = target.bearing !== undefined ? target.bearing : this.camera.bearing;
    this.camera.isAnimating = true;
    this.camera.isOrbiting = false;
  }

  setPitch(pitch) {
    this.camera.targetPitch = Math.max(0, Math.min(75, pitch));
    this.camera.isAnimating = true;
  }

  handleResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(this.dpr, this.dpr);
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        corridorIndex: Math.floor(Math.random() * this.corridors.length),
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
        size: 2 + Math.random() * 2.5
      });
    }
  }

  setupInteractions() {
    const el = this.canvas;

    el.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.isRotating = e.button === 2 || e.shiftKey;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.camera.isOrbiting = false;
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
      this.isRotating = false;
    });

    el.addEventListener("contextmenu", (e) => e.preventDefault());

    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      this.mouseScreenX = e.clientX - rect.left;
      this.mouseScreenY = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;

        if (this.isRotating) {
          // Rotate bearing and pitch
          this.camera.bearing = (this.camera.bearing + dx * 0.4) % 360;
          this.camera.pitch = Math.max(0, Math.min(75, this.camera.pitch - dy * 0.3));
          this.camera.targetBearing = this.camera.bearing;
          this.camera.targetPitch = this.camera.pitch;
        } else {
          // Pan camera
          const rad = (this.camera.bearing * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          // World move scale inversely proportional to zoom
          const panSpeed = 0.003 / Math.pow(2, this.camera.zoom - 7.5);
          const worldDx = (-dx * cos - dy * sin) * panSpeed;
          const worldDy = (-dx * sin + dy * cos) * panSpeed;

          this.camera.centerLng += worldDx * 1.5;
          this.camera.centerLat -= worldDy * 1.2;
          this.camera.targetCenterLng = this.camera.centerLng;
          this.camera.targetCenterLat = this.camera.centerLat;
        }

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else {
        // Raycast / Hit test for hover
        this.checkHover(this.mouseScreenX, this.mouseScreenY);
      }
    });

    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0015;
      this.camera.zoom = Math.max(6.5, Math.min(13.5, this.camera.zoom + zoomDelta));
      this.camera.targetZoom = this.camera.zoom;
      this.camera.isAnimating = false;
    }, { passive: false });

    el.addEventListener("click", (e) => {
      if (this.hoveredFacility) {
        this.selectFacility(this.hoveredFacility);
      }
    });

    // Touch support
    let touchStartDist = 0;
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
      }
    });

    el.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMouseX;
        const dy = e.touches[0].clientY - this.lastMouseY;
        const panSpeed = 0.003 / Math.pow(2, this.camera.zoom - 7.5);
        this.camera.centerLng -= dx * panSpeed * 1.5;
        this.camera.centerLat += dy * panSpeed * 1.2;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = (dist - touchStartDist) * 0.005;
        this.camera.zoom = Math.max(6.5, Math.min(13.5, this.camera.zoom + factor));
        touchStartDist = dist;
      }
    }, { passive: false });

    el.addEventListener("touchend", () => {
      this.isDragging = false;
    });
  }

  checkHover(screenX, screenY) {
    let closest = null;
    let minDistance = 28; // Hit radius threshold

    for (const f of this.facilities) {
      if (!f.projectedBase || f.currentHeightScale < 0.1) continue;

      // Hit test both base circle and 3D extruded pillar body
      const baseX = f.projectedBase.x;
      const baseY = f.projectedBase.y;
      const topX = f.projectedTop.x;
      const topY = f.projectedTop.y;

      // Distance to base
      const distBase = Math.hypot(screenX - baseX, screenY - baseY);

      // Distance to segment between base and top
      const distSeg = this.distToSegment(screenX, screenY, baseX, baseY, topX, topY);

      const d = Math.min(distBase, distSeg);
      if (d < minDistance) {
        minDistance = d;
        closest = f;
      }
    }

    if (this.hoveredFacility !== closest) {
      this.hoveredFacility = closest;
      this.canvas.style.cursor = closest ? "pointer" : "grab";
      if (typeof this.options.onHover === "function") {
        this.options.onHover(closest, screenX, screenY);
      }
    }
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  selectFacility(facility) {
    this.selectedFacility = facility;
    if (facility) {
      // Smooth fly camera slightly offset to show the 3D pillar dramatically
      this.flyTo({
        center: [facility.lat - 0.05, facility.lng],
        zoom: Math.max(this.camera.zoom, 10.5),
        pitch: 62,
        bearing: this.camera.bearing
      });
    }
    if (typeof this.options.onSelect === "function") {
      this.options.onSelect(facility);
    }
  }

  // Projection math: Lat/Lng -> 3D Isometric / Perspective Screen Coordinates
  project(lat, lng, heightOffsetZ = 0) {
    // 1. Mercator projection relative to camera center
    const scale = Math.pow(2, this.camera.zoom) * 18;

    // Longitudinal displacement (deg -> pixels)
    const dLng = (lng - this.camera.centerLng);
    const xWorld = dLng * (scale / 360) * 256;

    // Latitudinal displacement using Mercator spherical mapping
    const latRad = (lat * Math.PI) / 180;
    const centerLatRad = (this.camera.centerLat * Math.PI) / 180;
    const yWorldCenter = Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2));
    const yWorldPoint = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const yWorld = -(yWorldPoint - yWorldCenter) * (scale / (2 * Math.PI)) * 256;

    // 2. Rotate around center by bearing (yaw)
    const bearingRad = (this.camera.bearing * Math.PI) / 180;
    const cosB = Math.cos(bearingRad);
    const sinB = Math.sin(bearingRad);

    const xRot = xWorld * cosB - yWorld * sinB;
    const yRot = xWorld * sinB + yWorld * cosB;

    // 3. Apply pitch (tilt) foreshortening & perspective depth
    const pitchRad = (this.camera.pitch * Math.PI) / 180;
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);

    // Perspective depth camera distance
    const cameraDist = 800;
    const zDepth = yRot * sinP + cameraDist;
    const fovScale = cameraDist / Math.max(100, zDepth);

    // Final screen positions
    const screenX = this.width / 2 + xRot * fovScale;
    const screenY = this.height / 2 + (yRot * cosP - heightOffsetZ) * fovScale;

    return {
      x: screenX,
      y: screenY,
      depth: zDepth,
      scale: fovScale,
      visible: zDepth > 50 && screenX > -150 && screenX < this.width + 150 && screenY > -150 && screenY < this.height + 150
    };
  }

  // Main 60fps render loop
  render() {
    this.time += 0.016;

    // Smooth camera lerp
    if (this.camera.isOrbiting) {
      this.camera.bearing = (this.camera.bearing + this.camera.orbitSpeed) % 360;
      this.camera.targetBearing = this.camera.bearing;
    }

    if (this.camera.isAnimating || this.camera.isOrbiting) {
      const ease = 0.08;
      this.camera.centerLat += (this.camera.targetCenterLat - this.camera.centerLat) * ease;
      this.camera.centerLng += (this.camera.targetCenterLng - this.camera.centerLng) * ease;
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * ease;
      this.camera.pitch += (this.camera.targetPitch - this.camera.pitch) * ease;

      // Handle shortest bearing wrap
      let diffBearing = this.camera.targetBearing - this.camera.bearing;
      while (diffBearing > 180) diffBearing -= 360;
      while (diffBearing < -180) diffBearing += 360;
      this.camera.bearing += diffBearing * ease;

      if (
        Math.abs(this.camera.targetCenterLat - this.camera.centerLat) < 0.0001 &&
        Math.abs(this.camera.targetCenterLng - this.camera.centerLng) < 0.0001 &&
        Math.abs(this.camera.targetZoom - this.camera.zoom) < 0.005 &&
        !this.camera.isOrbiting
      ) {
        this.camera.isAnimating = false;
      }
    }

    // Clear Canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Deep Cyber High-Tech Map Background & Ocean
    this.drawMapBackground();

    // 2. Draw Realistic Peninsular Malaysia Landmass & State Outlines
    this.drawMalaysiaGeography();

    // 3. Draw Fiber Optic Cables & Energy Beams
    this.drawStrategicCorridors();

    // 4. Update and sort 3D Data Center Pillars by depth (Painters Algorithm)
    this.updateAndSortFacilities();

    // 5. Draw 3D Extruded Pillars, Radar Pulses, and Glowing Crowns
    this.drawDataCenterPillars();

    // 6. Draw Floating Hologram Tags & MW Indicators
    this.drawHolographicBadges();

    // Request next frame
    requestAnimationFrame(this.render);
  }

  drawMapBackground() {
    const ctx = this.ctx;
    // Gradient dark ocean
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
    grad.addColorStop(0, "#0b0f19");
    grad.addColorStop(0.5, "#0f172a");
    grad.addColorStop(1, "#080c14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // High-tech subtle perspective grid lines
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.035)";
    ctx.lineWidth = 1;

    const gridSize = 40;
    const timeOffset = (this.time * 8) % gridSize;

    // Longitudinal grid lines
    for (let x = -this.width; x < this.width * 2; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x + timeOffset, 0);
      ctx.lineTo(x + timeOffset, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMalaysiaGeography() {
    const ctx = this.ctx;

    // Detailed Polygon coordinates for Peninsular Malaysia Landmass
    const peninsularCoast = [
      [6.45, 100.18], [6.65, 100.22], [6.50, 100.50], [6.20, 101.00],
      [6.15, 102.15], [5.80, 102.50], [5.35, 103.15], [4.75, 103.45],
      [4.25, 103.48], [3.80, 103.35], [3.20, 103.45], [2.70, 103.60],
      [2.25, 104.05], [1.90, 104.15], [1.38, 104.28], [1.32, 104.05],
      // Johor South Coast / Singapore Strait
      [1.44, 103.78], [1.46, 103.62], [1.35, 103.52], [1.50, 103.45],
      [1.75, 103.20], [1.90, 102.90], [2.10, 102.50], [2.25, 102.15],
      // Malacca & Selangor Coast
      [2.45, 101.85], [2.70, 101.55], [2.95, 101.35], [3.30, 101.20],
      [3.70, 100.95], [4.15, 100.60], [4.80, 100.40], [5.30, 100.35],
      [5.75, 100.30], [6.25, 100.15], [6.45, 100.18]
    ];

    // Singapore Island Polygon
    const singaporePolygon = [
      [1.46, 103.75], [1.42, 103.95], [1.38, 104.02], [1.32, 103.98],
      [1.24, 103.82], [1.25, 103.65], [1.32, 103.62], [1.44, 103.70]
    ];

    // Key Tech Zones / Corridors
    const johorTechZone = [
      [1.75, 103.45], [1.75, 103.75], [1.38, 103.85], [1.38, 103.50]
    ];
    const klTechZone = [
      [3.30, 101.45], [3.30, 101.78], [2.85, 101.78], [2.85, 101.45]
    ];

    // Helper: Draw projected polygon
    const renderPoly = (poly, fillColor, strokeColor, lineWidth = 1) => {
      ctx.beginPath();
      let first = true;
      for (const pt of poly) {
        const p = this.project(pt[0], pt[1], 0);
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.closePath();
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    };

    // 1. Draw Mainland Malaysia Landmass with ambient 3D elevation glow
    ctx.save();
    // Ambient coastal cyan glow
    ctx.shadowColor = "rgba(14, 165, 233, 0.25)";
    ctx.shadowBlur = 25;
    renderPoly(peninsularCoast, "rgba(15, 23, 42, 0.95)", "rgba(56, 189, 248, 0.35)", 1.5);
    ctx.restore();

    // 2. Draw Singapore Island
    ctx.save();
    renderPoly(singaporePolygon, "rgba(30, 41, 59, 0.9)", "rgba(244, 63, 94, 0.4)", 1.2);
    const sgLabel = this.project(1.352, 103.82, 0);
    if (sgLabel.visible) {
      ctx.fillStyle = "rgba(244, 63, 94, 0.75)";
      ctx.font = "600 10px 'Google Sans', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🇸🇬 SINGAPORE HUB", sgLabel.x, sgLabel.y);
    }
    ctx.restore();

    // 3. Highlight Tech Corridor Zones (Johor Digital Belt & Greater KL Zone)
    renderPoly(johorTechZone, "rgba(168, 85, 247, 0.04)", "rgba(168, 85, 247, 0.25)", 1);
    renderPoly(klTechZone, "rgba(14, 165, 233, 0.04)", "rgba(14, 165, 233, 0.25)", 1);

    // Draw Zone Watermarks
    const jhZoneLabel = this.project(1.58, 103.64, 0);
    if (jhZoneLabel.visible && this.camera.zoom < 11.5) {
      ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
      ctx.font = "700 12px 'Google Sans', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "2px";
      ctx.fillText("JOHOR HYPERSCALE CORRIDOR (700MW - 1.5GW+)", jhZoneLabel.x, jhZoneLabel.y - 10);
    }

    const klZoneLabel = this.project(3.06, 101.65, 0);
    if (klZoneLabel.visible && this.camera.zoom < 11.5) {
      ctx.fillStyle = "rgba(14, 165, 233, 0.25)";
      ctx.font = "700 12px 'Google Sans', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GREATER KL / CYBERJAYA AI HUB", klZoneLabel.x, klZoneLabel.y - 10);
    }
  }

  drawStrategicCorridors() {
    const ctx = this.ctx;

    ctx.save();
    // 1. Draw glowing fiber connection lines
    for (const c of this.corridors) {
      const p1 = this.project(c.from[0], c.from[1], 0);
      const p2 = this.project(c.to[0], c.to[1], 0);

      if (!p1.visible && !p2.visible) continue;

      // Arc curve control point in 3D
      const midLat = (c.from[0] + c.to[0]) / 2;
      const midLng = (c.from[1] + c.to[1]) / 2;
      // Lift the fiber line slightly in 3D for dynamic arched laser effect
      const arcHeight = Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.15;
      const pMid = this.project(midLat, midLng, arcHeight);

      // Gradient laser beam
      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.2)");
      grad.addColorStop(0.5, "rgba(168, 85, 247, 0.45)");
      grad.addColorStop(1, "rgba(56, 189, 248, 0.2)");

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(pMid.x, pMid.y, p2.x, p2.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Dashed pulse
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(pMid.x, pMid.y, p2.x, p2.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 16]);
      ctx.lineDashOffset = -this.time * 40;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Animate Photon Energy Particles along corridors
    for (const p of this.particles) {
      p.t = (p.t + p.speed) % 1.0;
      const c = this.corridors[p.corridorIndex];
      if (!c) continue;

      const p1 = this.project(c.from[0], c.from[1], 0);
      const p2 = this.project(c.to[0], c.to[1], 0);
      const midLat = (c.from[0] + c.to[0]) / 2;
      const midLng = (c.from[1] + c.to[1]) / 2;
      const arcHeight = Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.15;
      const pMid = this.project(midLat, midLng, arcHeight);

      // Quadratic Bezier Interpolation B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
      const t = p.t;
      const bx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * pMid.x + t * t * p2.x;
      const by = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * pMid.y + t * t * p2.y;

      ctx.beginPath();
      ctx.arc(bx, by, p.size, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.restore();
  }

  updateAndSortFacilities() {
    // 1. Calculate projected coordinates and 3D height for all facilities
    for (const f of this.facilities) {
      // Smooth lerp height scale for filter transitions
      f.currentHeightScale += (f.targetHeightScale - f.currentHeightScale) * 0.12;

      // Calculate 3D extruded pillar height in world pixels
      // Base scaling: 10MW -> 18px height, 1200MW -> 180px height
      const rawMw = Math.max(2, f.capacityMW);
      // Logarithmic / power curve for balanced visual readability
      const normalizedHeight = Math.pow(rawMw, 0.58) * 3.4;
      const pillarHeight = normalizedHeight * f.currentHeightScale;

      // Base footprint radius scaled with capacity
      const baseRadius = (Math.pow(rawMw, 0.42) * 1.8 + 5) * f.currentHeightScale;
      f.baseRadius = Math.max(3, baseRadius);

      // Hover elevation bounce
      if (this.hoveredFacility === f) {
        f.hoverOffset += (12 - f.hoverOffset) * 0.2;
      } else {
        f.hoverOffset += (0 - f.hoverOffset) * 0.2;
      }

      // Projected base position (on ground, Z=0)
      f.projectedBase = this.project(f.lat, f.lng, 0);

      // Projected top position (in sky, Z = pillarHeight + hoverOffset)
      f.projectedTop = this.project(f.lat, f.lng, pillarHeight + f.hoverOffset);
    }

    // 2. Sort by depth (far to near) for correct 3D occlusion
    this.facilities.sort((a, b) => b.projectedBase.depth - a.projectedBase.depth);
  }

  drawDataCenterPillars() {
    const ctx = this.ctx;

    for (const f of this.facilities) {
      if (!f.projectedBase.visible || f.currentHeightScale < 0.05) continue;

      const baseX = f.projectedBase.x;
      const baseY = f.projectedBase.y;
      const topX = f.projectedTop.x;
      const topY = f.projectedTop.y;
      const radius = f.baseRadius * f.projectedBase.scale;
      const isHovered = this.hoveredFacility === f;
      const isSelected = this.selectedFacility === f;

      // Get color based on current mode
      let themeColor = "#38bdf8";
      let glowColor = "rgba(56, 189, 248, 0.4)";
      let topCapColor = "#e0f2fe";

      if (this.colorMode === "capacity") {
        const tier = getCapacityTier(f.capacityMW);
        themeColor = tier.color;
        glowColor = tier.glowColor;
        topCapColor = tier.textColor;
      } else {
        // By Status
        const st = STATUS_CONFIG[f.status] || STATUS_CONFIG["operational"];
        themeColor = st.color;
        glowColor = st.bg;
        topCapColor = "#ffffff";
      }

      // ----------------------------------------------------
      // STEP 1: Animated Radar Pulse Concentric Rings on Ground
      // ----------------------------------------------------
      ctx.save();
      const pulseSpeed = 1.5;
      const pulsePhase = (this.time * pulseSpeed + f.pulsePhase) % (Math.PI * 2);
      const ringCount = 2;

      for (let r = 0; r < ringCount; r++) {
        const progress = ((pulsePhase + (r * Math.PI)) % (Math.PI * 2)) / (Math.PI * 2);
        const ringRadius = radius * (1.2 + progress * 2.8);
        const ringAlpha = Math.max(0, (1 - progress) * 0.55);

        ctx.beginPath();
        // Flatten circle in perspective to match ground plane
        ctx.ellipse(baseX, baseY, ringRadius, ringRadius * 0.45, (this.camera.bearing * Math.PI) / 180, 0, Math.PI * 2);
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = ringAlpha;
        ctx.stroke();
      }
      ctx.restore();

      // Ground Drop Shadow / Footprint Disc
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(baseX, baseY, radius * 1.4, radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? glowColor : "rgba(0, 0, 0, 0.65)";
      ctx.fill();
      ctx.restore();

      // ----------------------------------------------------
      // STEP 2: 3D Extruded Polygonal Pillar Column Body
      // ----------------------------------------------------
      ctx.save();

      // Create vertical pillar body with 3D cylindrical lighting
      const leftBaseX = baseX - radius;
      const rightBaseX = baseX + radius;
      const leftTopX = topX - radius;
      const rightTopX = topX + radius;

      // Gradient shading: specular highlight on left side, shadow on right
      const pillarGrad = ctx.createLinearGradient(leftTopX, 0, rightTopX, 0);
      pillarGrad.addColorStop(0, themeColor);
      pillarGrad.addColorStop(0.35, "#ffffff"); // Bright specular sheen
      pillarGrad.addColorStop(0.7, themeColor);
      pillarGrad.addColorStop(1, "rgba(10, 15, 25, 0.85)"); // Shadow edge

      ctx.beginPath();
      ctx.moveTo(leftBaseX, baseY);
      ctx.lineTo(leftTopX, topY);
      ctx.lineTo(rightTopX, topY);
      ctx.lineTo(rightBaseX, baseY);
      ctx.closePath();

      ctx.fillStyle = pillarGrad;
      ctx.globalAlpha = isHovered ? 1.0 : (isSelected ? 0.95 : 0.82);
      ctx.fill();

      // Luminous edges
      ctx.strokeStyle = isHovered ? "#ffffff" : themeColor;
      ctx.lineWidth = isHovered ? 2.2 : 1.2;
      ctx.stroke();

      // ----------------------------------------------------
      // STEP 3: Top Polygon Cap (Roof of Data Center)
      // ----------------------------------------------------
      ctx.beginPath();
      ctx.ellipse(topX, topY, radius, radius * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? "#ffffff" : topCapColor;
      ctx.globalAlpha = 0.95;
      ctx.fill();

      ctx.strokeStyle = isHovered ? "#ffffff" : themeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center glowing beacon on crown
      ctx.beginPath();
      ctx.arc(topX, topY, Math.max(2, radius * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? "#38bdf8" : "#ffffff";
      ctx.shadowColor = themeColor;
      ctx.shadowBlur = 10;
      ctx.fill();

      // ----------------------------------------------------
      // STEP 4: Sky Laser Beam on Hover or Select
      // ----------------------------------------------------
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(topX, topY - 120);
        const beamGrad = ctx.createLinearGradient(topX, topY, topX, topY - 120);
        beamGrad.addColorStop(0, themeColor);
        beamGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.6)");
        beamGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawHolographicBadges() {
    const ctx = this.ctx;
    ctx.save();

    for (const f of this.facilities) {
      if (!f.projectedBase.visible || f.currentHeightScale < 0.2) continue;

      const topX = f.projectedTop.x;
      const topY = f.projectedTop.y;
      const isHovered = this.hoveredFacility === f;
      const isSelected = this.selectedFacility === f;

      // Only show text labels if zoom is high enough, or if it's a Mega scale facility, or hovered
      const shouldShowLabel =
        isHovered ||
        isSelected ||
        this.camera.zoom >= 9.8 ||
        f.capacityMW >= 300;

      if (!shouldShowLabel) continue;

      const tier = getCapacityTier(f.capacityMW);
      const mwText = f.capacityMW >= 1000
        ? `${(f.capacityMW / 1000).toFixed(1)} GW`
        : `${f.capacityMW} MW`;

      // Badge dimensions
      const paddingX = 7;
      const badgeH = 18;
      ctx.font = "700 11px 'Google Sans', Roboto, sans-serif";
      const textMetrics = ctx.measureText(mwText);
      const badgeW = textMetrics.width + paddingX * 2 + 12; // 12px for icon

      const badgeX = topX - badgeW / 2;
      const badgeY = topY - badgeH - 10;

      // Draw floating connector pin line
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(topX, badgeY + badgeH);
      ctx.strokeStyle = isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rounded Material 3 Pill Container
      ctx.beginPath();
      const r = badgeH / 2;
      ctx.moveTo(badgeX + r, badgeY);
      ctx.lineTo(badgeX + badgeW - r, badgeY);
      ctx.arc(badgeX + badgeW - r, badgeY + r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(badgeX + r, badgeY + badgeH);
      ctx.arc(badgeX + r, badgeY + r, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();

      ctx.fillStyle = isHovered ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.85)";
      ctx.fill();

      ctx.strokeStyle = isHovered ? "#ffffff" : tier.color;
      ctx.lineWidth = isHovered ? 2 : 1.2;
      ctx.shadowColor = tier.color;
      ctx.shadowBlur = isHovered ? 12 : 5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Small glowing indicator dot
      ctx.beginPath();
      ctx.arc(badgeX + paddingX + 4, badgeY + badgeH / 2, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = tier.color;
      ctx.fill();

      // Capacity text
      ctx.fillStyle = isHovered ? "#ffffff" : tier.textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(mwText, badgeX + paddingX + 11, badgeY + badgeH / 2);

      // If hovered or selected, also show company/name tag
      if (isHovered || isSelected) {
        ctx.font = "600 11px 'Google Sans', Roboto, sans-serif";
        const nameW = ctx.measureText(f.name).width + 16;
        const nameX = topX - nameW / 2;
        const nameY = badgeY - 22;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(nameX, nameY, nameW, 20, 6);
        } else {
          ctx.rect(nameX, nameY, nameW, 20);
        }
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.stroke();

        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "center";
        ctx.fillText(f.name, topX, nameY + 10);
      }
    }

    ctx.restore();
  }
}

// Global Export
if (typeof module !== "undefined") {
  module.exports = { DataCenter3DMap };
}
