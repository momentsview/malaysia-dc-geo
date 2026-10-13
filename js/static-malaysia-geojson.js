/**
 * High-Precision Static Vector GeoJSON for Malaysia (English Edition)
 * Provides 100% offline, zero-network, zero-API-key static map of
 * Peninsular Malaysia, States, Major Cities, Highways, and Tech Parks.
 */

const MALAYSIA_STATIC_GEOJSON = {
  type: "FeatureCollection",
  features: [
    // 1. Peninsular Malaysia Mainland
    {
      type: "Feature",
      properties: { name: "Peninsular Malaysia", type: "country" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [100.18, 6.45], [100.22, 6.65], [100.50, 6.50], [101.00, 6.20],
          [102.15, 6.15], [102.50, 5.80], [103.15, 5.35], [103.45, 4.75],
          [103.48, 4.25], [103.35, 3.80], [103.45, 3.20], [103.60, 2.70],
          [104.05, 2.25], [104.15, 1.90], [104.28, 1.38], [104.05, 1.32],
          // Johor South Coast / Straits
          [103.78, 1.44], [103.62, 1.46], [103.52, 1.35], [103.45, 1.50],
          [103.20, 1.75], [102.90, 1.90], [102.50, 2.10], [102.15, 2.25],
          // Melaka & Selangor Coast
          [101.85, 2.45], [101.55, 2.70], [101.35, 2.95], [101.20, 3.30],
          [100.95, 3.70], [100.60, 4.15], [100.40, 4.80], [100.35, 5.30],
          [100.30, 5.75], [100.15, 6.25], [100.18, 6.45]
        ]]
      }
    },
    // 2. State: Johor
    {
      type: "Feature",
      properties: { name: "State of Johor", type: "state", code: "JHR" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [102.50, 2.10], [102.75, 2.45], [103.10, 2.65], [103.60, 2.70],
          [104.05, 2.25], [104.15, 1.90], [104.28, 1.38], [104.05, 1.32],
          [103.78, 1.44], [103.62, 1.46], [103.52, 1.35], [103.45, 1.50],
          [103.20, 1.75], [102.90, 1.90], [102.50, 2.10]
        ]]
      }
    },
    // 3. State: Selangor & Putrajaya
    {
      type: "Feature",
      properties: { name: "State of Selangor", type: "state", code: "SGR" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [101.20, 3.30], [101.35, 3.80], [101.65, 3.75], [101.90, 3.40],
          [101.95, 2.95], [101.80, 2.65], [101.55, 2.70], [101.35, 2.95],
          [101.20, 3.30]
        ]]
      }
    },
    // 4. Federal Territory: Kuala Lumpur
    {
      type: "Feature",
      properties: { name: "Federal Territory of Kuala Lumpur", type: "state", code: "KUL" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [101.62, 3.24], [101.76, 3.24], [101.77, 3.04], [101.63, 3.04], [101.62, 3.24]
        ]]
      }
    },
    // 5. Singapore Island
    {
      type: "Feature",
      properties: { name: "Singapore", type: "country", code: "SGP" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.75, 1.46], [103.95, 1.42], [104.02, 1.38], [103.98, 1.32],
          [103.82, 1.24], [103.65, 1.25], [103.62, 1.32], [103.70, 1.44], [103.75, 1.46]
        ]]
      }
    },
    // 6. Sedenak Tech Park & Kulai Zone
    {
      type: "Feature",
      properties: { name: "Sedenak Tech Park & Kulai Green DC Park", type: "tech_zone" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.48, 1.74], [103.58, 1.74], [103.58, 1.64], [103.48, 1.64], [103.48, 1.74]
        ]]
      }
    },
    // 7. Iskandar Puteri & Nusajaya Tech Park Zone
    {
      type: "Feature",
      properties: { name: "Iskandar Puteri / Nusajaya Tech Park", type: "tech_zone" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [103.55, 1.48], [103.68, 1.48], [103.68, 1.40], [103.55, 1.40], [103.55, 1.48]
        ]]
      }
    },
    // 8. Cyberjaya Digital District
    {
      type: "Feature",
      properties: { name: "Cyberjaya AI & Digital District", type: "tech_zone" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [101.62, 2.95], [101.68, 2.95], [101.68, 2.90], [101.62, 2.90], [101.62, 2.95]
        ]]
      }
    },
    // 9. North-South Expressway (E1/E2) Backbone
    {
      type: "Feature",
      properties: { name: "North-South Expressway (E2 Highway)", type: "highway" },
      geometry: {
        type: "LineString",
        coordinates: [
          [103.76, 1.48], [103.68, 1.55], [103.60, 1.66], [103.53, 1.70],
          [103.25, 1.95], [102.72, 2.28], [102.30, 2.45], [101.88, 2.70],
          [101.76, 2.92], [101.70, 3.05], [101.68, 3.15]
        ]
      }
    }
  ]
};

// Static City & Region Reference Labels
const MALAYSIA_STATIC_CITIES = [
  { name: "Kuala Lumpur", lat: 3.1478, lng: 101.6953, type: "capital" },
  { name: "Cyberjaya", lat: 2.9213, lng: 101.6559, type: "dc_hub" },
  { name: "Petaling Jaya", lat: 3.1073, lng: 101.6067, type: "major" },
  { name: "Johor Bahru", lat: 1.4927, lng: 103.7414, type: "dc_hub" },
  { name: "Iskandar Puteri", lat: 1.4286, lng: 103.6262, type: "dc_hub" },
  { name: "Kulai / Sedenak", lat: 1.6644, lng: 103.6015, type: "dc_hub" },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, type: "cross_border" }
];
