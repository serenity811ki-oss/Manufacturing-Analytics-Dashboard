/* ==========================================================================
   View templates — static HTML skeletons injected into #view-container.
   app.js fills these with live data per view activation.
   ========================================================================== */
const Views = {

  "production-dashboard": `
    <div class="kpi-grid" id="kpi-grid"></div>
    <div class="panel-grid">
      <div class="panel panel-full">
        <div class="panel-header">
          <div class="panel-title">Production Trend<small>Units produced vs. target &amp; rejected</small></div>
        </div>
        <div class="chart-wrap tall"><canvas id="chart-production-trend"></canvas></div>
      </div>
      <div class="panel panel-full">
        <div class="panel-header"><div class="panel-title">Operational Snapshot<small>Current period highlights</small></div></div>
        <div class="panel-grid" id="dashboard-insights" style="margin-bottom:0;"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Machine Status Overview<small>Live status distribution</small></div></div>
        <div class="chart-wrap"><canvas id="chart-machine-status"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Shift Performance<small>Units produced by shift</small></div></div>
        <div class="chart-wrap"><canvas id="chart-shift-perf-mini"></canvas></div>
      </div>
      <div class="panel panel-full">
        <div class="panel-header"><div class="panel-title">Maintenance Alerts<small>Scheduled &amp; in-progress work orders</small></div></div>
        <div id="alerts-list"></div>
      </div>
    </div>
  `,

  "machine-performance": `
    <div class="panel-grid">
      <div class="panel panel-full">
        <div class="panel-header"><div class="panel-title">Top &amp; Bottom Performing Machines<small>Ranked by OEE</small></div></div>
        <div class="panel-grid" style="margin-bottom:0;">
          <div><div class="chart-wrap"><canvas id="chart-top-machines"></canvas></div></div>
          <div><div class="chart-wrap"><canvas id="chart-bottom-machines"></canvas></div></div>
        </div>
      </div>
      <div class="panel panel-full">
        <div class="panel-header"><div class="panel-title">Equipment Utilization<small>Availability % by machine</small></div></div>
        <div class="chart-wrap tall"><canvas id="chart-utilization"></canvas></div>
      </div>
    </div>
  `,

  "oee": `
    <div class="kpi-grid" id="oee-kpi-grid"></div>
    <div class="panel panel-full">
      <div class="panel-header"><div class="panel-title">OEE by Machine<small>Availability × Performance × Quality</small></div></div>
      <div class="table-scroll">
        <table class="data-table" id="oee-table">
          <thead><tr><th>Machine</th><th class="numeric">Availability</th><th class="numeric">Performance</th><th class="numeric">Quality</th><th class="numeric">OEE</th><th class="numeric">Units</th><th class="numeric">Downtime (min)</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `,

  "downtime-analysis": `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Downtime Root-Cause Pareto<small>Total minutes by category</small></div></div>
        <div class="chart-wrap tall"><canvas id="chart-downtime-pareto"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Downtime Share<small>By category</small></div></div>
        <div class="chart-wrap tall"><canvas id="chart-downtime-pie"></canvas></div>
      </div>
    </div>
    <div class="panel panel-full" id="downtime-crud-panel"></div>
  `,

  "predictive-maintenance": `
    <div class="kpi-grid" id="predictive-kpi-grid"></div>
    <div class="panel panel-full">
      <div class="panel-header"><div class="panel-title">Machines Flagged for Predictive Review<small>Based on recent predictive maintenance records &amp; failure codes</small></div></div>
      <div class="table-scroll">
        <table class="data-table" id="predictive-table">
          <thead><tr><th>Machine</th><th>Failure Code</th><th>Description</th><th>Scheduled</th><th>Status</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `,

  "maintenance-history": `<div class="panel panel-full" id="maintenance-crud-panel"></div>`,

  "failure-analysis": `
    <div class="kpi-grid" id="failure-kpi-grid"></div>
    <div class="panel panel-full">
      <div class="panel-header"><div class="panel-title">MTBF / MTTR by Machine<small>Mean Time Between Failures &amp; Mean Time To Repair</small></div></div>
      <div class="table-scroll">
        <table class="data-table" id="failure-table">
          <thead><tr><th>Machine</th><th class="numeric">Failures</th><th class="numeric">MTBF (hrs)</th><th class="numeric">MTTR (hrs)</th><th class="numeric">Total Repair (hrs)</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `,

  "efficiency-reports": `
    <div class="panel-grid">
      <div class="panel panel-full">
        <div class="panel-header"><div class="panel-title">Production Efficiency Trend<small>Actual vs target output</small></div></div>
        <div class="chart-wrap tall"><canvas id="chart-efficiency-trend"></canvas></div>
      </div>
      <div class="panel panel-full">
        <div class="panel-header"><div class="panel-title">Weekly Throughput Heatmap<small>Units produced — machine × day of week</small></div></div>
        <div id="heatmap-throughput"></div>
      </div>
    </div>
  `,

  "shift-performance": `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Units Produced by Shift<small>Selected period</small></div></div>
        <div class="chart-wrap"><canvas id="chart-shift-bar"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Rejects by Shift<small>Quality comparison</small></div></div>
        <div class="chart-wrap"><canvas id="chart-shift-rejects"></canvas></div>
      </div>
    </div>
  `,

  "quality": `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Scrap by Defect Type<small>Quantity scrapped</small></div></div>
        <div class="chart-wrap tall"><canvas id="chart-scrap-defect"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Defect Severity Mix<small>Event count</small></div></div>
        <div class="chart-wrap tall"><canvas id="chart-severity-mix"></canvas></div>
      </div>
    </div>
    <div class="panel panel-full" id="quality-crud-panel"></div>
  `,

  "machines-admin": `
    <div class="panel panel-full" id="lines-crud-panel" style="margin-bottom:16px;"></div>
    <div class="panel panel-full" id="machines-crud-panel"></div>
  `,

  "reports": `
    <div class="panel panel-full">
      <div class="panel-header"><div class="panel-title">Export &amp; Reports<small>Download filtered data for offline analysis or sharing</small></div></div>
      <div class="panel-grid" style="margin-bottom:0;">
        <div class="panel" style="box-shadow:none;">
          <div class="panel-title" style="margin-bottom:10px;">Production Records</div>
          <div class="pill-group">
            <button class="btn btn-secondary btn-sm" data-export="csv" data-dataset="production">CSV</button>
            <button class="btn btn-secondary btn-sm" data-export="excel" data-dataset="production">Excel</button>
          </div>
        </div>
        <div class="panel" style="box-shadow:none;">
          <div class="panel-title" style="margin-bottom:10px;">Downtime Events</div>
          <div class="pill-group">
            <button class="btn btn-secondary btn-sm" data-export="csv" data-dataset="downtime">CSV</button>
            <button class="btn btn-secondary btn-sm" data-export="excel" data-dataset="downtime">Excel</button>
          </div>
        </div>
        <div class="panel" style="box-shadow:none;">
          <div class="panel-title" style="margin-bottom:10px;">Maintenance Records</div>
          <div class="pill-group">
            <button class="btn btn-secondary btn-sm" data-export="csv" data-dataset="maintenance">CSV</button>
            <button class="btn btn-secondary btn-sm" data-export="excel" data-dataset="maintenance">Excel</button>
          </div>
        </div>
        <div class="panel" style="box-shadow:none;">
          <div class="panel-title" style="margin-bottom:10px;">Quality Records</div>
          <div class="pill-group">
            <button class="btn btn-secondary btn-sm" data-export="csv" data-dataset="quality">CSV</button>
            <button class="btn btn-secondary btn-sm" data-export="excel" data-dataset="quality">Excel</button>
          </div>
        </div>
        <div class="panel" style="box-shadow:none;">
          <div class="panel-title" style="margin-bottom:10px;">Printable OEE Summary</div>
          <div class="pill-group">
            <button class="btn btn-primary btn-sm" id="export-oee-pdf">Generate PDF</button>
          </div>
          <div class="text-muted" style="font-size:12px;margin-top:8px;">Plant-wide OEE report, ready to print or share with leadership.</div>
        </div>
      </div>
    </div>
  `,

  "data-entry": `
    <div class="panel panel-full upload-card">
      <div class="panel-header"><div class="panel-title">Upload Excel Data<small>Batch import production, downtime, maintenance or quality records</small></div></div>
      <div class="panel-body upload-body">
        <label class="field-label" for="excel-upload-input">Select Excel or CSV file</label>
        <input id="excel-upload-input" class="field-input" type="file" accept=".xlsx,.xls,.csv" />
        <div class="upload-actions">
          <button id="excel-upload-btn" class="btn btn-primary btn-sm">Upload File</button>
          <div id="excel-upload-status" class="upload-status">No file selected yet.</div>
        </div>
        <div class="text-muted" style="margin-top:10px;">Note: Upload preview is local in demo mode. Connect a backend to process and save Excel data automatically.</div>
      </div>
    </div>

    <div class="panel panel-full manual-entry-card">
      <div class="panel-header"><div class="panel-title">Manual Data Entry<small>Enter a single record directly into the system</small></div></div>
      <div class="panel-body">
        <form id="manual-entry-form">
          <div class="manual-entry-grid">
            <div>
              <label class="field-label" for="manual-machine">Machine</label>
              <select id="manual-machine" class="field-select" required></select>
            </div>
            <div>
              <label class="field-label" for="manual-date">Date</label>
              <input id="manual-date" class="field-input" type="date" required />
            </div>
            <div>
              <label class="field-label" for="manual-units-produced">Units Produced</label>
              <input id="manual-units-produced" class="field-input" type="number" min="0" required />
            </div>
            <div>
              <label class="field-label" for="manual-units-rejected">Units Rejected</label>
              <input id="manual-units-rejected" class="field-input" type="number" min="0" required />
            </div>
          </div>
          <div class="form-group">
            <label class="field-label" for="manual-notes">Notes</label>
            <textarea id="manual-notes" class="field-input" rows="3" placeholder="Optional notes or description"></textarea>
          </div>
          <div class="manual-entry-footer">
            <button type="submit" class="btn btn-primary btn-sm">Save Manual Record</button>
            <div id="manual-entry-status" class="upload-status">No manual entries added yet.</div>
          </div>
        </form>
        <div class="manual-entry-table" id="manual-entry-table"></div>
      </div>
    </div>
  `,

  "users-admin": `<div class="panel panel-full" id="users-crud-panel"></div>`,
};

const ViewTitles = {
  "production-dashboard": "Production Dashboard",
  "machine-performance": "Machine Performance Monitoring",
  "oee": "Overall Equipment Effectiveness (OEE)",
  "downtime-analysis": "Downtime Analysis",
  "predictive-maintenance": "Predictive Maintenance",
  "maintenance-history": "Maintenance History",
  "failure-analysis": "Equipment Failure Analysis",
  "efficiency-reports": "Production Efficiency Reports",
  "shift-performance": "Shift Performance",
  "quality": "Scrap & Quality Analysis",
  "machines-admin": "Machines & Production Lines",
  "reports": "Reports & Export",
  "data-entry": "Data Upload & Manual Entry",
  "users-admin": "User Management",
};
