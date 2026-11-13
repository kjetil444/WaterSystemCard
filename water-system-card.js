/*
 * water-system-card  v1.3.0
 * Home Assistant custom Lovelace card: well → pump (with pump guard) → pressure tank → valve → house + water heater.
 * Self-contained, no HACS dependencies. Every entity is optional. Includes a visual editor.
 */

const WSC_VERSION = "1.3.0";
const C = { water: "#38bdf8", ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444", frost: "#60a5fa", heat: "#f97316", hot: "#f43f5e" };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ON_STATES = ["on", "open", "opening", "heat", "heating"];
const BAD_STATES = ["unavailable", "unknown"];

const DEFAULTS = {
  name: null,
  tank_location: "box",          // "box" = separate insulated tank box outside, "house" = tank inside the house
  cut_in: 2.0,
  cut_out: 3.5,
  max_pressure: 6,
  low_pressure: null,
  min_temp: 3,
  trace_warn_temp: 0,            // warn if outdoor temp is below this and the heat cable is off
  power_threshold: 50,
  current_threshold: 0.5,
  flow_threshold: 0.1,
  history_hours: 24,
  max_run_minutes: 20,
  short_cycle_seconds: 30,
  guard_delay: 90,
  night_start: 1,
  night_end: 5,
  night_starts_warn: 4,
  water_heater_power_threshold: 100,
  water_heater_low_temp: 50,     // below: blue + "low hot water" (legionella grows at 20–50 °C)
  water_heater_ok_temp: 60,      // at/above: red (hot)
  legionella_temp: 70,           // must be reached at least once every legionella_days
  legionella_days: 7,
  confirm: true,
  language: null,
};

const STRINGS = {
  en: {
    title: "Water supply", sub: "Well · pump · pressure tank", well: "Well", tank: "Pressure tank", house: "House", out: "Outside",
    s_normal: "Normal", s_offline: "Sensor offline", s_leak: "Leak detected", s_guard: "Pump stopped", s_valve: "Main valve closed",
    s_long: "Pump running long", s_frost: "Frost risk", s_low: "Low pressure", s_short: "Short cycling", s_pump: "Pumping", s_use: "Water in use",
    b_leak: "Leak sensor triggered – check the pump house and pipes.",
    b_guard: "Pressure is low but the pump isn't running – check the pump guard display (EIL = dry run, EIH = overcurrent, EUL = low voltage).",
    b_frost: "Tank box is at {v} – risk of frozen pipes.", b_frost_off: " Frost guard is off.",
    b_trace: "It's {v} outside and the heat cable is off.",
    b_low: "Pressure is below {v} bar.",
    b_long: "Pump has run for {v} without stopping – possible leak or low well.",
    b_short: "Pump only runs {v} per start – check the tank's air pre-charge (bladder may be waterlogged).",
    b_night: "Pump started {v} times during the night ({d}) – check toilets and taps for a hidden leak.",
    b_wh_low: "Hot water is only {v}. Below 50 °C there's little hot water and legionella can grow.",
    b_leg: "Hot water hasn't reached {v} in the last {d} days – run a legionella heat cycle.",
    t_pressure: "Pressure", t_pump: "Pump", t_current: "Pump current", t_tank: "Tank box", t_flow: "Flow", t_today: "Today", t_well: "Well level",
    t_hot: "Hot water", t_whp: "Heater", t_whe: "Heater today", t_leg: "Last ≥ {v}", today: "today", days_ago: "{v} d ago", never: "not in {v} d",
    st_starts: "Starts today", st_run: "Run time today", st_last: "Last cycle", st_now: "Running for", st_night: "Starts last night",
    h_pressure: "Pressure", h_hist: "History",
    c_pump: "Pump", c_valve: "Main valve", c_guard: "Frost guard", c_trace: "Heat cable", c_wh: "Water heater",
    on: "on", off: "off", open: "open", closed: "closed", heating: "heating", unavail: "unavailable", confirm: "Tap again to confirm", h: "h",
  },
  nb: {
    title: "Vannforsyning", sub: "Brønn · pumpe · trykktank", well: "Brønn", tank: "Trykktank", house: "Hus", out: "Ute",
    s_normal: "Normal", s_offline: "Sensor frakoblet", s_leak: "Lekkasje", s_guard: "Pumpe stoppet", s_valve: "Hovedkran stengt",
    s_long: "Lang pumpetid", s_frost: "Frostfare", s_low: "Lavt trykk", s_short: "Hyppige starter", s_pump: "Pumper", s_use: "Vann i bruk",
    b_leak: "Lekkasjesensor utløst – sjekk pumperommet og rørene.",
    b_guard: "Lavt trykk, men pumpa går ikke – sjekk displayet på pumpevakten (EIL = tørrkjøring, EIH = overstrøm, EUL = lav spenning).",
    b_frost: "Tankkassen er {v} – fare for frosne rør.", b_frost_off: " Frostvakten er av.",
    b_trace: "Det er {v} ute og varmekabelen er av.",
    b_low: "Trykket er under {v} bar.",
    b_long: "Pumpa har gått i {v} uten stopp – mulig lekkasje eller lite vann i brønnen.",
    b_short: "Pumpa går bare {v} per start – sjekk fortrykket i tanken (membranen kan være vannfylt).",
    b_night: "Pumpa startet {v} ganger i natt ({d}) – sjekk toaletter og kraner for skjult lekkasje.",
    b_wh_low: "Varmtvannet er bare {v}. Under 50 °C er det lite varmtvann, og legionella kan vokse.",
    b_leg: "Varmtvannet har ikke vært over {v} de siste {d} dagene – kjør legionellaoppvarming.",
    t_pressure: "Trykk", t_pump: "Pumpe", t_current: "Pumpestrøm", t_tank: "Tankkasse", t_flow: "Flyt", t_today: "I dag", t_well: "Brønnivå",
    t_hot: "Varmtvann", t_whp: "Bereder", t_whe: "Bereder i dag", t_leg: "Sist ≥ {v}", today: "i dag", days_ago: "{v} d siden", never: "ikke på {v} d",
    st_starts: "Starter i dag", st_run: "Gangtid i dag", st_last: "Siste syklus", st_now: "Har gått i", st_night: "Starter i natt",
    h_pressure: "Trykk", h_hist: "Historikk",
    c_pump: "Pumpe", c_valve: "Hovedkran", c_guard: "Frostvakt", c_trace: "Varmekabel", c_wh: "Bereder",
    on: "på", off: "av", open: "åpen", closed: "stengt", heating: "varmer", unavail: "utilgjengelig", confirm: "Trykk igjen for å bekrefte", h: "t",
  },
};

const STYLE = `
:host { display:block; }
ha-card { padding:16px; overflow:hidden; }
[data-info] { cursor:pointer; }
.head { display:flex; align-items:center; gap:12px; }
.head .ico { width:40px; height:40px; border-radius:12px; display:grid; place-items:center; flex:none;
  background:color-mix(in srgb, ${C.water} 18%, transparent); color:${C.water}; --mdc-icon-size:24px; }
.head .title { flex:1; min-width:0; }
.head .title b { display:block; font-size:16px; font-weight:600; color:var(--primary-text-color); }
.head .title span { font-size:12px; color:var(--secondary-text-color); }
.chip { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-size:12px; font-weight:600;
  color:var(--c); background:color-mix(in srgb, var(--c) 16%, transparent); white-space:nowrap; }
.chip i { width:8px; height:8px; border-radius:50%; background:var(--c); }
.chip.pulse i { animation:pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.35; transform:scale(1.6); } }
.banner { display:flex; align-items:flex-start; gap:10px; margin-top:10px; padding:10px 12px; border-radius:12px; font-size:13px;
  font-weight:500; line-height:1.4; color:var(--c); background:color-mix(in srgb, var(--c) 14%, transparent); --mdc-icon-size:20px; }
.banner ha-icon { flex:none; }

svg.diagram { width:100%; height:auto; display:block; margin:8px 0 2px; }
svg.diagram text { font-family:inherit; font-size:19px; fill:var(--secondary-text-color); }
svg.diagram .big { font-size:28px; font-weight:700; fill:var(--primary-text-color); }
svg.diagram .val { font-weight:600; fill:var(--primary-text-color); }
.tb { transform-box:view-box; }
.pipe-base { fill:none; stroke:color-mix(in srgb, var(--primary-text-color) 14%, transparent); stroke-width:9; stroke-linecap:round; stroke-linejoin:round; }
.pipe-water { fill:none; stroke:${C.water}; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:round; opacity:.38; transition:opacity .3s; }
.pipe-water.flow { opacity:1; stroke-dasharray:7 11; animation:flow .8s linear infinite; }
@keyframes flow { to { stroke-dashoffset:-18; } }
.wave { animation:wave 4s linear infinite; }
@keyframes wave { to { transform:translateX(-60px); } }
#pump .body { fill:color-mix(in srgb, var(--primary-text-color) 30%, transparent); transition:fill .3s; }
#pump.run .body { fill:${C.water}; }
#pump.trip .body { fill:${C.bad}; }
#pump .glow { opacity:0; }
#pump.run .glow { animation:glow 1.2s ease-in-out infinite; transform-origin:65px 249px; }
#pump.run .spin { animation:spin 1s linear infinite; transform-origin:65px 249px; }
.pipe-water.hot { stroke:${C.hot}; }
#tap .drip { opacity:0; }
#tap.on .drip { animation:drip 1s ease-in infinite; }
@keyframes drip { 0% { opacity:0; transform:translateY(-4px); } 20% { opacity:1; } 100% { opacity:0; transform:translateY(12px); } }
@keyframes glow { 0%,100% { opacity:.25; transform:scale(1); } 50% { opacity:.7; transform:scale(1.25); } }
@keyframes spin { to { transform:rotate(360deg); } }
#needle { transition:transform .7s cubic-bezier(.3,1.4,.5,1); transform-origin:380px 76px; }
.trace { fill:none; stroke:color-mix(in srgb, var(--primary-text-color) 25%, transparent); stroke-width:2.5; stroke-dasharray:3 4; transition:stroke .3s; }
.trace.on { stroke:${C.heat}; stroke-dasharray:none; stroke-width:3; filter:drop-shadow(0 0 3px ${C.heat}); }
.trace.warn { stroke:${C.frost}; }
#wh .glow { transition:opacity .3s; }
#lvl { transition:transform .8s ease; }
#wh .glow { opacity:0; }
#wh.heating .glow { animation:hglow 1.6s ease-in-out infinite; }
@keyframes hglow { 0%,100% { opacity:.15; } 50% { opacity:.55; } }

.tiles { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.tile { flex:1 1 92px; min-width:0; padding:8px 10px; border-radius:12px; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); transition:background .15s; --mdc-icon-size:14px; }
.tile:hover { background:color-mix(in srgb, var(--primary-text-color) 9%, transparent); }
.tile .lbl { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tile .lbl ha-icon { color:var(--c, var(--secondary-text-color)); flex:none; }
.tile .val { margin-top:2px; font-size:17px; font-weight:700; color:var(--primary-text-color); white-space:nowrap; }
.tile .val small { font-size:12px; font-weight:500; color:var(--secondary-text-color); margin-left:3px; }

.panel { margin-top:8px; padding:10px 12px 6px; border-radius:14px; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); }
.panel .sep { height:1px; margin:8px 0; background:color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
.stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px 4px; }
.stats div { display:flex; flex-direction:column; gap:2px; min-width:0; }
.stats span { font-size:11px; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.stats b { font-size:16px; font-weight:700; color:var(--primary-text-color); }
.stats b.warn { color:${C.warn}; }

.hist .row { display:flex; justify-content:space-between; gap:8px; font-size:11px; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; }
.hist .lg { display:inline-flex; align-items:center; gap:4px; margin-left:8px; }
.hist .lg i { width:10px; height:6px; border-radius:2px; background:${C.water}; }
.hist svg { width:100%; height:64px; display:block; margin-top:4px; }

.ctrls { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.btn { flex:1 1 130px; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px 10px; border-radius:14px; border:0;
  cursor:pointer; font:inherit; font-size:13px; font-weight:600; color:var(--primary-text-color); --mdc-icon-size:20px;
  background:color-mix(in srgb, var(--primary-text-color) 7%, transparent); transition:transform .1s, background .15s; }
.btn:active { transform:scale(.97); }
.btn[disabled] { opacity:.45; cursor:default; }
.btn.on { color:var(--c, ${C.water}); background:color-mix(in srgb, var(--c, ${C.water}) 18%, transparent); }
.btn.off-bad { color:${C.bad}; background:color-mix(in srgb, ${C.bad} 16%, transparent); }
.btn.armed { color:#fff; background:${C.bad}; animation:pulse-bg 1s ease-in-out infinite; }
@keyframes pulse-bg { 50% { filter:brightness(1.2); } }
.btn small { font-weight:500; opacity:.75; }
`;

class WaterSystemCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._hist = null;
    this._histAt = 0;
    this._histDue = 0;
    this._live = { running: null, start: null, end: null };
    this._lowSince = null;
    this._armed = null;
    this._built = false;
  }

  static getConfigElement() { return document.createElement("water-system-card-editor"); }
  static getStubConfig() { return {}; }
  getCardSize() { return 9; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...DEFAULTS, ...config };
    this._sig = "";
    this._hist = null;
    this._histAt = 0;
    this._built = false;
    if (this._hass) { this._build(); this._update(); this._loadHistory(); }
  }

  connectedCallback() {
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (this._built) this._update(); }, 30000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    const sig = this._ids().map((id) => { const s = hass.states[id]; return s ? s.state + (s.attributes.current_temperature ?? "") : "x"; }).join("|");
    if (sig !== this._sig) { this._sig = sig; this._update(); }
    this._loadHistory();
    this._loadLeg();
  }

  // ---------- helpers ----------
  _t(k, v, d) {
    const c = this._config, h = this._hass || {};
    const lang = String(c.language || (h.locale && h.locale.language) || h.language || "en").toLowerCase();
    const s = (/^(nb|nn|no)/.test(lang) ? STRINGS.nb : STRINGS.en)[k] ?? STRINGS.en[k] ?? k;
    let out = v === undefined ? s : s.replace("{v}", v);
    return d === undefined ? out : out.replace("{d}", d);
  }
  _leakIds() { const l = this._config.leak; return !l ? [] : Array.isArray(l) ? l : [l]; }
  _ids() {
    const c = this._config;
    const ids = [c.pressure, c.pump_power, c.pump_current, c.pump_switch, c.pump_running, c.pump_guard, c.valve, c.temperature, c.heat_trace, c.frost_guard, c.outdoor_temp,
      c.flow, c.water_today, c.well_level, c.water_heater, c.water_heater_temp, c.water_heater_power, c.water_heater_energy, ...this._leakIds()];
    (c.buttons || []).forEach((b) => ids.push(b.entity));
    return ids.filter(Boolean);
  }
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  _num(id) {
    const s = this._st(id);
    if (!s || BAD_STATES.includes(s.state)) return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }
  _unit(id) { return ((this._st(id) || {}).attributes || {}).unit_of_measurement || ""; }
  _factor(id) {
    const u = this._unit(id).toLowerCase();
    return { kpa: 0.01, pa: 0.00001, psi: 1 / 14.5038, mbar: 0.001, hpa: 0.001, mpa: 10, kw: 1000, ma: 0.001 }[u] ?? 1;
  }
  _scaled(id) { const v = this._num(id); return v == null ? null : v * this._factor(id); }
  _isOn(id) {
    const s = this._st(id);
    if (!s || BAD_STATES.includes(s.state)) return false;
    const d = id.split(".")[0];
    if (d === "water_heater" || d === "climate") return s.state !== "off";
    return ON_STATES.includes(s.state);
  }
  _fmt(v, d = 1) { return v == null ? "–" : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
  _dur(ms, secs = true) {
    const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h) return `${h} ${this._t("h")} ${m} min`;
    if (m) return secs && m < 10 && r ? `${m} min ${r} s` : `${m} min`;
    return `${s} s`;
  }
  _runSrc() {
    const c = this._config;
    if (c.pump_power) return { id: c.pump_power, type: "num", thr: c.power_threshold };
    if (c.pump_current) return { id: c.pump_current, type: "num", thr: c.current_threshold };
    if (c.pump_running) return { id: c.pump_running, type: "bin" };
    return null;
  }

  // ---------- events ----------
  _onClick(ev) {
    const el = ev.target.closest("[data-action],[data-info]");
    if (!el) return;
    if (el.dataset.action) {
      const id = el.dataset.action;
      if (el.dataset.confirm && this._armed !== id) {
        this._armed = id;
        clearTimeout(this._armTimer);
        this._armTimer = setTimeout(() => { this._armed = null; this._update(); }, 3500);
        this._update();
        return;
      }
      this._armed = null;
      clearTimeout(this._armTimer);
      const d = id.split(".")[0];
      const on = this._isOn(id);
      if (d === "valve") this._hass.callService("valve", on ? "close_valve" : "open_valve", { entity_id: id });
      else if (d === "button") this._hass.callService("button", "press", { entity_id: id });
      else if (d === "script" || d === "scene") this._hass.callService(d, "turn_on", { entity_id: id });
      else if (d === "water_heater" || d === "climate") this._hass.callService(d, on ? "turn_off" : "turn_on", { entity_id: id });
      else this._hass.callService("homeassistant", on ? "turn_off" : "turn_on", { entity_id: id });
      this._update();
    } else if (el.dataset.info) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.info }, bubbles: true, composed: true }));
    }
  }

  // ---------- history ----------
  async _loadHistory() {
    const c = this._config, now = Date.now();
    const chartId = c.history_entity || c.pressure || c.temperature;
    const src = this._runSrc();
    const ids = [...new Set([chartId, src && src.id].filter(Boolean))];
    if (!ids.length || !this._hass || this._histBusy) return;
    const due = (this._histDue && now >= this._histDue) || now - this._histAt > 300000;
    if (!due) return;
    this._histBusy = true;
    this._histAt = now;
    this._histDue = 0;
    const mid = new Date(); mid.setHours(0, 0, 0, 0);
    const start = new Date(Math.min(now - c.history_hours * 3600e3, mid.getTime()));
    try {
      const res = await this._hass.callApi("GET",
        `history/period/${start.toISOString()}?filter_entity_id=${ids.join(",")}&minimal_response&no_attributes`);
      const byId = {};
      (res || []).forEach((arr) => { if (arr && arr[0]) byId[arr[0].entity_id] = arr; });
      const ts = (s) => new Date(s.last_changed || s.last_updated).getTime();
      const out = { start: start.getTime() };
      if (chartId && byId[chartId]) {
        const f = this._factor(chartId);
        let pts = byId[chartId].map((s) => ({ t: ts(s), v: parseFloat(s.state) * f })).filter((p) => isFinite(p.v));
        const step = Math.ceil(pts.length / 200);
        if (step > 1) pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
        out.chart = { id: chartId, pts };
      }
      if (src && byId[src.id]) {
        const f = this._factor(src.id), runs = [];
        let cur = null;
        for (const s of byId[src.id]) {
          if (BAD_STATES.includes(s.state)) continue;
          const on = src.type === "num" ? parseFloat(s.state) * f >= src.thr : s.state === "on";
          const t = ts(s);
          if (on && cur == null) cur = t;
          else if (!on && cur != null) { runs.push({ s: cur, e: t }); cur = null; }
        }
        if (cur != null) runs.push({ s: cur, e: null });
        out.runs = runs;
      }
      this._hist = out;
      this._update();
    } catch (e) { /* history is optional */ }
    this._histBusy = false;
  }

  // ---------- legionella: when did the hot water last reach legionella_temp? ----------
  async _loadLeg() {
    const c = this._config, id = c.water_heater_temp, now = Date.now();
    if (!id || !this._hass || this._legBusy || (this._legAt && now - this._legAt < 1800e3)) return;
    this._legBusy = true;
    this._legAt = now;
    const start = new Date(now - (c.legionella_days + 1) * 86400e3);
    let known = false, last = null;
    const hit = (t, v) => { if (v != null && v >= c.legionella_temp && (last == null || t > last)) last = t; };
    try {
      const r = await this._hass.callWS({ type: "recorder/statistics_during_period", start_time: start.toISOString(), statistic_ids: [id], period: "hour", types: ["max"] });
      const arr = (r && r[id]) || [];
      if (arr.length) { known = true; arr.forEach((e) => hit(typeof e.start === "number" ? e.start : new Date(e.start).getTime(), e.max)); }
    } catch (e) { /* statistics not available */ }
    if (!known) {
      try {
        const res = await this._hass.callApi("GET", `history/period/${start.toISOString()}?filter_entity_id=${id}&minimal_response&no_attributes`);
        const arr = (res && res[0]) || [];
        if (arr.length) { known = true; arr.forEach((s) => hit(new Date(s.last_changed || s.last_updated).getTime(), parseFloat(s.state))); }
      } catch (e) { /* history optional */ }
    }
    this._leg = { known, last };
    this._legBusy = false;
    this._update();
  }

  // ---------- model ----------
  _model() {
    const c = this._config, now = Date.now();
    const m = {};
    m.p = this._scaled(c.pressure);
    m.pw = this._scaled(c.pump_power);
    m.amps = this._scaled(c.pump_current);
    m.temp = this._num(c.temperature);
    m.outT = this._num(c.outdoor_temp);
    m.flow = this._num(c.flow);
    m.well = this._num(c.well_level);

    m.running = null;
    if (m.pw != null) m.running = m.pw >= c.power_threshold;
    else if (m.amps != null) m.running = m.amps >= c.current_threshold;
    else if (this._st(c.pump_running)) m.running = this._isOn(c.pump_running);
    else if (this._st(c.pump_switch)) m.running = this._isOn(c.pump_switch);

    if (m.running != null && this._live.running != null && m.running !== this._live.running) {
      if (m.running) this._live.start = now; else this._live.end = now;
      this._histDue = now + 15000;
    }
    this._live.running = m.running;

    m.valveOpen = this._st(c.valve) ? this._isOn(c.valve) : true;
    m.flowing = m.valveOpen && (m.flow != null ? m.flow > c.flow_threshold : m.running === true);
    m.leak = this._leakIds().some((id) => (this._st(id) || {}).state === "on");
    m.frost = m.temp != null && m.temp < c.min_temp;
    m.guardOn = c.frost_guard ? this._isOn(c.frost_guard) : null;
    m.traceOn = c.heat_trace ? this._isOn(c.heat_trace) : null;
    m.traceWarn = m.traceOn === false && m.outT != null && m.outT < c.trace_warn_temp;
    m.lowP = c.low_pressure ?? Math.max(0.5, c.cut_in - 0.5);
    m.lowPressure = m.p != null && m.p < m.lowP;

    // pump guard (e.g. EMS KM 35): explicit entity, or inferred from low pressure + pump not running
    m.guard = (this._st(c.pump_guard) || {}).state === "on";
    const src = this._runSrc();
    if (!m.guard && src && m.valveOpen && m.p != null && m.p < c.cut_in - 0.2 && m.running === false) {
      this._lowSince = this._lowSince || now;
      m.guard = now - this._lowSince > c.guard_delay * 1000;
    } else this._lowSince = null;

    // pump statistics
    m.stats = null;
    if (src && this._hist && this._hist.runs) {
      const iv = this._hist.runs.map((x) => ({ ...x }));
      const last = iv[iv.length - 1];
      if (m.running && (!last || last.e != null)) iv.push({ s: this._live.start || now, e: null });
      else if (m.running === false && last && last.e == null) last.e = this._live.end || now;
      const mid = new Date(); mid.setHours(0, 0, 0, 0);
      const m0 = mid.getTime();
      let starts = 0, runMs = 0;
      for (const x of iv) {
        if (x.s >= m0) starts++;
        runMs += Math.max(0, (x.e ?? now) - Math.max(x.s, m0));
      }
      const done = iv.filter((x) => x.e != null);
      const open = iv.find((x) => x.e == null);
      const recent = done.filter((x) => x.e > now - 2 * 3600e3).slice(-4);
      let median = null;
      if (recent.length >= 3) { const d = recent.map((x) => x.e - x.s).sort((a, b) => a - b); median = d[Math.floor(d.length / 2)]; }
      // starts during the most recent night window
      const ns = new Date(); ns.setHours(c.night_start, 0, 0, 0);
      const ne = new Date(); ne.setHours(c.night_end, 0, 0, 0);
      let w0 = ns.getTime(), w1 = ne.getTime();
      if (now < w0) { w0 -= 86400e3; w1 -= 86400e3; }
      const night = iv.filter((x) => x.s >= w0 && x.s < Math.min(w1, now)).length;
      m.stats = {
        iv, starts, runMs, night,
        nightWarn: night >= c.night_starts_warn,
        lastCycle: done.length ? done[done.length - 1].e - done[done.length - 1].s : null,
        runFor: open ? now - open.s : 0,
        longRun: !!open && now - open.s > c.max_run_minutes * 60e3,
        shortCycle: median != null && median < c.short_cycle_seconds * 1000,
        median,
      };
    }

    // water heater
    if (c.water_heater || c.water_heater_temp || c.water_heater_power) {
      const whs = this._st(c.water_heater);
      const whp = this._scaled(c.water_heater_power);
      const temp = this._num(c.water_heater_temp) ?? (whs && whs.attributes.current_temperature != null ? Number(whs.attributes.current_temperature) : null);
      const on = c.water_heater ? this._isOn(c.water_heater) : null;
      const wh = {
        on, temp, power: whp,
        target: whs && whs.attributes.temperature != null ? Number(whs.attributes.temperature) : null,
        heating: whp != null ? whp >= c.water_heater_power_threshold : (whs && (whs.state === "heating" || whs.attributes.hvac_action === "heating")) || (on && c.water_heater.startsWith("switch.")) || false,
        energy: this._num(c.water_heater_energy),
      };
      wh.level = temp == null ? null : temp < c.water_heater_low_temp ? "cold" : temp < c.water_heater_ok_temp ? "warm" : "hot";
      wh.low = wh.level === "cold";
      const leg = this._leg || {};
      let lastHot = leg.last ?? null;
      if (temp != null && temp >= c.legionella_temp) lastHot = now;
      wh.lastHot = lastHot;
      wh.legKnown = !!leg.known || lastHot != null;
      wh.legRisk = wh.legKnown && (lastHot == null || now - lastHot > c.legionella_days * 86400e3);
      m.wh = wh;
    }

    // status
    const st = (k, col, pulse = false) => ({ t: this._t(k), c: col, pulse });
    if (c.pressure && m.p == null) m.status = st("s_offline", C.warn);
    else if (m.leak) m.status = st("s_leak", C.bad, true);
    else if (m.guard) m.status = st("s_guard", C.bad, true);
    else if (!m.valveOpen) m.status = st("s_valve", C.warn);
    else if (m.stats && m.stats.longRun) m.status = st("s_long", C.bad, true);
    else if (m.frost) m.status = st("s_frost", C.frost, true);
    else if (m.lowPressure) m.status = st("s_low", C.warn, true);
    else if (m.stats && m.stats.shortCycle) m.status = st("s_short", C.warn);
    else if (m.running) m.status = st("s_pump", C.water, true);
    else if (m.flowing) m.status = st("s_use", C.water, true);
    else m.status = st("s_normal", C.ok);
    return m;
  }

  // ---------- build (once per config) ----------
  _build() {
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card>
      <div id="head"></div><div id="banners"></div>${this._diagramTpl()}
      <div id="tiles"></div><div id="stats"></div><div id="ctrls"></div></ha-card>`;
    const $ = (id) => this.shadowRoot.getElementById(id);
    this._el = { head: $("head"), banners: $("banners"), tiles: $("tiles"), stats: $("stats"), ctrls: $("ctrls") };
    if (!this._clickBound) { this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev)); this._clickBound = true; }
    this._built = true;
  }

  _diagramTpl() {
    const c = this._config, t = (k) => esc(this._t(k));
    const inHouse = c.tank_location === "house";
    const cx = 380, cy = 76, R = 52, r = 40, max = c.max_pressure, SW = 240;
    const ang = (f) => ((210 - SW * f) * Math.PI) / 180;
    const pt = (f, rad = r) => [cx + rad * Math.cos(ang(f)), cy - rad * Math.sin(ang(f))];
    const arc = (f1, f2, col, w, op, cap = "butt") => {
      if (f2 - f1 < 0.001) return "";
      const [x1, y1] = pt(f1), [x2, y2] = pt(f2);
      return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${(f2 - f1) * SW > 180 ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="${cap}" opacity="${op}"/>`;
    };
    const fi = clamp(c.cut_in / max, 0, 1), fo = clamp(c.cut_out / max, 0, 1);
    const step = max <= 10 ? 1 : Math.ceil(max / 10);
    let ticks = "";
    for (let i = 0; i <= max + 1e-9; i += step / 2) {
      const major = Math.abs(i / step - Math.round(i / step)) < 1e-6;
      const [a, b] = pt(i / max, r - 6), [d, e] = pt(i / max, r - (major ? 12 : 9));
      ticks += `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${d.toFixed(1)}" y2="${e.toFixed(1)}" stroke="var(--secondary-text-color)" stroke-width="${major ? 2 : 1}" opacity="${major ? 0.7 : 0.4}"/>`;
    }
    const tip = pt(0, 31), p1 = [cx + 3.5 * Math.cos(ang(0) + Math.PI / 2), cy - 3.5 * Math.sin(ang(0) + Math.PI / 2)], p2 = [2 * cx - p1[0], 2 * cy - p1[1]];
    const needle = `M${tip[0].toFixed(1)},${tip[1].toFixed(1)} L${p1[0].toFixed(1)},${p1[1].toFixed(1)} L${p2[0].toFixed(1)},${p2[1].toFixed(1)} Z`;

    const pumpInfo = c.pump_guard || c.pump_current || c.pump_power || c.pump_switch || c.pump_running;
    const hasWh = !!(c.water_heater || c.water_heater_temp || c.water_heater_power);
    const info = (id) => (id ? `data-info="${esc(id)}"` : "");
    const muted = "color-mix(in srgb, var(--primary-text-color) 22%, transparent)";
    const faint = "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
    const roof = "color-mix(in srgb, var(--primary-text-color) 20%, transparent)";
    const fixture = "color-mix(in srgb, var(--primary-text-color) 45%, transparent)";
    const stones = [[150, 214, 7], [330, 246, 9], [440, 212, 6], [580, 252, 8], [250, 266, 6], [128, 262, 5], [610, 214, 5]]
      .map(([x, y, s]) => `<ellipse cx="${x}" cy="${y}" rx="${s}" ry="${s * 0.6}" fill="#a16207" opacity=".13"/>`).join("");
    const outdoorPipe = inHouse ? "M86,139 H168" : "M86,139 H176 M314,139 H452";
    const pipeEnd = hasWh ? 582 : 540;

    return `
    <svg class="diagram" viewBox="0 -40 640 320" role="img" aria-label="${t("title")}">
      <defs>
        <clipPath id="tankclip"><rect x="214" y="56" width="62" height="94" rx="26"/></clipPath>
        <clipPath id="wellclip"><rect x="46" y="120" width="38" height="150" rx="5"/></clipPath>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.water}" stop-opacity=".9"/><stop offset="1" stop-color="#0369a1"/></linearGradient>
        <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop id="hg1" offset="0" stop-color="${C.hot}"/><stop id="hg2" offset="1" stop-color="${C.heat}"/></linearGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a16207" stop-opacity=".2"/><stop offset="1" stop-color="#a16207" stop-opacity=".03"/></linearGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--primary-text-color)" stop-opacity=".05"/><stop offset=".5" stop-color="var(--primary-text-color)" stop-opacity=".12"/><stop offset="1" stop-color="var(--primary-text-color)" stop-opacity=".05"/></linearGradient>
      </defs>

      <rect x="0" y="172" width="640" height="108" fill="url(#soil)"/>${stones}
      <rect x="0" y="170" width="640" height="4" rx="2" fill="#65a30d" opacity=".6"/>
      ${c.outdoor_temp ? `<g ${info(c.outdoor_temp)}><text x="6" y="-14" style="font-size:16px">${t("out")}</text><text id="otemp" x="6" y="8" class="val" style="font-size:22px"></text></g>` : ""}

      <g ${info(c.well_level)}>
        <rect x="44" y="118" width="42" height="154" rx="6" fill="${faint}" stroke="${muted}" stroke-width="2"/>
        <rect id="wellw" x="47" y="200" width="36" height="68" rx="3" fill="url(#wg)" opacity=".75"/>
        <rect x="38" y="111" width="54" height="10" rx="3" fill="${muted}"/>
        <text x="65" y="98" text-anchor="middle">${t("well")}</text>
        ${c.well_level ? `<text id="wellv" x="96" y="204" class="val"></text>` : ""}
      </g>

      ${inHouse ? `<rect x="168" y="20" width="290" height="152" rx="4" fill="${faint}" stroke="${muted}" stroke-width="2"/>
      <rect x="160" y="12" width="300" height="10" rx="3" fill="${roof}"/>` : ""}
      <polygon points="444,34 542,-30 640,34" fill="${roof}"/>
      <rect x="452" y="30" width="180" height="142" rx="4" fill="${inHouse ? "transparent" : faint}" stroke="${muted}" stroke-width="2"/>
      ${inHouse ? `<rect x="452" y="30" width="180" height="142" fill="${faint}"/>` : ""}

      ${c.heat_trace ? `<path id="htrace" ${info(c.heat_trace)} class="trace" d="${outdoorPipe}"/>` : ""}
      <path class="pipe-base" d="M65,232 V130 H214"/>
      <path id="pw1" class="pipe-water" d="M65,232 V130 H214"/>
      <path class="pipe-base" d="M276,130 H${pipeEnd}"/>
      <path id="pw2" class="pipe-water" d="M276,130 H${pipeEnd}"/>
      <path class="pipe-base" d="M540,130 V66"/>
      <path id="pw3" class="pipe-water" d="M540,130 V66"/>
      ${hasWh ? `<path class="pipe-base" d="M600,80 V64 H546"/><path id="pw4" class="pipe-water hot" d="M600,80 V64 H546"/>` : ""}

      <g id="pump" ${info(pumpInfo)} clip-path="url(#wellclip)">
        <ellipse class="glow tb" cx="65" cy="249" rx="17" ry="24" fill="${C.water}"/>
        <rect class="body" x="53" y="232" width="24" height="34" rx="8"/>
        <g class="spin tb"><path d="M65,242 v14 M58,249 h14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>
      </g>

      <g ${info(c.temperature || c.pressure)}>
        ${inHouse ? "" : `<rect id="box" x="176" y="46" width="138" height="126" rx="12" fill="${faint}" stroke="${muted}" stroke-width="2" stroke-dasharray="7 5" style="transition:stroke .3s"/>`}
        <text x="245" y="${inHouse ? 46 : 38}" text-anchor="middle">${t("tank")}</text>
        <rect x="214" y="56" width="62" height="94" rx="26" fill="url(#metal)"/>
        <g clip-path="url(#tankclip)">
          <g id="lvl" class="tb" style="transform:translateY(120px)">
            <rect x="214" y="0" width="62" height="200" fill="url(#wg)"/>
            <g class="wave" opacity=".55"><path d="M184,0 q15,-7 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 V200 H184 Z" fill="${C.water}"/></g>
          </g>
        </g>
        <rect x="214" y="56" width="62" height="94" rx="26" fill="none" stroke="${muted}" stroke-width="2.5"/>
        <path d="M222,72 Q245,66 268,72" stroke="#fff" stroke-width="2.5" fill="none" opacity=".25" stroke-linecap="round"/>
        <g id="fguard" style="display:none" ${info(c.frost_guard)}>
          <rect x="${inHouse ? 296 : 286}" y="146" width="20" height="20" rx="4" fill="${C.heat}" opacity=".9"/>
          <path d="M${inHouse ? 301 : 291},160 q2,-3 0,-6 t0,-6 M${inHouse ? 306 : 296},160 q2,-3 0,-6 t0,-6 M${inHouse ? 311 : 301},160 q2,-3 0,-6 t0,-6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </g>
        ${c.temperature ? `<text id="ttemp" x="245" y="204" text-anchor="middle" class="val"></text>` : ""}
      </g>

      <g ${info(c.pressure)}>
        <rect x="${cx - 5}" y="124" width="10" height="8" fill="${muted}"/>
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--ha-card-background, var(--card-background-color, #fff))" stroke="${muted}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${R - 5}" fill="${faint}"/>
        ${arc(0, 1, "color-mix(in srgb, var(--primary-text-color) 12%, transparent)", 7, 1, "round")}
        ${arc(0, fi, C.warn, 7, 0.8)}${arc(fi, fo, C.ok, 7, 0.95)}${arc(fo, 1, C.bad, 7, 0.6)}
        ${ticks}
        <g id="needle" class="tb" style="transform:rotate(0deg)"><path d="${needle}" fill="var(--primary-text-color)"/></g>
        <circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--primary-text-color)"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="var(--ha-card-background, var(--card-background-color, #fff))"/>
        <text id="pval" x="${cx}" y="110" text-anchor="middle" class="big">–</text>
        <text x="${cx}" y="123" text-anchor="middle" style="font-size:13px">bar</text>
      </g>

      <g id="valve" ${info(c.valve)} transform="translate(478,130)" style="--vc:${C.ok}">
        <path d="M-11,-10 L11,10 L11,-10 L-11,10 Z" style="fill:var(--vc)"/>
        <line x1="0" y1="0" x2="0" y2="-18" style="stroke:var(--vc)" stroke-width="3"/>
        <rect x="-8" y="-22" width="16" height="5" rx="2.5" style="fill:var(--vc)"/>
      </g>

      <g id="tap">
        <rect x="514" y="60" width="32" height="9" rx="3" fill="${fixture}"/>
        <rect x="508" y="60" width="8" height="17" rx="3" fill="${fixture}"/>
        <path class="drip" d="M512,80 c-3,4 -4,6 -4,7.5 a4,4 0 0 0 8,0 c0,-1.5 -1,-3.5 -4,-7.5 z" fill="${C.water}"/>
        <path d="M490,94 h44 v4 a12,12 0 0 1 -12,12 h-20 a12,12 0 0 1 -12,-12 z" fill="${fixture}" opacity=".7"/>
      </g>
      <text x="512" y="204" text-anchor="middle">${t("house")}</text>
      ${hasWh ? `
      <g id="wh" ${info(c.water_heater || c.water_heater_temp || c.water_heater_power)}>
        <rect class="glow" x="576" y="74" width="48" height="98" rx="18" fill="${C.hot}"/>
        <rect x="582" y="80" width="36" height="86" rx="14" fill="url(#metal)" stroke="${muted}" stroke-width="2"/>
        <rect id="whfill" x="585" y="83" width="30" height="80" rx="11" fill="url(#hg)" opacity=".6" style="transition:opacity .4s"/>
        <text id="whtemp" x="600" y="204" text-anchor="middle" class="val"></text>
        <g id="legb" style="display:none"><circle cx="618" cy="82" r="11" fill="${C.warn}"/><text x="618" y="88" text-anchor="middle" style="fill:#fff;font-size:15px;font-weight:700">L</text></g>
      </g>` : ""}

      <g id="leakm" style="display:none">
        <circle cx="470" cy="-12" r="13" fill="${C.bad}"><animate attributeName="opacity" values="1;.35;1" dur="1s" repeatCount="indefinite"/></circle>
        <text x="470" y="-5" text-anchor="middle" style="fill:#fff;font-weight:700">!</text>
      </g>
    </svg>`;
  }

  // ---------- update (every state change) ----------
  _set(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }

  _update() {
    if (!this._hass || !this._built) return;
    const m = this._model();
    const c = this._config;
    this._set(this._el.head, `
      <div class="head">
        <div class="ico"><ha-icon icon="mdi:water-pump"></ha-icon></div>
        <div class="title"><b>${esc(c.name || this._t("title"))}</b><span>${esc(this._t("sub"))}</span></div>
        <div class="chip ${m.status.pulse ? "pulse" : ""}" style="--c:${m.status.c}"><i></i>${esc(m.status.t)}</div>
      </div>`);
    this._set(this._el.banners, this._banners(m));
    this._updDiagram(m);
    this._set(this._el.tiles, this._tiles(m));
    const sh = this._statsHtml(m), hh = this._histHtml(m);
    this._set(this._el.stats, sh || hh ? `<div class="panel">${sh}${sh && hh ? '<div class="sep"></div>' : ""}${hh}</div>` : "");
    this._set(this._el.ctrls, this._controls(m));
  }

  _banners(m) {
    const c = this._config, out = [];
    const b = (col, icon, txt) => out.push(`<div class="banner" style="--c:${col}"><ha-icon icon="${icon}"></ha-icon><span>${esc(txt)}</span></div>`);
    const tu = (v, id) => `${this._fmt(v)}${this._unit(id) || "°C"}`;
    if (m.leak) b(C.bad, "mdi:water-alert", this._t("b_leak"));
    if (m.guard) b(C.bad, "mdi:engine-off", this._t("b_guard"));
    if (m.stats && m.stats.longRun) b(C.bad, "mdi:timer-alert", this._t("b_long", this._dur(m.stats.runFor, false)));
    if (m.frost) b(C.frost, "mdi:snowflake-alert", this._t("b_frost", tu(m.temp, c.temperature)) + (m.guardOn === false ? this._t("b_frost_off") : ""));
    if (m.traceWarn) b(C.frost, "mdi:snowflake-thermometer", this._t("b_trace", tu(m.outT, c.outdoor_temp)));
    if (m.lowPressure && !m.leak && !m.guard) b(C.warn, "mdi:gauge-low", this._t("b_low", this._fmt(m.lowP)));
    if (m.stats && m.stats.shortCycle && !m.leak) b(C.warn, "mdi:sync-alert", this._t("b_short", this._dur(m.stats.median)));
    if (m.stats && m.stats.nightWarn && !m.leak) b(C.warn, "mdi:weather-night", this._t("b_night", m.stats.night, `${String(c.night_start).padStart(2, "0")}–${String(c.night_end).padStart(2, "0")}`));
    if (m.wh && m.wh.low && m.wh.on !== false) b(C.frost, "mdi:water-thermometer-outline", this._t("b_wh_low", `${this._fmt(m.wh.temp, 0)} °C`));
    if (m.wh && m.wh.legRisk) b(C.warn, "mdi:bacteria-outline", this._t("b_leg", `${c.legionella_temp} °C`, c.legionella_days));
    return out.join("");
  }

  _updDiagram(m) {
    const c = this._config, q = (id) => this.shadowRoot.getElementById(id);
    const f = m.p == null ? 0 : clamp(m.p / c.max_pressure, 0, 1);
    q("needle").style.transform = `rotate(${(f * 240).toFixed(1)}deg)`;
    const pv = q("pval");
    pv.textContent = m.p == null ? "–" : this._fmt(m.p, 2);
    pv.style.fill = m.p == null ? "" : m.p < c.cut_in * 0.75 || m.p > c.cut_out * 1.15 ? C.warn : "";
    q("lvl").style.transform = `translateY(${(150 - 94 * (0.12 + 0.76 * f)).toFixed(1)}px)`;

    const pump = q("pump");
    pump.classList.toggle("run", !!m.running);
    pump.classList.toggle("trip", !!m.guard);
    q("pw1").classList.toggle("flow", !!m.running);
    ["pw2", "pw3", "pw4"].forEach((id) => { const e = q(id); if (e) { e.classList.toggle("flow", !!m.flowing); e.style.opacity = m.valveOpen ? "" : ".12"; } });
    q("valve").style.setProperty("--vc", m.valveOpen ? C.ok : C.bad);
    q("tap").classList.toggle("on", !!m.flowing);
    q("leakm").style.display = m.leak ? "" : "none";

    const wf = m.well == null ? 0.55 : clamp(m.well / 100, 0.05, 1);
    const wy = 268 - 140 * wf;
    q("wellw").setAttribute("y", wy.toFixed(1));
    q("wellw").setAttribute("height", (268 - wy).toFixed(1));
    if (q("wellv")) q("wellv").textContent = m.well == null ? "–" : `${this._fmt(m.well, 0)}${this._unit(c.well_level)}`;
    if (q("otemp")) {
      q("otemp").textContent = m.outT == null ? "–" : `${this._fmt(m.outT)}${this._unit(c.outdoor_temp) || "°C"}`;
      q("otemp").style.fill = m.outT != null && m.outT < 0 ? C.frost : "";
    }
    if (q("ttemp")) {
      q("ttemp").textContent = m.temp == null ? "–" : `${this._fmt(m.temp)}${this._unit(c.temperature) || "°C"}`;
      q("ttemp").style.fill = m.frost ? C.frost : "";
    }
    q("fguard").style.display = m.guardOn ? "" : "none";
    if (q("box")) q("box").style.stroke = m.guardOn ? C.heat : m.frost ? C.frost : "";
    if (q("htrace")) {
      q("htrace").classList.toggle("on", !!m.traceOn);
      q("htrace").classList.toggle("warn", !!m.traceWarn);
    }

    if (m.wh && q("wh")) {
      const w = m.wh;
      q("wh").classList.toggle("heating", !!w.heating);
      const cols = { cold: ["#93c5fd", "#3b82f6"], warm: ["#fcd34d", "#f59e0b"], hot: [C.hot, C.heat] }[w.level || "warm"];
      q("hg1").setAttribute("stop-color", cols[0]);
      q("hg2").setAttribute("stop-color", cols[1]);
      q("whfill").setAttribute("opacity", w.on === false ? "0.2" : "0.85");
      q("whtemp").textContent = w.temp == null ? "" : `${this._fmt(w.temp, 0)}°${w.target != null ? ` / ${this._fmt(w.target, 0)}°` : ""}`;
      q("whtemp").style.fill = w.level === "cold" ? "#3b82f6" : w.level === "warm" ? C.warn : w.level === "hot" ? C.hot : "";
      q("legb").style.display = w.legRisk ? "" : "none";
    }
  }

  _tiles(m) {
    const c = this._config, out = [];
    const add = (id, icon, label, val, unit, col) => {
      if (!id) return;
      out.push(`<div class="tile" data-info="${esc(id)}" ${col ? `style="--c:${col}"` : ""}>
        <div class="lbl"><ha-icon icon="${icon}"></ha-icon>${esc(label)}</div>
        <div class="val">${val}<small>${esc(unit)}</small></div></div>`);
    };
    const dec = (id) => (this._unit(id).toLowerCase() === "kw" ? 2 : 0);
    add(c.pump_power, "mdi:flash", this._t("t_pump"), this._fmt(this._num(c.pump_power), dec(c.pump_power)), this._unit(c.pump_power) || "W", m.running ? C.water : m.guard ? C.bad : null);
    add(c.pump_current, "mdi:current-ac", this._t("t_current"), this._fmt(this._num(c.pump_current), 1), this._unit(c.pump_current) || "A", m.running ? C.water : m.guard ? C.bad : null);
    add(c.flow, "mdi:water-sync", this._t("t_flow"), this._fmt(m.flow), this._unit(c.flow), m.flowing ? C.water : null);
    add(c.water_today, "mdi:water", this._t("t_today"), this._fmt(this._num(c.water_today), 0), this._unit(c.water_today), null);
    add(c.well_level, "mdi:water-well", this._t("t_well"), this._fmt(m.well, 0), this._unit(c.well_level), null);
    if (m.wh) {
      add(c.water_heater_power, "mdi:water-boiler", this._t("t_whp"), this._fmt(this._num(c.water_heater_power), dec(c.water_heater_power)), this._unit(c.water_heater_power) || "W", m.wh.heating ? C.hot : null);
      add(c.water_heater_energy, "mdi:lightning-bolt", this._t("t_whe"), this._fmt(m.wh.energy, 1), this._unit(c.water_heater_energy) || "kWh", null);
      if (m.wh.legKnown) {
        const d = m.wh.lastHot == null ? null : Math.floor((Date.now() - m.wh.lastHot) / 86400e3);
        const val = d == null ? this._t("never", c.legionella_days) : d === 0 ? this._t("today") : this._t("days_ago", d);
        add(c.water_heater_temp, "mdi:bacteria-outline", this._t("t_leg", `${c.legionella_temp}°`), esc(val), "", m.wh.legRisk ? C.warn : C.ok);
      }
    }
    return out.length ? `<div class="tiles">${out.join("")}</div>` : "";
  }

  _statsHtml(m) {
    const s = m.stats;
    if (!s) return "";
    const third = s.runFor
      ? `<div><span>${esc(this._t("st_now"))}</span><b class="${s.longRun ? "warn" : ""}">${this._dur(s.runFor)}</b></div>`
      : `<div><span>${esc(this._t("st_last"))}</span><b class="${s.shortCycle ? "warn" : ""}">${s.lastCycle == null ? "–" : this._dur(s.lastCycle)}</b></div>`;
    return `<div class="stats" data-info="${esc(this._runSrc().id)}">
      <div><span>${esc(this._t("st_starts"))}</span><b>${s.starts}</b></div>
      <div><span>${esc(this._t("st_run"))}</span><b>${this._dur(s.runMs, false)}</b></div>
      ${third}
      <div><span>${esc(this._t("st_night"))}</span><b class="${s.nightWarn ? "warn" : ""}">${s.night}</b></div></div>`;
  }

  _histHtml(m) {
    const h = this._hist, c = this._config;
    if (!h || !h.chart) return "";
    const now = Date.now(), t0 = now - c.history_hours * 3600e3, W = 600;
    const id = h.chart.id, isP = id === c.pressure;
    let pts = h.chart.pts.filter((p) => p.t >= t0);
    const pre = h.chart.pts.filter((p) => p.t < t0).pop();
    if (pre) pts.unshift({ t: t0, v: pre.v });
    const cur = this._scaled(id);
    if (cur != null) pts.push({ t: now, v: cur });
    if (pts.length < 2) return "";
    const vs = pts.map((p) => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    const dLo = lo, dHi = hi;
    if (isP) { lo = Math.min(lo, c.cut_in); hi = Math.max(hi, c.cut_out); }
    const pad = (hi - lo) * 0.08 || 0.1;
    lo -= pad; hi += pad;
    const x = (t) => (((t - t0) / (now - t0)) * W).toFixed(1);
    const y = (v) => (4 + (1 - (v - lo) / (hi - lo)) * 52).toFixed(1);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
    const area = `${line} L${x(now)},56 L${x(pts[0].t)},56 Z`;
    const refs = isP ? [c.cut_in, c.cut_out].map((v) => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.ok}" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" opacity=".7"/>`).join("") : "";
    let strips = "";
    if (m.stats) {
      strips = m.stats.iv.filter((r) => (r.e ?? now) > t0).map((r) => {
        const a = Math.max(r.s, t0), w = Math.max(1.5, ((r.e ?? now) - a) / (now - t0) * W);
        return `<rect x="${x(a)}" y="62" width="${w.toFixed(1)}" height="8" fill="${C.water}" opacity=".85"/>`;
      }).join("");
    }
    const unit = isP ? "bar" : this._unit(id);
    return `<div class="hist" data-info="${esc(id)}">
      <div class="row"><span>${esc(isP ? this._t("h_pressure") : this._t("h_hist"))} · ${c.history_hours} ${esc(this._t("h"))}${strips ? `<span class="lg"><i></i>${esc(this._t("t_pump"))}</span>` : ""}</span>
      <span>${this._fmt(dLo, 1)} – ${this._fmt(dHi, 1)} ${esc(unit)}</span></div>
      <svg viewBox="0 0 ${W} 72" preserveAspectRatio="none">
        <defs><linearGradient id="hgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.water}" stop-opacity=".4"/><stop offset="1" stop-color="${C.water}" stop-opacity="0"/></linearGradient></defs>
        ${refs}<path d="${area}" fill="url(#hgr)"/>
        <path d="${line}" fill="none" stroke="${C.water}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
        ${strips}
      </svg></div>`;
  }

  _controls(m) {
    const c = this._config, out = [];
    const mk = (id, name, iconOn, iconOff, opts = {}) => {
      const s = this._st(id);
      if (!id || !s || /^(binary_sensor|sensor)\./.test(id)) return;
      const on = this._isOn(id);
      const unavailable = BAD_STATES.includes(s.state);
      const label = unavailable ? this._t("unavail") : opts.stateText ? opts.stateText(on) : on ? this._t(opts.valve ? "open" : "on") : this._t(opts.valve ? "closed" : "off");
      const armed = this._armed === id;
      const needConfirm = c.confirm !== false && opts.confirmWhenOn && on;
      out.push(`<button class="btn ${armed ? "armed" : on ? "on" : opts.offBad ? "off-bad" : ""}" ${opts.col ? `style="--c:${opts.col}"` : ""}
        data-action="${esc(id)}" ${needConfirm ? 'data-confirm="1"' : ""} ${unavailable ? "disabled" : ""}>
        <ha-icon icon="${on ? iconOn : iconOff}"></ha-icon>${armed ? esc(this._t("confirm")) : `${esc(name)} <small>${esc(label)}</small>`}</button>`);
    };
    mk(c.pump_switch, this._t("c_pump"), "mdi:water-pump", "mdi:water-pump-off", { confirmWhenOn: true, col: C.water });
    mk(c.valve, this._t("c_valve"), "mdi:valve-open", "mdi:valve-closed", { confirmWhenOn: true, offBad: true, col: C.ok, valve: true });
    mk(c.frost_guard, this._t("c_guard"), "mdi:radiator", "mdi:radiator-off", { col: C.heat });
    mk(c.heat_trace, this._t("c_trace"), "mdi:heating-coil", "mdi:heating-coil", { col: C.heat, offBad: m.traceWarn });
    mk(c.water_heater, this._t("c_wh"), "mdi:water-boiler", "mdi:water-boiler-off", { col: C.hot, stateText: (on) => (m.wh && m.wh.heating ? this._t("heating") : this._t(on ? "on" : "off")) });
    (c.buttons || []).forEach((b) => {
      const s = this._st(b.entity);
      if (!s) return;
      const stateless = /^(script|scene|button)\./.test(b.entity);
      const on = !stateless && this._isOn(b.entity);
      out.push(`<button class="btn ${on ? "on" : ""}" data-action="${esc(b.entity)}"><ha-icon icon="${esc(b.icon || "mdi:gesture-tap")}"></ha-icon>${esc(b.name || s.attributes.friendly_name || b.entity)}</button>`);
    });
    return out.length ? `<div class="ctrls">${out.join("")}</div>` : "";
  }
}

// ---------- visual editor ----------
const num = (unit, min, max, step) => ({ number: { min, max, step, mode: "box", unit_of_measurement: unit } });
const ent = (domain, extra = {}) => ({ entity: { domain, ...extra } });
const EDITOR_SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "tank_location", selector: { select: { mode: "dropdown", options: [
    { value: "box", label: "Separate tank box (outside)" }, { value: "house", label: "Inside the house" }] } } },
  { type: "expandable", name: "", title: "Pump and pressure", flatten: true, expanded: true, schema: [
    { name: "pressure", selector: ent("sensor") },
    { name: "pump_power", selector: ent("sensor") },
    { name: "pump_current", selector: ent("sensor") },
    { name: "pump_running", selector: ent("binary_sensor") },
    { name: "pump_guard", selector: ent("binary_sensor") },
    { name: "pump_switch", selector: ent(["switch", "input_boolean"]) },
    { name: "valve", selector: ent(["valve", "switch"]) },
  ] },
  { type: "expandable", name: "", title: "Frost, leaks and usage", flatten: true, schema: [
    { name: "temperature", selector: ent("sensor") },
    { name: "outdoor_temp", selector: ent("sensor") },
    { name: "frost_guard", selector: ent(["switch", "climate", "input_boolean", "binary_sensor"]) },
    { name: "heat_trace", selector: ent(["switch", "climate", "input_boolean", "binary_sensor"]) },
    { name: "leak", selector: ent("binary_sensor", { multiple: true }) },
    { name: "flow", selector: ent("sensor") },
    { name: "water_today", selector: ent("sensor") },
    { name: "well_level", selector: ent("sensor") },
  ] },
  { type: "expandable", name: "", title: "Water heater", flatten: true, schema: [
    { name: "water_heater", selector: ent(["water_heater", "switch", "climate"]) },
    { name: "water_heater_temp", selector: ent("sensor") },
    { name: "water_heater_power", selector: ent("sensor") },
    { name: "water_heater_energy", selector: ent("sensor") },
    { type: "grid", name: "", schema: [
      { name: "water_heater_low_temp", selector: num("°C", 20, 70, 1) },
      { name: "water_heater_ok_temp", selector: num("°C", 30, 90, 1) },
      { name: "legionella_temp", selector: num("°C", 55, 85, 1) },
      { name: "legionella_days", selector: num("d", 1, 30, 1) },
    ] },
  ] },
  { type: "expandable", name: "", title: "Thresholds", flatten: true, schema: [
    { type: "grid", name: "", schema: [
      { name: "cut_in", selector: num("bar", 0, 10, 0.1) },
      { name: "cut_out", selector: num("bar", 0, 10, 0.1) },
      { name: "max_pressure", selector: num("bar", 1, 16, 1) },
      { name: "min_temp", selector: num("°C", -10, 15, 0.5) },
      { name: "trace_warn_temp", selector: num("°C", -20, 10, 0.5) },
      { name: "power_threshold", selector: num("W", 0, 5000, 10) },
      { name: "current_threshold", selector: num("A", 0, 20, 0.1) },
      { name: "max_run_minutes", selector: num("min", 1, 240, 1) },
      { name: "short_cycle_seconds", selector: num("s", 5, 300, 5) },
      { name: "guard_delay", selector: num("s", 10, 900, 10) },
      { name: "night_start", selector: num("h", 0, 23, 1) },
      { name: "night_end", selector: num("h", 1, 23, 1) },
      { name: "night_starts_warn", selector: num("", 1, 20, 1) },
      { name: "history_hours", selector: num("h", 1, 168, 1) },
    ] },
    { name: "confirm", selector: { boolean: {} } },
  ] },
];
const EDITOR_LABELS = {
  name: "Title", tank_location: "Pressure tank location", pressure: "Pressure sensor", pump_power: "Pump power (W)", pump_current: "Pump current (A)",
  pump_running: "Pump running (binary sensor)", pump_guard: "Pump guard alarm (binary sensor)", pump_switch: "Pump switch",
  valve: "Main valve", temperature: "Tank box / tank room temperature", outdoor_temp: "Outdoor temperature",
  frost_guard: "Frost guard in tank box", heat_trace: "Heat cable on outdoor pipes", leak: "Leak sensors",
  flow: "Flow sensor", water_today: "Water used today", well_level: "Well level",
  water_heater: "Water heater (entity or switch)", water_heater_temp: "Hot water temperature", water_heater_power: "Water heater power",
  water_heater_energy: "Water heater energy today", water_heater_low_temp: "Low hot water below", water_heater_ok_temp: "Hot from",
  legionella_temp: "Legionella temperature", legionella_days: "Must reach it every",
  cut_in: "Cut-in pressure", cut_out: "Cut-out pressure", max_pressure: "Gauge max", min_temp: "Frost warning below",
  trace_warn_temp: "Heat cable warning below (outdoor)",
  power_threshold: "Pump running above (W)", current_threshold: "Pump running above (A)", max_run_minutes: "Max run time",
  short_cycle_seconds: "Short cycle if run shorter than", guard_delay: "Pump-stopped alarm after",
  night_start: "Night from (hour)", night_end: "Night to (hour)", night_starts_warn: "Warn at night starts ≥", history_hours: "History length",
  confirm: "Confirm before closing valve or stopping pump",
};

class WaterSystemCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }
  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.title || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        const cfg = { ...ev.detail.value };
        Object.keys(cfg).forEach((k) => { const v = cfg[k]; if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete cfg[k]; });
        this._config = cfg;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { ...this._config };
    if (typeof data.leak === "string") data.leak = [data.leak];
    this._form.hass = this._hass;
    this._form.schema = EDITOR_SCHEMA;
    this._form.data = data;
  }
}

if (!customElements.get("water-system-card")) customElements.define("water-system-card", WaterSystemCard);
if (!customElements.get("water-system-card-editor")) customElements.define("water-system-card-editor", WaterSystemCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some((x) => x.type === "water-system-card")) {
  window.customCards.push({
    type: "water-system-card",
    name: "Water System Card",
    description: "Well pump, pump guard, pressure tank, water heater and house supply – live gauge, animated flow, pump statistics, history and controls.",
    preview: false,
  });
}
console.info(`%c WATER-SYSTEM-CARD %c v${WSC_VERSION} `, "color:#fff;background:#0ea5e9;font-weight:700", "color:#0ea5e9;background:#fff");
