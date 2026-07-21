/* ==========================================================================
   Generic CRUD table + modal builder.
   Config shape:
   {
     panelId, title, subtitle, endpoint,
     columns: [{ key, label, numeric, render(row) }],
     fields: [{ key, label, type: text|number|date|datetime|select|textarea, options, required }],
     canCreate, canEdit, canDelete,   // booleans, defaulted from role
     extraParams: () => ({...})       // additional query params (filters)
   }
   ========================================================================== */
function roleAllows(min) {
  const role = Api.role();
  const order = { technician: 1, manager: 2, admin: 3 };
  return order[role] >= order[min];
}

async function buildCrudPanel(cfg) {
  const panel = document.getElementById(cfg.panelId);
  if (!panel) return;

  const canCreate = cfg.canCreate ?? roleAllows("technician");
  const canEdit = cfg.canEdit ?? roleAllows("manager");
  const canDelete = cfg.canDelete ?? roleAllows("admin");

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">${cfg.title}<small>${cfg.subtitle || ""}</small></div>
      ${canCreate ? `<button class="btn btn-primary btn-sm" id="${cfg.panelId}-add">+ Add</button>` : ""}
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>${cfg.columns.map(c => `<th class="${c.numeric ? "numeric" : ""}">${c.label}</th>`).join("")}${(canEdit || canDelete) ? "<th>Actions</th>" : ""}</tr></thead>
        <tbody id="${cfg.panelId}-tbody"><tr><td colspan="${cfg.columns.length + 1}" class="empty-state">Loading…</td></tr></tbody>
      </table>
    </div>
  `;

  async function reload() {
    const tbody = document.getElementById(`${cfg.panelId}-tbody`);
    try {
      const params = cfg.extraParams ? cfg.extraParams() : {};
      const rows = await Api.get(cfg.endpoint, params);
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}" class="empty-state">No records for the selected filters.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(row => `
        <tr>
          ${cfg.columns.map(c => `<td class="${c.numeric ? "numeric" : ""}">${c.render ? c.render(row) : (row[c.key] ?? "—")}</td>`).join("")}
          ${(canEdit || canDelete) ? `
            <td><div class="row-actions">
              ${canEdit ? `<button data-act="edit" data-id="${row.id}">Edit</button>` : ""}
              ${canDelete ? `<button data-act="del" data-id="${row.id}" class="danger">Delete</button>` : ""}
            </div></td>` : ""}
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-act=edit]").forEach(btn =>
        btn.addEventListener("click", () => openModal(rows.find(r => String(r.id) === btn.dataset.id))));
      tbody.querySelectorAll("[data-act=del]").forEach(btn =>
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this record? This cannot be undone.")) return;
          try {
            await Api.del(`${cfg.endpoint}/${btn.dataset.id}`);
            toast("Record deleted");
            reload();
          } catch (e) { toast(e.message, "error"); }
        }));
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}" class="empty-state">${e.message}</td></tr>`;
    }
  }

  function openModal(existing) {
    const isEdit = !!existing;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? "Edit" : "Add"} ${cfg.title}</div>
          <button class="icon-btn" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <form id="modal-form">
            ${cfg.fields.map(f => renderField(f, existing)).join("")}
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelector("#modal-close").addEventListener("click", close);
    backdrop.querySelector("#modal-cancel").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

    backdrop.querySelector("#modal-save").addEventListener("click", async () => {
      const form = backdrop.querySelector("#modal-form");
      if (!form.reportValidity()) return;
      const payload = {};
      cfg.fields.forEach(f => {
        const el = form.querySelector(`[name="${f.key}"]`);
        let val = el.value;
        if (f.type === "number") val = val === "" ? null : parseFloat(val);
        if (f.type === "checkbox") val = el.checked;
        if (val === "" && !f.required) val = null;
        payload[f.key] = val;
      });
      try {
        if (isEdit) {
          await Api.put(`${cfg.endpoint}/${existing.id}`, payload);
          toast("Record updated");
        } else {
          await Api.post(cfg.endpoint, payload);
          toast("Record created");
        }
        close();
        reload();
      } catch (e) { toast(e.message, "error"); }
    });
  }

  function renderField(f, existing) {
    const val = existing ? (existing[f.key] ?? "") : (f.default ?? "");
    const req = f.required ? "required" : "";
    let control = "";
    if (f.type === "select") {
      control = `<select class="field-select" name="${f.key}" ${req}>
        ${f.options.map(o => `<option value="${o.value}" ${String(o.value) === String(val) ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>`;
    } else if (f.type === "textarea") {
      control = `<textarea class="field-input" name="${f.key}" rows="3" ${req}>${val}</textarea>`;
    } else if (f.type === "checkbox") {
      control = `<input type="checkbox" name="${f.key}" ${val ? "checked" : ""} />`;
    } else if (f.type === "datetime") {
      const v = val ? new Date(val).toISOString().slice(0, 16) : "";
      control = `<input class="field-input" type="datetime-local" name="${f.key}" value="${v}" ${req} />`;
    } else {
      control = `<input class="field-input" type="${f.type || "text"}" name="${f.key}" value="${val}" ${req} />`;
    }
    return `<div class="form-group"><label class="field-label">${f.label}</label>${control}</div>`;
  }

  if (canCreate) {
    document.getElementById(`${cfg.panelId}-add`).addEventListener("click", () => openModal(null));
  }

  await reload();
  return reload;
}
