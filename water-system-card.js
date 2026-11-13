/*
 * water-system-card  v1.10.1
 * Home Assistant custom Lovelace card: well → pump (with pump guard) → pressure tank → valve → house + water heater.
 * Self-contained, no HACS dependencies. Every entity is optional. Includes a visual editor.
 */

const WSC_VERSION = "1.10.1";
const C = { water: "#38bdf8", ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444", frost: "#60a5fa", heat: "#f97316", hot: "#f43f5e" };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ON_STATES = ["on", "open", "opening", "heat", "heating"];
const BAD_STATES = ["unavailable", "unknown"];
const LEAK_LOCS = ["box", "house", "heater", "well", "pipe"];
// unit conversion: factor from a unit to the card's internal unit (bar, L, L/min, W, A). Temperature is handled separately (°C internally).
const UNITS = {
  pressure: { bar: 1, mbar: 0.001, hpa: 0.001, kpa: 0.01, pa: 0.00001, mpa: 10, psi: 0.0689476 },
  volume: { l: 1, ml: 0.001, "m³": 1000, m3: 1000, gal: 3.78541, "ft³": 28.3168 },
  flow: { "l/min": 1, "l/h": 1 / 60, "l/s": 60, "m³/h": 1000 / 60, "m3/h": 1000 / 60, "gal/min": 3.78541, gpm: 3.78541 },
  power: { w: 1, kw: 1000 },
  current: { a: 1, ma: 0.001 },
};
// step-by-step guides shown in the maintenance form. {cutin} and {pre} are filled in from the card settings.
const HELP = {
  nb: {
    precharge: [
      "Slå av strømmen til pumpa (bryteren på pumpevakten til 0).",
      "Åpne en kran og la den stå til vanntrykket er 0 og det slutter å renne. Fortrykket måles alltid med tom tank.",
      "Ta av hetten på luftventilen (bilventil) på tanken og mål med en dekktrykkmåler.",
      "Fortrykket skal være 0,2–0,3 bar under innkoblingstrykket. Med innkobling {cutin} betyr det ca. {pre}.",
      "Fyll på med sykkel- eller kompressorpumpe, eller slipp ut luft til riktig trykk. Noter målt og justert verdi.",
      "Kommer det vann ut av luftventilen, er membranen ødelagt og tanken må byttes.",
      "Steng kranen, slå på pumpa og noter trykket der pumpa starter og stopper.",
    ],
    sample: [
      "Bestill prøveflasker fra et akkreditert laboratorium. Ta prøven tidlig i uka, så den kommer fram før helgen.",
      "Ta gjerne prøven etter mye regn eller snøsmelting – da er brønnen mest utsatt for innlekking.",
      "Bruk en kaldtvannskran: skru av perlatoren (silen), rengjør tuten med sprit og la vannet renne 3–5 minutter.",
      "Fyll flasken uten å skylle den og uten å ta på innsiden av flasken eller korken.",
      "Oppbevar prøven kaldt hvis det går mer enn 4 timer. Det må ikke gå mer enn 24 timer til bakterieanalysen.",
      "Har du borebrønn i fjell, bør du også analysere radon og fluorid (egen flaske for radon).",
      "Noter laboratorium, resultat og rapportnummer når svaret kommer.",
    ],
    uv: [
      "Slå av strømmen til UV-anlegget og la lampa kjøle seg ned i noen minutter.",
      "Steng ventilene før og etter UV-kammeret og slipp ut trykket.",
      "Trekk ut lampa. Hold i endene – ikke ta på glasset med bare fingre.",
      "Ta ut kvartsglasset, rengjør det med eddik eller sitronsyre og skyll godt. Bytt O-ringer hvis de er harde eller sprukne.",
      "Sett inn ny lampe, monter alt og åpne ventilene sakte. Sjekk for lekkasje.",
      "Slå på strømmen og sjekk at lampa lyser og at eventuell alarm/teller er nullstilt.",
      "Følg alltid produsentens bruksanvisning for ditt anlegg.",
    ],
    filter: [
      "Noter trykket før filteret byttes (tett filter gir lavere trykk ved tapping).",
      "Steng ventilene før og etter filteret (eller slå av pumpa) og slipp ut trykket med en kran.",
      "Skru av filterhuset med nøkkelen og ta ut den gamle patronen.",
      "Rengjør filterhuset. Sjekk O-ringen og smør den lett med silikonfett.",
      "Sett inn ny patron av riktig type, skru huset på for hånd og åpne ventilene sakte.",
      "Luft ut ved å åpne en kran til vannet renner jevnt, og sjekk for lekkasje.",
    ],
    outdoor_tap: [
      "Høst (før frosten): steng stoppekranen for utekranen inne i huset.",
      "Åpne utekranen og la den stå åpen så vannet renner ut av røret. La den gjerne stå åpen hele vinteren.",
      "Koble fra hageslangen og tøm den – en tilkoblet slange kan holde vann i kranen og sprenge den.",
      "Har du frostfri utekran, må slangen likevel kobles fra, ellers tømmer ikke kranen seg.",
      "Vår (når frosten er over): steng utekranen, åpne stoppekranen inne og sjekk for lekkasje i veggen og inne.",
    ],
    irrigation: [
      "Høst (før frosten): steng tilførselen til hagevanningen inne og slå av styringen/timeren.",
      "Åpne dreneringsventilene på de laveste punktene og la rørene renne tomme.",
      "Blås gjerne ut rør og dyser med trykkluft på lavt trykk (ca. 2–3 bar) én sone om gangen, med sonens ventil åpen. Gå aldri over anleggets maks trykk.",
      "Ta inn batteritimere, slanger og dyser som kan sprekke, og la ventilene stå litt åpne.",
      "Vår: steng dreneringsventilene, åpne tilførselen sakte og kjør hver sone kort for å sjekke dyser og lekkasjer.",
    ],
  },
  en: {
    precharge: [
      "Switch off the pump (set the pump guard switch to 0).",
      "Open a tap and leave it until the water pressure is 0 and the flow stops. Pre-charge is always measured with an empty tank.",
      "Remove the cap on the tank's air valve (tyre valve) and measure with a tyre pressure gauge.",
      "Pre-charge should be 0.2–0.3 bar below the cut-in pressure. With cut-in {cutin} that is about {pre}.",
      "Add air with a bicycle or compressor pump, or let air out, until it is right. Note the measured and adjusted value.",
      "If water comes out of the air valve, the membrane is broken and the tank must be replaced.",
      "Close the tap, switch the pump on and note the pressure where the pump starts and stops.",
    ],
    sample: [
      "Order sample bottles from an accredited laboratory. Take the sample early in the week so it arrives before the weekend.",
      "Ideally sample after heavy rain or snowmelt – that's when the well is most exposed to surface water.",
      "Use a cold tap: remove the aerator, clean the spout with spirit and let the water run for 3–5 minutes.",
      "Fill the bottle without rinsing it and without touching the inside of the bottle or cap.",
      "Keep the sample cold if more than 4 hours pass. No more than 24 hours may pass before the bacteria analysis.",
      "For a drilled well in bedrock, also test for radon and fluoride (radon needs its own bottle).",
      "Note the lab, result and report number when the answer arrives.",
    ],
    uv: [
      "Switch off the UV unit and let the lamp cool for a few minutes.",
      "Close the valves before and after the UV chamber and release the pressure.",
      "Pull out the lamp. Hold it by the ends – don't touch the glass with bare fingers.",
      "Remove the quartz sleeve, clean it with vinegar or citric acid and rinse well. Replace O-rings that are hard or cracked.",
      "Fit the new lamp, reassemble and open the valves slowly. Check for leaks.",
      "Switch on and check that the lamp is lit and any alarm/counter is reset.",
      "Always follow the manufacturer's manual for your unit.",
    ],
    filter: [
      "Note the pressure before changing (a clogged filter gives lower pressure at the tap).",
      "Close the valves before and after the filter (or switch off the pump) and release the pressure at a tap.",
      "Unscrew the filter housing with the wrench and remove the old cartridge.",
      "Clean the housing. Check the O-ring and lightly grease it with silicone grease.",
      "Fit a new cartridge of the right type, screw the housing on by hand and open the valves slowly.",
      "Bleed air by opening a tap until the water runs smoothly, and check for leaks.",
    ],
    outdoor_tap: [
      "Autumn (before frost): close the indoor stop valve for the outdoor tap.",
      "Open the outdoor tap so the pipe drains. It can stay open all winter.",
      "Disconnect and empty the garden hose – a connected hose can keep water in the tap and burst it.",
      "Even a frost-free tap needs the hose disconnected, or it can't drain.",
      "Spring (when frost is over): close the outdoor tap, open the indoor stop valve and check for leaks inside the wall and indoors.",
    ],
    irrigation: [
      "Autumn (before frost): close the indoor supply to the irrigation and switch off the controller/timer.",
      "Open the drain valves at the lowest points and let the pipes run empty.",
      "Optionally blow out pipes and nozzles with compressed air at low pressure (about 2–3 bar), one zone at a time with that zone's valve open. Never exceed the system's maximum pressure.",
      "Bring in battery timers, hoses and nozzles that can crack, and leave the valves slightly open.",
      "Spring: close the drain valves, open the supply slowly and run each zone briefly to check nozzles and leaks.",
    ],
  },
};
const UNIT_DEC = { bar: 2, mbar: 0, kpa: 0, psi: 1, l: 0, gal: 1, "m³": 2, "l/min": 1, "gal/min": 1, "m³/h": 2, w: 0, kw: 2 };
const UNIT_KEYS = {
  pressure: ["cut_in", "cut_out", "max_pressure", "low_pressure"],
  temp: ["min_temp", "guard_warn_temp", "trace_warn_temp", "water_heater_low_temp", "water_heater_ok_temp", "legionella_temp", "cold_water_temp", "tap_frost_temp", "irrigation_frost_temp"],
  volume: ["water_heater_volume", "shower_liters", "drawdown_min"],
  power: ["power_threshold", "water_heater_power_threshold"],
};
// entities created by the companion HA package (packages/water_system.yaml)
const PKG = {
  tripped: "binary_sensor.water_pump_tripped", long_run: "binary_sensor.water_pump_long_run", short_cycle: "binary_sensor.water_pump_short_cycling",
  low_pressure: "binary_sensor.water_low_pressure", frost: "binary_sensor.water_frost_risk", guard_off: "binary_sensor.water_frost_guard_off",
  trace_off: "binary_sensor.water_heat_cable_off", night: "binary_sensor.water_night_activity", hot_low: "binary_sensor.water_hot_water_low",
  legionella: "binary_sensor.water_legionella_risk", leak: "binary_sensor.water_leak", away_alarm: "binary_sensor.water_away_alarm",
  precharge: "binary_sensor.water_tank_precharge_low", wear: "binary_sensor.water_pump_wear_trend", maint: "binary_sensor.water_maintenance_due",
  tap_frost: "binary_sensor.water_outdoor_tap_frost", irr_frost: "binary_sensor.water_irrigation_frost", irr_long: "binary_sensor.water_irrigation_long_run",
};
const PKG_DEFAULTS = {
  away: "input_boolean.water_away", drawdown: "sensor.water_tank_drawdown_avg", drawdown_warn: PKG.precharge,
  cycle_avg_7d: "sensor.water_pump_cycle_avg_7d", cycle_avg_30d: "sensor.water_pump_cycle_avg_30d", pump_trend: PKG.wear,
};
const MAINT = {
  precharge: { entity: "input_datetime.water_last_precharge_check", interval: "input_number.water_precharge_interval_days", days: 182, icon: "mdi:gauge",
    fields: [{ key: "f_pre", type: "number", q: "pressure" }, { key: "f_cutin", type: "number", q: "pressure" }, { key: "f_cutout", type: "number", q: "pressure" },
      { key: "f_adj", type: "number", q: "pressure" }] },
  sample: { entity: "input_datetime.water_last_water_sample", interval: "input_number.water_sample_interval_days", days: 365, icon: "mdi:test-tube",
    fields: [{ key: "f_lab", type: "text" }, { key: "f_result", type: "select", options: ["r_ok", "r_remarks", "r_fail"] }, { key: "f_ref", type: "text" }] },
  uv: { entity: "input_datetime.water_last_uv_lamp", interval: "input_number.water_uv_interval_days", days: 365, icon: "mdi:lightbulb-fluorescent-tube-outline",
    fields: [{ key: "f_hours", type: "number", unit: "h" }, { key: "f_lamp", type: "text" }, { key: "f_sleeve", type: "bool" }] },
  filter: { entity: "input_datetime.water_last_filter_change", interval: "input_number.water_filter_interval_days", days: 180, icon: "mdi:filter-outline",
    fields: [{ key: "f_ftype", type: "text" }, { key: "f_pbefore", type: "number", q: "pressure" }] },
  outdoor_tap: { entity: "input_datetime.water_last_outdoor_tap", interval: "input_number.water_outdoor_tap_interval_days", days: 182, icon: "mdi:water-pump-outline",
    fields: [{ key: "f_tapact", type: "select", options: ["a_winter", "a_summer"] }, { key: "f_drained", type: "bool" }, { key: "f_hose", type: "bool" }] },
  irrigation: { entity: "input_datetime.water_last_irrigation_service", interval: "input_number.water_irrigation_interval_days", days: 182, icon: "mdi:sprinkler-variant",
    fields: [{ key: "f_tapact", type: "select", options: ["a_winter", "a_summer"] }, { key: "f_blown", type: "bool" }, { key: "f_drainv", type: "bool" }, { key: "f_timer", type: "bool" }] },
};
// helpers from the HA package that hold the card's settings (internal units: bar, °C, L, W, s, min, d)
const HELPERS = {
  cut_in: "input_number.water_cut_in", cut_out: "input_number.water_cut_out", power_threshold: "input_number.water_pump_power_threshold",
  current_threshold: "input_number.water_pump_current_threshold", guard_delay: "input_number.water_guard_delay", max_run_minutes: "input_number.water_max_run_minutes",
  short_cycle_seconds: "input_number.water_short_cycle_seconds", min_temp: "input_number.water_min_temp", guard_warn_temp: "input_number.water_guard_warn_temp",
  trace_warn_temp: "input_number.water_trace_warn_temp", tap_frost_temp: "input_number.water_tap_frost_temp", night_start: "input_number.water_night_start",
  night_end: "input_number.water_night_end", night_starts_warn: "input_number.water_night_starts_warn", water_heater_low_temp: "input_number.water_hot_low_temp",
  water_heater_ok_temp: "input_number.water_hot_ok_temp", legionella_temp: "input_number.water_legionella_temp", legionella_days: "input_number.water_legionella_days",
  water_heater_volume: "input_number.water_heater_volume", drawdown_min: "input_number.water_drawdown_min",
  irrigation_frost_temp: "input_number.water_irrigation_frost_temp", irrigation_max_minutes: "input_number.water_irrigation_max_minutes",
};
// settings panel: sections of [config key, quantity or fixed unit]; extra rows: helper-only numbers and switches
const SETTINGS = [
  ["set_pump", [["cut_in", "pressure"], ["cut_out", "pressure"], ["max_run_minutes", "min"], ["short_cycle_seconds", "s"], ["guard_delay", "s"], ["power_threshold", "power"], ["current_threshold", "A"]]],
  ["set_frost", [["min_temp", "temp"], ["guard_warn_temp", "temp"], ["trace_warn_temp", "temp"], ["tap_frost_temp", "temp"], ["irrigation_frost_temp", "temp"],
    ["@input_number.water_trace_auto_on_temp", "temp"], ["!input_boolean.water_auto_heat_cable"]]],
  ["set_hot", [["@wh_target", "temp"], ["water_heater_low_temp", "temp"], ["water_heater_ok_temp", "temp"], ["legionella_temp", "temp"], ["legionella_days", "d"], ["water_heater_volume", "volume"]]],
  ["set_night", [["night_start", "h"], ["night_end", "h"], ["night_starts_warn", ""], ["drawdown_min", "volume"], ["irrigation_max_minutes", "min"]]],
  ["set_maint", [["%precharge", "d"], ["%sample", "d"], ["%uv", "d"], ["%filter", "d"], ["%outdoor_tap", "d"], ["%irrigation", "d"]]],
  ["set_auto", [["!input_boolean.water_notifications"], ["!input_boolean.water_away_close_valve"]]],
];

const DEFAULTS = {
  name: null,
  pressure_unit: "bar",          // bar | kPa | psi | mbar
  temperature_unit: "auto",      // auto (from HA) | °C | °F
  volume_unit: "L",              // L | gal | m³
  flow_unit: "L/min",            // L/min | gal/min | m³/h
  power_unit: "W",               // W | kW
  tank_location: "box",          // "box" = separate insulated tank box outside, "house" = tank inside the house
  cut_in: 2.0,
  cut_out: 3.5,
  max_pressure: 6,
  low_pressure: null,
  min_temp: 3,
  trace_warn_temp: 5,            // warn if outdoor temp is below this and the heat cable is off
  guard_warn_temp: 5,            // warn if tank box temp is below this and the frost guard is off
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
  confirm: true,                 // true = all, false = none, or a list: [pump, valve, frost_guard, heat_trace, water_heater]
  show_valve: true,
  show_pump_guard: true,
  show_frost_guard: true,
  show_heat_trace: true,
  show_water_heater: true,
  show_leak: true,
  show_outdoor: true,
  show_labels: true,
  show_tiles: true,
  show_stats: true,
  show_history: true,
  show_controls: true,
  show_events: true,
  use_package: false,            // read alarms from the companion HA package
  compact: false,                // show only header + drawing; tap header to expand
  events_count: 8,
  water_heater_volume: null,     // litres, enables "≈ L hot water / showers"
  cold_water_temp: 8,
  shower_liters: 60,
  drawdown_min: null,            // litres per cycle; warn below (if no package)
  uv: null,                      // true or entity (switch/binary_sensor: lamp on) – draws a UV unit
  filter: null,                  // true or entity (sensor, e.g. pressure drop) – draws a filter
  outdoor_tap: null,             // true or entity (valve/switch) – draws an outdoor tap
  outdoor_tap_shutoff: null,     // indoor stop valve for the outdoor tap (on/open = water in the outdoor pipe)
  irrigation: null,              // switch/binary_sensor; water use while it runs is not a leak/away alarm
  tap_frost_temp: 0,             // warn below this (outdoor) if the outdoor tap isn't shut off
  irrigation_shutoff: null,      // indoor supply valve for the irrigation (on/open = water in the irrigation pipes)
  irrigation_frost_temp: 3,      // warn below this (outdoor) if the irrigation isn't winterized
  irrigation_max_minutes: 60,    // warn if irrigation runs longer than this
  interval_irrigation: null,
  interval_precharge: null, interval_sample: null, interval_uv: null, interval_filter: null, interval_outdoor_tap: null,
  language: null,
};

const STRINGS = {
  en: {
    title: "Water supply", sub: "Well · pump · pressure tank", well: "Well", tank: "Pressure tank", house: "House", out: "Outside",
    s_normal: "Normal", s_offline: "Sensor offline", s_leak: "Leak detected", s_guard: "Pump stopped", s_valve: "Main valve closed",
    s_long: "Pump running long", s_frost: "Frost risk", s_low: "Low pressure", s_short: "Short cycling", s_pump: "Pumping", s_use: "Water in use",
    b_leak: "Leak sensor triggered – check the pump house and pipes.",
    b_guard: "Pressure is low but the pump isn't running – check the pump guard display (EIL = dry run, EIH = overcurrent, EUL = low voltage).",
    b_frost: "Tank box is at {v} – risk of frozen pipes.", b_frost_off: " Frost guard is off.", b_frost_weak: " Frost guard is on but can't keep it warm – check it.",
    b_guard_off: "Tank box is {v} and the frost guard is off.", b_leak_at: "Leak: {v} – close the main valve and check.",
    s_away: "Away", s_away_alarm: "Water used while away",
    b_away_alarm: "Water is being used while you're away – check for a leak.", b_precharge: "Tank delivers only {v} per pump cycle – check the air pre-charge.",
    b_wear: "Pump cycles are {v} longer than the 30-day average – pump wear or low well level?", b_maint: "Maintenance due: {v}",
    t_hot_l: "Hot water", showers: "{v} showers", t_draw: "Per cycle", t_cyc: "Cycle 7 d / 30 d",
    ev: "Events", maint: "Maintenance", m_precharge: "Tank pre-charge", m_sample: "Water sample", m_uv: "UV lamp", m_filter: "Filter",
    due_in: "in {v} d", overdue: "{v} d overdue", never_done: "not logged", done: "Start", c_away: "Away", howto: "How to do it",
    set_title: "Settings", set_pump: "Pump and pressure", set_frost: "Frost", set_hot: "Hot water", set_night: "Night and tank",
    set_maint: "Maintenance intervals", set_auto: "Notifications and automation", set_none: "Install the HA package to change settings here. Until then, use the card editor.",
    set_saved: "Saved", close: "Close", wh_target: "Water heater set point", tap_frost_temp: "Outdoor tap frost warning below",
    cut_in: "Cut-in pressure", cut_out: "Cut-out pressure", max_run_minutes: "Max pump run time", short_cycle_seconds: "Short cycle below",
    guard_delay: "Pump-stopped alarm after", power_threshold: "Pump running above", current_threshold: "Pump running above (current)",
    min_temp: "Frost alarm (tank box) below", guard_warn_temp: "Frost guard off: warn below", trace_warn_temp: "Heat cable off: warn when outside below",
    water_heater_low_temp: "Low hot water below", water_heater_ok_temp: "Hot water OK from", legionella_temp: "Legionella temperature",
    legionella_days: "Must reach it every", water_heater_volume: "Water heater volume", night_start: "Night from", night_end: "Night to",
    night_starts_warn: "Warn at night starts ≥", drawdown_min: "Warn if drawdown per cycle below",
    "input_number.water_trace_auto_on_temp": "Heat cable auto on below", "input_boolean.water_auto_heat_cable": "Automatic heat cable",
    "input_boolean.water_notifications": "Push notifications", "input_boolean.water_away_close_valve": "Close main valve when away",
    m_outdoor_tap: "Outdoor tap", f_tapact: "Done", a_winter: "Winterized (closed and drained)", a_summer: "Opened for summer",
    f_drained: "Pipe drained", f_hose: "Hose disconnected", b_tap_frost: "It's {v} outside and the outdoor tap isn't shut off – risk of a burst pipe.",
    b_uv_off: "The UV lamp is off – the water isn't being disinfected.",
    m_irrigation: "Irrigation", f_blown: "Blown out with compressed air", f_drainv: "Drain valves opened", f_timer: "Timer/controller off",
    b_irr_frost: "It's {v} outside and the irrigation isn't winterized – drain the pipes before the frost.",
    b_irr_run_frost: "Irrigation is running at {v} outside – stop it before pipes and nozzles freeze.",
    b_irr_long: "Irrigation has run for {v} – check for a stuck valve or a broken pipe.",
    b_tap_winter: "Frost is coming ({v}) – remember to close and drain the outdoor tap.",
    irrigation_frost_temp: "Irrigation frost warning below", irrigation_max_minutes: "Irrigation max run time", t_uv: "UV lamp", t_filter: "Filter", c_tap: "Outdoor tap", c_irr: "Irrigation",
    dlg_title: "{v} – log", f_date: "Date", f_notes: "Notes", save: "Save as done", cancel: "Cancel", prev: "Previous entries",
    no_prev: "No previous entries.", need_num: "Enter a number", need_date: "Pick a date", no_log: "History isn't saved: add a Local To-do list (see README).",
    last: "Last", f_pre: "Measured pre-charge", f_cutin: "Cut-in pressure", f_cutout: "Cut-out pressure", f_adj: "Pre-charge adjusted to",
    f_lab: "Laboratory", f_result: "Result", f_ref: "Report no.", r_ok: "Approved", r_remarks: "Remarks", r_fail: "Not approved",
    f_hours: "Lamp hours", f_lamp: "New lamp (model)", f_sleeve: "Quartz sleeve cleaned", f_ftype: "Filter type", f_pbefore: "Pressure before change", yes: "Yes", no: "No",
    loc_box: "Tank box", loc_house: "House", loc_heater: "Under water heater", loc_well: "Well", loc_pipe: "Outdoor pipe",
    b_trace: "It's {v} outside and the heat cable is off.",
    b_low: "Pressure is below {v}.",
    b_long: "Pump has run for {v} without stopping – possible leak or low well.",
    b_short: "Pump only runs {v} per start – check the tank's air pre-charge (bladder may be waterlogged).",
    b_night: "Pump started {v} times during the night ({d}) – check toilets and taps for a hidden leak.",
    b_wh_low: "Hot water is only {v}. Below {d} there's little hot water and legionella can grow.",
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
    b_frost: "Tankkassen er {v} – fare for frosne rør.", b_frost_off: " Frostvakten er av.", b_frost_weak: " Frostvakten er på, men klarer ikke å holde varmen – sjekk den.",
    b_guard_off: "Tankkassen er {v} og frostvakten er av.", b_leak_at: "Lekkasje: {v} – steng hovedkranen og sjekk.",
    s_away: "Borte", s_away_alarm: "Vann brukt mens borte",
    b_away_alarm: "Det brukes vann mens dere er borte – sjekk for lekkasje.", b_precharge: "Tanken gir bare {v} per pumpesyklus – sjekk fortrykket.",
    b_wear: "Pumpesyklusene er {v} lengre enn 30-dagerssnittet – slitasje på pumpa eller lavt nivå i brønnen?", b_maint: "Vedlikehold forfalt: {v}",
    t_hot_l: "Varmtvann", showers: "{v} dusjer", t_draw: "Per syklus", t_cyc: "Syklus 7 d / 30 d",
    ev: "Hendelser", maint: "Vedlikehold", m_precharge: "Fortrykk i tanken", m_sample: "Vannprøve", m_uv: "UV-lampe", m_filter: "Filter",
    due_in: "om {v} d", overdue: "forfalt {v} d", never_done: "ikke registrert", done: "Utfør", c_away: "Borte", howto: "Slik gjør du det",
    set_title: "Innstillinger", set_pump: "Pumpe og trykk", set_frost: "Frost", set_hot: "Varmtvann", set_night: "Natt og tank",
    set_maint: "Vedlikeholdsintervaller", set_auto: "Varsler og automatikk", set_none: "Installer HA-pakken for å endre innstillinger her. Inntil da kan du bruke kort-editoren.",
    set_saved: "Lagret", close: "Lukk", wh_target: "Berederens innstilte temperatur", tap_frost_temp: "Utekran: frostvarsel under",
    cut_in: "Innkoblingstrykk", cut_out: "Utkoblingstrykk", max_run_minutes: "Maks gangtid for pumpa", short_cycle_seconds: "Kort syklus under",
    guard_delay: "Alarm for stoppet pumpe etter", power_threshold: "Pumpa går over", current_threshold: "Pumpa går over (strøm)",
    min_temp: "Frostalarm (tankkasse) under", guard_warn_temp: "Frostvakt av: varsle under", trace_warn_temp: "Varmekabel av: varsle når ute under",
    water_heater_low_temp: "Lite varmtvann under", water_heater_ok_temp: "Varmtvann OK fra", legionella_temp: "Legionellatemperatur",
    legionella_days: "Må nås minst hver", water_heater_volume: "Berederens volum", night_start: "Natt fra kl.", night_end: "Natt til kl.",
    night_starts_warn: "Varsle ved nattstarter ≥", drawdown_min: "Varsle hvis uttak per syklus under",
    "input_number.water_trace_auto_on_temp": "Varmekabel automatisk på under", "input_boolean.water_auto_heat_cable": "Automatisk varmekabel",
    "input_boolean.water_notifications": "Push-varsler", "input_boolean.water_away_close_valve": "Steng hovedkran når borte",
    m_outdoor_tap: "Utekran", f_tapact: "Utført", a_winter: "Vinterklargjort (stengt og tømt)", a_summer: "Åpnet for sommeren",
    f_drained: "Røret tømt", f_hose: "Slangen koblet fra", b_tap_frost: "Det er {v} ute og utekranen er ikke stengt – fare for frostsprengning.",
    b_uv_off: "UV-lampen er av – vannet blir ikke desinfisert.",
    m_irrigation: "Hagevanning", f_blown: "Blåst ut med trykkluft", f_drainv: "Dreneringsventiler åpnet", f_timer: "Timer/styring slått av",
    b_irr_frost: "Det er {v} ute og hagevanningen er ikke vinterklargjort – tøm rørene før frosten.",
    b_irr_run_frost: "Hagevanningen går mens det er {v} ute – stopp den før rør og dyser fryser.",
    b_irr_long: "Hagevanningen har gått i {v} – sjekk om en ventil henger eller et rør er ødelagt.",
    b_tap_winter: "Frosten nærmer seg ({v}) – husk å stenge og tømme utekranen.",
    irrigation_frost_temp: "Hagevanning: frostvarsel under", irrigation_max_minutes: "Hagevanning: maks gangtid", t_uv: "UV-lampe", t_filter: "Filter", c_tap: "Utekran", c_irr: "Hagevanning",
    dlg_title: "{v} – registrer", f_date: "Dato", f_notes: "Notat", save: "Lagre som utført", cancel: "Avbryt", prev: "Tidligere registreringer",
    no_prev: "Ingen tidligere registreringer.", need_num: "Skriv inn et tall", need_date: "Velg en dato", no_log: "Historikk lagres ikke: legg til en Local To-do-liste (se README).",
    last: "Sist", f_pre: "Målt fortrykk", f_cutin: "Innkoblingstrykk", f_cutout: "Utkoblingstrykk", f_adj: "Fortrykk justert til",
    f_lab: "Laboratorium", f_result: "Resultat", f_ref: "Rapportnr.", r_ok: "Godkjent", r_remarks: "Merknader", r_fail: "Ikke godkjent",
    f_hours: "Lampetimer", f_lamp: "Ny lampe (modell)", f_sleeve: "Kvartsglass rengjort", f_ftype: "Filtertype", f_pbefore: "Trykk før bytte", yes: "Ja", no: "Nei",
    loc_box: "Tankkasse", loc_house: "Hus", loc_heater: "Under bereder", loc_well: "Brønn", loc_pipe: "Rør ute",
    b_trace: "Det er {v} ute og varmekabelen er av.",
    b_low: "Trykket er under {v}.",
    b_long: "Pumpa har gått i {v} uten stopp – mulig lekkasje eller lite vann i brønnen.",
    b_short: "Pumpa går bare {v} per start – sjekk fortrykket i tanken (membranen kan være vannfylt).",
    b_night: "Pumpa startet {v} ganger i natt ({d}) – sjekk toaletter og kraner for skjult lekkasje.",
    b_wh_low: "Varmtvannet er bare {v}. Under {d} er det lite varmtvann, og legionella kan vokse.",
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
svg.diagram .big { font-size:23px; font-weight:700; fill:var(--primary-text-color); }
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
.lkdrop { animation:lkdrop .9s ease-in infinite; }
@keyframes lkdrop { 0% { transform:translateY(0); opacity:1; } 100% { transform:translateY(var(--dy)); opacity:.15; } }
.lkpud { transform-origin:center; animation:lkpud 2s ease-in-out infinite; opacity:.8; }
@keyframes lkpud { 50% { transform:scaleX(1.15); } }
.lkring { animation:lkring 1s ease-in-out infinite; }
@keyframes lkring { 50% { opacity:.2; } }
svg.diagram .whv { font-size:17px; font-weight:700; fill:#fff; stroke:rgba(0,0,0,.45); stroke-width:3px; paint-order:stroke; }
.trace { fill:none; stroke:color-mix(in srgb, var(--primary-text-color) 25%, transparent); stroke-width:2.5; stroke-dasharray:3 4; transition:stroke .3s; }
.trace.on { stroke:${C.heat}; stroke-dasharray:none; stroke-width:3; filter:drop-shadow(0 0 3px ${C.heat}); }
.trace.warn { stroke:${C.frost}; }
#wh .glow { transition:opacity .3s; }
#uv .uvglow { opacity:0; transition:opacity .3s; }
#uv.on .uvglow { opacity:.35; animation:hglow 2s ease-in-out infinite; }
#uv .uvtube { opacity:.25; }
#uv.on .uvtube { opacity:1; }
#spr { display:none; }
#spr.on { display:inline; }
#spr .jet { fill:none; stroke:${C.water}; stroke-width:2.8; stroke-linecap:round; stroke-dasharray:2 6; animation:flow .6s linear infinite; }
#otap .spray, #otap .tapwarn { display:none; }
#otap.open .spray { display:inline; animation:lkdrop .7s ease-in infinite; --dy:6px; }
#otap.frost .tapwarn { display:inline; animation:lkring 1s ease-in-out infinite; }
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

.head[data-toggle] { cursor:pointer; }
.head .gear { --mdc-icon-size:22px; color:var(--secondary-text-color); cursor:pointer; padding:4px; border-radius:50%; }
.head .gear:hover { background:color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
.dl h3 { margin:16px 0 4px; font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--secondary-text-color); }
.dl .srow { display:flex; align-items:center; gap:10px; padding:6px 0; font-size:14px; }
.dl .srow span { flex:1; min-width:0; }
.dl .srow input[type=text] { flex:0 0 84px; width:84px; text-align:right; padding:8px 10px; }
.dl .srow small { min-width:42px; color:var(--secondary-text-color); }
.dl .srow input[type=checkbox] { width:22px; height:22px; flex:none; }
.dl .srow.ok input { border-color:${C.ok}; }
.head .chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s; }
.head .chev.open { transform:rotate(180deg); }
.evl .ev, .mt { display:flex; align-items:center; gap:10px; padding:6px 0; font-size:13px; --mdc-icon-size:18px; }
.evl .ev + .ev, .mt + .mt { border-top:1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent); }
.evl .ev span, .mt span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--primary-text-color); }
.evl .ev time, .mt small { color:var(--secondary-text-color); font-size:12px; white-space:nowrap; }
.evl ha-icon, .mt ha-icon { color:var(--c, var(--secondary-text-color)); flex:none; }
.mt small.bad { color:${C.warn}; font-weight:600; }
.mt button { border:0; border-radius:10px; padding:6px 10px; font:inherit; font-size:12px; font-weight:600; cursor:pointer;
  color:var(--primary-text-color); background:color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
dialog.mdlg { border:0; border-radius:18px; padding:0; width:min(440px, 94vw); max-height:88vh; color:var(--primary-text-color);
  background:var(--ha-card-background, var(--card-background-color, #1c1f26)); box-shadow:0 20px 60px rgba(0,0,0,.45); }
dialog.mdlg::backdrop { background:rgba(0,0,0,.55); }
.dl { display:flex; flex-direction:column; max-height:88vh; }
.dl header { display:flex; align-items:center; gap:10px; padding:16px 18px 8px; font-size:16px; font-weight:600; --mdc-icon-size:22px; }
.dl header ha-icon { color:${C.water}; }
.dl .body { padding:4px 18px 8px; overflow:auto; }
.dl label.fld { display:block; margin:10px 0 0; font-size:12px; color:var(--secondary-text-color); }
.dl .row { display:flex; align-items:center; gap:8px; margin-top:4px; }
.dl input, .dl select, .dl textarea { flex:1; width:100%; box-sizing:border-box; font:inherit; font-size:15px; color:var(--primary-text-color); padding:10px 12px; border-radius:10px;
  border:1px solid color-mix(in srgb, var(--primary-text-color) 18%, transparent); background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); }
.dl textarea { min-height:64px; resize:vertical; }
.dl .row small { color:var(--secondary-text-color); min-width:34px; }
.dl .err { color:${C.bad}; font-size:12px; min-height:14px; margin-top:2px; }
.dl .chk { display:flex; align-items:center; gap:10px; margin-top:12px; font-size:14px; }
.dl .chk input { flex:none; width:20px; height:20px; }
.dl details.help { margin:2px 0 6px; padding:10px 12px; border-radius:12px; background:color-mix(in srgb, ${C.water} 10%, transparent); }
.dl details.help summary { cursor:pointer; font-size:14px; font-weight:600; color:${C.water}; list-style:none; display:flex; align-items:center; gap:8px; --mdc-icon-size:18px; }
.dl details.help summary::-webkit-details-marker { display:none; }
.dl details.help[open] summary .chev2 { transform:rotate(180deg); }
.dl details.help ol { margin:8px 0 2px; padding-left:20px; font-size:13px; line-height:1.5; }
.dl details.help li + li { margin-top:4px; }
.dl .prev { margin-top:16px; padding-top:10px; border-top:1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent); }
.dl .prev h4 { margin:0 0 6px; font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--secondary-text-color); }
.dl .pe { padding:8px 10px; border-radius:10px; margin-bottom:6px; font-size:13px; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); }
.dl .pe b { display:block; font-size:12px; margin-bottom:2px; }
.dl .pe div { color:var(--secondary-text-color); white-space:pre-line; }
.dl .hint { font-size:12px; color:${C.warn}; margin-top:10px; }
.dl footer { display:flex; gap:8px; justify-content:flex-end; padding:12px 18px 16px; }
.dl footer button { border:0; border-radius:12px; padding:11px 16px; font:inherit; font-size:14px; font-weight:600; cursor:pointer;
  color:var(--primary-text-color); background:color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
.dl footer button.pri { color:#fff; background:${C.water}; }
.mt .nm { flex:1; min-width:0; display:flex; flex-direction:column; }
.mt .nm em { font-style:normal; font-size:11px; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ptitle { font-size:11px; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
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
    this._raw = config;
    const tu = config.temperature_unit && config.temperature_unit !== "auto" ? config.temperature_unit
      : (this._hass && this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature) || "°C";
    this._tU = /f/i.test(tu) ? "°F" : "°C";
    const user = { ...config };
    const pk = String(user.pressure_unit || DEFAULTS.pressure_unit).toLowerCase(), vk = String(user.volume_unit || DEFAULTS.volume_unit).toLowerCase();
    const wk = String(user.power_unit || DEFAULTS.power_unit).toLowerCase();
    const conv = (keys, fn) => keys.forEach((k) => { if (typeof user[k] === "number") user[k] = fn(user[k]); });
    conv(UNIT_KEYS.pressure, (v) => v * (UNITS.pressure[pk] ?? 1));
    conv(UNIT_KEYS.volume, (v) => v * (UNITS.volume[vk] ?? 1));
    conv(UNIT_KEYS.power, (v) => v * (UNITS.power[wk] ?? 1));
    if (this._tU === "°F") conv(UNIT_KEYS.temp, (v) => ((v - 32) * 5) / 9);
    const cfg = { ...DEFAULTS, ...user };
    const off = (flag, keys) => { if (cfg[flag] === false) keys.forEach((k) => delete cfg[k]); };
    off("show_valve", ["valve"]);
    off("show_pump_guard", ["pump_guard"]);
    off("show_frost_guard", ["frost_guard"]);
    off("show_heat_trace", ["heat_trace"]);
    off("show_water_heater", ["water_heater", "water_heater_temp", "water_heater_power", "water_heater_energy"]);
    off("show_leak", ["leak", ...LEAK_LOCS.map((l) => `leak_${l}`)]);
    off("show_outdoor", ["outdoor_temp"]);
    ["uv", "filter", "outdoor_tap"].forEach((k) => { if (cfg[`has_${k}`] && !cfg[k]) cfg[k] = cfg[`${k}_entity`] || true; if (cfg[`has_${k}`] === false) cfg[k] = null; });
    if (cfg.use_package) Object.entries(PKG_DEFAULTS).forEach(([k, v]) => { if (cfg[k] === undefined) cfg[k] = v; });
    if (cfg.use_package && cfg.maintenance === undefined)
      cfg.maintenance = ["precharge", "sample", ...(cfg.uv ? ["uv"] : []), ...(cfg.filter ? ["filter"] : []), ...(cfg.outdoor_tap ? ["outdoor_tap"] : []), ...(cfg.irrigation ? ["irrigation"] : [])];
    this._config = cfg;
    this._sig = "";
    this._hist = null;
    this._histAt = 0;
    this._built = false;
    this._evAt = 0;
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
    if ((!this._raw.temperature_unit || this._raw.temperature_unit === "auto") && hass.config && hass.config.unit_system) {
      const want = /f/i.test(hass.config.unit_system.temperature || "") ? "°F" : "°C";
      if (want !== this._tU) { this.setConfig(this._raw); this._hass = hass; }
    }
    const lang = String(this._config.language || (hass.locale && hass.locale.language) || hass.language || "en");
    if (this._built && lang !== this._lang) this._built = false;
    this._lang = lang;
    if (this._config.use_package && this._syncHelpers()) this._built = false;
    if (!this._built) this._build();
    const sig = this._ids().map((id) => { const s = hass.states[id]; return s ? s.state + (s.attributes.current_temperature ?? "") : "x"; }).join("|");
    if (sig !== this._sig) { this._sig = sig; this._update(); }
    this._loadHistory();
    this._loadLeg();
    this._loadEvents();
    this._loadLog();
  }

  // ---------- helpers ----------
  _t(k, v, d) {
    const c = this._config, h = this._hass || {};
    const lang = String(c.language || (h.locale && h.locale.language) || h.language || "en").toLowerCase();
    const s = (/^(nb|nn|no)/.test(lang) ? STRINGS.nb : STRINGS.en)[k] ?? STRINGS.en[k] ?? k;
    let out = v === undefined ? s : s.replace("{v}", v);
    return d === undefined ? out : out.replace("{d}", d);
  }
  // read thresholds from the package's helpers; returns true when something that is drawn (gauge zones) changed
  _syncHelpers() {
    let redraw = false;
    Object.entries(HELPERS).forEach(([k, id]) => {
      if (this._raw && this._raw[k] !== undefined && !this._config.use_package) return;
      const v = this._num(id);
      if (v == null || v === this._config[k]) return;
      if (["cut_in", "cut_out"].includes(k)) redraw = true;
      this._config[k] = v;
    });
    return redraw;
  }

  _irrIds() { const v = this._config.irrigation; return !v ? [] : (Array.isArray(v) ? v : [v]).filter((x) => typeof x === "string"); }

  // latest logged season action for a maintenance item: "winter", "summer" or null
  _season(key) {
    const it = this._maintItems().find((x) => x.key === key);
    if (!it) return null;
    const h = this._logFor(it)[0];
    if (!h) return null;
    const txt = h.lines.join(" ");
    const has = (k) => txt.includes(STRINGS.nb[k]) || txt.includes(STRINGS.en[k]);
    return has("a_winter") ? "winter" : has("a_summer") ? "summer" : null;
  }

  _leaks() {
    const c = this._config, out = [];
    const add = (x, loc) => {
      if (!x) return;
      if (typeof x === "string") out.push({ id: x, loc, name: null });
      else if (x.entity) out.push({ id: x.entity, loc: x.location || loc, name: x.name || null });
    };
    (Array.isArray(c.leak) ? c.leak : [c.leak]).forEach((x) => add(x, "house"));
    LEAK_LOCS.forEach((l) => { const v = c[`leak_${l}`]; (Array.isArray(v) ? v : [v]).forEach((x) => add(x, l)); });
    return out;
  }
  _leakIds() { return this._leaks().map((l) => l.id); }
  _ids() {
    const c = this._config;
    const ids = [c.pressure, c.pump_power, c.pump_current, c.pump_switch, c.pump_running, c.pump_guard, c.valve, c.temperature, c.heat_trace, c.frost_guard, c.outdoor_temp,
      c.flow, c.water_today, c.well_level, c.water_heater, c.water_heater_temp, c.water_heater_power, c.water_heater_energy, ...this._leakIds()];
    (c.buttons || []).forEach((b) => ids.push(b.entity));
    ids.push(c.away, c.drawdown, c.drawdown_warn, c.cycle_avg_7d, c.cycle_avg_30d, c.pump_trend, c.outdoor_tap_shutoff, c.irrigation);
    ["uv", "filter", "outdoor_tap"].forEach((k) => { if (typeof c[k] === "string") ids.push(c[k]); });
    ids.push(...this._irrIds(), c.irrigation_shutoff);
    if (c.use_package) ids.push(...Object.values(HELPERS));
    if (c.use_package) ids.push(...Object.values(PKG), "sensor.water_pump_starts_night");
    this._maintItems().forEach((m) => ids.push(m.entity, m.interval));
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
  // value converted to the card's internal unit for quantity q (pressure, volume, flow, power, current, temp)
  _conv(id, q) {
    const u = this._unit(id).toLowerCase();
    if (q === "temp") return /f/.test(u) ? (v) => ((v - 32) * 5) / 9 : /^k$/.test(u) ? (v) => v - 273.15 : (v) => v;
    const f = (UNITS[q] || {})[u];
    return (v) => v * (f ?? 1);
  }
  _canon(id, q) { const v = this._num(id); return v == null ? null : this._conv(id, q)(v); }
  // internal value → display value / label
  _du(q) {
    const c = this._config;
    return q === "temp" ? this._tU : q === "pressure" ? c.pressure_unit : q === "volume" ? c.volume_unit : q === "flow" ? c.flow_unit : q === "power" ? c.power_unit : "";
  }
  _disp(v, q) {
    if (v == null) return null;
    if (q === "temp") return this._tU === "°F" ? (v * 9) / 5 + 32 : v;
    const f = (UNITS[q] || {})[String(this._du(q)).toLowerCase()];
    return f ? v / f : v;
  }
  _fq(v, q, d) {
    const dec = d ?? UNIT_DEC[String(this._du(q)).toLowerCase()] ?? 1;
    return this._fmt(this._disp(v, q), dec);
  }
  _fv(v, q, d) { return v == null ? "–" : q === "temp" ? `${this._fq(v, q, d)}${this._tU}` : `${this._fq(v, q, d)} ${this._du(q)}`; }
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
    if (c.pump_power) return { id: c.pump_power, type: "num", thr: c.power_threshold, q: "power" };
    if (c.pump_current) return { id: c.pump_current, type: "num", thr: c.current_threshold, q: "current" };
    if (c.pump_running) return { id: c.pump_running, type: "bin" };
    return null;
  }

  // ---------- events ----------
  _onClick(ev) {
    if (ev.target.closest("[data-settings]")) { this._openSettings(); return; }
    const dl = ev.target.closest("[data-dlg]");
    if (dl) { if (dl.dataset.dlg === "save") this._saveMaint(); else this._closeDlg(); return; }
    if (ev.target.id === "mdlg") { this._closeDlg(); return; }        // click on the backdrop
    const done = ev.target.closest("[data-done]");
    if (done) { this._openMaint(done.dataset.done); return; }
    const tog = ev.target.closest("[data-toggle]");
    if (tog && !ev.target.closest("[data-info]")) { this._expanded = !this._expanded; this._update(); return; }
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
        const f = this._conv(chartId, chartId === c.pressure ? "pressure" : /temp/.test(chartId) || chartId === c.temperature ? "temp" : "x");
        let pts = byId[chartId].map((s) => ({ t: ts(s), v: f(parseFloat(s.state)) })).filter((p) => isFinite(p.v));
        const step = Math.ceil(pts.length / 200);
        if (step > 1) pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
        out.chart = { id: chartId, pts };
      }
      if (src && byId[src.id]) {
        const f = this._conv(src.id, src.q), runs = [];
        let cur = null;
        for (const s of byId[src.id]) {
          if (BAD_STATES.includes(s.state)) continue;
          const on = src.type === "num" ? f(parseFloat(s.state)) >= src.thr : s.state === "on";
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
    const cv = this._conv(id, "temp");
    const hit = (t, v) => { if (v != null && isFinite(v) && cv(v) >= c.legionella_temp && (last == null || t > last)) last = t; };
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
    m.p = this._canon(c.pressure, "pressure");
    m.pw = this._canon(c.pump_power, "power");
    m.amps = this._canon(c.pump_current, "current");
    m.temp = this._canon(c.temperature, "temp");
    m.outT = this._canon(c.outdoor_temp, "temp");
    m.flow = this._canon(c.flow, "flow");
    m.today = this._canon(c.water_today, "volume");
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
    m.leaks = this._leaks().filter((l) => (this._st(l.id) || {}).state === "on");
    m.leak = m.leaks.length > 0;
    m.frost = m.temp != null && m.temp < c.min_temp;
    m.guardOn = c.frost_guard ? this._isOn(c.frost_guard) : null;
    m.traceOn = c.heat_trace ? this._isOn(c.heat_trace) : null;
    m.traceWarn = m.traceOn === false && m.outT != null && m.outT < c.trace_warn_temp;
    m.guardWarn = !m.frost && m.guardOn === false && m.temp != null && m.temp < c.guard_warn_temp;
    m.lowP = c.low_pressure ?? Math.max(0.5, c.cut_in - 0.5);
    m.lowPressure = m.p != null && m.p < m.lowP;

    // pump guard (e.g. EMS KM 35): explicit entity, or inferred from low pressure + pump not running
    m.guard = (this._st(c.pump_guard) || {}).state === "on";
    const src = this._runSrc();
    if (!m.guard && c.show_pump_guard !== false && src && m.valveOpen && m.p != null && m.p < c.cut_in - 0.2 && m.running === false) {
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
      const whp = this._canon(c.water_heater_power, "power");
      const haF = /f/i.test(((this._hass.config || {}).unit_system || {}).temperature || "");
      const attrT = whs && whs.attributes.current_temperature != null ? Number(whs.attributes.current_temperature) : null;
      const temp = this._canon(c.water_heater_temp, "temp") ?? (attrT == null ? null : haF ? ((attrT - 32) * 5) / 9 : attrT);
      const on = c.water_heater ? this._isOn(c.water_heater) : null;
      const wh = {
        on, temp, power: whp,
        target: whs && whs.attributes.temperature != null ? (haF ? ((Number(whs.attributes.temperature) - 32) * 5) / 9 : Number(whs.attributes.temperature)) : null,
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

    // away mode, tank health, pump wear, hot water litres
    m.away = c.away ? this._isOn(c.away) : false;
    const ent = (k) => (typeof c[k] === "string" ? c[k] : null);
    m.uvOn = ent("uv") && /^(switch|binary_sensor|input_boolean|light)\./.test(c.uv) ? this._isOn(c.uv) : c.uv ? true : null;
    m.tapOpen = ent("outdoor_tap") ? this._isOn(c.outdoor_tap) : false;
    const irr = this._irrIds().filter((id) => this._isOn(id));
    m.irrigating = irr.length > 0;
    m.irrFor = m.irrigating ? Math.max(...irr.map((id) => now - new Date(this._st(id).last_changed || now).getTime())) : 0;
    m.tapLive = c.outdoor_tap_shutoff ? this._isOn(c.outdoor_tap_shutoff) : null;   // water in the outdoor pipe
    m.tapFrost = !!c.outdoor_tap && m.outT != null && m.outT < c.tap_frost_temp && (m.tapOpen || m.tapLive === true);
    m.awayAlarm = m.away && (m.flowing || m.running === true) && !m.tapOpen && !m.irrigating;
    // outdoor use (tap / irrigation) – shown as flow in the outdoor branch instead of the indoor tap
    m.outdoorUse = (m.tapOpen || m.irrigating) && m.tapLive !== false && (c.tank_location === "house" || m.valveOpen);
    m.indoorUse = m.flowing && !m.outdoorUse;
    // winterizing reminders (from the shut-off valve if there is one, otherwise from the maintenance log)
    const tapSeason = this._season("outdoor_tap"), irrSeason = this._season("irrigation");
    m.tapWinter = !!c.outdoor_tap && !c.outdoor_tap_shutoff && !m.tapFrost && m.outT != null && m.outT < c.tap_frost_temp + 3 && tapSeason !== "winter";
    const irrLive = c.irrigation_shutoff ? this._isOn(c.irrigation_shutoff) : irrSeason !== "winter";
    m.irrFrost = this._irrIds().length > 0 && m.outT != null && m.outT < c.irrigation_frost_temp && irrLive && !m.irrigating;
    m.irrRunFrost = m.irrigating && m.outT != null && m.outT < 1;
    m.irrLong = m.irrigating && m.irrFor > c.irrigation_max_minutes * 60e3;
    m.drawdown = this._canon(c.drawdown, "volume");
    m.precharge = c.drawdown_warn ? this._isOn(c.drawdown_warn) : c.drawdown_min != null && m.drawdown != null && m.drawdown < c.drawdown_min;
    m.cyc7 = this._num(c.cycle_avg_7d);
    m.cyc30 = this._num(c.cycle_avg_30d);
    m.wear = c.pump_trend ? this._isOn(c.pump_trend) : !!(m.cyc7 && m.cyc30 && m.cyc7 > m.cyc30 * 1.25);
    if (m.wh && c.water_heater_volume && m.wh.temp != null) {
      const tc = c.cold_water_temp, T = m.wh.temp;
      m.wh.litres = T > 40 ? Math.round((c.water_heater_volume * (T - tc)) / (40 - tc)) : 0;
      m.wh.showers = Math.floor(m.wh.litres / c.shower_liters);
    }
    m.maint = this._maintItems().map((it) => {
      const s = this._st(it.entity);
      const days = this._num(it.interval) ?? it.days;
      let last = null;
      if (s && !BAD_STATES.includes(s.state)) { const t = new Date(s.attributes.timestamp ? s.attributes.timestamp * 1000 : s.state).getTime(); if (isFinite(t)) last = t; }
      const hist = this._logFor(it);
      if (hist.length && (last == null || hist[0].t > last)) last = hist[0].t;
      it.lastText = hist.length ? hist[0].lines[0] || "" : "";
      const left = last == null ? null : Math.round((last + days * 86400e3 - now) / 86400e3);
      return { ...it, last, left, due: left == null || left < 0 };
    });
    // values from the HA package take precedence when it is installed
    if (c.use_package) {
      const pk = (k, cur) => { const s = this._st(PKG[k]); return s && !BAD_STATES.includes(s.state) ? s.state === "on" : cur; };
      m.guard = pk("tripped", m.guard);
      m.frost = pk("frost", m.frost);
      m.guardWarn = pk("guard_off", m.guardWarn);
      m.traceWarn = pk("trace_off", m.traceWarn);
      m.lowPressure = pk("low_pressure", m.lowPressure);
      m.awayAlarm = pk("away_alarm", m.awayAlarm);
      m.tapFrost = pk("tap_frost", m.tapFrost);
      m.irrFrost = pk("irr_frost", m.irrFrost);
      m.irrLong = pk("irr_long", m.irrLong);
      if (m.stats) {
        m.stats.longRun = pk("long_run", m.stats.longRun);
        m.stats.shortCycle = pk("short_cycle", m.stats.shortCycle);
        m.stats.nightWarn = pk("night", m.stats.nightWarn);
        const ns = this._num("sensor.water_pump_starts_night");
        if (ns != null) m.stats.night = Math.round(ns);
      }
      if (m.wh) { m.wh.low = pk("hot_low", m.wh.low); m.wh.legRisk = pk("legionella", m.wh.legRisk); }
    }

    // status
    const st = (k, col, pulse = false) => ({ t: this._t(k), c: col, pulse });
    if (c.pressure && m.p == null) m.status = st("s_offline", C.warn);
    else if (m.leak) m.status = st("s_leak", C.bad, true);
    else if (m.awayAlarm) m.status = st("s_away_alarm", C.bad, true);
    else if (m.guard) m.status = st("s_guard", C.bad, true);
    else if (!m.valveOpen) m.status = st("s_valve", C.warn);
    else if (m.stats && m.stats.longRun) m.status = st("s_long", C.bad, true);
    else if (m.frost) m.status = st("s_frost", C.frost, true);
    else if (m.lowPressure) m.status = st("s_low", C.warn, true);
    else if (m.stats && m.stats.shortCycle) m.status = st("s_short", C.warn);
    else if (m.running) m.status = st("s_pump", C.water, true);
    else if (m.flowing) m.status = st("s_use", C.water, true);
    else if (m.away) m.status = st("s_away", "#a78bfa");
    else m.status = st("s_normal", C.ok);
    return m;
  }

  // ---------- build (once per config) ----------
  _build() {
    // the dialog lives outside ha-card so a redraw (e.g. new cut-in pressure) doesn't close an open form
    if (!this.shadowRoot.getElementById("hc")) this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card id="hc"></ha-card><dialog class="mdlg" id="mdlg"></dialog>`;
    this.shadowRoot.getElementById("hc").innerHTML = `
      <div id="head"></div><div id="banners"></div>${this._diagramTpl()}
      <div id="tiles"></div><div id="stats"></div><div id="extra"></div><div id="ctrls"></div>`;
    const $ = (id) => this.shadowRoot.getElementById(id);
    this._el = { head: $("head"), banners: $("banners"), tiles: $("tiles"), stats: $("stats"), extra: $("extra"), ctrls: $("ctrls") };
    if (!this._clickBound) {
      this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
      this.shadowRoot.addEventListener("change", (ev) => this._onChange(ev));
      this._clickBound = true;
    }
    this._built = true;
  }

  _diagramTpl() {
    const c = this._config, t = (k) => esc(this._t(k));
    const labels = c.show_labels !== false;
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
    const outdoorPipe = inHouse ? "M86,139 H160" : "M86,139 H176 M314,139 H452";
    const pipeEnd = hasWh ? 582 : 540;
    // house geometry: one small house (tank in box) or one long house with a technical room (tank inside)
    const hb = inHouse ? { x: 160, y: 20, w: 472, roof: "150,22 396,-36 642,22", gx: 396, gy: 4 }
                       : { x: 452, y: 30, w: 180, roof: "444,32 542,-30 640,32", gx: 542, gy: 16 };
    // leak effects, one per location in use: [drip from x,y] → puddle at px
    const LK = {
      box: [262, 150, 262], house: [512, 112, 512], heater: [586, 150, 586],
      well: [92, 134, 112], pipe: inHouse ? [124, 134, 124] : [140, 134, 140],
    };
    const locs = [...new Set(this._leaks().map((l) => l.loc))].filter((l) => LK[l]);
    const leakFx = locs.map((l) => {
      const [sx, sy, px] = LK[l];
      return `<g class="lkfx" id="lk-${l}" style="display:none">
        <ellipse class="lkpud tb" cx="${px}" cy="169" rx="26" ry="4.5" fill="${C.water}"/>
        <path class="lkdrop tb" style="--dy:${169 - sy - 6}px" d="M${sx},${sy} c-3,4 -4,6 -4,7.5 a4,4 0 0 0 8,0 c0,-1.5 -1,-3.5 -4,-7.5 z" fill="${C.water}"/>
        <circle class="lkring" cx="${px}" cy="166" r="20" fill="none" stroke="${C.bad}" stroke-width="2.5"/>
      </g>`;
    }).join("");

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
      ${c.outdoor_temp ? `<g ${info(c.outdoor_temp)}>${labels ? `<text x="6" y="-14" style="font-size:16px">${t("out")}</text>` : ""}<text id="otemp" x="6" y="8" class="val" style="font-size:22px"></text></g>` : ""}

      <g ${info(c.well_level)}>
        <rect x="44" y="118" width="42" height="154" rx="6" fill="${faint}" stroke="${muted}" stroke-width="2"/>
        <rect id="wellw" x="47" y="200" width="36" height="68" rx="3" fill="url(#wg)" opacity=".75"/>
        <rect x="38" y="111" width="54" height="10" rx="3" fill="${muted}"/>
        ${labels ? `<text x="65" y="98" text-anchor="middle">${t("well")}</text>` : ""}
        ${c.well_level ? `<text id="wellv" x="96" y="204" class="val"></text>` : ""}
      </g>

      <polygon points="${hb.roof}" fill="${roof}" stroke-linejoin="round"/>
      <rect x="${hb.x}" y="${hb.y}" width="${hb.w}" height="${172 - hb.y}" rx="4" fill="${faint}" stroke="${muted}" stroke-width="2"/>
      ${inHouse ? `<line x1="452" y1="${hb.y + 2}" x2="452" y2="170" stroke="${muted}" stroke-width="2" stroke-dasharray="5 5"/>` : ""}
      ${labels ? `<text x="${hb.gx}" y="${hb.gy}" text-anchor="middle" style="font-size:16px">${t("house")}</text>` : ""}

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
        ${labels ? `<text x="245" y="${inHouse ? 46 : 38}" text-anchor="middle">${t("tank")}</text>` : ""}
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
          <rect x="286" y="146" width="20" height="20" rx="4" fill="${C.heat}" opacity=".9"/>
          <path d="M291,160 q2,-3 0,-6 t0,-6 M296,160 q2,-3 0,-6 t0,-6 M301,160 q2,-3 0,-6 t0,-6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </g>
        ${c.temperature ? `<text id="ttemp" x="245" y="167" text-anchor="middle" class="val" style="font-size:17px"></text>` : ""}
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
        <text id="pval" x="${cx}" y="104" text-anchor="middle" class="big">–</text>
        <text x="${cx}" y="121" text-anchor="middle" style="font-size:12px">${esc(c.pressure_unit)}</text>
      </g>

      ${c.valve ? `<g id="valve" ${info(c.valve)} transform="translate(${inHouse ? 300 : 466},130)" style="--vc:${C.ok}">
        <path d="M-11,-10 L11,10 L11,-10 L-11,10 Z" style="fill:var(--vc)"/>
        <line x1="0" y1="0" x2="0" y2="-18" style="stroke:var(--vc)" stroke-width="3"/>
        <rect x="-8" y="-22" width="16" height="5" rx="2.5" style="fill:var(--vc)"/>
      </g>` : ""}

      <g id="tap">
        <rect x="514" y="60" width="32" height="9" rx="3" fill="${fixture}"/>
        <rect x="508" y="60" width="8" height="17" rx="3" fill="${fixture}"/>
        <path class="drip" d="M512,80 c-3,4 -4,6 -4,7.5 a4,4 0 0 0 8,0 c0,-1.5 -1,-3.5 -4,-7.5 z" fill="${C.water}"/>
        <path d="M490,94 h44 v4 a12,12 0 0 1 -12,12 h-20 a12,12 0 0 1 -12,-12 z" fill="${fixture}" opacity=".7"/>
      </g>
      ${c.filter ? `<g id="filt" ${info(typeof c.filter === "string" ? c.filter : null)}>
        <rect x="487" y="124" width="18" height="6" rx="2" fill="${fixture}"/>
        <rect x="489" y="130" width="14" height="30" rx="5" fill="url(#metal)" stroke="${muted}" stroke-width="2"/>
        <path d="M492,136 h8 M492,141 h8 M492,146 h8 M492,151 h8" stroke="${muted}" stroke-width="1.5"/>
      </g>` : ""}
      ${c.uv ? `<g id="uv" ${info(typeof c.uv === "string" ? c.uv : null)}>
        <rect class="uvglow" x="505" y="118" width="32" height="24" rx="10" fill="#a78bfa"/>
        <rect x="508" y="121" width="26" height="18" rx="8" fill="url(#metal)" stroke="${muted}" stroke-width="2"/>
        <rect class="uvtube" x="512" y="127" width="18" height="6" rx="3" fill="#a78bfa"/>
      </g>` : ""}
      ${c.outdoor_tap ? `<g id="otap" ${info(typeof c.outdoor_tap === "string" ? c.outdoor_tap : c.outdoor_tap_shutoff)}>
        <path class="pipe-base" d="M${inHouse ? 174 : 480},130 V150 H${inHouse ? 148 : 440}" style="stroke-width:6"/>
        <path id="pw5" class="pipe-water" d="M${inHouse ? 174 : 480},130 V150 H${inHouse ? 148 : 440}" style="stroke-width:3"/>
        <rect x="${inHouse ? 136 : 428}" y="144" width="14" height="10" rx="3" fill="${fixture}"/>
        <rect x="${inHouse ? 136 : 428}" y="148" width="6" height="12" rx="2" fill="${fixture}"/>
        <rect x="${inHouse ? 140 : 432}" y="138" width="8" height="5" rx="2" fill="${fixture}"/>
        <path class="spray" d="M${inHouse ? 139 : 431},164 l-2,5 M${inHouse ? 139 : 431},164 l0,6 M${inHouse ? 139 : 431},164 l2,5" stroke="${C.water}" stroke-width="2" stroke-linecap="round"/>
        <circle class="tapwarn" cx="${inHouse ? 139 : 431}" cy="151" r="15" fill="none" stroke="${C.frost}" stroke-width="2.5"/>
      </g>` : ""}
      ${this._irrIds().length || c.irrigation ? `<g id="spr" ${info(this._irrIds()[0])}>${(inHouse ? [108] : [120, 372]).map((x) => `
        <path class="jet" d="M${x},161 q-22,-36 -48,8"/><path class="jet" d="M${x},161 q22,-36 48,8"/><path class="jet" d="M${x},161 q-8,-42 -24,8"/><path class="jet" d="M${x},161 q8,-42 24,8"/>
        <rect x="${x - 3}" y="160" width="6" height="10" rx="2" fill="${fixture}"/>`).join("")}</g>` : ""}
      ${hasWh ? `
      <g id="wh" ${info(c.water_heater || c.water_heater_temp || c.water_heater_power)}>
        <rect class="glow" x="576" y="74" width="48" height="98" rx="18" fill="${C.hot}"/>
        <rect x="582" y="80" width="36" height="86" rx="14" fill="url(#metal)" stroke="${muted}" stroke-width="2"/>
        <rect id="whfill" x="585" y="83" width="30" height="80" rx="11" fill="url(#hg)" opacity=".6" style="transition:opacity .4s"/>
        <text id="whtemp" x="600" y="130" text-anchor="middle" class="whv"></text>
        <g id="legb" style="display:none"><circle cx="618" cy="82" r="11" fill="${C.warn}"/><text x="618" y="88" text-anchor="middle" style="fill:#fff;font-size:15px;font-weight:700">L</text></g>
      </g>` : ""}
      ${leakFx}
    </svg>`;
  }

  // ---------- update (every state change) ----------
  _set(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }

  _update() {
    if (!this._hass || !this._built) return;
    const m = this._model();
    const c = this._config;
    this._set(this._el.head, `
      <div class="head" ${c.compact ? "data-toggle=\"1\"" : ""}>
        <div class="ico"><ha-icon icon="mdi:water-pump"></ha-icon></div>
        <div class="title"><b>${esc(c.name || this._t("title"))}</b><span>${esc(this._t("sub"))}</span></div>
        <div class="chip ${m.status.pulse ? "pulse" : ""}" style="--c:${m.status.c}"><i></i>${esc(m.status.t)}</div>
        ${this._hasSettings() ? `<ha-icon class="gear" data-settings="1" icon="mdi:cog-outline"></ha-icon>` : ""}
        ${c.compact ? `<ha-icon class="chev ${this._expanded ? "open" : ""}" icon="mdi:chevron-down"></ha-icon>` : ""}
      </div>`);
    const full = !c.compact || this._expanded;
    this._set(this._el.banners, this._banners(m));
    this._updDiagram(m);
    this._set(this._el.tiles, c.show_tiles === false || !full ? "" : this._tiles(m));
    const sh = c.show_stats === false || !full ? "" : this._statsHtml(m), hh = c.show_history === false || !full ? "" : this._histHtml(m);
    this._set(this._el.stats, sh || hh ? `<div class="panel">${sh}${sh && hh ? '<div class="sep"></div>' : ""}${hh}</div>` : "");
    this._set(this._el.extra, full ? this._maintHtml(m) + this._eventsHtml() : "");
    this._set(this._el.ctrls, c.show_controls === false || !full ? "" : this._controls(m));
  }

  _banners(m) {
    const c = this._config, out = [];
    const b = (col, icon, txt) => out.push(`<div class="banner" style="--c:${col}"><ha-icon icon="${icon}"></ha-icon><span>${esc(txt)}</span></div>`);
    const tu = (v) => this._fv(v, "temp");
    if (m.leak) {
      const names = [...new Set(m.leaks.map((l) => l.name || (this._st(l.id) || {}).attributes?.friendly_name || this._t(`loc_${l.loc}`)))];
      b(C.bad, "mdi:water-alert", this._t("b_leak_at", names.join(", ")));
    }
    if (m.awayAlarm) b(C.bad, "mdi:home-alert", this._t("b_away_alarm"));
    if (m.tapFrost) b(C.frost, "mdi:water-pump-off", this._t("b_tap_frost", this._fv(m.outT, "temp")));
    if (m.irrRunFrost) b(C.bad, "mdi:sprinkler-variant", this._t("b_irr_run_frost", this._fv(m.outT, "temp")));
    if (m.irrLong) b(C.warn, "mdi:timer-alert-outline", this._t("b_irr_long", this._dur(m.irrFor, false)));
    if (m.irrFrost) b(C.frost, "mdi:sprinkler-variant", this._t("b_irr_frost", this._fv(m.outT, "temp")));
    if (m.tapWinter) b(C.frost, "mdi:water-pump-off", this._t("b_tap_winter", this._fv(m.outT, "temp")));
    if (m.uvOn === false) b(C.warn, "mdi:lightbulb-alert-outline", this._t("b_uv_off"));
    if (m.guard) b(C.bad, "mdi:engine-off", this._t("b_guard"));
    if (m.stats && m.stats.longRun) b(C.bad, "mdi:timer-alert", this._t("b_long", this._dur(m.stats.runFor, false)));
    if (m.frost) b(C.frost, "mdi:snowflake-alert", this._t("b_frost", tu(m.temp, c.temperature)) + (m.guardOn === false ? this._t("b_frost_off") : m.guardOn ? this._t("b_frost_weak") : ""));
    if (m.guardWarn) b(C.frost, "mdi:radiator-off", this._t("b_guard_off", tu(m.temp, c.temperature)));
    if (m.traceWarn) b(C.frost, "mdi:snowflake-thermometer", this._t("b_trace", tu(m.outT, c.outdoor_temp)));
    if (m.lowPressure && !m.leak && !m.guard) b(C.warn, "mdi:gauge-low", this._t("b_low", this._fv(m.lowP, "pressure")));
    if (m.stats && m.stats.shortCycle && !m.leak) b(C.warn, "mdi:sync-alert", this._t("b_short", this._dur(m.stats.median)));
    if (m.stats && m.stats.nightWarn && !m.leak) b(C.warn, "mdi:weather-night", this._t("b_night", m.stats.night, `${String(c.night_start).padStart(2, "0")}–${String(c.night_end).padStart(2, "0")}`));
    if (m.wh && m.wh.low && m.wh.on !== false) b(C.frost, "mdi:water-thermometer-outline", this._t("b_wh_low", this._fv(m.wh.temp, "temp", 0), this._fv(c.water_heater_low_temp, "temp", 0)));
    if (m.wh && m.wh.legRisk) b(C.warn, "mdi:bacteria-outline", this._t("b_leg", this._fv(c.legionella_temp, "temp", 0), c.legionella_days));
    if (m.precharge) b(C.warn, "mdi:gauge-low", this._t("b_precharge", this._fv(m.drawdown, "volume")));
    if (m.wear) b(C.warn, "mdi:engine-outline", this._t("b_wear", m.cyc7 && m.cyc30 ? `${Math.round((m.cyc7 / m.cyc30 - 1) * 100)} %` : "–"));
    const due = m.maint.filter((x) => x.due && x.last != null);
    if (due.length) b(C.warn, "mdi:wrench-clock", this._t("b_maint", due.map((x) => x.name).join(", ")));
    return out.join("");
  }

  _updDiagram(m) {
    const c = this._config, q = (id) => this.shadowRoot.getElementById(id);
    const f = m.p == null ? 0 : clamp(m.p / c.max_pressure, 0, 1);
    q("needle").style.transform = `rotate(${(f * 240).toFixed(1)}deg)`;
    const pv = q("pval");
    pv.textContent = m.p == null ? "–" : this._fq(m.p, "pressure");
    pv.style.fill = m.p == null ? "" : m.p < c.cut_in * 0.75 || m.p > c.cut_out * 1.15 ? C.warn : "";
    q("lvl").style.transform = `translateY(${(150 - 94 * (0.12 + 0.76 * f)).toFixed(1)}px)`;

    const pump = q("pump");
    pump.classList.toggle("run", !!m.running);
    pump.classList.toggle("trip", !!m.guard);
    q("pw1").classList.toggle("flow", !!m.running);
    const inside = !!m.indoorUse;
    q("pw2").classList.toggle("flow", !!(m.flowing || m.outdoorUse));
    q("pw2").style.opacity = m.valveOpen ? "" : ".12";
    ["pw3", "pw4"].forEach((id) => { const e = q(id); if (e) { e.classList.toggle("flow", inside); e.style.opacity = m.valveOpen ? "" : ".12"; } });
    if (q("pw5")) q("pw5").classList.toggle("flow", !!m.outdoorUse);
    if (q("spr")) q("spr").classList.toggle("on", !!m.irrigating);
    if (q("valve")) q("valve").style.setProperty("--vc", m.valveOpen ? C.ok : C.bad);
    q("tap").classList.toggle("on", inside);
    const active = new Set(m.leaks.map((l) => l.loc));
    this.shadowRoot.querySelectorAll(".lkfx").forEach((g) => { g.style.display = active.has(g.id.slice(3)) ? "" : "none"; });

    const wf = m.well == null ? 0.55 : clamp(m.well / 100, 0.05, 1);
    const wy = 268 - 140 * wf;
    q("wellw").setAttribute("y", wy.toFixed(1));
    q("wellw").setAttribute("height", (268 - wy).toFixed(1));
    if (q("wellv")) q("wellv").textContent = m.well == null ? "–" : `${this._fmt(m.well, 0)}${this._unit(c.well_level)}`;
    if (q("otemp")) {
      q("otemp").textContent = this._fv(m.outT, "temp", 1);
      q("otemp").style.fill = m.outT != null && m.outT < 0 ? C.frost : "";
    }
    if (q("ttemp")) {
      q("ttemp").textContent = this._fv(m.temp, "temp", 1);
      q("ttemp").style.fill = m.frost ? C.frost : "";
    }
    q("fguard").style.display = m.guardOn ? "" : "none";
    if (q("uv")) q("uv").classList.toggle("on", m.uvOn !== false);
    if (q("otap")) { q("otap").classList.toggle("open", m.tapOpen && m.outdoorUse); q("otap").classList.toggle("frost", m.tapFrost || m.tapWinter); }
    if (q("box")) q("box").style.stroke = m.frost || m.guardWarn ? C.frost : m.guardOn ? C.heat : "";
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
      q("whtemp").textContent = w.temp == null ? "" : `${this._fq(w.temp, "temp", 0)}°`;
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
    add(c.pump_power, "mdi:flash", this._t("t_pump"), this._fq(m.pw, "power"), this._du("power"), m.running ? C.water : m.guard ? C.bad : null);
    add(c.pump_current, "mdi:current-ac", this._t("t_current"), this._fmt(this._num(c.pump_current), 1), this._unit(c.pump_current) || "A", m.running ? C.water : m.guard ? C.bad : null);
    add(c.flow, "mdi:water-sync", this._t("t_flow"), this._fq(m.flow, "flow"), this._du("flow"), m.flowing ? C.water : null);
    add(c.water_today, "mdi:water", this._t("t_today"), this._fq(m.today, "volume"), this._du("volume"), null);
    add(c.well_level, "mdi:water-well", this._t("t_well"), this._fmt(m.well, 0), this._unit(c.well_level), null);
    if (m.wh) {
      add(c.water_heater_power, "mdi:water-boiler", this._t("t_whp"), this._fq(m.wh.power, "power"), this._du("power"), m.wh.heating ? C.hot : null);
      add(c.water_heater_energy, "mdi:lightning-bolt", this._t("t_whe"), this._fmt(m.wh.energy, 1), this._unit(c.water_heater_energy) || "kWh", null);
      if (m.wh.legKnown) {
        const d = m.wh.lastHot == null ? null : Math.floor((Date.now() - m.wh.lastHot) / 86400e3);
        const val = d == null ? this._t("never", c.legionella_days) : d === 0 ? this._t("today") : this._t("days_ago", d);
        add(c.water_heater_temp, "mdi:bacteria-outline", this._t("t_leg", `${this._fq(c.legionella_temp, "temp", 0)}°`), esc(val), "", m.wh.legRisk ? C.warn : C.ok);
      }
    }
    if (m.wh && m.wh.litres != null) add(c.water_heater_temp || c.water_heater, "mdi:shower-head", this._t("t_hot_l"), `≈${this._fq(m.wh.litres, "volume", 0)}`, ` ${this._du("volume")} · ${this._t("showers", m.wh.showers)}`, m.wh.low ? C.frost : C.hot);
    if (typeof c.uv === "string" && /^sensor\./.test(c.uv)) add(c.uv, "mdi:lightbulb-fluorescent-tube-outline", this._t("t_uv"), this._fmt(this._num(c.uv), 0), this._unit(c.uv), null);
    if (typeof c.filter === "string" && /^sensor\./.test(c.filter)) add(c.filter, "mdi:filter-outline", this._t("t_filter"), this._fmt(this._num(c.filter), 2), this._unit(c.filter), null);
    if (c.drawdown) add(c.drawdown, "mdi:car-coolant-level", this._t("t_draw"), this._fq(m.drawdown, "volume"), this._du("volume"), m.precharge ? C.warn : C.ok);
    if (c.cycle_avg_7d) add(c.cycle_avg_7d, "mdi:chart-timeline-variant", this._t("t_cyc"), `${this._fmt(m.cyc7, 0)}/${this._fmt(m.cyc30, 0)}`, "s", m.wear ? C.warn : null);
    return out.length ? `<div class="tiles">${out.join("")}</div>` : "";
  }

  _maintItems() {
    const c = this._config, list = c.maintenance;
    if (!list) return [];
    return (Array.isArray(list) ? list : [list]).map((x) => {
      if (typeof x === "string") { const d = MAINT[x]; return d ? { key: x, name: this._t(`m_${x}`), ...d, days: c[`interval_${x}`] ?? d.days } : null; }
      return x && (x.entity || x.name) ? { key: x.key || x.entity || x.name, name: x.name || x.entity, icon: x.icon || "mdi:wrench", entity: x.entity, interval: x.interval_entity,
        days: x.interval_days || 365, help: x.help, fields: (x.fields || []).map((f) => (typeof f === "string" ? { key: f, label: f, type: "text" } : { type: "text", ...f, key: f.key || f.label })) } : null;
    }).filter(Boolean);
  }

  _maintHtml(m) {
    if (!m.maint.length) return "";
    return `<div class="panel"><div class="ptitle">${esc(this._t("maint"))}</div>${m.maint.map((x) => {
      const txt = x.last == null ? this._t("never_done") : x.left < 0 ? this._t("overdue", -x.left) : this._t("due_in", x.left);
      return `<div class="mt" style="--c:${x.due && x.last != null ? C.warn : "var(--secondary-text-color)"}"><ha-icon icon="${esc(x.icon)}"></ha-icon>
        <span class="nm">${esc(x.name)}${x.lastText ? `<em>${esc(this._t("last"))}: ${esc(x.lastText)}</em>` : ""}</span>
        <small class="${x.due && x.last != null ? "bad" : ""}">${esc(txt)}</small><button data-done="${esc(x.key)}">${esc(this._t("done"))}</button></div>`;
    }).join("")}</div>`;
  }

  // ---------- maintenance log (HA to-do list keeps the history permanently) ----------
  _logEntity() {
    const c = this._config;
    if (c.maintenance_log) return c.maintenance_log;
    return this._st("todo.water_maintenance") ? "todo.water_maintenance" : null;
  }

  async _loadLog(force) {
    const id = this._logEntity(), now = Date.now();
    if (!id || !this._hass || !this._hass.callWS || this._logBusy || !this._maintItems().length) return;
    if (!force && this._logAt && now - this._logAt < 600000) return;
    this._logBusy = true;
    this._logAt = now;
    try {
      const r = await this._hass.callWS({ type: "todo/item/list", entity_id: id });
      this._logItems = (r && r.items) || [];
    } catch (e) { this._logItems = null; }
    this._logBusy = false;
    this._update();
    if (this._dlgKey && this._dlgKey !== "__settings") this._renderDlg();
  }

  // entries for one maintenance item, newest first: { t, date, lines[] }
  _logFor(it) {
    if (!this._logItems) return [];
    const pre = `${it.name} – `;
    return this._logItems.filter((x) => (x.summary || "").startsWith(pre)).map((x) => {
      const date = x.due || (x.summary.slice(pre.length).match(/\d{4}-\d{2}-\d{2}/) || [])[0] || "";
      return { t: new Date(date).getTime() || 0, date, lines: (x.description || "").split("\n").filter(Boolean) };
    }).sort((a, b) => b.t - a.t);
  }

  // ---------- settings panel (values live in the package's helpers) ----------
  _setRows() {
    const c = this._config, rows = [];
    const whEnt = c.water_heater && /^(water_heater|climate)\./.test(c.water_heater) ? c.water_heater : null;
    SETTINGS.forEach(([sec, items]) => {
      const list = [];
      items.forEach(([key, u]) => {
        if (key.startsWith("!")) { const id = key.slice(1); if (this._st(id)) list.push({ kind: "bool", id, label: this._t(id) }); return; }
        if (key === "@wh_target") { if (whEnt && this._st(whEnt).attributes.temperature != null) list.push({ kind: "wh", id: whEnt, label: this._t("wh_target"), q: "temp" }); return; }
        if (key.startsWith("@")) { const id = key.slice(1); if (this._st(id)) list.push({ kind: "num", id, label: this._t(id), q: u }); return; }
        if (key.startsWith("%")) {
          const it = this._maintItems().find((x) => x.key === key.slice(1));
          if (it && it.interval && this._st(it.interval)) list.push({ kind: "num", id: it.interval, label: it.name, q: u });
          return;
        }
        const id = HELPERS[key];
        if (id && this._st(id)) list.push({ kind: "num", id, label: this._t(key), q: u });
      });
      if (list.length) rows.push([sec, list]);
    });
    return rows;
  }

  _hasSettings() { return this._config.use_package || (this._config.water_heater && /^(water_heater|climate)\./.test(this._config.water_heater)); }

  _openSettings() {
    this._dlgKey = "__settings";
    this._setOk = {};
    const d = this.shadowRoot.getElementById("mdlg");
    if (!d) return;
    d.innerHTML = "";
    this._renderSettings();
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
  }

  _renderSettings() {
    const d = this.shadowRoot.getElementById("mdlg");
    if (!d) return;
    const units = { pressure: 1, temp: 1, volume: 1, power: 1 };
    const rows = this._setRows();
    const row = (r) => {
      const s = this._st(r.id);
      if (r.kind === "bool") return `<label class="srow"><span>${esc(r.label)}</span><input type="checkbox" data-set="${esc(r.id)}" data-kind="bool" ${s.state === "on" ? "checked" : ""}></label>`;
      const raw = r.kind === "wh" ? Number(s.attributes.temperature) : Number(s.state);
      const haF = /f/i.test(((this._hass.config || {}).unit_system || {}).temperature || "");
      const canon = r.kind === "wh" && haF ? ((raw - 32) * 5) / 9 : raw;
      const shown = units[r.q] ? this._fq(canon, r.q, r.q === "pressure" ? 1 : r.q === "temp" ? 1 : undefined) : this._fmt(canon, Number.isInteger(canon) ? 0 : 1);
      const unit = units[r.q] ? this._du(r.q) : r.q;
      return `<label class="srow ${this._setOk[r.id] ? "ok" : ""}"><span>${esc(r.label)}</span><input type="text" inputmode="decimal" data-set="${esc(r.id)}" data-kind="${r.kind}" data-q="${esc(r.q)}" value="${esc(shown)}"><small>${esc(unit)}</small></label>`;
    };
    d.innerHTML = `<div class="dl">
      <header><ha-icon icon="mdi:cog-outline"></ha-icon>${esc(this._t("set_title"))}</header>
      <div class="body">${rows.length ? rows.map(([sec, list]) => `<h3>${esc(this._t(sec))}</h3>${list.map(row).join("")}`).join("") : `<div class="hint">${esc(this._t("set_none"))}</div>`}</div>
      <footer><button class="pri" data-dlg="cancel">${esc(this._t("close"))}</button></footer>
    </div>`;
  }

  _onChange(ev) {
    const el = ev.target.closest("[data-set]");
    if (!el || !this._hass) return;
    const id = el.dataset.set;
    if (el.dataset.kind === "bool") { this._hass.callService("input_boolean", el.checked ? "turn_on" : "turn_off", { entity_id: id }); return; }
    const v = Number(String(el.value).replace(",", "."));
    if (!isFinite(v)) { el.value = ""; return; }
    const q = el.dataset.q;
    // display unit → internal unit
    let canon = v;
    if (q === "temp") canon = this._tU === "°F" ? ((v - 32) * 5) / 9 : v;
    else if (UNITS[q]) canon = v * (UNITS[q][String(this._du(q)).toLowerCase()] ?? 1);
    if (el.dataset.kind === "wh") {
      const haF = /f/i.test(((this._hass.config || {}).unit_system || {}).temperature || "");
      this._hass.callService(id.split(".")[0], "set_temperature", { entity_id: id, temperature: Math.round((haF ? (canon * 9) / 5 + 32 : canon) * 2) / 2 });
    } else {
      const a = this._st(id).attributes || {};
      const val = Math.min(a.max ?? Infinity, Math.max(a.min ?? -Infinity, Math.round(canon * 1000) / 1000));
      this._hass.callService("input_number", "set_value", { entity_id: id, value: val });
    }
    this._setOk[id] = true;
    el.closest(".srow").classList.add("ok");
  }

  _openMaint(key) {
    this._helpOpen = undefined;
    this._dlgKey = key;
    this._dlgVals = {};
    this._dlgErr = {};
    const old = this.shadowRoot.getElementById("mdlg");
    if (old) old.innerHTML = "";
    this._renderDlg();
    const d = this.shadowRoot.getElementById("mdlg");
    if (d && !d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
    this._loadLog(true);
  }

  _closeDlg() {
    const d = this.shadowRoot.getElementById("mdlg");
    if (d && d.open) d.close();
    this._dlgKey = null;
  }

  _renderDlg() {
    const it = this._maintItems().find((x) => x.key === this._dlgKey);
    const d = this.shadowRoot.getElementById("mdlg");
    if (!it || !d) return;
    // keep what the user has typed
    d.querySelectorAll("[data-f]").forEach((el) => { this._dlgVals[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; });
    const v = this._dlgVals, err = this._dlgErr || {};
    const pad = (n) => String(n).padStart(2, "0"), now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const label = (f) => f.label || this._t(f.key);
    const unit = (f) => f.unit || (f.q ? this._du(f.q) : "");
    const field = (f) => {
      const val = v[f.key] ?? "";
      if (f.type === "bool") return `<label class="chk"><input type="checkbox" data-f="${esc(f.key)}" ${val ? "checked" : ""}>${esc(label(f))}</label>`;
      let input;
      if (f.type === "select") input = `<select data-f="${esc(f.key)}"><option value=""></option>${(f.options || []).map((o) => {
        const t = this._t(o); return `<option value="${esc(o)}" ${val === o ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`;
      else input = `<input data-f="${esc(f.key)}" ${f.type === "number" ? 'type="text" inputmode="decimal"' : 'type="text"'} value="${esc(val)}">`;
      return `<label class="fld">${esc(label(f))}<div class="row">${input}${unit(f) ? `<small>${esc(unit(f))}</small>` : ""}</div><div class="err">${esc(err[f.key] || "")}</div></label>`;
    };
    const hist = this._logFor(it).slice(0, 5);
    const nb = /^(nb|nn|no)/.test(String(this._config.language || (this._hass.locale || {}).language || this._hass.language || ""));
    const ci = this._config.cut_in;
    let steps = it.help ? (Array.isArray(it.help) ? it.help : [it.help]) : (HELP[nb ? "nb" : "en"][it.key] || []);
    steps = steps.map((x) => String(x).replace("{cutin}", this._fv(ci, "pressure", 1)).replace("{pre}", this._fv(ci - 0.2, "pressure", 1)));
    if (this._helpOpen === undefined || this._helpKey !== it.key) { this._helpOpen = hist.length === 0; this._helpKey = it.key; }
    const prevHelp = d.querySelector("details.help");
    if (prevHelp) this._helpOpen = prevHelp.open;
    d.innerHTML = `<div class="dl">
      <header><ha-icon icon="${esc(it.icon)}"></ha-icon>${esc(this._t("dlg_title", it.name))}</header>
      <div class="body">
        ${steps.length ? `<details class="help" ${this._helpOpen ? "open" : ""}><summary><ha-icon icon="mdi:help-circle-outline"></ha-icon>${esc(this._t("howto"))}<ha-icon class="chev2" icon="mdi:chevron-down" style="margin-left:auto"></ha-icon></summary>
          <ol>${steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></details>` : ""}
        <label class="fld">${esc(this._t("f_date"))}<div class="row"><input type="date" data-f="_date" value="${esc(v._date || today)}" max="${today}"></div><div class="err">${esc(err._date || "")}</div></label>
        ${(it.fields || []).map(field).join("")}
        <label class="fld">${esc(this._t("f_notes"))}<div class="row"><textarea data-f="_notes">${esc(v._notes || "")}</textarea></div></label>
        ${this._logEntity() ? "" : `<div class="hint">${esc(this._t("no_log"))}</div>`}
        ${this._logEntity() ? `<div class="prev"><h4>${esc(this._t("prev"))}</h4>${hist.length ? hist.map((h) =>
          `<div class="pe"><b>${esc(h.date)}</b><div>${esc(h.lines.join("\n"))}</div></div>`).join("") : `<div class="pe"><div>${esc(this._t("no_prev"))}</div></div>`}</div>` : ""}
      </div>
      <footer><button data-dlg="cancel">${esc(this._t("cancel"))}</button><button class="pri" data-dlg="save">${esc(this._t("save"))}</button></footer>
    </div>`;
  }

  async _saveMaint() {
    const it = this._maintItems().find((x) => x.key === this._dlgKey);
    const d = this.shadowRoot.getElementById("mdlg");
    if (!it || !d) return;
    const vals = {};
    d.querySelectorAll("[data-f]").forEach((el) => { vals[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value.trim(); });
    this._dlgVals = vals;
    const err = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vals._date || "")) err._date = this._t("need_date");
    (it.fields || []).forEach((f) => { if (f.type === "number" && vals[f.key] !== "" && !isFinite(Number(String(vals[f.key]).replace(",", ".")))) err[f.key] = this._t("need_num"); });
    this._dlgErr = err;
    if (Object.keys(err).length) { this._renderDlg(); return; }
    // description: one "Label: value unit" line per filled-in field
    const lines = [];
    (it.fields || []).forEach((f) => {
      const raw = vals[f.key];
      if (raw === "" || raw == null || raw === false && f.type !== "bool") return;
      const val = f.type === "bool" ? this._t(raw ? "yes" : "no") : f.type === "select" ? this._t(raw) : f.type === "number" ? String(raw).replace(",", ".") : raw;
      const u = f.unit || (f.q ? this._du(f.q) : "");
      lines.push(`${f.label || this._t(f.key)}: ${val}${u ? ` ${u}` : ""}`);
    });
    if (vals._notes) lines.push(`${this._t("f_notes")}: ${vals._notes}`);
    const date = vals._date;
    try {
      if (it.entity && this._st(it.entity)) await this._hass.callService("input_datetime", "set_datetime", { entity_id: it.entity, date });
      // tell the package whether the irrigation is winterized (used by its frost alarm)
      const wz = "input_datetime.water_irrigation_winterized";
      if (it.key === "irrigation" && this._st(wz) && vals.f_tapact)
        await this._hass.callService("input_datetime", "set_datetime", { entity_id: wz, date: vals.f_tapact === "a_winter" ? date : "2000-01-01" });
      const log = this._logEntity();
      if (log) {
        const summary = `${it.name} – ${date}`;
        await this._hass.callService("todo", "add_item", { entity_id: log, item: summary, due_date: date, description: lines.join("\n") });
        await this._hass.callService("todo", "update_item", { entity_id: log, item: summary, status: "completed" });
      }
    } catch (e) { this._dlgErr = { _date: String(e.message || e) }; this._renderDlg(); return; }
    this._closeDlg();
    this._loadLog(true);
  }

  _eventEntities() {
    const c = this._config;
    if (c.event_entities) return c.event_entities;
    const ids = [...this._leakIds(), c.pump_guard];
    if (c.use_package) ids.push(...Object.values(PKG));
    return [...new Set(ids.filter((id) => id && this._st(id)))];
  }

  async _loadEvents() {
    const c = this._config, now = Date.now();
    if (c.show_events === false || !this._hass || !this._hass.callWS || this._evBusy) return;
    const ids = this._eventEntities();
    const sig = ids.map((id) => (this._st(id) || {}).state).join("|");
    if (!ids.length || (sig === this._evSig && now - (this._evAt || 0) < 300000)) return;
    this._evBusy = true;
    this._evSig = sig;
    this._evAt = now;
    try {
      const res = await this._hass.callWS({ type: "logbook/get_events", start_time: new Date(now - 14 * 86400e3).toISOString(), end_time: new Date(now).toISOString(), entity_ids: ids });
      this._events = (res || []).filter((e) => e.state === "on").sort((a, b) => b.when - a.when).slice(0, c.events_count);
    } catch (e) { this._events = null; }
    this._evBusy = false;
    this._update();
  }

  _eventsHtml() {
    const ev = this._events;
    if (!ev || !ev.length || this._config.show_events === false) return "";
    const lang = /^(nb|nn|no)/.test(String(this._config.language || (this._hass.locale || {}).language || "")) ? "nb-NO" : undefined;
    const today = new Date().toDateString();
    return `<div class="panel evl"><div class="ptitle">${esc(this._t("ev"))}</div>${ev.map((e) => {
      const d = new Date(e.when * 1000), s = this._st(e.entity_id);
      const name = (s && s.attributes.friendly_name) || e.entity_id;
      const tm = d.toDateString() === today ? d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const col = /leak|tripped|away_alarm|long_run/.test(e.entity_id) || this._leakIds().includes(e.entity_id) ? C.bad : C.warn;
      return `<div class="ev" style="--c:${col}" data-info="${esc(e.entity_id)}"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span>${esc(name)}</span><time>${esc(tm)}</time></div>`;
    }).join("")}</div>`;
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
    const q = isP ? "pressure" : id === c.temperature || /temp/.test(id) ? "temp" : null;
    const cur = q ? this._canon(id, q) : this._num(id);
    if (cur != null) pts.push({ t: now, v: cur });
    if (pts.length < 2) return "";
    if (q) pts = pts.map((p) => ({ t: p.t, v: this._disp(p.v, q) }));
    const vs = pts.map((p) => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    const dLo = lo, dHi = hi;
    const ci = this._disp(c.cut_in, "pressure"), co = this._disp(c.cut_out, "pressure");
    if (isP) { lo = Math.min(lo, ci); hi = Math.max(hi, co); }
    const pad = (hi - lo) * 0.08 || 0.1;
    lo -= pad; hi += pad;
    const x = (t) => (((t - t0) / (now - t0)) * W).toFixed(1);
    const y = (v) => (4 + (1 - (v - lo) / (hi - lo)) * 52).toFixed(1);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
    const area = `${line} L${x(now)},56 L${x(pts[0].t)},56 Z`;
    const refs = isP ? [ci, co].map((v) => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.ok}" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" opacity=".7"/>`).join("") : "";
    let strips = "";
    if (m.stats) {
      strips = m.stats.iv.filter((r) => (r.e ?? now) > t0).map((r) => {
        const a = Math.max(r.s, t0), w = Math.max(1.5, ((r.e ?? now) - a) / (now - t0) * W);
        return `<rect x="${x(a)}" y="62" width="${w.toFixed(1)}" height="8" fill="${C.water}" opacity=".85"/>`;
      }).join("");
    }
    const unit = q ? this._du(q) : this._unit(id);
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
      const cf = c.confirm;
      const needConfirm = on && opts.key && (cf === true || (Array.isArray(cf) && cf.includes(opts.key)));
      out.push(`<button class="btn ${armed ? "armed" : on ? "on" : opts.offBad ? "off-bad" : ""}" ${opts.col ? `style="--c:${opts.col}"` : ""}
        data-action="${esc(id)}" ${needConfirm ? 'data-confirm="1"' : ""} ${unavailable ? "disabled" : ""}>
        <ha-icon icon="${on ? iconOn : iconOff}"></ha-icon>${armed ? esc(this._t("confirm")) : `${esc(name)} <small>${esc(label)}</small>`}</button>`);
    };
    mk(c.pump_switch, this._t("c_pump"), "mdi:water-pump", "mdi:water-pump-off", { key: "pump", col: C.water });
    mk(c.valve, this._t("c_valve"), "mdi:valve-open", "mdi:valve-closed", { key: "valve", offBad: true, col: C.ok, valve: true });
    if (typeof c.outdoor_tap === "string") mk(c.outdoor_tap, this._t("c_tap"), "mdi:water-pump", "mdi:water-pump-off", { col: C.water, valve: /^valve\./.test(c.outdoor_tap) });
    if (c.outdoor_tap_shutoff) mk(c.outdoor_tap_shutoff, `${this._t("c_tap")} (${this._t("c_valve").toLowerCase()})`, "mdi:valve-open", "mdi:valve-closed", { col: C.water, valve: true });
    this._irrIds().forEach((id, i, a) => mk(id, a.length > 1 ? (this._st(id) || { attributes: {} }).attributes.friendly_name || this._t("c_irr") : this._t("c_irr"), "mdi:sprinkler-variant", "mdi:sprinkler-variant", { col: C.ok, valve: /^valve\./.test(id) }));
    if (c.irrigation_shutoff) mk(c.irrigation_shutoff, `${this._t("c_irr")} (${this._t("c_valve").toLowerCase()})`, "mdi:valve-open", "mdi:valve-closed", { col: C.ok, valve: true });
    mk(c.away, this._t("c_away"), "mdi:home-export-outline", "mdi:home-outline", { col: "#a78bfa" });
    mk(c.frost_guard, this._t("c_guard"), "mdi:radiator", "mdi:radiator-off", { key: "frost_guard", col: C.heat });
    mk(c.heat_trace, this._t("c_trace"), "mdi:heating-coil", "mdi:heating-coil", { key: "heat_trace", col: C.heat, offBad: m.traceWarn });
    mk(c.water_heater, this._t("c_wh"), "mdi:water-boiler", "mdi:water-boiler-off", { key: "water_heater", col: C.hot, stateText: (on) => (m.wh && m.wh.heating ? this._t("heating") : this._t(on ? "on" : "off")) });
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
const bool = (name) => ({ name, selector: { boolean: {} } });
const CONFIRM_KEYS = ["pump", "valve", "frost_guard", "heat_trace", "water_heater"];
const EDITOR_SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "tank_location", selector: { select: { mode: "dropdown", options: [
    { value: "box", label: "Separate tank box (outside)" }, { value: "house", label: "Inside the house" }] } } },
  { type: "expandable", name: "", title: "Units", flatten: true, schema: [
    { type: "grid", name: "", schema: [
      { name: "pressure_unit", selector: { select: { mode: "dropdown", options: ["bar", "kPa", "psi", "mbar"] } } },
      { name: "temperature_unit", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Auto (from HA)" }, "°C", "°F"] } } },
      { name: "volume_unit", selector: { select: { mode: "dropdown", options: ["L", "gal", "m³"] } } },
      { name: "flow_unit", selector: { select: { mode: "dropdown", options: ["L/min", "gal/min", "m³/h"] } } },
      { name: "power_unit", selector: { select: { mode: "dropdown", options: ["W", "kW"] } } },
    ] },
  ] },
  { type: "expandable", name: "", title: "HA package, away mode and extras", flatten: true, schema: [
    bool("use_package"), bool("compact"),
    { name: "away", selector: ent("input_boolean") },
    { type: "grid", name: "", schema: [
      { name: "water_heater_volume", selector: num("L", 0, 1000, 10) },
      { name: "shower_liters", selector: num("L", 10, 200, 5) },
      { name: "cold_water_temp", selector: num("°C", 1, 20, 1) },
      { name: "drawdown_min", selector: num("L", 0, 500, 1) },
      { name: "events_count", selector: num("", 0, 30, 1) },
    ] },
    { name: "drawdown", selector: ent("sensor") },
    { name: "cycle_avg_7d", selector: ent("sensor") },
    { name: "cycle_avg_30d", selector: ent("sensor") },
    { name: "maintenance_log", selector: ent("todo") },
    { name: "maintenance", selector: { select: { multiple: true, mode: "list", options: [
      { value: "precharge", label: "Tank pre-charge check" }, { value: "sample", label: "Water sample" },
      { value: "uv", label: "UV lamp" }, { value: "filter", label: "Filter change" }, { value: "outdoor_tap", label: "Outdoor tap (winter/summer)" }, { value: "irrigation", label: "Irrigation (winter/summer)" }] } } },
  ] },
  { type: "expandable", name: "", title: "Features (show / hide)", flatten: true, schema: [
    { type: "grid", name: "", schema: [
      bool("show_valve"), bool("show_pump_guard"), bool("show_frost_guard"), bool("show_heat_trace"),
      bool("show_water_heater"), bool("show_leak"), bool("show_outdoor"), bool("show_labels"),
      bool("show_tiles"), bool("show_stats"), bool("show_history"), bool("show_controls"), bool("show_events"),
    ] },
  ] },
  { type: "expandable", name: "", title: "Pump and pressure", flatten: true, expanded: true, schema: [
    { name: "pressure", selector: ent("sensor") },
    { name: "pump_power", selector: ent("sensor") },
    { name: "pump_current", selector: ent("sensor") },
    { name: "pump_running", selector: ent("binary_sensor") },
    { name: "pump_guard", selector: ent("binary_sensor") },
    { name: "pump_switch", selector: ent(["switch", "input_boolean"]) },
    { name: "valve", selector: ent(["valve", "switch"]) },
  ] },
  { type: "expandable", name: "", title: "Frost protection and usage", flatten: true, schema: [
    { name: "temperature", selector: ent("sensor") },
    { name: "outdoor_temp", selector: ent("sensor") },
    { name: "frost_guard", selector: ent(["switch", "climate", "input_boolean", "binary_sensor"]) },
    { name: "heat_trace", selector: ent(["switch", "climate", "input_boolean", "binary_sensor"]) },
    { name: "flow", selector: ent("sensor") },
    { name: "water_today", selector: ent("sensor") },
    { name: "well_level", selector: ent("sensor") },
  ] },
  { type: "expandable", name: "", title: "Leak sensors (by location)", flatten: true, schema: [
    { name: "leak_box", selector: ent("binary_sensor", { multiple: true }) },
    { name: "leak_house", selector: ent("binary_sensor", { multiple: true }) },
    { name: "leak_heater", selector: ent("binary_sensor", { multiple: true }) },
    { name: "leak_well", selector: ent("binary_sensor", { multiple: true }) },
    { name: "leak_pipe", selector: ent("binary_sensor", { multiple: true }) },
  ] },
  { type: "expandable", name: "", title: "UV, filter and outdoor tap", flatten: true, schema: [
    { type: "grid", name: "", schema: [bool("has_uv"), bool("has_filter"), bool("has_outdoor_tap")] },
    { name: "uv_entity", selector: ent(["switch", "binary_sensor", "sensor", "light"]) },
    { name: "filter_entity", selector: ent("sensor") },
    { name: "outdoor_tap_entity", selector: ent(["valve", "switch"]) },
    { name: "outdoor_tap_shutoff", selector: ent(["valve", "switch", "input_boolean"]) },
    { name: "irrigation", selector: ent(["switch", "binary_sensor", "valve"], { multiple: true }) },
    { name: "irrigation_shutoff", selector: ent(["valve", "switch", "input_boolean"]) },
    { type: "grid", name: "", schema: [{ name: "irrigation_frost_temp", selector: num("°C", -10, 10, 0.5) }, { name: "irrigation_max_minutes", selector: num("min", 5, 600, 5) }] },
    { name: "tap_frost_temp", selector: num("°C", -20, 10, 0.5) },
  ] },
  { type: "expandable", name: "", title: "Maintenance intervals (if not using the HA package)", flatten: true, schema: [
    { type: "grid", name: "", schema: [
      { name: "interval_precharge", selector: num("d", 30, 1095, 1) }, { name: "interval_sample", selector: num("d", 30, 3650, 1) },
      { name: "interval_uv", selector: num("d", 30, 1095, 1) }, { name: "interval_filter", selector: num("d", 14, 730, 1) },
      { name: "interval_outdoor_tap", selector: num("d", 30, 730, 1) }, { name: "interval_irrigation", selector: num("d", 30, 730, 1) },
    ] },
  ] },
  { type: "expandable", name: "", title: "Water heater", flatten: true, schema: [
    { name: "water_heater", selector: ent(["water_heater", "switch", "climate"]) },
    { name: "water_heater_temp", selector: ent("sensor") },
    { name: "water_heater_power", selector: ent("sensor") },
    { name: "water_heater_energy", selector: ent("sensor") },
  ] },
  { type: "expandable", name: "", title: "Alert levels", flatten: true, schema: [
    { type: "grid", name: "", schema: [
      { name: "min_temp", selector: num("°C", -10, 15, 0.5) },
      { name: "guard_warn_temp", selector: num("°C", -10, 20, 0.5) },
      { name: "trace_warn_temp", selector: num("°C", -25, 20, 0.5) },
      { name: "low_pressure", selector: num("bar", 0, 10, 0.1) },
      { name: "max_run_minutes", selector: num("min", 1, 240, 1) },
      { name: "short_cycle_seconds", selector: num("s", 5, 300, 5) },
      { name: "guard_delay", selector: num("s", 10, 900, 10) },
      { name: "night_starts_warn", selector: num("", 1, 20, 1) },
      { name: "night_start", selector: num("h", 0, 23, 1) },
      { name: "night_end", selector: num("h", 1, 23, 1) },
      { name: "water_heater_low_temp", selector: num("°C", 20, 70, 1) },
      { name: "water_heater_ok_temp", selector: num("°C", 30, 90, 1) },
      { name: "legionella_temp", selector: num("°C", 55, 85, 1) },
      { name: "legionella_days", selector: num("d", 1, 30, 1) },
    ] },
  ] },
  { type: "expandable", name: "", title: "Pump and pressure settings", flatten: true, schema: [
    { type: "grid", name: "", schema: [
      { name: "cut_in", selector: num("bar", 0, 10, 0.1) },
      { name: "cut_out", selector: num("bar", 0, 10, 0.1) },
      { name: "max_pressure", selector: num("bar", 1, 16, 1) },
      { name: "power_threshold", selector: num("W", 0, 5000, 10) },
      { name: "current_threshold", selector: num("A", 0, 20, 0.1) },
      { name: "history_hours", selector: num("h", 1, 168, 1) },
    ] },
    { name: "confirm", selector: { select: { multiple: true, mode: "list", options: [
      { value: "pump", label: "Pump off" }, { value: "valve", label: "Close main valve" }, { value: "frost_guard", label: "Frost guard off" },
      { value: "heat_trace", label: "Heat cable off" }, { value: "water_heater", label: "Water heater off" }] } } },
  ] },
];
const EDITOR_LABELS = {
  name: "Title", tank_location: "Pressure tank location", pressure: "Pressure sensor", pump_power: "Pump power (W)", pump_current: "Pump current (A)",
  pump_running: "Pump running (binary sensor)", pump_guard: "Pump guard alarm (binary sensor)", pump_switch: "Pump switch",
  valve: "Main valve", temperature: "Tank box / tank room temperature", outdoor_temp: "Outdoor temperature",
  frost_guard: "Frost guard in tank box", heat_trace: "Heat cable on outdoor pipes",
  leak_box: "Leak sensors – tank box", leak_house: "Leak sensors – house / kitchen / bathroom", leak_heater: "Leak sensors – under water heater",
  leak_well: "Leak sensors – well / pump house", leak_pipe: "Leak sensors – outdoor pipe",
  flow: "Flow sensor", water_today: "Water used today", well_level: "Well level",
  water_heater: "Water heater (entity or switch)", water_heater_temp: "Hot water temperature", water_heater_power: "Water heater power",
  water_heater_energy: "Water heater energy today", water_heater_low_temp: "Low hot water below", water_heater_ok_temp: "Hot water OK from",
  legionella_temp: "Legionella temperature", legionella_days: "Must reach it every",
  cut_in: "Cut-in pressure", cut_out: "Cut-out pressure", max_pressure: "Gauge max", low_pressure: "Low pressure below (empty = cut-in − 0.5)",
  min_temp: "Frost alarm: tank box below", guard_warn_temp: "Warn if frost guard off below", trace_warn_temp: "Warn if heat cable off when outside below",
  power_threshold: "Pump running above (W)", current_threshold: "Pump running above (A)", max_run_minutes: "Max pump run time",
  short_cycle_seconds: "Short cycle if run shorter than", guard_delay: "Pump-stopped alarm after",
  night_start: "Night from (hour)", night_end: "Night to (hour)", night_starts_warn: "Warn at night starts ≥", history_hours: "History length",
  confirm: "Ask 'are you sure' before", show_valve: "Main valve", show_pump_guard: "Pump guard (KM 35)", show_frost_guard: "Frost guard",
  show_heat_trace: "Heat cable", show_water_heater: "Water heater", show_leak: "Leak sensors", show_outdoor: "Outdoor temperature",
  pressure_unit: "Pressure", temperature_unit: "Temperature", volume_unit: "Volume", flow_unit: "Flow", power_unit: "Power",
  use_package: "Use the HA package (alarms run in HA)", compact: "Compact (tap header to expand)", away: "Away mode switch",
  water_heater_volume: "Water heater volume", shower_liters: "Litres per shower (40 °C)", cold_water_temp: "Incoming cold water",
  drawdown_min: "Warn if drawdown per cycle below", events_count: "Events to show", drawdown: "Drawdown per cycle sensor",
  cycle_avg_7d: "Pump cycle average 7 d", cycle_avg_30d: "Pump cycle average 30 d", maintenance: "Maintenance reminders", maintenance_log: "Maintenance history (to-do list)",
  show_events: "Event log", show_labels: "Labels in drawing",
  has_uv: "UV unit", has_filter: "Filter", has_outdoor_tap: "Outdoor tap", uv_entity: "UV lamp entity (on = lamp lit) or lamp hours",
  filter_entity: "Filter sensor (optional)", outdoor_tap_entity: "Outdoor tap valve (optional)", outdoor_tap_shutoff: "Indoor stop valve for outdoor tap",
  irrigation: "Irrigation zones (not a leak while running)", irrigation_shutoff: "Indoor supply valve for irrigation",
  irrigation_frost_temp: "Irrigation frost warning below", irrigation_max_minutes: "Irrigation max run time", interval_irrigation: "Irrigation every", tap_frost_temp: "Outdoor tap frost warning below",
  interval_precharge: "Pre-charge every", interval_sample: "Water sample every", interval_uv: "UV lamp every", interval_filter: "Filter every",
  interval_outdoor_tap: "Outdoor tap every", show_tiles: "Value tiles", show_stats: "Pump statistics", show_history: "History graph", show_controls: "Buttons",
};

// number fields are entered in the chosen display units: relabel and rescale their ranges
function unitSchema(schema, cfg, hass) {
  const pu = cfg.pressure_unit || "bar", vu = cfg.volume_unit || "L", wu = cfg.power_unit || "W";
  const tu = cfg.temperature_unit && cfg.temperature_unit !== "auto" ? cfg.temperature_unit
    : (/f/i.test((((hass || {}).config || {}).unit_system || {}).temperature || "") ? "°F" : "°C");
  const nice = (v) => Number(v.toPrecision(2));
  const map = (n) => {
    if (n.schema) return { ...n, schema: n.schema.map(map) };
    const nb = n.selector && n.selector.number;
    if (!nb) return n;
    let { min, max, step } = nb, unit = nb.unit_of_measurement;
    const niceStep = (x) => { const e = 10 ** Math.floor(Math.log10(x)), f = x / e; return Number(((f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e).toPrecision(1)); };
    const scale = (k) => { step = niceStep(step * k); min = nice(min * k); max = nice(max * k); };
    if (unit === "bar" && pu !== "bar") { scale(1 / UNITS.pressure[pu.toLowerCase()]); unit = pu; }
    else if (unit === "L" && vu !== "L") { scale(1 / UNITS.volume[vu.toLowerCase()]); unit = vu; }
    else if (unit === "W" && wu !== "W") { scale(1 / UNITS.power[wu.toLowerCase()]); unit = wu; }
    else if (unit === "°C" && tu === "°F") { min = Math.round(min * 1.8 + 32); max = Math.round(max * 1.8 + 32); step = 1; unit = "°F"; }
    else return n;
    return { ...n, selector: { number: { ...nb, min, max, step, unit_of_measurement: unit } } };
  };
  return schema.map(map);
}

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
        Object.keys(cfg).forEach((k) => {
          const v = cfg[k];
          if (v === "" || v == null || (Array.isArray(v) && !v.length && k !== "confirm")) delete cfg[k];
          else if (k in DEFAULTS && JSON.stringify(v) === JSON.stringify(DEFAULTS[k])) delete cfg[k];
        });
        if (Array.isArray(cfg.confirm) && cfg.confirm.length === CONFIRM_KEYS.length) delete cfg.confirm;

        this._config = cfg;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { ...DEFAULTS, ...this._config };
    Object.keys(data).forEach((k) => { if (data[k] === null) delete data[k]; });
    if (data.confirm === true) data.confirm = [...CONFIRM_KEYS];
    else if (data.confirm === false) data.confirm = [];
    LEAK_LOCS.forEach((l) => { if (typeof data[`leak_${l}`] === "string") data[`leak_${l}`] = [data[`leak_${l}`]]; });
    const plain = (Array.isArray(data.leak) ? data.leak : [data.leak]).filter((x) => typeof x === "string");
    if (plain.length && plain.length === (Array.isArray(data.leak) ? data.leak.length : 1)) {
      data.leak_house = [...new Set([...(data.leak_house || []), ...plain])];
      delete data.leak;
    }
    this._form.hass = this._hass;
    this._form.schema = unitSchema(EDITOR_SCHEMA, data, this._hass);
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
