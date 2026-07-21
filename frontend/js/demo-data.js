/* ==========================================================================
   DEMO MODE — runs the entire app with realistic mock data, no backend
   required. Loaded BEFORE api.js and only takes effect when
   window.MAP_DEMO_MODE is true (see index.html).

   This lets you open index.html directly (double-click the file, or host
   it on GitHub Pages with nothing else deployed) and see a fully working,
   fully populated dashboard immediately. When you're ready to connect a
   real backend, set MAP_DEMO_MODE to false and set MAP_API_BASE instead —
   nothing else in the app needs to change.
   ========================================================================== */
(function () {
  if (!window.MAP_DEMO_MODE) return;

  const DEMO_USERS = {
    admin: { password: "Admin123!", role: "admin", username: "admin" },
    manager: { password: "Manager123!", role: "manager", username: "manager" },
    technician: { password: "Tech123!", role: "technician", username: "technician" },
  };

  function normalizeUserRecord(user) {
    const username = user.username || "user";
    const password = user.password || DEMO_USERS[username]?.password || "Admin123!";
    const role = user.role || DEMO_USERS[username]?.role || "technician";
    return { ...user, username, password, role, is_active: user.is_active !== false };
  }

  function syncUserCredentials(user) {
    if (!user || !user.username) return;
    DEMO_USERS[user.username] = {
      password: user.password || DEMO_USERS[user.username]?.password || "Admin123!",
      role: user.role || DEMO_USERS[user.username]?.role || "technician",
      username: user.username,
    };
  }

  const MACHINE_TYPES = [
    ["CNC Mill 1", "Line A — Machining"], ["CNC Lathe 2", "Line A — Machining"],
    ["Robotic Welding Cell 3", "Line B — Welding & Assembly"], ["Robotic Welding Cell 4", "Line B — Welding & Assembly"],
    ["Stamping Press 5", "Line C — Forming"], ["Injection Molding 6", "Line C — Forming"],
    ["Conveyor System 7", "Line D — Packaging"], ["Vision Inspection 8", "Line D — Packaging"],
    ["CNC Mill 9", "Line A — Machining"], ["CNC Lathe 10", "Line A — Machining"],
    ["Robotic Welding Cell 11", "Line B — Welding & Assembly"], ["Stamping Press 12", "Line C — Forming"],
  ];
  const LINE_NAMES = ["Line A — Machining", "Line B — Welding & Assembly", "Line C — Forming", "Line D — Packaging"];
  const STATUSES = ["running", "running", "running", "idle", "down", "maintenance"];

  function seededRand(seed) {
    let s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  const rand = seededRand(42);

  const lines = LINE_NAMES.map((name, i) => ({
    id: i + 1, name, description: "", location: `Bay ${i + 1}`, is_active: true,
  }));

  const machines = MACHINE_TYPES.map(([name, lineName], i) => ({
    id: i + 1,
    asset_tag: `MC-${1000 + i}`,
    name,
    machine_type: name.replace(/ \d+$/, ""),
    manufacturer: ["Haas", "Mazak", "Yaskawa Motoman", "Schuler", "Engel", "Dorner", "Cognex"][i % 7],
    model_number: `M-${100 + i}`,
    production_line_id: lines.find(l => l.name === lineName).id,
    status: STATUSES[Math.floor(rand() * STATUSES.length)],
    ideal_cycle_time_seconds: 20 + Math.floor(rand() * 40),
    is_active: true,
  }));

  function machineOee(m) {
    const availability = 78 + rand() * 18;
    const performance = 70 + rand() * 25;
    const quality = 92 + rand() * 7;
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
    return {
      machine_id: m.id, machine_name: m.name,
      availability: +availability.toFixed(1), performance: +performance.toFixed(1),
      quality: +quality.toFixed(1), oee: +oee.toFixed(1),
      units_produced: Math.floor(4000 + rand() * 12000),
      units_rejected: Math.floor(50 + rand() * 400),
      downtime_minutes: +(rand() * 800).toFixed(1),
    };
  }
  const oeeRows = machines.map(machineOee);

  function last30Days() {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const target = 8000 + Math.floor(rand() * 2000);
      const produced = Math.floor(target * (0.82 + rand() * 0.2));
      days.push({
        period: d.toISOString().slice(0, 10),
        units_produced: produced, target_units: target,
        units_rejected: Math.floor(produced * (0.01 + rand() * 0.05)),
      });
    }
    return days;
  }

  const DOWNTIME_CATEGORIES = ["unplanned_mechanical", "unplanned_electrical", "planned_maintenance", "changeover", "material_shortage", "operator_break", "quality_hold", "other"];
  const DEFECT_TYPES = ["Dimensional out-of-tolerance", "Surface finish defect", "Weld porosity", "Warping", "Incomplete fill", "Contamination"];

  let nextId = 5000;
  const store = {
    downtime: DOWNTIME_CATEGORIES.map((cat, i) => ({
      id: ++nextId, machine_id: (i % machines.length) + 1, category: cat,
      reason: "Sample " + cat.replace(/_/g, " "), start_time: new Date(Date.now() - i * 86400000).toISOString(),
      end_time: new Date(Date.now() - i * 86400000 + 3600000).toISOString(),
      duration_minutes: 30 + i * 12, reported_by: "Demo Operator", resolved: true,
    })),
    maintenance: machines.slice(0, 8).map((m, i) => ({
      id: ++nextId, machine_id: m.id,
      maintenance_type: ["preventive", "corrective", "predictive", "emergency"][i % 4],
      status: ["scheduled", "in_progress", "completed", "completed"][i % 4],
      description: "Sample maintenance record " + (i + 1),
      scheduled_date: new Date(Date.now() - i * 43200000).toISOString(),
      start_time: null, end_time: null, cost: 200 + i * 150,
      parts_replaced: null, failure_code: i % 3 === 0 ? `F-${100 + i}` : null,
    })),
    quality: DEFECT_TYPES.map((defect, i) => ({
      id: ++nextId, machine_id: (i % machines.length) + 1, inspection_date: new Date(Date.now() - i * 86400000).toISOString(),
      defect_type: defect, severity: ["minor", "major", "critical"][i % 3],
      quantity_scrapped: 5 + i * 3, quantity_reworked: i, root_cause: "Tool wear", inspector_name: "QC - Demo",
    })),
    production: machines.map((m, i) => ({
      id: ++nextId, machine_id: m.id, shift_id: (i % 3) + 1,
      production_date: new Date().toISOString(), planned_production_time_minutes: 480,
      units_produced: 500 + i * 30, units_rejected: 10 + i, target_units: 550 + i * 30,
      operator_name: "Demo Operator", notes: "",
    })),
    users: [
      normalizeUserRecord({ id: 1, username: "admin", email: "admin@demo.local", full_name: "Alex Rivera", role: "admin", password: "Admin123!", is_active: true, created_at: new Date().toISOString() }),
      normalizeUserRecord({ id: 2, username: "manager", email: "manager@demo.local", full_name: "Jordan Lee", role: "manager", password: "Manager123!", is_active: true, created_at: new Date().toISOString() }),
      normalizeUserRecord({ id: 3, username: "technician", email: "tech@demo.local", full_name: "Sam Okafor", role: "technician", password: "Tech123!", is_active: true, created_at: new Date().toISOString() }),
    ],
  };

  store.users.forEach(syncUserCredentials);

  function statusOverview() {
  };

  function statusOverview() {
    const out = {};
    machines.forEach(m => { out[m.status] = (out[m.status] || 0) + 1; });
    return out;
  }

  function shiftPerformance() {
    return ["day", "evening", "night"].map(s => ({
      shift: s, units_produced: Math.floor(6000 + rand() * 3000),
      units_rejected: Math.floor(100 + rand() * 200), avg_units_per_record: Math.floor(500 + rand() * 200),
    }));
  }

  function downtimePareto() {
    return DOWNTIME_CATEGORIES.map(cat => ({
      category: cat, total_minutes: Math.floor(200 + rand() * 2000), event_count: Math.floor(3 + rand() * 20),
    })).sort((a, b) => b.total_minutes - a.total_minutes);
  }

  function scrapQuality() {
    return DEFECT_TYPES.map(d => ({
      defect_type: d, severity: ["minor", "major", "critical"][Math.floor(rand() * 3)],
      quantity_scrapped: Math.floor(10 + rand() * 100), quantity_reworked: Math.floor(rand() * 20),
      event_count: Math.floor(2 + rand() * 15),
    }));
  }

  function kpiSummary() {
    const n = oeeRows.length;
    const avg = k => +(oeeRows.reduce((s, r) => s + r[k], 0) / n).toFixed(2);
    const productionRows = store.production;
    const totalProduced = productionRows.reduce((s, r) => s + (r.units_produced || 0), 0);
    const totalTarget = productionRows.reduce((s, r) => s + (r.target_units || 0), 0);
    const totalRejected = productionRows.reduce((s, r) => s + (r.units_rejected || 0), 0);
    const qualityRate = totalProduced ? +((1 - totalRejected / totalProduced) * 100).toFixed(1) : 100;
    const downtimeRows = downtimePareto();
    const defectRows = scrapQuality();
    return {
      total_units_produced: oeeRows.reduce((s, r) => s + r.units_produced, 0),
      total_units_rejected: oeeRows.reduce((s, r) => s + r.units_rejected, 0),
      overall_oee: avg("oee"), overall_availability: avg("availability"),
      overall_performance: avg("performance"), overall_quality: avg("quality"),
      total_downtime_minutes: +oeeRows.reduce((s, r) => s + r.downtime_minutes, 0).toFixed(1),
      active_machines: machines.filter(m => m.is_active).length,
      machines_down: machines.filter(m => m.status === "down").length,
      open_maintenance_alerts: store.maintenance.filter(m => ["scheduled", "in_progress"].includes(m.status)).length,
      target_attainment_pct: +(totalTarget ? (totalProduced / totalTarget) * 100 : 0).toFixed(1),
      quality_rate_pct: qualityRate,
      top_downtime_category: downtimeRows[0] ? downtimeRows[0].category.replace(/_/g, " ") : "—",
      top_downtime_minutes: downtimeRows[0] ? downtimeRows[0].total_minutes : 0,
      top_defect_type: defectRows[0] ? defectRows[0].defect_type : "—",
      top_defect_scrapped: defectRows[0] ? defectRows[0].quantity_scrapped : 0,
    };
  }

  function maintenanceAlerts() {
    return store.maintenance.filter(m => ["scheduled", "in_progress"].includes(m.status)).map(m => ({
      id: m.id, machine_id: m.machine_id, machine_name: machines.find(x => x.id === m.machine_id).name,
      type: m.maintenance_type, status: m.status, description: m.description, scheduled_date: m.scheduled_date,
    }));
  }

  function topBottomMachines(n) {
    const ranked = [...oeeRows].sort((a, b) => b.oee - a.oee);
    return { top: ranked.slice(0, n), bottom: ranked.slice(-n).reverse() };
  }

  function equipmentUtilization() {
    return oeeRows.map(r => ({
      machine_id: r.machine_id, machine_name: r.machine_name,
      status: machines.find(m => m.id === r.machine_id).status,
      utilization_pct: r.availability, throughput: r.units_produced,
    })).sort((a, b) => b.utilization_pct - a.utilization_pct);
  }

  function mtbfMttr(machineId) {
    const failureCount = Math.floor(1 + rand() * 6);
    return {
      machine_id: machineId || null, failure_count: failureCount,
      mtbf_hours: +(80 + rand() * 400).toFixed(1), mttr_hours: +(1 + rand() * 8).toFixed(1),
      total_repair_hours: +(failureCount * (1 + rand() * 8)).toFixed(1),
    };
  }

  // ---- Routing table: GET path -> generator ----------------------------
  function routeGet(path, params) {
    if (path === "/api/production-lines") return lines;
    if (path === "/api/machines") return machines;
    if (path === "/api/shifts") return [{ id: 1, name: "day", start_time: "06:00", end_time: "14:00" }, { id: 2, name: "evening", start_time: "14:00", end_time: "22:00" }, { id: 3, name: "night", start_time: "22:00", end_time: "06:00" }];
    if (path === "/api/dashboard/kpi-summary") return kpiSummary();
    if (path === "/api/dashboard/oee") {
      if (params && params.machine_id) return oeeRows.filter(r => String(r.machine_id) === String(params.machine_id));
      return oeeRows;
    }
    if (path === "/api/dashboard/machine-status-overview") return statusOverview();
    if (path === "/api/dashboard/shift-performance") return shiftPerformance();
    if (path === "/api/dashboard/maintenance-alerts") return maintenanceAlerts();
    if (path === "/api/dashboard/production-trend") return last30Days();
    if (path === "/api/dashboard/downtime-pareto") return downtimePareto();
    if (path === "/api/dashboard/scrap-quality") return scrapQuality();
    if (path === "/api/dashboard/top-bottom-machines") return topBottomMachines((params && params.n) || 5);
    if (path === "/api/dashboard/equipment-utilization") return equipmentUtilization();
    if (path === "/api/dashboard/mtbf-mttr") return mtbfMttr(params && params.machine_id);
    if (path === "/api/production-records") return store.production;
    if (path === "/api/downtime-events") return store.downtime;
    if (path === "/api/maintenance-records") {
      if (params && params.maintenance_type) return store.maintenance.filter(m => m.maintenance_type === params.maintenance_type);
      return store.maintenance;
    }
    if (path === "/api/quality-records") return store.quality;
    if (path === "/api/users") return store.users;
    return [];
  }

  function collectionFor(path) {
    if (path.startsWith("/api/downtime-events")) return store.downtime;
    if (path.startsWith("/api/maintenance-records")) return store.maintenance;
    if (path.startsWith("/api/quality-records")) return store.quality;
    if (path.startsWith("/api/production-records")) return store.production;
    if (path.startsWith("/api/users")) return store.users;
    if (path.startsWith("/api/machines")) return machines;
    if (path.startsWith("/api/production-lines")) return lines;
    return null;
  }

  // ---- Demo Api implementation (same interface as the real Api) --------
  window.Api = {
    token() { return localStorage.getItem("map_demo_token"); },
    role() { return localStorage.getItem("map_demo_role"); },
    username() { return localStorage.getItem("map_demo_username"); },
    setSession(token, role, username) {
      localStorage.setItem("map_demo_token", token);
      localStorage.setItem("map_demo_role", role);
      localStorage.setItem("map_demo_username", username);
    },
    clearSession() {
      localStorage.removeItem("map_demo_token");
      localStorage.removeItem("map_demo_role");
      localStorage.removeItem("map_demo_username");
    },
    async login(username, password) {
      await new Promise(r => setTimeout(r, 250)); // feels like a real request
      const userRecord = store.users.find(u => u.username === username);
      const u = userRecord ? normalizeUserRecord(userRecord) : (DEMO_USERS[username] || DEMO_USERS.admin);
      if (!u) {
        throw new Error("Incorrect username or password");
      }
      if (!password) {
        throw new Error("Password required");
      }
      if (u.password !== password) {
        throw new Error("Incorrect username or password");
      }
      return { access_token: "demo-token-" + username, role: u.role, username: u.username };
    },
    async get(path, params) {
      await new Promise(r => setTimeout(r, 120));
      return JSON.parse(JSON.stringify(routeGet(path, params || {})));
    },
    async post(path, body) {
      await new Promise(r => setTimeout(r, 120));
      if (path === "/api/users") {
        const record = normalizeUserRecord({ id: ++nextId, ...body, created_at: new Date().toISOString() });
        store.users.unshift(record);
        syncUserCredentials(record);
        return record;
      }
      const coll = collectionFor(path);
      if (coll) {
        const record = { id: ++nextId, ...body };
        coll.unshift(record);
        return record;
      }
      return { id: ++nextId, ...body };
    },
    async put(path, body) {
      await new Promise(r => setTimeout(r, 120));
      const [base, id] = path.split(/\/(\d+)$/);
      const coll = collectionFor(base);
      if (coll) {
        const row = coll.find(r => String(r.id) === String(id));
        if (row) {
          const nextPayload = { ...body };
          if (base === "/api/users") {
            if (nextPayload.password === undefined || nextPayload.password === null || nextPayload.password === "") {
              nextPayload.password = row.password || "Admin123!";
            }
            const updated = normalizeUserRecord({ ...row, ...nextPayload });
            Object.assign(row, updated);
            syncUserCredentials(row);
            return row;
          }
          Object.assign(row, body);
        }
        return row;
      }
      return body;
    },
    async del(path) {
      await new Promise(r => setTimeout(r, 120));
      const [base, id] = path.split(/\/(\d+)$/);
      const coll = collectionFor(base);
      if (coll) {
        const idx = coll.findIndex(r => String(r.id) === String(id));
        if (idx >= 0) coll.splice(idx, 1);
      }
      return null;
    },
    async downloadFile() {
      alert("Exports require a real backend — this demo runs entirely in your browser with no server to generate files.");
    },
  };

  console.info("%cMAP demo mode active — all data is generated in-browser. No backend required.", "color:#12959F;font-weight:bold;");
})();
