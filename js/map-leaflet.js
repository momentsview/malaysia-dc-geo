/**
 * Leaflet 2D Real Map Controller with 3D Isometric Building Markers
 * 100% Free, Zero API Key Required: Uses OpenStreetMap, ESRI Free Tiles,
 * and Built-in Offline Static Vector Map of Malaysia.
 */

class MalaysiaDataCenterMap {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.facilities = [];
    this.markers = new Map();
    this.corridorLayers = [];
    this.colorMode = "status";
    this.activePreset = "malaysia";

    // Initialize Leaflet Map instance
    this.initMap();
  }

  initMap() {
    if (typeof L === "undefined") {
      console.error("Leaflet library not loaded.");
      return;
    }

    // Default center on Peninsular Malaysia
    this.map = L.map(this.containerId, {
      center: [3.1, 102.2],
      zoom: 7,
      minZoom: 6,
      maxZoom: 17,
      zoomControl: false
    });

    // 100% Free, NO API Key Required Basemap Providers
    this.baseLayers = {
      // 1. OpenStreetMap Standard (100% Free, Zero API Key, Global Standard)
      osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }),
      // 2. ESRI World Street Map (100% Free, Zero API Key, Clean & Professional)
      esriStreet: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        attribution: '&copy; Esri &copy; HERE, Garmin, USGS',
        maxZoom: 18
      }),
      // 3. ESRI Satellite Imagery (100% Free, Zero API Key)
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: '&copy; Esri &copy; Earthstar Geographics',
        maxZoom: 18
      }),
      // 4. ESRI Topographic Map (100% Free, Zero API Key)
      esriTopo: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        attribution: '&copy; Esri &copy; Intermap, USGS',
        maxZoom: 18
      })
    };

    // Default to ESRI World Street Map (Crisp, clean streets, zero watermarks, no API key)
    this.currentTileLayer = this.baseLayers.esriStreet;
    this.currentTileLayer.addTo(this.map);

    // Static Vector Map Layer Group (100% Offline / No network tiles)
    this.staticVectorGroup = L.layerGroup();
    this.initStaticVectorMap();

    // Marker Layer Group
    this.markerGroup = L.layerGroup().addTo(this.map);

    // Fiber Corridors Layer Group
    this.corridorGroup = L.layerGroup().addTo(this.map);

    // Render strategic fiber corridors
    this.drawFiberCorridors();
  }

  initStaticVectorMap() {
    if (typeof MALAYSIA_STATIC_GEOJSON === "undefined") return;

    // 1. Add Landmass & State Boundaries
    L.geoJSON(MALAYSIA_STATIC_GEOJSON, {
      style: (feature) => {
        if (feature.properties.type === "country") {
          return {
            fillColor: "#e2e8f0",
            fillOpacity: 0.95,
            color: "#64748b",
            weight: 2
          };
        }
        if (feature.properties.type === "state") {
          const isCore = feature.properties.code === "JHR" || feature.properties.code === "SGR" || feature.properties.code === "KUL";
          return {
            fillColor: isCore ? "#cbd5e1" : "#f1f5f9",
            fillOpacity: 0.8,
            color: "#0284c7",
            weight: isCore ? 2 : 1,
            dashArray: "4, 4"
          };
        }
        if (feature.properties.type === "tech_zone") {
          return {
            fillColor: "#a855f7",
            fillOpacity: 0.15,
            color: "#a855f7",
            weight: 1.5,
            dashArray: "2, 4"
          };
        }
        if (feature.properties.type === "highway") {
          return {
            color: "#f59e0b",
            weight: 2.5,
            opacity: 0.85
          };
        }
        return { color: "#94a3b8", weight: 1 };
      }
    }).addTo(this.staticVectorGroup);

    // 2. Add Static City Labels
    if (typeof MALAYSIA_STATIC_CITIES !== "undefined") {
      MALAYSIA_STATIC_CITIES.forEach(city => {
        const cityIcon = L.divIcon({
          className: "static-city-label",
          html: `<div style="font-family:'Google Sans',sans-serif;font-weight:700;font-size:11px;color:#0f172a;background:rgba(255,255,255,0.9);padding:2px 6px;border-radius:4px;border:1px solid #cbd5e1;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">📍 ${city.name}</div>`,
          iconSize: [120, 20],
          iconAnchor: [60, 10]
        });
        L.marker([city.lat, city.lng], { icon: cityIcon }).addTo(this.staticVectorGroup);
      });
    }
  }

  setBaseLayer(layerName) {
    // If selecting "static", disable raster tiles and show pure static vector map
    if (layerName === "static") {
      if (this.currentTileLayer) {
        this.map.removeLayer(this.currentTileLayer);
        this.currentTileLayer = null;
      }
      this.staticVectorGroup.addTo(this.map);
      document.getElementById(this.containerId).style.background = "#e0f2fe"; // Ocean blue background
      return;
    }

    // Switch between free tile providers
    if (this.baseLayers[layerName]) {
      this.map.removeLayer(this.staticVectorGroup);
      if (this.currentTileLayer) {
        this.map.removeLayer(this.currentTileLayer);
      }
      this.currentTileLayer = this.baseLayers[layerName];
      this.currentTileLayer.addTo(this.map);
    }
  }

  setData(facilities) {
    this.facilities = facilities;
    this.renderMarkers();
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this.renderMarkers();
  }

  setFilteredIds(activeIds) {
    const idSet = new Set(activeIds);
    this.markers.forEach((marker, id) => {
      const el = marker.getElement();
      if (!el) return;
      if (idSet.has(id)) {
        el.style.display = "block";
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      } else {
        el.style.display = "none";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    });
  }

  renderMarkers() {
    this.markerGroup.clearLayers();
    this.markers.clear();

    this.facilities.forEach(dc => {
      const rawMw = Math.max(2, dc.capacityMW || 10);
      const scale = Math.min(1.0, Math.pow(rawMw / 1300, 0.42));
      const buildingW = Math.round(26 + scale * 32);
      const buildingH = Math.round(22 + scale * 54);
      const slope = Math.round(buildingW * 0.28);
      const totalSvgW = buildingW + 48;
      const totalSvgH = buildingH + slope * 2 + 58;

      const svgHtml = generate3DBuildingSVG(dc, this.colorMode);

      const customIcon = L.divIcon({
        className: "leaflet-dc-3d-icon",
        html: svgHtml,
        iconSize: [totalSvgW, totalSvgH],
        iconAnchor: [totalSvgW / 2, totalSvgH - 24] // Exact ground anchor point
      });

      const marker = L.marker([dc.lat, dc.lng], {
        icon: customIcon,
        riseOnHover: true,
        zIndexOffset: Math.round(dc.capacityMW)
      });

      // Hover Tooltip
      const tier = getCapacityTier(dc.capacityMW);
      const isColo = dc.isColocation !== false && dc.colocation !== "No";
      const statusCfg = STATUS_CONFIG[dc.status] || STATUS_CONFIG["operational"];
      const mwText = dc.capacityMW >= 1000
        ? `${(dc.capacityMW / 1000).toFixed(1)} GW`
        : `${dc.capacityMW} MW`;

      const tooltipContent = `
        <div style="font-family: 'Google Sans', Roboto, sans-serif; padding: 4px 6px; min-width: 190px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${dc.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${dc.operator} • ${dc.cluster}</div>
          
          <div style="display: flex; gap: 5px; margin-top: 6px; flex-wrap: wrap;">
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isColo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.12)'}; color: ${isColo ? '#059669' : '#1e293b'}; border: 1px solid ${isColo ? 'rgba(16, 185, 129, 0.4)' : '#64748b'};">
              ${isColo ? '🔑 Ready for Rent (Colo)' : '🔒 Own Use (Private)'}
            </span>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${statusCfg.bg}; color: ${statusCfg.color}; border: 1px solid ${statusCfg.border};">
              ● ${statusCfg.label}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
            <span style="font-weight: 700; color: #0284c7; font-size: 12px;">⚡ ${mwText}</span>
            <span style="font-size: 10px; color: #64748b;">${dc.state}</span>
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -totalSvgH + 28],
        opacity: 0.98,
        className: "m3-leaflet-tooltip"
      });

      // Click Event
      marker.on("click", () => {
        this.selectFacility(dc);
      });

      marker.addTo(this.markerGroup);
      this.markers.set(dc.id, marker);
    });
  }

  drawFiberCorridors() {
    this.corridorGroup.clearLayers();
    if (!STRATEGIC_CORRIDORS) return;

    STRATEGIC_CORRIDORS.forEach(corridor => {
      const latlngs = [corridor.from, corridor.to];

      // 1. Outer ambient glow line (non-interactive to avoid event conflicts)
      const glowLine = L.polyline(latlngs, {
        color: "#38bdf8",
        weight: 6,
        opacity: 0.35,
        lineCap: "round",
        interactive: false
      }).addTo(this.corridorGroup);

      // 2. Animated dashed laser line (non-interactive so moving dashes never trigger mouseover/mouseout)
      const laserLine = L.polyline(latlngs, {
        color: "#0284c7",
        weight: 2.8,
        opacity: 0.9,
        dashArray: "6, 12",
        className: "animated-fiber-cable",
        interactive: false
      }).addTo(this.corridorGroup);

      // 3. Invisible continuous solid hit-testing line (stationary, solid, wide 18px hitbox - stops all flicker!)
      const hitLine = L.polyline(latlngs, {
        color: "#0284c7",
        weight: 18,
        opacity: 0.0001,
        interactive: true,
        className: "fiber-hitbox"
      }).addTo(this.corridorGroup);

      // Tooltip HTML with stable layout
      const tooltipContent = `
        <div style="font-family: 'Google Sans', Roboto, sans-serif; padding: 4px 6px; max-width: 330px;">
          <div style="font-weight: 700; font-size: 13px; color: #0284c7; margin-bottom: 2px;">⚡ ${corridor.name}</div>
          <div style="font-size: 11px; font-weight: 600; color: #0f172a; margin-bottom: 3px;">${corridor.speed}</div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.35;">${corridor.desc}</div>
        </div>
      `;

      hitLine.bindTooltip(tooltipContent, {
        sticky: true,
        direction: "top",
        offset: [0, -14],
        opacity: 0.98,
        className: "m3-leaflet-tooltip fiber-corridor-tooltip"
      });

      // Visual glow highlight when user hovers over the corridor
      hitLine.on("mouseover", () => {
        glowLine.setStyle({ weight: 10, opacity: 0.7, color: "#38bdf8" });
        laserLine.setStyle({ weight: 4, opacity: 1.0 });
      });

      hitLine.on("mouseout", () => {
        glowLine.setStyle({ weight: 6, opacity: 0.35, color: "#38bdf8" });
        laserLine.setStyle({ weight: 2.8, opacity: 0.9 });
      });
    });
  }

  selectFacility(dc) {
    if (!dc) return;
    this.map.flyTo([dc.lat, dc.lng], 12, {
      duration: 1.2,
      easeLinearity: 0.25
    });

    if (typeof this.options.onSelect === "function") {
      this.options.onSelect(dc);
    }
  }

  flyToPreset(presetKey) {
    this.activePreset = presetKey;
    if (presetKey === "malaysia") {
      this.map.flyTo([3.1, 102.2], 7, { duration: 1.2 });
    } else if (presetKey === "johor") {
      this.map.flyTo([1.56, 103.65], 10.8, { duration: 1.2 });
    } else if (presetKey === "kl") {
      this.map.flyTo([3.05, 101.65], 10.8, { duration: 1.2 });
    }
  }

  zoomIn() {
    this.map.zoomIn();
  }

  zoomOut() {
    this.map.zoomOut();
  }

  resetView() {
    this.flyToPreset("malaysia");
  }
}
