/**
 * Main Application Controller for Malaysia Data Centers 3D Geo (English Edition)
 * Features:
 * - English UI with Material Design 3 tokens
 * - Interactive Status Editor (Change Under Construction -> Operational in real time)
 * - Add New Data Center Dialog (Adds 3D building marker dynamically & persists)
 * - LocalStorage sync & Export updated dataset
 * - Multi-criteria search, filters, timeline playback, and Leaflet map sync
 */

class DataCenterApp {
  constructor() {
    // Dataset version identifier to sync with updated data.js
    const DATA_VERSION = "2026-10-13-v4";
    const savedVersion = localStorage.getItem("MALAYSIA_DC_DATA_VERSION");
    const saved = localStorage.getItem("MALAYSIA_DC_LOCAL_DATA");

    if (saved && savedVersion === DATA_VERSION) {
      try {
        this.allData = JSON.parse(saved);
      } catch (e) {
        this.allData = [...MALAYSIA_DC_DATA];
      }
    } else {
      this.allData = [...MALAYSIA_DC_DATA];
      try {
        localStorage.setItem("MALAYSIA_DC_DATA_VERSION", DATA_VERSION);
        localStorage.setItem("MALAYSIA_DC_LOCAL_DATA", JSON.stringify(this.allData));
      } catch (e) {}
    }

    // Ensure isColocation is defined on all records (handles migration)
    this.allData.forEach(dc => {
      if (typeof dc.isColocation === "undefined") {
        if (typeof dc.colocation === "string") {
          dc.isColocation = dc.colocation.trim().toLowerCase() === "yes";
        } else {
          const op = (dc.operator || "").toLowerCase();
          dc.isColocation = !(op.includes("google") || op.includes("aws") || op.includes("amazon") || op.includes("microsoft") || op.includes("azure"));
        }
      }
      if (!dc.colocation) {
        dc.colocation = dc.isColocation ? "Yes" : "No";
      }
      if (!dc.colocationLabel) {
        dc.colocationLabel = dc.isColocation ? "Ready for Rent (Colocation)" : "Own Use (Private Hyperscale)";
      }
    });

    this.filteredData = [...this.allData];
    this.selectedDC = null;

    // Filters state
    this.filters = {
      search: "",
      operator: "all",
      colocation: "all",
      state: "all",
      status: "all",
      tier: "all",
      yearMax: 2030
    };

    // Sort state: "mw-desc" | "mw-asc" | "name" | "year"
    this.currentSort = "mw-desc";

    // Main View Mode: "map" (Interactive Map) | "list" (Full-Screen Data Table)
    this.mainView = "map";

    // Table Sort State: { col: "capacity", dir: "desc" }
    this.tableSort = { col: "capacity", dir: "desc" };

    // Color mode: "status" (default with color-coded operational phases & stealth black for own-use) | "capacity"
    this.colorMode = "status";

    // Active Drawer Tab: "projects" | "analytics" | "milestones"
    this.activeTab = "projects";

    // Timeline playback state
    this.isPlayingTimeline = false;
    this.timelineInterval = null;

    // Theme Mode: "light" (Day View - Clean Material Light) | "dark" (Night View - Cyber Dark)
    this.theme = localStorage.getItem("MALAYSIA_DC_THEME") || "light";

    // Initialize 2D Real Map with 3D Building Markers
    this.map = new MalaysiaDataCenterMap("leaflet-map", {
      onSelect: (dc) => this.showDetailModal(dc)
    });
    this.map.setColorMode(this.colorMode);
    this.map.setData(this.allData);

    // Setup DOM and Event Listeners
    this.initDOM();
    this.setTheme(this.theme, false);
    this.initEvents();
    this.populateOperatorFilter();
    this.updateStatsCounters();
    this.renderProjectCards();
    this.renderAnalyticsTab();
    this.renderMilestonesTab();
    this.renderListView();
    this.updateLegendUI();
  }

  saveDataToStorage() {
    try {
      localStorage.setItem("MALAYSIA_DC_LOCAL_DATA", JSON.stringify(this.allData));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  showToast(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      toast.className = "m3-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg style="width: 20px; height: 20px; fill: var(--md-sys-color-primary);" viewBox="0 0 24 24">
        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
      </svg>
      <span>${message}</span>
    `;
    toast.classList.add("active");
    setTimeout(() => {
      toast.classList.remove("active");
    }, 3200);
  }

  initDOM() {
    this.sideDrawer = document.getElementById("side-drawer");
    this.detailModal = document.getElementById("detail-modal");
    this.drawerContent = document.getElementById("drawer-content");
    this.searchInput = document.getElementById("search-input");
    this.timelineSlider = document.getElementById("timeline-slider");
    this.timelineCurrentYearLabel = document.getElementById("timeline-current-year");
    this.timelineMilestoneText = document.getElementById("timeline-milestone-text");
    this.playTimelineBtn = document.getElementById("timeline-play-btn");
    this.basemapPickerMenu = document.getElementById("basemap-picker-menu");

    this.operatorFilter = document.getElementById("filter-operator");
    this.btnClearFilters = document.getElementById("btn-clear-filters");

    // Main View Mode Toggle & Layout Containers
    this.btnViewMap = document.getElementById("btn-view-map");
    this.btnViewList = document.getElementById("btn-view-list");
    this.listViewContainer = document.getElementById("list-view-container");
    this.leafletMapContainer = document.getElementById("leaflet-map");
    this.floatingMapControls = document.querySelector(".floating-map-controls");
    this.timelineBar = document.querySelector(".timeline-bar");
    this.openDrawerBtn = document.getElementById("open-drawer-btn");
    this.presetNavigation = document.querySelector(".preset-navigation");

    // List View Filter Controls
    this.listSearchInput = document.getElementById("list-search-input");
    this.listFilterOperator = document.getElementById("list-filter-operator");
    this.listFilterState = document.getElementById("list-filter-state");
    this.listFilterTier = document.getElementById("list-filter-tier");
    this.listSortSelect = document.getElementById("list-sort-select");
    this.btnListResetFilters = document.getElementById("btn-list-reset-filters");
    this.tableTbody = document.getElementById("table-tbody");
    this.tableEmptyState = document.getElementById("table-empty-state");

    // List View Summary Stats & Actions
    this.listSummaryCount = document.getElementById("list-summary-count");
    this.listSummaryCapacity = document.getElementById("list-summary-capacity");
    this.listSummaryOperational = document.getElementById("list-summary-operational");
    this.listSummaryPipeline = document.getElementById("list-summary-pipeline");
    this.btnListUploadCsv = document.getElementById("btn-list-upload-csv");
    this.btnListExportCsv = document.getElementById("btn-list-export-csv");
    this.btnListAddFacility = document.getElementById("btn-list-add-facility");

    // Theme Mode Toggle Buttons (Day vs Night View)
    this.btnThemeDay = document.getElementById("btn-theme-day");
    this.btnThemeNight = document.getElementById("btn-theme-night");
    this.btnListThemeDay = document.getElementById("btn-list-theme-day");
    this.btnListThemeNight = document.getElementById("btn-list-theme-night");

    // Dialog Elements
    this.editDialogBackdrop = document.getElementById("edit-status-dialog");
    this.addDialogBackdrop = document.getElementById("add-dc-dialog");
    this.importDialogBackdrop = document.getElementById("import-csv-dialog");
    this.importPreviewSummary = document.getElementById("import-preview-summary");
    this.csvFileInput = document.getElementById("csv-file-input");
    this.btnConfirmImport = document.getElementById("btn-confirm-import");
    this.btnCancelImport = document.getElementById("btn-cancel-import");
  }

  initEvents() {
    // 0. Main View Mode Toggle (Map vs List View)
    if (this.btnViewMap) {
      this.btnViewMap.addEventListener("click", () => this.setMainView("map"));
    }
    if (this.btnViewList) {
      this.btnViewList.addEventListener("click", () => this.setMainView("list"));
    }

    // 0b. Day / Night Theme Mode Toggle (☀️ Day vs 🌙 Night)
    if (this.btnThemeDay) {
      this.btnThemeDay.addEventListener("click", () => this.setTheme("light"));
    }
    if (this.btnThemeNight) {
      this.btnThemeNight.addEventListener("click", () => this.setTheme("dark"));
    }
    if (this.btnListThemeDay) {
      this.btnListThemeDay.addEventListener("click", () => this.setTheme("light"));
    }
    if (this.btnListThemeNight) {
      this.btnListThemeNight.addEventListener("click", () => this.setTheme("dark"));
    }

    // 1. Search Input (Drawer)
    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.filters.search = e.target.value.trim().toLowerCase();
        if (this.listSearchInput) this.listSearchInput.value = e.target.value;
        this.applyFilters();
      });
    }

    // 1b. Search Input (List View)
    if (this.listSearchInput) {
      this.listSearchInput.addEventListener("input", (e) => {
        this.filters.search = e.target.value.trim().toLowerCase();
        if (this.searchInput) this.searchInput.value = e.target.value;
        this.applyFilters();
      });
    }

    // 2. Company / Operator Select (Drawer)
    if (this.operatorFilter) {
      this.operatorFilter.addEventListener("change", (e) => {
        this.filters.operator = e.target.value;
        if (this.listFilterOperator) this.listFilterOperator.value = e.target.value;
        this.applyFilters();

        // If filtering by a specific operator, center map on their facilities
        if (this.filters.operator !== "all" && this.filteredData.length > 0) {
          if (this.filteredData.length === 1) {
            this.map.selectFacility(this.filteredData[0]);
          } else {
            const first = this.filteredData[0];
            this.map.map.flyTo([first.lat, first.lng], 10.5, { duration: 1.2 });
          }
        }
      });
    }

    // 2b. Company / Operator Select (List View)
    if (this.listFilterOperator) {
      this.listFilterOperator.addEventListener("change", (e) => {
        this.filters.operator = e.target.value;
        if (this.operatorFilter) this.operatorFilter.value = e.target.value;
        this.applyFilters();
      });
    }

    // 2c. State / Region Select (List View)
    if (this.listFilterState) {
      this.listFilterState.addEventListener("change", (e) => {
        this.filters.state = e.target.value;
        document.querySelectorAll(`.filter-chip[data-group="state"]`).forEach(c => {
          c.classList.toggle("active", c.dataset.val === e.target.value);
        });
        this.applyFilters();
      });
    }

    // 2d. Capacity Tier Select (List View)
    if (this.listFilterTier) {
      this.listFilterTier.addEventListener("change", (e) => {
        this.filters.tier = e.target.value;
        this.applyFilters();
      });
    }

    // 2e. Quick Sort Select (List View)
    if (this.listSortSelect) {
      this.listSortSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const [col, dir] = val.split("-");
        this.tableSort = { col, dir };
        this.renderListView();
      });
    }

    // 2f. Sortable Column Headers Click (List View Table)
    document.querySelectorAll(".sortable-th").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (this.tableSort.col === col) {
          this.tableSort.dir = this.tableSort.dir === "asc" ? "desc" : "asc";
        } else {
          this.tableSort.col = col;
          this.tableSort.dir = (col === "capacity" || col === "year") ? "desc" : "asc";
        }
        if (this.listSortSelect) {
          const matchOpt = Array.from(this.listSortSelect.options).find(o => o.value === `${this.tableSort.col}-${this.tableSort.dir}`);
          if (matchOpt) this.listSortSelect.value = matchOpt.value;
        }
        this.renderListView();
      });
    });

    // 3. Clear / Reset Filters Buttons
    if (this.btnClearFilters) {
      this.btnClearFilters.addEventListener("click", () => {
        this.resetFilters();
      });
    }
    if (this.btnListResetFilters) {
      this.btnListResetFilters.addEventListener("click", () => {
        this.resetFilters();
      });
    }

    // 3b. List View Toolbar Actions (Upload, Export, Add)
    if (this.btnListUploadCsv) {
      this.btnListUploadCsv.addEventListener("click", () => {
        if (this.csvFileInput) this.csvFileInput.click();
      });
    }
    if (this.btnListExportCsv) {
      this.btnListExportCsv.addEventListener("click", () => {
        this.exportCSV();
      });
    }
    if (this.btnListAddFacility) {
      this.btnListAddFacility.addEventListener("click", () => {
        this.showAddFacilityDialog();
      });
    }

    // 4. Filter Chips (Colocation, State, Status, Tier) - Shared across Drawer and List View
    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const group = chip.dataset.group;
        const val = chip.dataset.val;

        // Toggle active class across both views for consistency
        document.querySelectorAll(`.filter-chip[data-group="${group}"]`).forEach(c => {
          c.classList.toggle("active", c.dataset.val === val);
        });

        // Sync state dropdown if state chip clicked
        if (group === "state" && this.listFilterState) {
          this.listFilterState.value = val;
        }

        this.filters[group] = val;
        this.applyFilters();
      });
    });

    // 3. Tab Switching
    document.querySelectorAll(".drawer-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".drawer-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeTab = tab.dataset.tab;
        this.renderDrawerTabContent();
      });
    });

    // 4. Color Mode Toggle (Capacity vs Status)
    document.querySelectorAll(".color-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".color-mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.colorMode = btn.dataset.mode;
        this.map.setColorMode(this.colorMode);
        this.updateLegendUI();
      });
    });

    // 5. Preset Region Buttons
    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const presetKey = btn.dataset.preset;
        this.map.flyToPreset(presetKey);
      });
    });

    // 6. Floating Map Controls (FABs)
    const btnLayers = document.getElementById("fab-layers-toggle");
    if (btnLayers && this.basemapPickerMenu) {
      btnLayers.addEventListener("click", (e) => {
        e.stopPropagation();
        const isActive = this.basemapPickerMenu.classList.toggle("active");
        btnLayers.classList.toggle("active", isActive);
      });

      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        if (!this.basemapPickerMenu.contains(e.target) && e.target !== btnLayers) {
          this.basemapPickerMenu.classList.remove("active");
          btnLayers.classList.remove("active");
        }
      });
    }

    // Basemap Options Selection
    document.querySelectorAll(".basemap-opt-btn").forEach(opt => {
      opt.addEventListener("click", () => {
        document.querySelectorAll(".basemap-opt-btn").forEach(b => b.classList.remove("active"));
        opt.classList.add("active");
        const layer = opt.dataset.layer;
        this.map.setBaseLayer(layer);
        this.basemapPickerMenu.classList.remove("active");
        btnLayers.classList.remove("active");
      });
    });

    const btnResetView = document.getElementById("fab-reset-north");
    if (btnResetView) {
      btnResetView.addEventListener("click", () => {
        this.map.resetView();
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        document.querySelector('.preset-btn[data-preset="malaysia"]')?.classList.add("active");
      });
    }

    const btnZoomIn = document.getElementById("fab-zoom-in");
    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => {
        this.map.zoomIn();
      });
    }

    const btnZoomOut = document.getElementById("fab-zoom-out");
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => {
        this.map.zoomOut();
      });
    }

    // 7. Drawer Collapse / Open
    const closeDrawerBtn = document.getElementById("close-drawer-btn");
    const openDrawerBtn = document.getElementById("open-drawer-btn");
    if (closeDrawerBtn && openDrawerBtn) {
      closeDrawerBtn.addEventListener("click", () => {
        this.sideDrawer.classList.add("collapsed");
        openDrawerBtn.style.display = "flex";
      });
      openDrawerBtn.addEventListener("click", () => {
        this.sideDrawer.classList.remove("collapsed");
        openDrawerBtn.style.display = "none";
      });
    }

    // 8. Detail Modal Close
    const closeDetailBtn = document.getElementById("close-detail-btn");
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener("click", () => {
        this.detailModal.classList.remove("active");
        document.querySelectorAll(".dc-building-marker.selected").forEach(el => el.classList.remove("selected"));
        this.selectedDC = null;
      });
    }

    // 9. Timeline Slider & Play/Pause
    if (this.timelineSlider) {
      this.timelineSlider.addEventListener("input", (e) => {
        this.filters.yearMax = parseInt(e.target.value, 10);
        this.updateTimelineUI();
        this.applyFilters();
      });
    }

    if (this.playTimelineBtn) {
      this.playTimelineBtn.addEventListener("click", () => {
        this.toggleTimelinePlay();
      });
    }

    // 10. Export Data Button
    const exportBtn = document.getElementById("btn-export-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportCSV());
    }

    // 11. Add New Data Center Dialog Triggers
    const btnOpenAdd = document.getElementById("btn-open-add-dialog");
    const btnCancelAdd = document.getElementById("btn-cancel-add");
    const formAdd = document.getElementById("form-add-dc");

    if (btnOpenAdd && this.addDialogBackdrop) {
      btnOpenAdd.addEventListener("click", () => {
        this.addDialogBackdrop.classList.add("active");
      });
    }

    if (btnCancelAdd && this.addDialogBackdrop) {
      btnCancelAdd.addEventListener("click", () => {
        this.addDialogBackdrop.classList.remove("active");
      });
    }

    if (formAdd) {
      formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAddNewDC(formAdd);
      });
    }

    // 12. Edit Facility Status Dialog Triggers
    const btnOpenEdit = document.getElementById("btn-modal-edit-status");
    const btnCancelEdit = document.getElementById("btn-cancel-edit");
    const formEdit = document.getElementById("form-edit-status");

    if (btnOpenEdit && this.editDialogBackdrop) {
      btnOpenEdit.addEventListener("click", () => {
        if (!this.selectedDC) return;
        this.populateEditForm(this.selectedDC);
        this.editDialogBackdrop.classList.add("active");
      });
    }

    if (btnCancelEdit && this.editDialogBackdrop) {
      btnCancelEdit.addEventListener("click", () => {
        this.editDialogBackdrop.classList.remove("active");
      });
    }

    if (formEdit) {
      formEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveEditStatus(formEdit);
      });
    }

    // 13. Reset Database to Default button
    const btnResetData = document.getElementById("btn-reset-database");
    if (btnResetData) {
      btnResetData.addEventListener("click", () => {
        if (confirm("Reset all data center modifications back to default?")) {
          localStorage.removeItem("MALAYSIA_DC_LOCAL_DATA");
          this.allData = [...MALAYSIA_DC_DATA];
          this.map.setData(this.allData);
          this.applyFilters();
        }
      });
    }

    // 14. CSV File Upload and Bulk Import Triggers
    const btnUploadCSV = document.getElementById("btn-upload-csv");
    const btnDrawerUploadCSV = document.getElementById("btn-drawer-upload-csv");

    if (btnUploadCSV && this.csvFileInput) {
      btnUploadCSV.addEventListener("click", () => {
        this.csvFileInput.click();
      });
    }

    if (btnDrawerUploadCSV && this.csvFileInput) {
      btnDrawerUploadCSV.addEventListener("click", () => {
        this.csvFileInput.click();
      });
    }

    if (this.csvFileInput) {
      this.csvFileInput.addEventListener("change", (e) => {
        this.handleCSVFileSelected(e);
      });
    }

    if (this.btnCancelImport && this.importDialogBackdrop) {
      this.btnCancelImport.addEventListener("click", () => {
        this.importDialogBackdrop.classList.remove("active");
        if (this.csvFileInput) this.csvFileInput.value = "";
      });
    }

    if (this.btnConfirmImport) {
      this.btnConfirmImport.addEventListener("click", () => {
        this.applyCSVImport();
      });
    }
  }

  handleAddNewDC(form) {
    const name = form.dc_name.value.trim();
    const operator = form.dc_operator.value.trim();
    const state = form.dc_state.value;
    const cluster = form.dc_cluster.value.trim() || state;
    const capacityMW = parseFloat(form.dc_capacity.value) || 50;
    const operationalMW = parseFloat(form.dc_operational.value) || 0;
    const pipelineMW = Math.max(0, capacityMW - operationalMW);
    const status = form.dc_status.value;
    const lat = parseFloat(form.dc_lat.value) || (state === "Johor" ? 1.48 : 2.92);
    const lng = parseFloat(form.dc_lng.value) || (state === "Johor" ? 103.65 : 101.65);
    const power = form.dc_power.value.trim() || "Dedicated High-Voltage Substation";
    const cooling = form.dc_cooling.value.trim() || "Advanced Liquid Cooling Ready";
    const tier = form.dc_tier.value.trim() || "Hyperscale AI-Ready";

    const statusLabelMap = {
      "operational": "Operational",
      "operational-expansion": "Operational + Expanding",
      "under-construction": "Under Construction",
      "planned": "Planned / Announced"
    };

    const newDC = {
      id: `dc-${Date.now()}`,
      name: name,
      operator: operator,
      state: state,
      cluster: cluster,
      status: status,
      statusLabel: statusLabelMap[status] || "Operational",
      location: `${cluster}, ${state}`,
      lat: lat,
      lng: lng,
      capacityMW: capacityMW,
      operationalMW: operationalMW,
      pipelineMW: pipelineMW,
      capacityDisplay: `${capacityMW} MW IT`,
      timeline: `Commissioning targeted for ${new Date().getFullYear() + 1}`,
      year: new Date().getFullYear(),
      powerGrid: power,
      cooling: cooling,
      pue: "Design PUE <1.25",
      greenEnergy: "Green Power Target",
      tier: tier,
      connectivity: "Carrier-Neutral Low-Latency Hub",
      landDeveloper: `${cluster} Industrial Park`,
      clients: "Global Hyperscalers",
      notes: "Newly added data center facility entry.",
      isColocation: form.dc_colocation ? (form.dc_colocation.value === "Yes") : true,
      colocation: form.dc_colocation ? form.dc_colocation.value : "Yes",
      colocationLabel: (form.dc_colocation && form.dc_colocation.value === "No") ? "Own Use (Private Hyperscale)" : "Ready for Rent (Colocation)",
      category: capacityMW >= 500 ? "mega-scale" : (capacityMW >= 200 ? "ultra-hyperscale" : "hyperscale"),
      tags: ["New Entry", power, cooling]
    };

    this.allData.unshift(newDC);
    this.saveDataToStorage();

    // Refresh operator options, map, and UI
    this.populateOperatorFilter();
    this.map.setData(this.allData);
    this.applyFilters();
    this.addDialogBackdrop.classList.remove("active");
    form.reset();

    // Fly to new data center and select it
    this.map.selectFacility(newDC);
    this.showDetailModal(newDC);
    this.showToast(`Added '${newDC.name}' (${newDC.capacityMW} MW) successfully!`);
  }

  populateEditForm(dc) {
    const form = document.getElementById("form-edit-status");
    if (!form) return;

    form.edit_name.value = dc.name;
    form.edit_status.value = dc.status;
    if (form.edit_colocation) {
      form.edit_colocation.value = (dc.isColocation !== false && dc.colocation !== "No") ? "Yes" : "No";
    }
    form.edit_capacity.value = dc.capacityMW;
    form.edit_operational.value = dc.operationalMW || 0;
    form.edit_timeline.value = dc.timeline || "";
  }

  handleSaveEditStatus(form) {
    if (!this.selectedDC) return;

    const newStatus = form.edit_status.value;
    const capacityMW = parseFloat(form.edit_capacity.value) || this.selectedDC.capacityMW;
    const operationalMW = parseFloat(form.edit_operational.value) || 0;
    const pipelineMW = Math.max(0, capacityMW - operationalMW);
    const timeline = form.edit_timeline.value.trim() || this.selectedDC.timeline;

    const statusLabelMap = {
      "operational": "Fully Operational",
      "operational-expansion": "Operational + Expanding",
      "under-construction": "Under Construction",
      "planned": "Planned / Concept"
    };

    // Update in data array
    this.selectedDC.status = newStatus;
    this.selectedDC.statusLabel = statusLabelMap[newStatus] || "Fully Operational";
    this.selectedDC.capacityMW = capacityMW;
    this.selectedDC.operationalMW = operationalMW;
    this.selectedDC.pipelineMW = pipelineMW;
    this.selectedDC.timeline = timeline;

    if (form.edit_colocation) {
      const isColo = form.edit_colocation.value === "Yes";
      this.selectedDC.isColocation = isColo;
      this.selectedDC.colocation = isColo ? "Yes" : "No";
      this.selectedDC.colocationLabel = isColo ? "Ready for Rent (Colocation)" : "Own Use (Private Hyperscale)";
    }

    this.saveDataToStorage();

    // Update map markers and UI
    this.map.setData(this.allData);
    this.applyFilters();
    this.showDetailModal(this.selectedDC);
    this.editDialogBackdrop.classList.remove("active");

    this.showToast(`Updated '${this.selectedDC.name}' status to ${this.selectedDC.statusLabel}!`);
  }

  populateOperatorFilter() {
    if (!this.operatorFilter) return;

    const currentVal = this.filters.operator || "all";
    const opMap = new Map();
    this.allData.forEach(dc => {
      const op = dc.operator ? dc.operator.trim() : "Other";
      opMap.set(op, (opMap.get(op) || 0) + 1);
    });

    const sortedOps = Array.from(opMap.keys()).sort((a, b) => a.localeCompare(b));

    let html = `<option value="all">🏢 All Companies (${this.allData.length} facilities)</option>`;
    sortedOps.forEach(op => {
      const isSelected = op.toLowerCase() === currentVal.toLowerCase() ? "selected" : "";
      html += `<option value="${op}" ${isSelected}>${op} (${opMap.get(op)})</option>`;
    });

    this.operatorFilter.innerHTML = html;

    if (this.listFilterOperator) {
      let listHtml = `<option value="all">🏢 All Companies (${this.allData.length})</option>`;
      sortedOps.forEach(op => {
        const isSelected = op.toLowerCase() === currentVal.toLowerCase() ? "selected" : "";
        listHtml += `<option value="${op}" ${isSelected}>${op} (${opMap.get(op)})</option>`;
      });
      this.listFilterOperator.innerHTML = listHtml;
    }
  }

  resetFilters() {
    this.filters.search = "";
    this.filters.operator = "all";
    this.filters.colocation = "all";
    this.filters.state = "all";
    this.filters.status = "all";
    this.filters.tier = "all";
    this.filters.yearMax = 2030;

    if (this.searchInput) this.searchInput.value = "";
    if (this.operatorFilter) this.operatorFilter.value = "all";
    if (this.listSearchInput) this.listSearchInput.value = "";
    if (this.listFilterOperator) this.listFilterOperator.value = "all";
    if (this.listFilterState) this.listFilterState.value = "all";
    if (this.listFilterTier) this.listFilterTier.value = "all";

    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.val === "all");
    });

    this.applyFilters();
    this.map.resetView();
    this.showToast("Reset all filters to view all facilities");
  }

  applyFilters() {
    const { search, operator, colocation, state, status, tier, yearMax } = this.filters;

    this.filteredData = this.allData.filter(dc => {
      // 1. Search Query
      if (search) {
        const queryMatches =
          dc.name.toLowerCase().includes(search) ||
          dc.operator.toLowerCase().includes(search) ||
          dc.location.toLowerCase().includes(search) ||
          (dc.tags && dc.tags.some(t => t.toLowerCase().includes(search)));
        if (!queryMatches) return false;
      }

      // 2. Company / Operator filter (e.g. DayOne, YTL, AirTrunk, Google, etc.)
      if (operator && operator !== "all") {
        if (dc.operator.toLowerCase().trim() !== operator.toLowerCase().trim()) {
          return false;
        }
      }

      // 3. Colocation Purpose / Business Model filter (Ready for Rent vs Own Use)
      if (colocation && colocation !== "all") {
        const isColo = dc.isColocation !== false && dc.colocation !== "No";
        if (colocation === "yes" && !isColo) return false;
        if (colocation === "no" && isColo) return false;
      }

      // 4. State filter
      if (state !== "all") {
        if (state === "Johor" && dc.state !== "Johor") return false;
        if (state === "Selangor" && dc.state !== "Selangor") return false;
        if (state === "Kuala Lumpur" && dc.state !== "Kuala Lumpur" && dc.state !== "Greater Kuala Lumpur") return false;
      }

      // 5. Operational Status filter
      if (status !== "all") {
        if (dc.status !== status) return false;
      }

      // 6. Capacity Tier filter
      if (tier !== "all") {
        const dcTier = getCapacityTier(dc.capacityMW);
        if (dcTier.id !== tier) return false;
      }

      // 7. Timeline Year filter
      if (dc.year && dc.year > yearMax) {
        return false;
      }

      return true;
    });

    // Update 3D Building Markers Visibility on 2D Map
    const activeIds = this.filteredData.map(dc => dc.id);
    this.map.setFilteredIds(activeIds);

    // Toggle Clear Filters button
    const isFiltered = search !== "" || operator !== "all" || colocation !== "all" || state !== "all" || status !== "all" || tier !== "all";
    if (this.btnClearFilters) {
      this.btnClearFilters.style.display = isFiltered ? "inline" : "none";
    }

    // Update Project List & KPI Counters & Data Table
    this.updateStatsCounters();
    this.renderDrawerTabContent();
    this.renderListView();
  }

  updateStatsCounters() {
    let totalMW = 0;
    let operationalMW = 0;
    let pipelineMW = 0;

    this.filteredData.forEach(dc => {
      totalMW += (dc.capacityMW || 0);
      operationalMW += (dc.operationalMW || 0);
      pipelineMW += (dc.pipelineMW || (dc.capacityMW - (dc.operationalMW || 0)));
    });

    this.animateNumber("kpi-total-mw", totalMW);
    this.animateNumber("kpi-operational-mw", operationalMW);
    this.animateNumber("kpi-pipeline-mw", pipelineMW);
    this.animateNumber("kpi-count", this.filteredData.length);
  }

  animateNumber(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const start = parseInt(el.innerText.replace(/,/g, ""), 10) || 0;
    const duration = 500;
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (targetValue - start) * eased);
      el.innerText = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }

  renderDrawerTabContent() {
    if (this.activeTab === "projects") {
      this.renderProjectCards();
    } else if (this.activeTab === "analytics") {
      this.renderAnalyticsTab();
    } else if (this.activeTab === "milestones") {
      this.renderMilestonesTab();
    }
  }

  renderProjectCards() {
    if (!this.drawerContent) return;

    if (this.filteredData.length === 0) {
      this.drawerContent.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--md-sys-color-on-surface-variant);">
          <svg style="width: 42px; height: 42px; fill: currentColor; margin-bottom: 8px;" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <p style="font-weight: 600; font-size: 14px;">No matching data centers</p>
          <p style="font-size: 12px; margin-top: 4px;">Try resetting filter chips or adjusting search keywords</p>
        </div>
      `;
      return;
    }

    // Sort data
    const sorted = [...this.filteredData].sort((a, b) => {
      if (this.currentSort === "mw-desc") return b.capacityMW - a.capacityMW;
      if (this.currentSort === "mw-asc") return a.capacityMW - b.capacityMW;
      if (this.currentSort === "year") return a.year - b.year;
      return a.name.localeCompare(b.name);
    });

    // Default view mode: "cards" (detailed cards) or "compact" (sleek list)
    if (!this.viewMode) {
      this.viewMode = "cards";
    }

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 11px; color: var(--md-sys-color-on-surface-variant); flex-wrap: wrap; gap: 6px;">
        <span style="font-weight: 600;">Showing ${sorted.length} facilities</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="view-mode-toggle">
            <button class="view-mode-btn ${this.viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Detailed Cards View">📋 Cards</button>
            <button class="view-mode-btn ${this.viewMode === 'compact' ? 'active' : ''}" data-view="compact" title="Compact List View">☰ Compact</button>
          </div>
          <select id="sort-select" style="background: var(--md-sys-color-surface-container); color: #fff; border: 1px solid var(--md-sys-color-outline); border-radius: 6px; padding: 3px 6px; font-size: 11px; outline: none; cursor: pointer;">
            <option value="mw-desc" ${this.currentSort === "mw-desc" ? "selected" : ""}>Capacity (High to Low)</option>
            <option value="mw-asc" ${this.currentSort === "mw-asc" ? "selected" : ""}>Capacity (Low to High)</option>
            <option value="year" ${this.currentSort === "year" ? "selected" : ""}>Timeline Year</option>
            <option value="name" ${this.currentSort === "name" ? "selected" : ""}>Facility Name (A-Z)</option>
          </select>
        </div>
      </div>
    `;

    sorted.forEach(dc => {
      const tier = getCapacityTier(dc.capacityMW);
      const isSelected = this.selectedDC && this.selectedDC.id === dc.id;
      const statusCfg = STATUS_CONFIG[dc.status] || STATUS_CONFIG["operational"];

      const mwText = dc.capacityMW >= 1000
        ? `${(dc.capacityMW / 1000).toFixed(1)} GW`
        : `${dc.capacityMW} MW`;

      const progressPct = Math.min(100, Math.round((dc.capacityMW / 1300) * 100));

      const isColo = dc.isColocation !== false && dc.colocation !== "No";
      const modelBadgeHtml = isColo
        ? `<span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">🔑 Ready for Rent (Colo)</span>`
        : `<span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #09090b; color: #e2e8f0; border: 1px solid #71717a;">🔒 Own Use (Private)</span>`;

      if (this.viewMode === "compact") {
        html += `
          <div class="dc-card compact-mode ${isSelected ? 'selected' : ''}" data-id="${dc.id}">
            <div class="dc-card-header">
              <div style="flex: 1; min-width: 0; padding-right: 8px;">
                <div class="dc-name" title="${dc.name}">${dc.name}</div>
                <div class="dc-operator" style="margin-top: 2px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                  <span style="color: ${statusCfg.color}; font-weight: 700;">● ${statusCfg.label}</span>
                  <span style="opacity: 0.4;">•</span>
                  <span>${dc.operator}</span>
                  ${isColo ? '<span style="color: #34d399; font-size: 10px; font-weight: 600;">[Colo]</span>' : '<span style="color: #94a3b8; font-size: 10px; font-weight: 600;">[Private]</span>'}
                </div>
              </div>
              <div class="dc-mw-badge" style="background: ${tier.badgeBg}; color: ${tier.textColor}; border: 1px solid ${tier.color};">
                ⚡ ${mwText}
              </div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="dc-card ${isSelected ? 'selected' : ''}" data-id="${dc.id}">
            <div class="dc-card-header">
              <div style="flex: 1; min-width: 0; padding-right: 8px;">
                <div class="dc-name">${dc.name}</div>
                <div class="dc-operator">${dc.operator} • ${dc.state}</div>
              </div>
              <div class="dc-mw-badge" style="background: ${tier.badgeBg}; color: ${tier.textColor}; border: 1px solid ${tier.color};">
                ⚡ ${mwText}
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-top: 6px; flex-wrap: wrap; gap: 4px;">
              ${modelBadgeHtml}
              <span style="color: ${statusCfg.color}; font-weight: 600;">● ${statusCfg.label}</span>
            </div>

            <div class="capacity-progress-bar">
              <div class="capacity-progress-fill" style="width: ${progressPct}%; background: linear-gradient(90deg, ${tier.color}, #ffffff);"></div>
            </div>

            <div class="dc-card-meta">
              ${dc.tags ? dc.tags.slice(0, 3).map(t => `<span class="dc-meta-tag">${t}</span>`).join('') : ''}
            </div>
          </div>
        `;
      }
    });

    this.drawerContent.innerHTML = html;

    // Attach card click handlers
    this.drawerContent.querySelectorAll(".dc-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const dc = this.allData.find(item => item.id === id);
        if (dc) {
          this.map.selectFacility(dc);
          this.showDetailModal(dc);
        }
      });
    });

    // Attach sort select handler
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.currentSort = e.target.value;
        this.renderProjectCards();
      });
    }

    // Attach view mode toggle buttons
    this.drawerContent.querySelectorAll(".view-mode-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.viewMode = btn.dataset.view;
        this.renderProjectCards();
      });
    });
  }

  setMainView(view) {
    this.mainView = view;

    if (this.btnViewMap) this.btnViewMap.classList.toggle("active", view === "map");
    if (this.btnViewList) this.btnViewList.classList.toggle("active", view === "list");

    if (view === "list") {
      if (this.listViewContainer) this.listViewContainer.style.display = "flex";
      if (this.leafletMapContainer) this.leafletMapContainer.style.display = "none";
      if (this.sideDrawer) this.sideDrawer.style.display = "none";
      if (this.openDrawerBtn) this.openDrawerBtn.style.display = "none";
      if (this.floatingMapControls) this.floatingMapControls.style.display = "none";
      if (this.timelineBar) this.timelineBar.style.display = "none";
      if (this.presetNavigation) this.presetNavigation.style.display = "none";

      this.renderListView();
    } else {
      if (this.listViewContainer) this.listViewContainer.style.display = "none";
      if (this.leafletMapContainer) this.leafletMapContainer.style.display = "block";
      if (this.sideDrawer && !this.sideDrawer.classList.contains("collapsed")) {
        this.sideDrawer.style.display = "flex";
      } else if (this.openDrawerBtn) {
        this.openDrawerBtn.style.display = "flex";
      }
      if (this.floatingMapControls) this.floatingMapControls.style.display = "flex";
      if (this.timelineBar) this.timelineBar.style.display = "flex";
      if (this.presetNavigation) this.presetNavigation.style.display = "flex";

      // Invalidate Leaflet map size after displaying
      setTimeout(() => {
        if (this.map && this.map.map) {
          this.map.map.invalidateSize();
        }
      }, 80);

      this.renderDrawerTabContent();
    }
  }

  setTheme(theme, save = true) {
    this.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);

    const isLight = theme === "light";
    if (this.btnThemeDay) this.btnThemeDay.classList.toggle("active", isLight);
    if (this.btnThemeNight) this.btnThemeNight.classList.toggle("active", !isLight);
    if (this.btnListThemeDay) this.btnListThemeDay.classList.toggle("active", isLight);
    if (this.btnListThemeNight) this.btnListThemeNight.classList.toggle("active", !isLight);

    if (save) {
      try {
        localStorage.setItem("MALAYSIA_DC_THEME", theme);
      } catch (e) {
        console.warn("Could not save theme preference:", e);
      }
      this.showToast(isLight ? "☀️ Day View (Material Light) Activated" : "🌙 Night View (Cyber Dark) Activated");
    }

    // Refresh list view to ensure proper styling
    if (this.mainView === "list") {
      this.renderListView();
    }
  }

  renderListView() {
    if (!this.tableTbody) return;

    // 1. Sort filteredData
    const { col, dir } = this.tableSort;
    const sorted = [...this.filteredData].sort((a, b) => {
      let comparison = 0;
      if (col === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (col === "operator") {
        comparison = a.operator.localeCompare(b.operator);
      } else if (col === "status") {
        comparison = (a.status || "").localeCompare(b.status || "");
      } else if (col === "colocation") {
        const aColo = a.isColocation !== false && a.colocation !== "No" ? "Colo" : "Private";
        const bColo = b.isColocation !== false && b.colocation !== "No" ? "Colo" : "Private";
        comparison = aColo.localeCompare(bColo);
      } else if (col === "capacity") {
        comparison = (a.capacityMW || 0) - (b.capacityMW || 0);
      } else if (col === "state") {
        comparison = (a.state || "").localeCompare(b.state || "");
      } else if (col === "year") {
        comparison = (a.year || 0) - (b.year || 0);
      }
      return dir === "asc" ? comparison : -comparison;
    });

    // 2. Update Table Headers sort icons & active state
    document.querySelectorAll(".sortable-th").forEach(th => {
      const thCol = th.dataset.col;
      const icon = th.querySelector(".sort-icon");
      if (thCol === col) {
        th.classList.add("sort-active");
        if (icon) icon.innerText = dir === "asc" ? "▲" : "▼";
      } else {
        th.classList.remove("sort-active");
        if (icon) icon.innerText = "↕";
      }
    });

    // 3. Update Summary Stats
    if (this.listSummaryCount) {
      this.listSummaryCount.innerText = `Showing ${sorted.length} of ${this.allData.length} facilities`;
    }
    let totalCap = 0, operationalCap = 0, pipelineCap = 0;
    sorted.forEach(dc => {
      totalCap += dc.capacityMW || 0;
      operationalCap += dc.operationalMW || (dc.status === "operational" ? dc.capacityMW : 0);
      pipelineCap += dc.pipelineMW || (dc.status !== "operational" ? dc.capacityMW : 0);
    });
    if (this.listSummaryCapacity) this.listSummaryCapacity.innerHTML = `⚡ Total: <strong>${totalCap.toLocaleString()} MW</strong>`;
    if (this.listSummaryOperational) this.listSummaryOperational.innerHTML = `🟢 Operational: <strong>${operationalCap.toLocaleString()} MW</strong>`;
    if (this.listSummaryPipeline) this.listSummaryPipeline.innerHTML = `🟡 Pipeline: <strong>${pipelineCap.toLocaleString()} MW</strong>`;

    // 4. Render Table Rows or Empty State
    if (sorted.length === 0) {
      this.tableTbody.innerHTML = "";
      if (this.tableEmptyState) this.tableEmptyState.style.display = "block";
      return;
    }

    if (this.tableEmptyState) this.tableEmptyState.style.display = "none";

    let html = "";
    sorted.forEach(dc => {
      const tier = getCapacityTier(dc.capacityMW);
      const statusCfg = STATUS_CONFIG[dc.status] || STATUS_CONFIG["operational"];
      const mwText = dc.capacityMW >= 1000
        ? `${(dc.capacityMW / 1000).toFixed(1)} GW`
        : `${dc.capacityMW} MW`;

      const progressPct = Math.min(100, Math.round((dc.capacityMW / 1300) * 100));
      const isColo = dc.isColocation !== false && dc.colocation !== "No";

      const statusBadge = `
        <span class="table-status-pill status-${dc.status}" style="background: ${statusCfg.color}22; color: ${statusCfg.color}; border: 1px solid ${statusCfg.color}55;">
          ● ${statusCfg.label}
        </span>
      `;

      const coloBadge = isColo
        ? `<span class="table-colo-pill colo-yes">🔑 Ready for Rent (Colo)</span>`
        : `<span class="table-colo-pill colo-no">🔒 Own Use (Private)</span>`;

      const iconBg = statusCfg.color || "#0284c7";

      html += `
        <tr data-id="${dc.id}">
          <td>
            <div class="table-facility-cell">
              <div class="table-facility-icon" style="background: linear-gradient(135deg, ${iconBg}33, #0f172a); border-color: ${iconBg};">
                <svg style="width: 18px; height: 18px; fill: ${iconBg};" viewBox="0 0 24 24">
                  <path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 2.84L18.16 11H17v7H7v-7H5.84L12 5.84z"/>
                </svg>
              </div>
              <div class="table-facility-info">
                <div class="table-facility-name">${dc.name}</div>
                <div class="table-facility-operator">${dc.operator} • <span style="opacity: 0.85;">${dc.cluster || dc.state}</span></div>
              </div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td>${coloBadge}</td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 110px;">
              <span class="dc-mw-badge" style="background: ${tier.badgeBg}; color: ${tier.textColor}; border: 1px solid ${tier.color};">
                ⚡ ${mwText}
              </span>
              <div class="table-progress-bar-track">
                <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, ${tier.color}, #ffffff);"></div>
              </div>
              <span style="font-size: 10px; color: var(--md-sys-color-on-surface-variant); font-feature-settings: 'tnum';">
                ${dc.operationalMW > 0 ? `${dc.operationalMW}MW live` : ''}${dc.pipelineMW > 0 ? ` • ${dc.pipelineMW}MW dev` : ''}
              </span>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span class="table-facility-name" style="font-size: 12px;">${dc.state}</span>
              <span style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${dc.address || dc.location || dc.cluster}">📍 ${dc.address || dc.location || dc.cluster}</span>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
              <span style="color: var(--md-sys-color-primary); font-weight: 600;">${dc.cooling || 'Standard CRAC / CRAH'}</span>
              <span style="color: var(--md-sys-color-on-surface-variant);">${dc.powerGrid || 'Redundant High-Voltage'}</span>
            </div>
          </td>
          <td>
            <span class="table-year-badge">
              ${dc.year || '2026+'}
            </span>
          </td>
          <td>
            <div class="table-action-btns">
              <button class="table-btn table-btn-primary btn-table-map" data-id="${dc.id}" title="Locate on 3D Map">
                🗺️ Map
              </button>
              <button class="table-btn btn-table-details" data-id="${dc.id}" title="Full Intel Specs">
                ℹ️
              </button>
              <button class="table-btn btn-table-edit" data-id="${dc.id}" title="Edit Status / Capacity">
                ✏️
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    this.tableTbody.innerHTML = html;

    // Attach row and button click listeners
    this.tableTbody.querySelectorAll("tr").forEach(tr => {
      const id = tr.dataset.id;
      const dc = this.allData.find(item => item.id === id);
      if (!dc) return;

      // Row click opens detail modal
      tr.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        this.showDetailModal(dc);
      });

      // View on Map button
      const btnMap = tr.querySelector(".btn-table-map");
      if (btnMap) {
        btnMap.addEventListener("click", (e) => {
          e.stopPropagation();
          this.setMainView("map");
          setTimeout(() => {
            this.map.selectFacility(dc);
            this.map.map.flyTo([dc.lat, dc.lng], 12.5, { duration: 1.5 });
            this.showToast(`Centered 3D map on ${dc.name}`);
          }, 120);
        });
      }

      // Details button
      const btnDetails = tr.querySelector(".btn-table-details");
      if (btnDetails) {
        btnDetails.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showDetailModal(dc);
        });
      }

      // Edit button
      const btnEdit = tr.querySelector(".btn-table-edit");
      if (btnEdit) {
        btnEdit.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showEditStatusDialog(dc);
        });
      }
    });
  }

  renderAnalyticsTab() {
    if (this.activeTab !== "analytics" || !this.drawerContent) return;

    let johorMW = 0, selangorMW = 0, klMW = 0;
    let liquidCoolingCount = 0;
    let gigawattCampusCount = 0;

    this.allData.forEach(dc => {
      if (dc.state === "Johor") johorMW += dc.capacityMW;
      else if (dc.state === "Selangor") selangorMW += dc.capacityMW;
      else klMW += dc.capacityMW;

      if (dc.cooling && (dc.cooling.toLowerCase().includes("liquid") || dc.cooling.toLowerCase().includes("immersion"))) {
        liquidCoolingCount++;
      }
      if (dc.capacityMW >= 500) {
        gigawattCampusCount++;
      }
    });

    const totalTracked = johorMW + selangorMW + klMW;
    const johorPct = Math.round((johorMW / totalTracked) * 100);
    const selangorPct = Math.round((selangorMW / totalTracked) * 100);
    const klPct = Math.round((klMW / totalTracked) * 100);

    this.drawerContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline); border-radius: 16px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #fff;">
            🗺️ Regional Capacity Share
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                <span style="color: #c084fc; font-weight: 600;">State of Johor</span>
                <span style="font-weight: 700;">${johorMW.toLocaleString()} MW (${johorPct}%)</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div style="width: ${johorPct}%; height: 100%; background: #a855f7;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                <span style="color: #38bdf8; font-weight: 600;">State of Selangor</span>
                <span style="font-weight: 700;">${selangorMW.toLocaleString()} MW (${selangorPct}%)</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div style="width: ${selangorPct}%; height: 100%; background: #0284c7;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                <span style="color: #34d399; font-weight: 600;">Kuala Lumpur Metro (KL)</span>
                <span style="font-weight: 700;">${klMW.toLocaleString()} MW (${klPct}%)</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div style="width: ${klPct}%; height: 100%; background: #10b981;"></div>
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #38bdf8;">${liquidCoolingCount}</div>
            <div style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px;">Liquid Cooling / AI-Ready</div>
          </div>
          <div style="background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #c084fc;">${gigawattCampusCount}</div>
            <div style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px;">500MW+ / Gigawatt Parks</div>
          </div>
        </div>

        <div class="notes-box">
          <div class="notes-box-title">
            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            Key Research Findings
          </div>
          <div class="notes-box-content">
            <strong>1. Johor Evolution:</strong> Now an autonomous global hyperscale nexus capturing ~76% of pipeline capacity across Sedenak/Kulai, Iskandar Puteri, and Kempas.<br><br>
            <strong>2. Greater KL Focus:</strong> Anchored around enterprise connectivity, sovereign clouds, and AI training with NEXTDC KL1 (Tier IV Certified), Vantage KUL2 (436MW), and Google Elmina.<br><br>
            <strong>3. Energized vs. Planned Gap:</strong> ~500MW is currently energized, with the remaining ~5,800MW undergoing multi-stage phased delivery across 2024–2028.
          </div>
        </div>
      </div>
    `;
  }

  renderMilestonesTab() {
    if (this.activeTab !== "milestones" || !this.drawerContent) return;

    const milestones = [
      { year: "2023 Q3", name: "DayOne NTP Launched", desc: "First 69.5MW delivered in record 14 months, inaugurating Johor's hyperscale wave" },
      { year: "2024 Q1", name: "Equinix KL1 IBX Operational", desc: "Equinix's first IBX in Cyberjaya goes live" },
      { year: "2024 Q2", name: "Equinix JH1 IBX Opens (Fully Leased)", desc: "Southern Malaysia IBX opens and quickly reaches full subscription" },
      { year: "2024 Q3", name: "AirTrunk JHB1 & PDG JH1 Delivered", desc: "AirTrunk delivers initial >50MW; PDG powers up 52MW Phase 1 with TNB Green Lane" },
      { year: "2024 Q3", name: "AWS Malaysia Region GA", desc: "AWS launches ap-southeast-5 region with 3 Availability Zones" },
      { year: "2025 Q2", name: "Vantage JHB1 25MW Online", desc: "First 25MW energized at Sedenak, followed by Vantage acquisition" },
      { year: "2025 Q4", name: "Vantage KUL1 Campus Completed", desc: "KUL14 delivered (16MW single-tenant), completing 31MW KUL1 campus" },
      { year: "2026 Q2", name: "NEXTDC KL1 Officially Live", desc: "Peninsular Malaysia's first major Uptime Tier IV Design & Constructed AI facility opens" },
      { year: "2026 Q3", name: "STeP West 1.5GW Partnership", desc: "YTL / SIPP & JLand ink gigawatt-scale AI supercomputing campus" },
      { year: "2027+", name: "STT Johor 1 & Equinix JH2 Targets", desc: "STT $1.37B green loan facility and Equinix JH2 structure topped out" }
    ];

    let html = `<div style="display: flex; flex-direction: column; gap: 12px; position: relative;">`;

    milestones.forEach((m, idx) => {
      html += `
        <div style="display: flex; gap: 12px; position: relative;">
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--md-sys-color-primary); box-shadow: 0 0 8px var(--md-sys-color-primary);"></div>
            ${idx < milestones.length - 1 ? '<div style="width: 2px; flex: 1; background: rgba(56, 189, 248, 0.2); margin-top: 4px;"></div>' : ''}
          </div>
          <div style="background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline); border-radius: 12px; padding: 10px 12px; flex: 1; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <span style="font-size: 13px; font-weight: 700; color: #fff;">${m.name}</span>
              <span style="font-size: 10px; font-weight: 700; color: var(--md-sys-color-primary); background: var(--md-sys-color-primary-container); padding: 2px 6px; border-radius: 6px;">${m.year}</span>
            </div>
            <p style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); line-height: 1.4;">${m.desc}</p>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    this.drawerContent.innerHTML = html;
  }

  showDetailModal(dc) {
    if (!dc || !this.detailModal) return;
    this.selectedDC = dc;

    // Highlight marker on map
    document.querySelectorAll(".dc-building-marker").forEach(el => {
      el.classList.toggle("selected", el.dataset.id === dc.id);
    });

    const statusCfg = STATUS_CONFIG[dc.status] || STATUS_CONFIG["operational"];

    const isColo = dc.isColocation !== false && dc.colocation !== "No";
    const coloText = isColo ? "🔑 Ready for Rent (Colo)" : "🔒 Own Use (Private)";

    document.getElementById("modal-dc-name").innerText = dc.name;
    document.getElementById("modal-dc-operator").innerText = `${dc.operator} • ${dc.state} • ${coloText}`;
    document.getElementById("modal-dc-status").innerText = `● ${statusCfg.label || dc.statusLabel}`;
    document.getElementById("modal-dc-status").style.color = statusCfg.color;

    const modalAddrEl = document.getElementById("modal-dc-address");
    if (modalAddrEl) {
      modalAddrEl.innerText = dc.address ? `📍 ${dc.address}` : (dc.location ? `📍 ${dc.location}` : "");
    }

    document.getElementById("modal-dc-total-mw").innerText = `${dc.capacityMW} MW`;
    document.getElementById("modal-dc-op-mw").innerText = `${dc.operationalMW || 0} MW`;
    document.getElementById("modal-dc-pipe-mw").innerText = `${dc.pipelineMW || (dc.capacityMW - (dc.operationalMW || 0))} MW`;

    document.getElementById("modal-dc-power").innerText = dc.powerGrid || "Not Publicly Disclosed";
    document.getElementById("modal-dc-cooling").innerText = dc.cooling || "Precision Chilled Water";
    document.getElementById("modal-dc-tier").innerText = dc.tier || "High-Availability Tier Standard";
    document.getElementById("modal-dc-pue").innerText = dc.pue || "Energy Efficient Standard";
    document.getElementById("modal-dc-connect").innerText = dc.connectivity || "Carrier-Neutral Backbone";
    document.getElementById("modal-dc-land").innerText = dc.landDeveloper || "Digital Tech Park Parcel";
    document.getElementById("modal-dc-clients").innerText = dc.clients || "Global Cloud & AI Hyperscalers";
    document.getElementById("modal-dc-timeline").innerText = dc.timeline || "Phased rolling delivery";
    document.getElementById("modal-dc-notes").innerText = dc.notes || "";

    // Button actions
    const btnFly = document.getElementById("btn-modal-fly");
    if (btnFly) {
      btnFly.onclick = () => {
        this.map.selectFacility(dc);
      };
    }

    const btnCopy = document.getElementById("btn-modal-copy");
    if (btnCopy) {
      btnCopy.onclick = () => {
        const addrText = dc.address ? ` - ${dc.address}` : "";
        const text = `${dc.name} (${dc.capacityMW}MW)${addrText} - Coordinates: [${dc.lat}, ${dc.lng}], Operator: ${dc.operator}, Status: ${dc.statusLabel}, Model: ${coloText}`;
        navigator.clipboard.writeText(text).then(() => {
          btnCopy.innerText = "Copied!";
          setTimeout(() => { btnCopy.innerText = "Copy Info"; }, 2000);
        });
      };
    }

    this.detailModal.classList.add("active");
  }

  updateLegendUI() {
    const legendItemsEl = document.getElementById("legend-items-list");
    if (!legendItemsEl) return;

    // Calculate real-time counts for each status and model
    const statusCounts = {
      "operational": 0,
      "operational-expansion": 0,
      "under-construction": 0,
      "planned": 0
    };
    let ownUseCount = 0;

    this.allData.forEach(dc => {
      const isColo = dc.isColocation !== false && dc.colocation !== "No";
      if (!isColo) {
        ownUseCount++;
      } else if (statusCounts[dc.status] !== undefined) {
        statusCounts[dc.status]++;
      }
    });

    if (this.colorMode === "capacity") {
      let html = "";
      CAPACITY_TIERS.forEach(tier => {
        const barH = Math.round(tier.scaleFactor * 16);
        const count = this.allData.filter(d => getCapacityTier(d.capacityMW).id === tier.id).length;
        const isActive = this.filters.tier === tier.id ? "active" : "";
        html += `
          <div class="legend-row ${isActive}" data-tier="${tier.id}">
            <div class="legend-row-left">
              <div style="display: flex; align-items: flex-end; width: 14px; height: 18px;">
                <div style="width: 10px; height: ${barH}px; background: ${tier.color}; border-radius: 2px; box-shadow: 0 0 6px ${tier.color};"></div>
              </div>
              <span class="legend-label">${tier.label}</span>
            </div>
            <span class="legend-count">${count}</span>
          </div>
        `;
      });
      legendItemsEl.innerHTML = html;
    } else {
      const isOpActive = this.filters.status === "operational" ? "active" : "";
      const isExpActive = this.filters.status === "operational-expansion" ? "active" : "";
      const isConActive = this.filters.status === "under-construction" ? "active" : "";
      const isPlanActive = this.filters.status === "planned" ? "active" : "";
      const isOwnActive = this.filters.colocation === "no" ? "active" : "";

      let html = `
        <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
          🔑 Ready for Rent (Colocation)
        </div>
        <div class="legend-row ${isOpActive}" data-status="operational" title="Filter by Fully Operational">
          <div class="legend-row-left">
            <div class="legend-swatch" style="background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);"></div>
            <span class="legend-label">Fully Operational</span>
          </div>
          <span class="legend-count">${statusCounts["operational"]}</span>
        </div>
        <div class="legend-row ${isExpActive}" data-status="operational-expansion" title="Filter by Expanding Campus">
          <div class="legend-row-left">
            <div class="legend-swatch" style="background: #06b6d4; box-shadow: 0 0 8px rgba(6, 182, 212, 0.7);"></div>
            <span class="legend-label">Expanding Campus</span>
          </div>
          <span class="legend-count">${statusCounts["operational-expansion"]}</span>
        </div>
        <div class="legend-row ${isConActive}" data-status="under-construction" title="Filter by Under Construction">
          <div class="legend-row-left">
            <div class="legend-swatch" style="background: #eab308; box-shadow: 0 0 8px rgba(234, 179, 8, 0.7);"></div>
            <span class="legend-label">In Construction</span>
          </div>
          <span class="legend-count">${statusCounts["under-construction"]}</span>
        </div>
        <div class="legend-row ${isPlanActive}" data-status="planned" title="Filter by Planned / Concept">
          <div class="legend-row-left">
            <div class="legend-swatch" style="background: #a855f7; box-shadow: 0 0 8px rgba(168, 85, 247, 0.7);"></div>
            <span class="legend-label">Planned / Concept</span>
          </div>
          <span class="legend-count">${statusCounts["planned"]}</span>
        </div>
        
        <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 3px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15);">
          🔒 Private Hyperscale (Own Use)
        </div>
        <div class="legend-row ${isOwnActive}" data-colocation="no" title="Filter by Own Use (Google, AWS, Microsoft)">
          <div class="legend-row-left">
            <div class="legend-swatch" style="background: #09090b; border: 1.5px solid #94a3b8; box-shadow: 0 0 5px rgba(255,255,255,0.25);"></div>
            <span class="legend-label">Google, AWS, Microsoft</span>
          </div>
          <span class="legend-count">${ownUseCount}</span>
        </div>
      `;
      legendItemsEl.innerHTML = html;
    }

    // Attach row filter click
    legendItemsEl.querySelectorAll(".legend-row").forEach(row => {
      row.addEventListener("click", () => {
        if (this.colorMode === "capacity") {
          const tierId = row.dataset.tier;
          this.filters.tier = this.filters.tier === tierId ? "all" : tierId;
        } else if (row.dataset.colocation) {
          this.filters.colocation = this.filters.colocation === "no" ? "all" : "no";
          document.querySelectorAll(`.filter-chip[data-group="colocation"]`).forEach(c => {
            c.classList.toggle("active", c.dataset.val === this.filters.colocation);
          });
        } else {
          const statusKey = row.dataset.status;
          this.filters.status = this.filters.status === statusKey ? "all" : statusKey;
          document.querySelectorAll(`.filter-chip[data-group="status"]`).forEach(c => {
            c.classList.toggle("active", c.dataset.val === this.filters.status);
          });
        }
        this.applyFilters();
      });
    });
  }

  toggleTimelinePlay() {
    this.isPlayingTimeline = !this.isPlayingTimeline;

    if (this.isPlayingTimeline) {
      this.playTimelineBtn.innerHTML = `
        <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;

      this.timelineInterval = setInterval(() => {
        let nextYear = this.filters.yearMax + 1;
        if (nextYear > 2027) {
          nextYear = 2023;
        }
        this.timelineSlider.value = nextYear;
        this.filters.yearMax = nextYear;
        this.updateTimelineUI();
        this.applyFilters();
      }, 1600);
    } else {
      clearInterval(this.timelineInterval);
      this.playTimelineBtn.innerHTML = `
        <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
    }
  }

  updateTimelineUI() {
    const y = this.filters.yearMax;
    if (this.timelineCurrentYearLabel) {
      this.timelineCurrentYearLabel.innerText = y >= 2027 ? "2027+ Pipeline" : `${y}`;
    }

    if (this.timelineMilestoneText) {
      if (y === 2023) {
        this.timelineMilestoneText.innerText = "2023: DayOne NTP initial phase launched, inaugurating Johor hyperscale wave";
      } else if (y === 2024) {
        this.timelineMilestoneText.innerText = "2024: Equinix JH1/KL1, AirTrunk JHB1, PDG JH1, and AWS Cloud Region delivered";
      } else if (y === 2025) {
        this.timelineMilestoneText.innerText = "2025: Vantage acquires Yondr Johor campus (25MW live); KUL1 campus fully delivered";
      } else if (y === 2026) {
        this.timelineMilestoneText.innerText = "2026: NEXTDC KL1 Tier IV live; YTL signs STeP West 1.5GW AI supercomputing park";
      } else {
        this.timelineMilestoneText.innerText = "2027+: STT Johor 1, Equinix JH2, and gigawatt-scale AI expansions coming online";
      }
    }
  }

  exportCSV() {
    const headers = [
      "ID", "Facility Name", "Operator", "State", "Cluster", "Address", "Is Colocation", "Status", "Milestone Timeline", "Total Capacity (MW)",
      "Operational (MW)", "Pipeline (MW)", "Power Grid", "Cooling", "Tier", "Longitude", "Latitude"
    ];

    const rows = this.filteredData.map(dc => [
      `"${dc.id}"`,
      `"${dc.name}"`,
      `"${dc.operator}"`,
      `"${dc.state}"`,
      `"${dc.cluster}"`,
      `"${(dc.address || dc.location || '').replace(/"/g, '""')}"`,
      `"${dc.isColocation !== false && dc.colocation !== 'No' ? 'Yes' : 'No'}"`,
      `"${dc.statusLabel}"`,
      `"${(dc.timeline || '').replace(/"/g, '""')}"`,
      dc.capacityMW,
      dc.operationalMW || 0,
      dc.pipelineMW || (dc.capacityMW - (dc.operationalMW || 0)),
      `"${(dc.powerGrid || '').replace(/"/g, '""')}"`,
      `"${(dc.cooling || '').replace(/"/g, '""')}"`,
      `"${(dc.tier || '').replace(/"/g, '""')}"`,
      dc.lng,
      dc.lat
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `malaysia_data_centers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  handleCSVFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target.result;
      const parsed = this.parseCSV(csvText);

      if (!parsed || parsed.length === 0) {
        alert("Could not find valid data center records in this CSV file. Please make sure the CSV has headers like Facility Name, Operator, State, Total Capacity (MW).");
        if (this.csvFileInput) this.csvFileInput.value = "";
        return;
      }

      this.pendingImportData = parsed;

      // Calculate summary stats
      let totalMW = 0;
      let liveMW = 0;
      let inConstMW = 0;
      let coloCount = 0;
      let ownUseCount = 0;

      parsed.forEach(d => {
        totalMW += (d.capacityMW || 0);
        liveMW += (d.operationalMW || 0);
        inConstMW += (d.pipelineMW || 0);
        if (d.isColocation) coloCount++;
        else ownUseCount++;
      });

      if (this.importPreviewSummary) {
        this.importPreviewSummary.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 8px;">
            <strong style="color: #ffffff; font-size: 13px;">📄 ${file.name}</strong>
            <span style="font-size: 11px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
              ${parsed.length} Facilities Found
            </span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 12px;">
            <div>Total Capacity: <strong style="color: #ffffff;">${totalMW.toLocaleString()} MW</strong></div>
            <div>Live Operational: <strong style="color: #10b981;">${liveMW.toLocaleString()} MW</strong></div>
            <div>In Pipeline: <strong style="color: #f59e0b;">${inConstMW.toLocaleString()} MW</strong></div>
            <div>States Tracked: <strong style="color: #a855f7;">${new Set(parsed.map(p => p.state)).size} Regions</strong></div>
            <div style="grid-column: span 2; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1);">
              Model Breakdown: <strong style="color: #10b981;">${coloCount} Ready for Rent (Colo)</strong> • <strong style="color: #94a3b8;">${ownUseCount} Own Use (Private)</strong>
            </div>
          </div>
        `;
      }

      if (this.importDialogBackdrop) {
        this.importDialogBackdrop.classList.add("active");
      }
    };
    reader.readAsText(file);
  }

  applyCSVImport() {
    if (!this.pendingImportData || this.pendingImportData.length === 0) return;

    const modeInput = document.querySelector('input[name="import_mode"]:checked');
    const mode = modeInput ? modeInput.value : "replace";

    if (mode === "replace") {
      this.allData = [...this.pendingImportData];
    } else {
      // Merge mode
      const existingMap = new Map();
      this.allData.forEach(d => {
        existingMap.set(d.id.toLowerCase(), d);
        existingMap.set(d.name.toLowerCase().trim(), d);
      });

      this.pendingImportData.forEach(item => {
        const match = existingMap.get(item.id.toLowerCase()) || existingMap.get(item.name.toLowerCase().trim());
        if (match) {
          Object.assign(match, item);
        } else {
          this.allData.push(item);
        }
      });
    }

    this.saveDataToStorage();

    // Refresh operator filter options, map, and UI
    this.populateOperatorFilter();
    this.map.setData(this.allData);
    this.applyFilters();
    this.map.resetView();

    if (this.importDialogBackdrop) {
      this.importDialogBackdrop.classList.remove("active");
    }
    if (this.csvFileInput) {
      this.csvFileInput.value = "";
    }

    this.showToast(`✅ Successfully imported ${this.pendingImportData.length} facilities! All 3D buildings and metrics refreshed.`);
  }

  parseCSV(csvText) {
    if (!csvText) return [];
    csvText = csvText.replace(/^\uFEFF/, "");

    // Tokenize CSV rows handling quotes and linebreaks
    const rows = [];
    let row = [];
    let inQuotes = false;
    let field = "";

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(field.trim());
        field = "";
      } else if ((char === "\r" || char === "\n") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
        row.push(field.trim());
        if (row.some(val => val.length > 0)) {
          rows.push(row);
        }
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    if (field || row.length > 0) {
      row.push(field.trim());
      if (row.some(val => val.length > 0)) {
        rows.push(row);
      }
    }

    if (rows.length < 2) return [];

    // Header normalization (strips spaces, dashes, parentheses, underscores)
    const rawHeaders = rows[0].map(h => h.toLowerCase().replace(/[\s\-_()]/g, ""));

    const findCol = (aliases) => {
      for (const a of aliases) {
        const idx = rawHeaders.findIndex(h => h.includes(a));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idCol = findCol(["id", "dcid", "code"]);
    const nameCol = findCol(["facilityname", "name", "project", "facility", "datacenter", "dcname"]);
    const opCol = findCol(["operator", "owner", "company", "provider", "developer"]);
    const stateCol = findCol(["state", "region", "province", "territory", "location"]);
    const clusterCol = findCol(["cluster", "district", "city", "area", "park", "subregion"]);
    const addressCol = findCol(["address", "street", "postal", "addr", "locationaddress"]);
    const statusCol = findCol(["status", "phase", "stage", "operationalstatus", "progress"]);
    const coloCol = findCol(["colocation", "colo", "readyforrent", "rent", "purpose", "businessmodel", "model", "type", "ownuse", "selfuse", "iscolo"]);
    const totalMwCol = findCol(["totalcapacity", "capacitymw", "capacity", "totalmw", "mw", "itload", "powerload"]);
    const opMwCol = findCol(["operationalmw", "livemw", "energized", "operational", "currentmw"]);
    const pipeMwCol = findCol(["pipelinemw", "underconstruction", "pipeline", "constructionmw"]);
    const timeCol = findCol(["milestonetimeline", "timeline", "rfs", "commissioning", "milestone", "delivery", "year"]);
    const powerCol = findCol(["powergrid", "power", "grid", "substation", "tnb"]);
    const coolingCol = findCol(["cooling", "liquidcooling", "coolingtech"]);
    const tierCol = findCol(["tier", "uptime", "standard", "cert"]);
    const lngCol = findCol(["longitude", "lng", "lon"]);
    const latCol = findCol(["latitude", "lat"]);

    const formatExcelDate = (val) => {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 30000 && num < 60000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const quarter = Math.ceil((month + 1) / 3);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[month]} ${year} (Q${quarter})`;
      }
      return val || "In active rollout";
    };

    const parseYear = (val) => {
      const match = (val || "").match(/\b(202\d|20[0-1]\d)\b/);
      if (match) return parseInt(match[1], 10);
      const num = parseFloat(val);
      if (!isNaN(num) && num > 30000 && num < 60000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        return d.getUTCFullYear();
      }
      return 2026;
    };

    const parsedFacilities = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || !row.some(c => c)) continue;

      const name = (nameCol !== -1 ? row[nameCol] : "") || `Facility ${r}`;
      const operator = (opCol !== -1 ? row[opCol] : "") || "Hyperscale Operator";
      const state = (stateCol !== -1 ? row[stateCol] : "") || "Johor";
      const cluster = (clusterCol !== -1 ? row[clusterCol] : "") || state;
      const address = (addressCol !== -1 && row[addressCol]) ? row[addressCol] : `${cluster}, ${state}`;

      const rawCap = totalMwCol !== -1 ? parseFloat(row[totalMwCol]) : 50;
      const capacityMW = isNaN(rawCap) ? 50 : rawCap;

      const rawOp = opMwCol !== -1 ? parseFloat(row[opMwCol]) : 0;
      const operationalMW = isNaN(rawOp) ? 0 : rawOp;

      let pipelineMW = pipeMwCol !== -1 ? parseFloat(row[pipeMwCol]) : (capacityMW - operationalMW);
      if (isNaN(pipelineMW)) pipelineMW = Math.max(0, capacityMW - operationalMW);

      // Colocation determination
      let isColocation = true;
      if (coloCol !== -1 && row[coloCol]) {
        const rawColo = row[coloCol].trim().toLowerCase();
        if (rawColo === "no" || rawColo === "n" || rawColo === "false" || rawColo === "0" || rawColo.includes("own") || rawColo.includes("self") || rawColo.includes("private")) {
          isColocation = false;
        } else if (rawColo === "yes" || rawColo === "y" || rawColo === "true" || rawColo === "1" || rawColo.includes("colo") || rawColo.includes("rent")) {
          isColocation = true;
        }
      } else {
        // Automatic heuristic based on operator name (Google, AWS, Microsoft build for own use)
        const opLower = operator.toLowerCase();
        if (opLower.includes("google") || opLower.includes("aws") || opLower.includes("amazon") || opLower.includes("microsoft") || opLower.includes("azure")) {
          isColocation = false;
        }
      }

      // Status normalization
      let rawStatus = (statusCol !== -1 ? row[statusCol] : "").toLowerCase();
      let status = "under-construction";
      let statusLabel = "Under Construction";

      if (rawStatus.includes("expansion") || rawStatus.includes("扩建")) {
        status = "operational-expansion";
        statusLabel = "Operational + Expanding";
      } else if (rawStatus.includes("fully") || rawStatus.includes("operat") || rawStatus.includes("live") || rawStatus.includes("已运营") || rawStatus.includes("运营")) {
        status = "operational";
        statusLabel = "Fully Operational";
      } else if (rawStatus.includes("plan") || rawStatus.includes("announced") || rawStatus.includes("规划") || rawStatus.includes("concept")) {
        status = "planned";
        statusLabel = "Planned / Concept";
      } else if (rawStatus.includes("construct") || rawStatus.includes("在建")) {
        status = "under-construction";
        statusLabel = "Under Construction";
      } else if (operationalMW >= capacityMW && capacityMW > 0) {
        status = "operational";
        statusLabel = "Fully Operational";
      }

      // Coordinates fallback
      let lat = latCol !== -1 ? parseFloat(row[latCol]) : NaN;
      let lng = lngCol !== -1 ? parseFloat(row[lngCol]) : NaN;

      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        const stateLower = state.toLowerCase();
        if (stateLower.includes("johor") || stateLower.includes("柔佛")) {
          lat = 1.48 + (Math.random() - 0.5) * 0.2;
          lng = 103.65 + (Math.random() - 0.5) * 0.2;
        } else if (stateLower.includes("selangor") || stateLower.includes("雪兰莪")) {
          lat = 2.92 + (Math.random() - 0.5) * 0.15;
          lng = 101.65 + (Math.random() - 0.5) * 0.15;
        } else if (stateLower.includes("kuala") || stateLower.includes("kl") || stateLower.includes("吉隆坡")) {
          lat = 3.14 + (Math.random() - 0.5) * 0.1;
          lng = 101.69 + (Math.random() - 0.5) * 0.1;
        } else {
          lat = 2.5 + (Math.random() - 0.5) * 0.5;
          lng = 102.5 + (Math.random() - 0.5) * 0.5;
        }
      }

      const id = (idCol !== -1 && row[idCol]) ? row[idCol] : `dc-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${r}`;
      const rawTimeline = (timeCol !== -1 && row[timeCol]) ? row[timeCol] : "In active rollout";
      const timeline = formatExcelDate(rawTimeline);
      const year = parseYear(rawTimeline);
      const powerGrid = (powerCol !== -1 && row[powerCol]) ? row[powerCol] : "Dedicated Substation";
      const cooling = (coolingCol !== -1 && row[coolingCol]) ? row[coolingCol] : "Advanced Liquid Cooling Ready";
      const tier = (tierCol !== -1 && row[tierCol]) ? row[tierCol] : "Hyperscale AI-Ready";

      parsedFacilities.push({
        id: id,
        name: name,
        operator: operator,
        state: state,
        cluster: cluster,
        address: address,
        status: status,
        statusLabel: statusLabel,
        isColocation: isColocation,
        colocation: isColocation ? "Yes" : "No",
        colocationLabel: isColocation ? "Ready for Rent (Colocation)" : "Own Use (Private Hyperscale)",
        location: `${cluster}, ${state}`,
        lat: lat,
        lng: lng,
        capacityMW: capacityMW,
        operationalMW: operationalMW,
        pipelineMW: pipelineMW,
        capacityDisplay: `${capacityMW} MW IT`,
        timeline: timeline,
        year: year,
        powerGrid: powerGrid,
        cooling: cooling,
        pue: "Design PUE <1.25",
        greenEnergy: "Green Power Target",
        tier: tier,
        connectivity: "Carrier-Neutral Hub",
        landDeveloper: `${cluster} Park`,
        clients: isColocation ? "Colocation Enterprise Tenants" : "Internal Cloud & AI Services",
        notes: `Imported from CSV. Address: ${address}`,
        category: capacityMW >= 500 ? "mega-scale" : (capacityMW >= 200 ? "ultra-hyperscale" : "hyperscale"),
        tags: [operator, state, isColocation ? "Colocation / For Rent" : "Private Own Use"]
      });
    }

    return parsedFacilities;
  }
}

// Instantiate on DOM load
window.addEventListener("DOMContentLoaded", () => {
  window.app = new DataCenterApp();
});
