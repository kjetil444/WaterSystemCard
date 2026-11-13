# Water System Card

A Home Assistant Lovelace card for a private water supply: well with submersible pump, pump guard, pressure tank (outdoor tank box or inside the house), main valve, house and water heater.

![Preview](images/preview.png)

## Features

- Animated cutaway diagram: well, pump, pressure tank, manometer, valve, tap and water heater
- Pressure gauge with cut-in / cut-out zones
- Pump statistics: starts today, run time, last cycle, starts during the night
- Alarms: leak, pump stopped (pump guard / dry run), long run time, short cycling, low pressure, frost, heat cable off in frost
- Water heater: colour follows temperature (blue < 50 °C, amber, red ≥ 60 °C), "L" badge when legionella temperature hasn't been reached for N days
- Frost guard (tank box) and heat cable (outdoor pipes) shown separately
- 24 h pressure history with pump run strips
- Pump, main valve, frost guard, heat cable and water heater buttons (valve/pump ask for a second tap)
- Visual editor, Norwegian and English (follows HA language)

## Installation

### HACS (custom repository)

1. HACS → ⋮ → Custom repositories
2. Add this repository URL, type **Dashboard**
3. Install **Water System Card** and reload the browser

### Manual

1. Copy `water-system-card.js` to `/config/www/`
2. Settings → Dashboards → ⋮ → Resources → Add `/local/water-system-card.js?v=1.4.0` as **JavaScript module**

## Configuration

Everything is optional; only configured parts are shown. All options are also available in the visual editor.

```yaml
type: custom:water-system-card
name: Vannforsyning
tank_location: box            # box | house
# pump and pressure
pressure: sensor.bod_monitor_pressure
pump_power: sensor.pump_power       # or pump_current / pump_running
pump_guard: binary_sensor.pumpevakt_alarm   # optional, otherwise inferred
pump_switch: switch.pump
valve: valve.main_water
# frost, leaks, usage
temperature: sensor.bod_monitor_pressure_tank_box
outdoor_temp: sensor.bod_monitor_outside
frost_guard: switch.frostvakt
heat_trace: switch.varmekabel
# leak sensors per location (box, house, heater, well, pipe) – shown as drip + puddle there
leak_box: [binary_sensor.leak_tank_box]
leak_heater: [binary_sensor.leak_water_heater]
leak_house: [binary_sensor.leak_kitchen, binary_sensor.leak_bathroom]
flow: sensor.water_flow
water_today: sensor.water_today
# water heater
water_heater: switch.vvb            # or water_heater.* / climate.*
water_heater_temp: sensor.vvb_temp
water_heater_power: sensor.vvb_power
water_heater_energy: sensor.vvb_energy_today
# thresholds (defaults shown)
cut_in: 2.0
cut_out: 3.5
max_pressure: 6
min_temp: 3
trace_warn_temp: 5        # heat cable off and outside below this → warning
guard_warn_temp: 5        # frost guard off and tank box below this → warning
power_threshold: 50
current_threshold: 0.5
max_run_minutes: 20
short_cycle_seconds: 30
guard_delay: 90
night_start: 1
night_end: 5
night_starts_warn: 4
water_heater_low_temp: 50
water_heater_ok_temp: 60
legionella_temp: 70
legionella_days: 7
history_hours: 24
confirm: [pump, valve, frost_guard, heat_trace, water_heater]   # or true / false
# hide features
show_valve: true
show_pump_guard: true
show_frost_guard: true
show_heat_trace: true
show_water_heater: true
show_leak: true
show_outdoor: true
show_labels: true
show_tiles: true
show_stats: true
show_history: true
show_controls: true
```

The legionella check reads hourly long-term statistics for `water_heater_temp`, so the sensor needs a `state_class` (ESPHome/most integrations set this for temperatures).

## Updating

Bump the version in `water-system-card.js`, commit, and create a GitHub release (e.g. `v1.3.1`). HACS picks up new releases.
