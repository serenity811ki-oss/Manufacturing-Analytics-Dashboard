/* ==========================================================================
   ViewRenderers — one async function per nav view, called by App.navigate()
   ========================================================================== */
function machineName(id) {
  const m = App.machines.find(x => x.id === id);
  return m ? m.name : `#${id}`;
}
function machineOptions() {
  return App.machines.map(m => ({ value: m.id, label: m.name }));
}
function lineOptions() {
  return App.lines.map(l => ({ value: l.id, label: l.name }));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    return headers.reduce((obj, key, index) => ({ ...obj, [key]: values[index] ?? "" }), {});
  });
  return { headers, rows };
}

function kpiCard(label, value, sub, accent) {
  return `<div class="kpi-card accent-${accent}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-sub">${sub || ""}</div>
  </div>`;
}

const ViewRenderers = {

  async "production-dashboard"() {
    const f = App.getFilters();
    const [kpi, trend, statusOverview, shiftPerf, alerts] = await Promise.all([
      Api.get("/api/dashboard/kpi-summary", f),
      Api.get("/api/dashboard/production-trend", { ...f, granularity: "day" }),
      Api.get("/api/dashboard/machine-status-overview"),
      Api.get("/api/dashboard/shift-performance", f),
      Api.get("/api/dashboard/maintenance-alerts"),
    ]);

    document.getElementById("kpi-grid").innerHTML = [
      kpiCard("Overall OEE", `${kpi.overall_oee}%`, "Availability × Performance × Quality", "teal"),
      kpiCard("Units Produced", kpi.total_units_produced.toLocaleString(), `${kpi.total_units_rejected.toLocaleString()} rejected`, "green"),
      kpiCard("Target Attainment", `${kpi.target_attainment_pct}%`, "Output vs planned target", "teal"),
      kpiCard("Quality Rate", `${kpi.quality_rate_pct}%`, `${kpi.top_defect_type} • ${kpi.top_defect_scrapped} units`, "green"),
      kpiCard("Total Downtime", `${Math.round(kpi.total_downtime_minutes).toLocaleString()} min`, "Selected period", "amber"),
      kpiCard("Machines Down", kpi.machines_down, `${kpi.active_machines} active total`, kpi.machines_down > 0 ? "red" : "green"),
      kpiCard("Open Maintenance Alerts", kpi.open_maintenance_alerts, "Scheduled / in progress", "amber"),
    ].join("");

    document.getElementById("dashboard-insights").innerHTML = [
      `<div class="panel" style="box-shadow:none;"><div class="panel-title" style="margin-bottom:8px;">Main bottleneck</div><div class="kpi-value">${kpi.top_downtime_category}</div><div class="kpi-sub">${kpi.top_downtime_minutes.toLocaleString()} min lost in the current window</div></div>`,
      `<div class="panel" style="box-shadow:none;"><div class="panel-title" style="margin-bottom:8px;">Top defect</div><div class="kpi-value">${kpi.top_defect_type}</div><div class="kpi-sub">${kpi.top_defect_scrapped.toLocaleString()} units flagged for rework or scrap</div></div>`,
      `<div class="panel" style="box-shadow:none;"><div class="panel-title" style="margin-bottom:8px;">Operational focus</div><div class="kpi-value">${kpi.machines_down ? `${kpi.machines_down} machine(s) need attention` : "Fleet is running smoothly"}</div><div class="kpi-sub">${kpi.open_maintenance_alerts} open maintenance task(s) are currently scheduled</div></div>`,
    ].join("");

    trend.sort((a, b) => a.period.localeCompare(b.period));
    renderAreaChart("chart-production-trend", trend.map(t => t.period), [
      { label: "Units Produced", data: trend.map(t => t.units_produced) },
      { label: "Target", data: trend.map(t => t.target_units), fill: false, borderDash: [5, 4] },
      { label: "Rejected", data: trend.map(t => t.units_rejected), fill: false },
    ]);

    const statusLabels = Object.keys(statusOverview);
    renderPieChart("chart-machine-status", statusLabels.map(s => s.replace(/_/g, " ")), statusLabels.map(s => statusOverview[s]));

    renderBarChart("chart-shift-perf-mini", shiftPerf.map(s => s.shift), [
      { label: "Units Produced", data: shiftPerf.map(s => s.units_produced) },
    ]);

    const alertsList = document.getElementById("alerts-list");
    if (!alerts.length) {
      alertsList.innerHTML = `<div class="empty-state">No open maintenance alerts. All machines nominal.</div>`;
    } else {
      alertsList.innerHTML = `<div class="table-scroll"><table class="data-table">
        <thead><tr><th>Machine</th><th>Type</th><th>Description</th><th>Scheduled</th><th>Status</th></tr></thead>
        <tbody>${alerts.map(a => `<tr>
          <td>${a.machine_name || "—"}</td><td>${badge(a.type)}</td><td>${a.description}</td>
          <td>${fmtDate(a.scheduled_date)}</td><td>${badge(a.status)}</td>
        </tr>`).join("")}</tbody></table></div>`;
    }
  },

  async "machine-performance"() {
    const f = App.getFilters();
    const [topBottom, utilization] = await Promise.all([
      Api.get("/api/dashboard/top-bottom-machines", { ...f, n: 6 }),
      Api.get("/api/dashboard/equipment-utilization", f),
    ]);
    renderBarChart("chart-top-machines", topBottom.top.map(m => m.machine_name), [
      { label: "OEE %", data: topBottom.top.map(m => m.oee), backgroundColor: ChartTheme.green },
    ], { plugins: { legend: { display: false }, title: { display: true, text: "Top Performers", font: { size: 12 } } } });
    renderBarChart("chart-bottom-machines", topBottom.bottom.map(m => m.machine_name), [
      { label: "OEE %", data: topBottom.bottom.map(m => m.oee), backgroundColor: ChartTheme.red },
    ], { plugins: { legend: { display: false }, title: { display: true, text: "Needs Attention", font: { size: 12 } } } });

    renderBarChart("chart-utilization", utilization.map(u => u.machine_name), [
      { label: "Utilization (Availability %)", data: utilization.map(u => u.utilization_pct) },
    ]);
  },

  async "oee"() {
    const f = App.getFilters();
    const rows = await Api.get("/api/dashboard/oee", f);
    const n = rows.length || 1;
    const avg = (key) => (rows.reduce((s, r) => s + r[key], 0) / n).toFixed(1);
    document.getElementById("oee-kpi-grid").innerHTML = [
      kpiCard("Avg Availability", `${avg("availability")}%`, "", "teal"),
      kpiCard("Avg Performance", `${avg("performance")}%`, "", "teal"),
      kpiCard("Avg Quality", `${avg("quality")}%`, "", "teal"),
      kpiCard("Avg OEE", `${avg("oee")}%`, "World-class benchmark: 85%", "green"),
    ].join("");
    document.querySelector("#oee-table tbody").innerHTML = rows.length ? rows.map(r => `
      <tr><td>${r.machine_name}</td><td class="numeric">${r.availability}%</td><td class="numeric">${r.performance}%</td>
      <td class="numeric">${r.quality}%</td><td class="numeric"><strong>${r.oee}%</strong></td>
      <td class="numeric">${r.units_produced.toLocaleString()}</td><td class="numeric">${r.downtime_minutes}</td></tr>
    `).join("") : `<tr><td colspan="7" class="empty-state">No data for the selected filters.</td></tr>`;
  },

  async "downtime-analysis"() {
    const f = App.getFilters();
    const pareto = await Api.get("/api/dashboard/downtime-pareto", f);
    renderBarChart("chart-downtime-pareto", pareto.map(p => p.category.replace(/_/g, " ")), [
      { label: "Downtime (min)", data: pareto.map(p => p.total_minutes) },
    ], { indexAxis: "y", plugins: { legend: { display: false } } });
    renderPieChart("chart-downtime-pie", pareto.map(p => p.category.replace(/_/g, " ")), pareto.map(p => p.total_minutes));

    await buildCrudPanel({
      panelId: "downtime-crud-panel",
      title: "Downtime Events",
      subtitle: "Log and resolve unplanned & planned stops",
      endpoint: "/api/downtime-events",
      extraParams: () => App.getFilters(),
      columns: [
        { key: "machine_id", label: "Machine", render: r => machineName(r.machine_id) },
        { key: "category", label: "Category", render: r => badge(r.category) },
        { key: "reason", label: "Reason" },
        { key: "start_time", label: "Start", render: r => fmtDateTime(r.start_time) },
        { key: "duration_minutes", label: "Duration (min)", numeric: true, render: r => r.duration_minutes ?? "—" },
        { key: "resolved", label: "Resolved", render: r => r.resolved ? badge("resolved") : badge("in_progress") },
      ],
      fields: [
        { key: "machine_id", label: "Machine", type: "select", options: machineOptions(), required: true },
        { key: "category", label: "Category", type: "select", required: true, options: [
          "unplanned_mechanical", "unplanned_electrical", "planned_maintenance", "changeover",
          "material_shortage", "operator_break", "quality_hold", "other",
        ].map(v => ({ value: v, label: v.replace(/_/g, " ") })) },
        { key: "reason", label: "Reason", type: "text", required: true },
        { key: "start_time", label: "Start Time", type: "datetime", required: true },
        { key: "end_time", label: "End Time", type: "datetime" },
        { key: "reported_by", label: "Reported By", type: "text" },
        { key: "resolved", label: "Resolved", type: "checkbox" },
      ],
    });
  },

  async "predictive-maintenance"() {
    const [alerts, all] = await Promise.all([
      Api.get("/api/dashboard/maintenance-alerts"),
      Api.get("/api/maintenance-records", { maintenance_type: "predictive", limit: 200 }),
    ]);
    document.getElementById("predictive-kpi-grid").innerHTML = [
      kpiCard("Predictive Flags", all.length, "Vibration / sensor-triggered", "amber"),
      kpiCard("Open Work Orders", alerts.length, "Scheduled / in progress", "teal"),
      kpiCard("Machines Monitored", App.machines.length, "Active fleet", "green"),
    ].join("");
    document.querySelector("#predictive-table tbody").innerHTML = all.length ? all.map(r => `
      <tr><td>${machineName(r.machine_id)}</td><td>${r.failure_code || "—"}</td><td>${r.description}</td>
      <td>${fmtDate(r.scheduled_date)}</td><td>${badge(r.status)}</td></tr>
    `).join("") : `<tr><td colspan="5" class="empty-state">No predictive maintenance events recorded.</td></tr>`;
  },

  async "maintenance-history"() {
    await buildCrudPanel({
      panelId: "maintenance-crud-panel",
      title: "Maintenance Records",
      subtitle: "Preventive, corrective, predictive & emergency work orders",
      endpoint: "/api/maintenance-records",
      extraParams: () => App.getFilters(),
      canDelete: roleAllows("admin"),
      columns: [
        { key: "machine_id", label: "Machine", render: r => machineName(r.machine_id) },
        { key: "maintenance_type", label: "Type", render: r => badge(r.maintenance_type) },
        { key: "status", label: "Status", render: r => badge(r.status) },
        { key: "description", label: "Description" },
        { key: "scheduled_date", label: "Scheduled", render: r => fmtDate(r.scheduled_date) },
        { key: "cost", label: "Cost", numeric: true, render: r => `$${(r.cost || 0).toLocaleString()}` },
      ],
      fields: [
        { key: "machine_id", label: "Machine", type: "select", options: machineOptions(), required: true },
        { key: "maintenance_type", label: "Type", type: "select", required: true,
          options: ["preventive", "corrective", "predictive", "emergency"].map(v => ({ value: v, label: v })) },
        { key: "status", label: "Status", type: "select", required: true,
          options: ["scheduled", "in_progress", "completed", "cancelled"].map(v => ({ value: v, label: v.replace("_", " ") })) },
        { key: "description", label: "Description", type: "textarea", required: true },
        { key: "scheduled_date", label: "Scheduled Date", type: "datetime", required: true },
        { key: "start_time", label: "Start Time", type: "datetime" },
        { key: "end_time", label: "End Time", type: "datetime" },
        { key: "cost", label: "Cost ($)", type: "number" },
        { key: "parts_replaced", label: "Parts Replaced", type: "text" },
        { key: "failure_code", label: "Failure Code", type: "text" },
      ],
    });
  },

  async "failure-analysis"() {
    const f = App.getFilters();
    const rows = await Promise.all(App.machines.map(async m => {
      const r = await Api.get("/api/dashboard/mtbf-mttr", { ...f, machine_id: m.id });
      return { ...r, machine_name: m.name };
    }));
    const totalFailures = rows.reduce((s, r) => s + r.failure_count, 0);
    const avgMtbf = rows.length ? (rows.reduce((s, r) => s + r.mtbf_hours, 0) / rows.length).toFixed(1) : 0;
    const avgMttr = rows.length ? (rows.reduce((s, r) => s + r.mttr_hours, 0) / rows.length).toFixed(1) : 0;
    document.getElementById("failure-kpi-grid").innerHTML = [
      kpiCard("Total Failures", totalFailures, "Corrective + emergency events", "red"),
      kpiCard("Avg MTBF", `${avgMtbf} hrs`, "Mean Time Between Failures", "teal"),
      kpiCard("Avg MTTR", `${avgMttr} hrs`, "Mean Time To Repair", "amber"),
    ].join("");
    document.querySelector("#failure-table tbody").innerHTML = rows.filter(r => r.failure_count > 0).map(r => `
      <tr><td>${r.machine_name}</td><td class="numeric">${r.failure_count}</td>
      <td class="numeric">${r.mtbf_hours}</td><td class="numeric">${r.mttr_hours}</td>
      <td class="numeric">${r.total_repair_hours}</td></tr>
    `).join("") || `<tr><td colspan="5" class="empty-state">No failure events for the selected filters.</td></tr>`;
  },

  async "data-entry"() {
    const machineSelect = document.getElementById("manual-machine");
    machineSelect.innerHTML = App.machines.map(m => `<option value="${m.id}">${m.name}</option>`).join("");

    const uploadInput = document.getElementById("excel-upload-input");
    const uploadButton = document.getElementById("excel-upload-btn");
    const uploadStatus = document.getElementById("excel-upload-status");
    let selectedFile = null;

    uploadInput.addEventListener("change", () => {
      selectedFile = uploadInput.files[0] || null;
      uploadStatus.textContent = selectedFile ? `Ready to upload ${selectedFile.name}` : "No file selected yet.";
    });

    uploadButton.addEventListener("click", async () => {
      if (!selectedFile) {
        toast("Please choose a file before uploading.", "error");
        return;
      }
      if (selectedFile.name.toLowerCase().endsWith(".csv")) {
        const text = await selectedFile.text();
        const parsed = parseCsv(text);
        uploadStatus.textContent = `Parsed ${parsed.rows.length} rows from ${selectedFile.name}.`; 
        if (!parsed.rows.length) {
          uploadStatus.textContent = "File parsed but contains no rows.";
          return;
        }
        const preview = parsed.rows.slice(0, 5).map(row => Object.values(row).join(" | ")).join("\n");
        if (preview) {
          uploadStatus.textContent += ` Preview: ${parsed.headers.join(", ")} | ${preview.replace(/\n/g, " ; ")}`;
        }
        toast("CSV upload preview available in demo mode.");
      } else {
        uploadStatus.textContent = `Selected ${selectedFile.name}. Excel upload preview is not supported in the demo client.`;
        toast("Excel upload will send the file to a backend when connected.");
      }
    });

    const manualForm = document.getElementById("manual-entry-form");
    const manualStatus = document.getElementById("manual-entry-status");
    const manualTable = document.getElementById("manual-entry-table");

    manualForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        machine_id: parseInt(document.getElementById("manual-machine").value, 10),
        production_date: document.getElementById("manual-date").value,
        units_produced: parseInt(document.getElementById("manual-units-produced").value, 10),
        units_rejected: parseInt(document.getElementById("manual-units-rejected").value, 10),
        notes: document.getElementById("manual-notes").value.trim(),
      };
      try {
        await Api.post("/api/production-records", payload);
        manualStatus.textContent = "Manual record added successfully.";
        manualForm.reset();
        renderManualEntries();
        toast("Manual data saved.");
      } catch (e) {
        manualStatus.textContent = e.message;
        toast(e.message, "error");
      }
    });

    async function renderManualEntries() {
      const rows = await Api.get("/api/production-records");
      if (!rows.length) {
        manualTable.innerHTML = `<div class="empty-state">No manual records have been added yet.</div>`;
        return;
      }
      const latest = rows.slice(0, 5);
      manualTable.innerHTML = `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Machine</th><th>Date</th><th class="numeric">Units</th><th class="numeric">Rejected</th><th>Notes</th></tr></thead>
            <tbody>${latest.map(r => `
              <tr>
                <td>${machineName(r.machine_id)}</td>
                <td>${fmtDate(r.production_date)}</td>
                <td class="numeric">${r.units_produced ?? "—"}</td>
                <td class="numeric">${r.units_rejected ?? "—"}</td>
                <td>${r.notes || "—"}</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>`;
    }

    await renderManualEntries();
  },

  async "efficiency-reports"() {
    const f = App.getFilters();
    const trend = await Api.get("/api/dashboard/production-trend", { ...f, granularity: "week" });
    trend.sort((a, b) => a.period.localeCompare(b.period));
    renderLineChart("chart-efficiency-trend", trend.map(t => t.period), [
      { label: "Actual Units", data: trend.map(t => t.units_produced) },
      { label: "Target Units", data: trend.map(t => t.target_units), borderDash: [5, 4] },
    ]);

    // Weekly throughput heatmap: machine x day-of-week, using production trend by day
    const daily = await Api.get("/api/dashboard/production-trend", { ...f, granularity: "day" });
    const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const util = await Api.get("/api/dashboard/equipment-utilization", f);
    const topMachines = util.slice(0, 6);
    const matrix = topMachines.map(() => dow.map(() => Math.round(Math.random() * 0))); // placeholder zero base
    // Build a real matrix from production records per machine per weekday
    const recs = await Api.get("/api/production-records", { ...f, limit: 3000 });
    topMachines.forEach((m, ri) => {
      dow.forEach((d, ci) => {
        const total = recs.filter(r => r.machine_id === m.machine_id &&
          ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][(new Date(r.production_date).getDay() + 6) % 7] === d)
          .reduce((s, r) => s + r.units_produced, 0);
        matrix[ri][ci] = total;
      });
    });
    renderHeatmap("heatmap-throughput", topMachines.map(m => m.machine_name), dow, matrix);
  },

  async "shift-performance"() {
    const f = App.getFilters();
    const rows = await Api.get("/api/dashboard/shift-performance", f);
    renderBarChart("chart-shift-bar", rows.map(r => r.shift), [
      { label: "Units Produced", data: rows.map(r => r.units_produced), backgroundColor: ChartTheme.teal },
    ]);
    renderBarChart("chart-shift-rejects", rows.map(r => r.shift), [
      { label: "Units Rejected", data: rows.map(r => r.units_rejected), backgroundColor: ChartTheme.red },
    ]);
  },

  async "quality"() {
    const f = App.getFilters();
    const rows = await Api.get("/api/dashboard/scrap-quality", f);
    const byDefect = {};
    rows.forEach(r => { byDefect[r.defect_type] = (byDefect[r.defect_type] || 0) + r.quantity_scrapped; });
    renderBarChart("chart-scrap-defect", Object.keys(byDefect), [
      { label: "Units Scrapped", data: Object.values(byDefect) },
    ], { indexAxis: "y", plugins: { legend: { display: false } } });

    const bySeverity = {};
    rows.forEach(r => { bySeverity[r.severity] = (bySeverity[r.severity] || 0) + r.event_count; });
    renderPieChart("chart-severity-mix", Object.keys(bySeverity), Object.values(bySeverity));

    await buildCrudPanel({
      panelId: "quality-crud-panel",
      title: "Quality & Scrap Records",
      subtitle: "Inspection findings, root cause, and disposition",
      endpoint: "/api/quality-records",
      extraParams: () => App.getFilters(),
      canEdit: false,
      columns: [
        { key: "machine_id", label: "Machine", render: r => machineName(r.machine_id) },
        { key: "inspection_date", label: "Date", render: r => fmtDate(r.inspection_date) },
        { key: "defect_type", label: "Defect Type" },
        { key: "severity", label: "Severity", render: r => badge(r.severity) },
        { key: "quantity_scrapped", label: "Scrapped", numeric: true },
        { key: "quantity_reworked", label: "Reworked", numeric: true },
        { key: "root_cause", label: "Root Cause" },
      ],
      fields: [
        { key: "machine_id", label: "Machine", type: "select", options: machineOptions(), required: true },
        { key: "inspection_date", label: "Inspection Date", type: "datetime", required: true },
        { key: "defect_type", label: "Defect Type", type: "text", required: true },
        { key: "severity", label: "Severity", type: "select", required: true,
          options: ["minor", "major", "critical"].map(v => ({ value: v, label: v })) },
        { key: "quantity_scrapped", label: "Quantity Scrapped", type: "number", required: true },
        { key: "quantity_reworked", label: "Quantity Reworked", type: "number" },
        { key: "root_cause", label: "Root Cause", type: "text" },
        { key: "inspector_name", label: "Inspector", type: "text" },
      ],
    });
  },

  async "machines-admin"() {
    await buildCrudPanel({
      panelId: "lines-crud-panel",
      title: "Production Lines",
      subtitle: "Plant floor line/cell definitions",
      endpoint: "/api/production-lines",
      canCreate: roleAllows("manager"),
      canEdit: roleAllows("manager"),
      columns: [
        { key: "name", label: "Name" },
        { key: "location", label: "Location" },
        { key: "description", label: "Description" },
        { key: "is_active", label: "Active", render: r => r.is_active ? badge("running") : badge("offline") },
      ],
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "location", label: "Location", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "is_active", label: "Active", type: "checkbox", default: true },
      ],
    });

    await buildCrudPanel({
      panelId: "machines-crud-panel",
      title: "Machines",
      subtitle: "Asset registry — full CRUD",
      endpoint: "/api/machines",
      canCreate: roleAllows("manager"),
      canEdit: roleAllows("manager"),
      columns: [
        { key: "asset_tag", label: "Asset Tag" },
        { key: "name", label: "Name" },
        { key: "machine_type", label: "Type" },
        { key: "manufacturer", label: "Manufacturer" },
        { key: "production_line_id", label: "Line", render: r => (App.lines.find(l => l.id === r.production_line_id) || {}).name || "—" },
        { key: "status", label: "Status", render: r => badge(r.status) },
      ],
      fields: [
        { key: "asset_tag", label: "Asset Tag", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "machine_type", label: "Machine Type", type: "text", required: true },
        { key: "manufacturer", label: "Manufacturer", type: "text" },
        { key: "model_number", label: "Model Number", type: "text" },
        { key: "production_line_id", label: "Production Line", type: "select", options: lineOptions(), required: true },
        { key: "status", label: "Status", type: "select", required: true,
          options: ["running", "idle", "down", "maintenance", "offline"].map(v => ({ value: v, label: v })) },
        { key: "ideal_cycle_time_seconds", label: "Ideal Cycle Time (sec)", type: "number", required: true },
      ],
    });
  },

  async "reports"() {
    document.querySelectorAll("[data-export]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const { export: fmt, dataset } = btn.dataset;
        try {
          await Api.downloadFile(`/api/reports/export/${fmt}/${dataset}`, App.getFilters(),
            `${dataset}_export.${fmt === "excel" ? "xlsx" : "csv"}`);
          toast("Export downloaded");
        } catch (e) { toast(e.message, "error"); }
      });
    });
    document.getElementById("export-oee-pdf").addEventListener("click", async () => {
      try {
        await Api.downloadFile("/api/reports/export/pdf/oee-summary", App.getFilters(), "oee_summary_report.pdf");
        toast("Report generated");
      } catch (e) { toast(e.message, "error"); }
    });
  },

  async "users-admin"() {
    if (Api.role() !== "admin") {
      document.getElementById("users-crud-panel").innerHTML = `<div class="empty-state">Admin access required.</div>`;
      return;
    }
    await buildCrudPanel({
      panelId: "users-crud-panel",
      title: "Users",
      subtitle: "Role-based access: Admin, Manager, Technician",
      endpoint: "/api/users",
      canCreate: true, canEdit: true, canDelete: true,
      columns: [
        { key: "username", label: "Username" },
        { key: "full_name", label: "Full Name" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role", render: r => badge(r.role) },
        { key: "is_active", label: "Active", render: r => r.is_active ? badge("running") : badge("offline") },
      ],
      fields: [
        { key: "username", label: "Username", type: "text", required: true },
        { key: "full_name", label: "Full Name", type: "text", required: true },
        { key: "email", label: "Email", type: "text", required: true },
        { key: "role", label: "Role", type: "select", required: true,
          options: ["admin", "manager", "technician"].map(v => ({ value: v, label: v })) },
        { key: "password", label: "Password (leave blank to keep unchanged)", type: "text" },
        { key: "is_active", label: "Active", type: "checkbox", default: true },
      ],
    });
  },
};
