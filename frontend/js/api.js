/* ==========================================================================
   API client
   Configure API_BASE for split deployments (e.g. GitHub Pages frontend +
   Render/Railway backend). Defaults to same-origin for single-container use.

   NOTE: when window.MAP_DEMO_MODE is true, js/demo-data.js (loaded before
   this file) already sets window.Api to a fully working in-browser mock —
   this file skips defining the real network client so it doesn't overwrite it.
   ========================================================================== */
if (!window.MAP_DEMO_MODE) {
  const API_BASE = (window.MAP_API_BASE || "").replace(/\/$/, "");

  window.Api = {
    token() { return localStorage.getItem("map_token"); },
    role() { return localStorage.getItem("map_role"); },
    username() { return localStorage.getItem("map_username"); },

    setSession(token, role, username) {
      localStorage.setItem("map_token", token);
      localStorage.setItem("map_role", role);
      localStorage.setItem("map_username", username);
    },
    clearSession() {
      localStorage.removeItem("map_token");
      localStorage.removeItem("map_role");
      localStorage.removeItem("map_username");
    },

    getApiUrl(path) {
      let base = API_BASE || window.location.origin;
      if (!base || base === "null") {
        base = "http://localhost:8000";
      }
      return `${base}${path}`;
    },

    async login(username, password) {
      const body = new URLSearchParams();
      body.set("username", username);
      body.set("password", password);
      const res = await fetch(this.getApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Login failed");
      }
      return res.json();
    },

    async request(path, { method = "GET", body = null, params = null, raw = false } = {}) {
      let url = this.getApiUrl(path);
      if (params) {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") qs.set(k, v);
        });
        const s = qs.toString();
        if (s) url += `?${s}`;
      }
      const headers = { "Authorization": `Bearer ${this.token()}` };
      if (body) headers["Content-Type"] = "application/json";

      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

      if (res.status === 401) {
        window.Api.clearSession();
        if (window.App && typeof window.App.showLogin === "function") {
          window.App.showLogin();
        } else {
          window.location.reload();
        }
        throw new Error("Session expired");
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Request failed");
      }
      if (raw) return res;
      if (res.status === 204) return null;
      return res.json();
    },

    get(path, params) { return this.request(path, { method: "GET", params }); },
    post(path, body) { return this.request(path, { method: "POST", body }); },
    put(path, body) { return this.request(path, { method: "PUT", body }); },
    del(path) { return this.request(path, { method: "DELETE" }); },

    async downloadFile(path, params, filename) {
      const res = await this.request(path, { method: "GET", params, raw: true });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    },
  };
}
