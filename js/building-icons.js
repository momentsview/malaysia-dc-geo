/**
 * 3D Isometric Building & Icon Generator for Leaflet 2D Map
 * Renders authentic, modern 3D architectural data center models
 * with realistic shading, server rack windows, HVAC cooling, and capacity/model badges.
 * 
 * Supports:
 * - Colocation (Ready for Rent): Dynamic Status Colors (Green, Cyan, Yellow, Purple) + Rental Key icon [🔑]
 * - Not for Colocation (Own Use / Private Hyperscale - Google, AWS, Microsoft): Stealth Matte Obsidian Black + Lock icon [🔒]
 */

function generate3DBuildingSVG(dc, colorMode = "status") {
  const isColo = dc.isColocation !== false && dc.colocation !== "No";
  const rawMw = Math.max(2, dc.capacityMW || 10);
  const tier = getCapacityTier(rawMw);
  const statusCfg = STATUS_CONFIG[dc.status] || STATUS_CONFIG["operational"];

  // Size scaling based on MW capacity
  // Small edge node (2.4MW) -> W:28px, H:24px
  // Mega campus (1200MW)   -> W:58px, H:76px
  const scale = Math.min(1.0, Math.pow(rawMw / 1300, 0.42));
  const buildingW = Math.round(26 + scale * 32);
  const buildingH = Math.round(22 + scale * 54);
  const slope = Math.round(buildingW * 0.28);

  const totalSvgW = buildingW + 54;
  const totalSvgH = buildingH + slope * 2 + 60;

  const cx = totalSvgW / 2;
  const cy = totalSvgH - 24;

  // Formatting MW label
  const mwLabel = rawMw >= 1000 ? `${(rawMw / 1000).toFixed(1)} GW` : `${rawMw} MW`;

  // Visual Theme Determination
  let themeColor = statusCfg.color;
  let textColor = "#ffffff";
  let wallLitStop1 = "#334155";
  let wallLitStop2 = "#1e293b";
  let wallDarkStop1 = "#1e293b";
  let wallDarkStop2 = "#090d16";
  let roofStop1 = "#64748b";
  let roofStop2 = "#334155";
  let auraOpacity = 0.55;
  let windowStroke = themeColor;
  let isBlackBuilding = !isColo;

  if (isBlackBuilding) {
    // ⬛ Not for Colocation (Own Use / Private: Google, AWS, Microsoft)
    // Stealth Matte Obsidian Black & Carbon Finish
    themeColor = "#71717a"; // Sleek metallic titanium
    textColor = "#f8fafc";
    wallLitStop1 = "#18181b"; // Deep matte carbon
    wallLitStop2 = "#09090b"; // Midnight obsidian
    wallDarkStop1 = "#09090b";
    wallDarkStop2 = "#020305"; // Pitch black
    roofStop1 = "#27272a"; // Graphite titanium roof
    roofStop2 = "#18181b";
    windowStroke = "#a1a1aa"; // Cool subtle white/slate server lights
    auraOpacity = 0.35;
  } else if (colorMode === "capacity") {
    themeColor = tier.color;
    textColor = tier.textColor;
    windowStroke = themeColor;
  } else {
    // 🏢 Colocation (Ready for Rent): Dynamic Status Colors
    // - Fully Operational: Green (#10b981)
    // - Operational + Expanding: Cyan/Teal (#06b6d4)
    // - Under Construction: Yellow (#eab308)
    // - Planned: Purple (#a855f7)
    themeColor = statusCfg.color;
    textColor = "#ffffff";
    windowStroke = themeColor;
  }

  // Number of server floor window lines
  const floors = Math.max(2, Math.min(9, Math.round(buildingH / 7)));

  // Left face points
  const pLB = `${cx - buildingW / 2},${cy - slope}`;
  const pCB = `${cx},${cy}`;
  const pCT = `${cx},${cy - buildingH}`;
  const pLT = `${cx - buildingW / 2},${cy - slope - buildingH}`;

  // Right face points
  const pRB = `${cx + buildingW / 2},${cy - slope}`;
  const pRT = `${cx + buildingW / 2},${cy - slope - buildingH}`;

  // Top roof points
  const pRoofBack = `${cx},${cy - slope * 2 - buildingH}`;

  // Window lines for left and right faces
  let leftWindows = "";
  let rightWindows = "";
  const floorH = buildingH / (floors + 1);

  for (let f = 1; f <= floors; f++) {
    const yOff = f * floorH;
    const lwY1 = cy - yOff;
    const lwX1 = cx - 3;
    const lwY2 = cy - slope - yOff;
    const lwX2 = cx - buildingW / 2 + 4;
    leftWindows += `<line x1="${lwX1}" y1="${lwY1}" x2="${lwX2}" y2="${lwY2}" stroke="${windowStroke}" stroke-width="1.8" stroke-linecap="round" opacity="${isBlackBuilding ? 0.45 : 0.85}"/>`;

    const rwY1 = cy - yOff;
    const rwX1 = cx + 3;
    const rwY2 = cy - slope - yOff;
    const rwX2 = cx + buildingW / 2 - 4;
    rightWindows += `<line x1="${rwX1}" y1="${rwY1}" x2="${rwX2}" y2="${rwY2}" stroke="${windowStroke}" stroke-width="1.8" stroke-linecap="round" opacity="${isBlackBuilding ? 0.3 : 0.6}"/>`;
  }

  // Multi-campus extra building if > 500MW
  let extraCampusBlock = "";
  if (rawMw >= 500) {
    const subW = Math.round(buildingW * 0.55);
    const subH = Math.round(buildingH * 0.65);
    const subCx = cx + buildingW * 0.42;
    const subCy = cy + 4;
    const subSlope = Math.round(subW * 0.28);

    extraCampusBlock = `
      <g opacity="0.9">
        <polygon points="${subCx - subW / 2},${subCy - subSlope} ${subCx},${subCy} ${subCx},${subCy - subH} ${subCx - subW / 2},${subCy - subSlope - subH}" 
          fill="${isBlackBuilding ? '#09090b' : '#1e293b'}" stroke="${themeColor}" stroke-width="1" />
        <polygon points="${subCx},${subCy} ${subCx + subW / 2},${subCy - subSlope} ${subCx + subW / 2},${subCy - subSlope - subH} ${subCx},${subCy - subH}" 
          fill="${isBlackBuilding ? '#020305' : '#0f172a'}" stroke="${themeColor}" stroke-width="1" />
        <polygon points="${subCx},${subCy - subH} ${subCx - subW / 2},${subCy - subSlope - subH} ${subCx},${subCy - subSlope * 2 - subH} ${subCx + subW / 2},${subCy - subSlope - subH}" 
          fill="${isBlackBuilding ? '#18181b' : '#334155'}" stroke="#ffffff" stroke-width="1" />
      </g>
    `;
  }

  // Rooftop Architecture & Badging
  let rooftopStructure = "";
  if (isBlackBuilding) {
    // Sleek security monolith + lock emblem for private enterprise campus
    rooftopStructure = `
      <polygon points="${cx},${cy - buildingH - slope * 0.5} ${cx - 5},${cy - buildingH - slope} ${cx},${cy - buildingH - slope * 1.5} ${cx + 5},${cy - buildingH - slope}" 
        fill="#09090b" stroke="#71717a" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy - buildingH - slope}" r="4" fill="#18181b" stroke="#a1a1aa" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy - buildingH - slope}" r="1.5" fill="#f8fafc"/>
    `;
  } else {
    // High-efficiency cooling units + glowing operational status beacon
    rooftopStructure = `
      <polygon points="${cx},${cy - buildingH - slope * 0.5} ${cx - 5},${cy - buildingH - slope} ${cx},${cy - buildingH - slope * 1.5} ${cx + 5},${cy - buildingH - slope}" 
        fill="${themeColor}" stroke="#ffffff" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy - buildingH - slope}" r="2.5" fill="#ffffff" class="beacon-blinker"/>
    `;
  }

  // Floating Badge Config
  const badgeY = cy - slope * 2 - buildingH - 18;
  const badgeIcon = isBlackBuilding ? "🔒" : "🔑";
  const badgeSubText = isBlackBuilding ? "Own" : "Rent";
  const badgeStroke = isBlackBuilding ? "#71717a" : themeColor;
  const badgeFill = isBlackBuilding ? "#09090b" : "#0f172a";
  const badgeWidth = isBlackBuilding ? 78 : 72;
  const badgeX = cx - badgeWidth / 2;

  return `
    <div class="dc-building-marker" data-id="${dc.id}">
      <svg width="${totalSvgW}" height="${totalSvgH}" viewBox="0 0 ${totalSvgW} ${totalSvgH}" class="building-svg">
        <defs>
          <!-- Ground Aura Glow Gradient -->
          <radialGradient id="aura-${dc.id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${isBlackBuilding ? '#38bdf8' : themeColor}" stop-opacity="${auraOpacity}"/>
            <stop offset="60%" stop-color="${isBlackBuilding ? '#0f172a' : themeColor}" stop-opacity="${auraOpacity * 0.3}"/>
            <stop offset="100%" stop-color="${themeColor}" stop-opacity="0"/>
          </radialGradient>

          <!-- Left Wall Lit Gradient -->
          <linearGradient id="wallLeft-${dc.id}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${wallLitStop1}"/>
            <stop offset="100%" stop-color="${wallLitStop2}"/>
          </linearGradient>

          <!-- Right Wall Shadow Gradient -->
          <linearGradient id="wallRight-${dc.id}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${wallDarkStop1}"/>
            <stop offset="100%" stop-color="${wallDarkStop2}"/>
          </linearGradient>

          <!-- Roof Gradient -->
          <linearGradient id="roofGrad-${dc.id}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${roofStop1}"/>
            <stop offset="100%" stop-color="${roofStop2}"/>
          </linearGradient>

          <!-- Filter Shadow -->
          <filter id="glow-${dc.id}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="${isBlackBuilding ? 'rgba(0,0,0,0.8)' : themeColor}" flood-opacity="0.6"/>
          </filter>
        </defs>

        <!-- 1. Ground Shadow & Animated Pulse Aura -->
        <ellipse cx="${cx}" cy="${cy}" rx="${buildingW * 0.9}" ry="${slope * 1.1}" fill="url(#aura-${dc.id})" class="animated-pulse-disc"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${buildingW * 0.55}" ry="${slope * 0.7}" fill="rgba(0,0,0,0.5)"/>

        <!-- Extra campus block if mega scale -->
        ${extraCampusBlock}

        <!-- 2. Main 3D Building Body -->
        <g filter="url(#glow-${dc.id})">
          <!-- Left Wall (Lit side) -->
          <polygon points="${pLB} ${pCB} ${pCT} ${pLT}" fill="url(#wallLeft-${dc.id})" stroke="${themeColor}" stroke-width="${isBlackBuilding ? 1.4 : 1.2}"/>
          ${leftWindows}

          <!-- Right Wall (Shaded side) -->
          <polygon points="${pCB} ${pRB} ${pRT} ${pCT}" fill="url(#wallRight-${dc.id})" stroke="${themeColor}" stroke-width="${isBlackBuilding ? 1.4 : 1.2}"/>
          ${rightWindows}

          <!-- 3. Top Roof (Cap) -->
          <polygon points="${pCT} ${pLT} ${pRoofBack} ${pRT}" fill="url(#roofGrad-${dc.id})" stroke="${isBlackBuilding ? '#71717a' : '#ffffff'}" stroke-width="1.3"/>

          <!-- 4. Roof Architecture (Cooling or Private Monolith) -->
          ${rooftopStructure}
        </g>

        <!-- 5. Floating Capacity & Business Model Badge -->
        <g class="floating-badge-group">
          <!-- Connector Pin -->
          <line x1="${cx}" y1="${cy - slope * 2 - buildingH}" x2="${cx}" y2="${badgeY + 14}" stroke="${badgeStroke}" stroke-width="1.5" stroke-dasharray="2,2"/>

          <!-- Badge Container -->
          <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="22" rx="11" 
            fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="1.6" filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.7))"/>
          
          <!-- Icon Symbol (🔑 for Colocation / Rent, 🔒 for Own Use) -->
          <text x="${badgeX + 7}" y="${badgeY + 15}" font-size="11">${badgeIcon}</text>
          
          <!-- MW Text -->
          <text x="${badgeX + 22}" y="${badgeY + 15}" fill="${textColor}" font-family="'Google Sans', Roboto, sans-serif" font-size="10" font-weight="700">
            ${mwLabel}
          </text>
        </g>
      </svg>
    </div>
  `;
}
