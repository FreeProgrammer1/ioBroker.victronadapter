'use strict';

/**
 * Register map for Victron GX / Cerbo GX Modbus TCP.
 * Scale is stored as multiplier after decoding the raw Modbus value.
 * Example: Victron scale factor 10 becomes multiplier 0.1.
 */

const SYSTEM_REGISTERS = [
    { id: "relay_1_state", name: "GX Relay 1 state", address: 806, type: "uint16", scale: 1, role: "value", description: "0=Open;1=Closed" },
    { id: "relay_2_state", name: "GX Relay 2 state", address: 807, type: "uint16", scale: 1, role: "value", description: "0=Open;1=Closed" },

    { id: "pv_ac_output_l1", name: "PV AC-coupled on output L1", address: 808, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_output_l2", name: "PV AC-coupled on output L2", address: 809, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_output_l3", name: "PV AC-coupled on output L3", address: 810, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_input_l1", name: "PV AC-coupled on grid/input L1", address: 811, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_input_l2", name: "PV AC-coupled on grid/input L2", address: 812, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_input_l3", name: "PV AC-coupled on grid/input L3", address: 813, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_genset_l1", name: "PV AC-coupled on generator L1", address: 814, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_genset_l2", name: "PV AC-coupled on generator L2", address: 815, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_genset_l3", name: "PV AC-coupled on generator L3", address: 816, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "ac_consumption_l1", name: "AC consumption L1", address: 817, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "ac_consumption_l2", name: "AC consumption L2", address: 818, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "ac_consumption_l3", name: "AC consumption L3", address: 819, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "grid_l1", name: "Grid L1", address: 820, type: "int16", scale: 1, unit: "W", role: "value.power", description: "Positive import from grid, negative feed-in." },
    { id: "grid_l2", name: "Grid L2", address: 821, type: "int16", scale: 1, unit: "W", role: "value.power", description: "Positive import from grid, negative feed-in." },
    { id: "grid_l3", name: "Grid L3", address: 822, type: "int16", scale: 1, unit: "W", role: "value.power", description: "Positive import from grid, negative feed-in." },
    { id: "genset_l1", name: "Genset L1", address: 823, type: "int16", scale: 1, unit: "W", role: "value.power" },
    { id: "genset_l2", name: "Genset L2", address: 824, type: "int16", scale: 1, unit: "W", role: "value.power" },
    { id: "genset_l3", name: "Genset L3", address: 825, type: "int16", scale: 1, unit: "W", role: "value.power" },
    { id: "active_input_source", name: "Active input source", address: 826, type: "int16", scale: 1, role: "value", description: "0=Unknown;1=Grid;2=Generator;3=Shore power;240=Not connected" },

    { id: "battery_voltage", name: "Battery voltage system", address: 840, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" },
    { id: "battery_current", name: "Battery current system", address: 841, type: "int16", scale: 0.1, unit: "A", role: "value.current", description: "Positive charging, negative discharging." },
    { id: "battery_power", name: "Battery power system", address: 842, type: "int16", scale: 1, unit: "W", role: "value.power", description: "Positive charging, negative discharging." },
    { id: "battery_soc", name: "Battery state of charge system", address: 843, type: "uint16", scale: 1, unit: "%", role: "value.battery" },
    { id: "battery_state", name: "Battery state system", address: 844, type: "uint16", scale: 1, role: "value", description: "0=idle;1=charging;2=discharging" },
    { id: "battery_consumed_ah", name: "Battery consumed amp hours system", address: 845, type: "uint16", scale: -0.1, unit: "Ah", role: "value" },
    { id: "battery_time_to_go_s", name: "Battery time to go system", address: 846, type: "uint16", scale: 100, unit: "s", role: "value" },
    { id: "pv_dc_power", name: "PV DC-coupled power", address: 850, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_dc_current", name: "PV DC-coupled current", address: 851, type: "int16", scale: 0.1, unit: "A", role: "value.current" },
    { id: "charger_power", name: "Charger power", address: 855, type: "uint16", scale: 1, unit: "W", role: "value.power" },
    { id: "dc_system_power", name: "DC system power", address: 860, type: "int16", scale: 1, unit: "W", role: "value.power" },
    { id: "charge_current", name: "VE.Bus charge current system", address: 865, type: "int16", scale: 0.1, unit: "A", role: "value.current" },
    { id: "charge_power", name: "VE.Bus charge power system", address: 866, type: "int16", scale: 1, unit: "W", role: "value.power" },
    { id: "inverter_charger_current", name: "Inverter/Charger DC current", address: 868, type: "int32", scale: 0.1, unit: "A", role: "value.current" },
    { id: "inverter_charger_power", name: "Inverter/Charger DC power", address: 870, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "consumption_on_input_l1", name: "Power between meter and inverter/charger L1", address: 872, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "consumption_on_input_l2", name: "Power between meter and inverter/charger L2", address: 874, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "consumption_on_input_l3", name: "Power between meter and inverter/charger L3", address: 876, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "consumption_on_output_l1", name: "Power on output of inverter/charger L1", address: 878, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "consumption_on_output_l2", name: "Power on output of inverter/charger L2", address: 880, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "consumption_on_output_l3", name: "Power on output of inverter/charger L3", address: 882, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_output_l1_32", name: "PV AC-coupled on output L1 32-bit", address: 884, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_output_l2_32", name: "PV AC-coupled on output L2 32-bit", address: 886, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_output_l3_32", name: "PV AC-coupled on output L3 32-bit", address: 888, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_input_l1_32", name: "PV AC-coupled on grid/input L1 32-bit", address: 890, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_input_l2_32", name: "PV AC-coupled on grid/input L2 32-bit", address: 892, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_input_l3_32", name: "PV AC-coupled on grid/input L3 32-bit", address: 894, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_genset_l1_32", name: "PV AC-coupled on generator L1 32-bit", address: 896, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_genset_l2_32", name: "PV AC-coupled on generator L2 32-bit", address: 898, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "pv_ac_genset_l3_32", name: "PV AC-coupled on generator L3 32-bit", address: 900, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "ac_consumption_l1_32", name: "AC consumption L1 32-bit", address: 902, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "ac_consumption_l2_32", name: "AC consumption L2 32-bit", address: 904, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "ac_consumption_l3_32", name: "AC consumption L3 32-bit", address: 906, type: "uint32", scale: 1, unit: "W", role: "value.power" },
    { id: "grid_l1_32", name: "Grid L1 32-bit", address: 908, type: "int32", scale: 1, unit: "W", role: "value.power", description: "Positive import from grid, negative feed-in." },
    { id: "grid_l2_32", name: "Grid L2 32-bit", address: 910, type: "int32", scale: 1, unit: "W", role: "value.power", description: "Positive import from grid, negative feed-in." },
    { id: "grid_l3_32", name: "Grid L3 32-bit", address: 912, type: "int32", scale: 1, unit: "W", role: "value.power", description: "Positive import from grid, negative feed-in." },
    { id: "genset_l1_32", name: "Genset L1 32-bit", address: 914, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "genset_l2_32", name: "Genset L2 32-bit", address: 916, type: "int32", scale: 1, unit: "W", role: "value.power" },
    { id: "genset_l3_32", name: "Genset L3 32-bit", address: 918, type: "int32", scale: 1, unit: "W", role: "value.power" },

    { id: "dynamic_ess_active", name: "Dynamic ESS active", address: 5400, type: "uint16", scale: 1, role: "indicator" },
    { id: "dynamic_ess_allow_grid_feed_in", name: "Dynamic ESS allow grid feed-in", address: 5401, type: "uint16", scale: 1, role: "indicator" },
    { id: "dynamic_ess_available", name: "Dynamic ESS available", address: 5402, type: "uint16", scale: 1, role: "indicator" },
    { id: "dynamic_ess_charge_rate", name: "Dynamic ESS calculated rate of charge/discharge", address: 5403, type: "uint16", scale: 10, role: "value" },
    { id: "dynamic_ess_error_code", name: "Dynamic ESS error code", address: 5404, type: "uint16", scale: 1, role: "value" },
    { id: "dynamic_ess_restrictions", name: "Dynamic ESS active restrictions", address: 5405, type: "uint16", scale: 1, role: "value" },
    { id: "dynamic_ess_strategy", name: "Dynamic ESS current strategy", address: 5406, type: "uint16", scale: 1, role: "value" },
    { id: "dynamic_ess_target_soc", name: "Dynamic ESS target SOC", address: 5407, type: "uint16", scale: 1, unit: "%", role: "value.battery" }
];

const FLOW_STATES = [
    { id: "grid_total", name: "Grid total power", unit: "W", role: "value.power", description: "Positive import, negative feed-in." },
    { id: "grid_import", name: "Current grid import", unit: "W", role: "value.power" },
    { id: "grid_export", name: "Current grid export", unit: "W", role: "value.power" },
    { id: "available_surplus", name: "Available PV surplus from grid export", unit: "W", role: "value.power" },
    { id: "ac_consumption_total", name: "Total house consumption", unit: "W", role: "value.power" },
    { id: "critical_loads_total", name: "Essential loads total", unit: "W", role: "value.power" },
    { id: "critical_loads_l1", name: "Essential loads L1", unit: "W", role: "value.power" },
    { id: "critical_loads_l2", name: "Essential loads L2", unit: "W", role: "value.power" },
    { id: "critical_loads_l3", name: "Essential loads L3", unit: "W", role: "value.power" },
    { id: "non_critical_loads_total", name: "AC loads total", unit: "W", role: "value.power" },
    { id: "non_critical_loads_l1", name: "AC loads L1", unit: "W", role: "value.power" },
    { id: "non_critical_loads_l2", name: "AC loads L2", unit: "W", role: "value.power" },
    { id: "non_critical_loads_l3", name: "AC loads L3", unit: "W", role: "value.power" },
    { id: "ac_loads_total", name: "AC loads display total", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für normale AC-Lasten / nicht essentielle Lasten." },
    { id: "ac_loads_l1", name: "AC loads display L1", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für normale AC-Lasten L1." },
    { id: "ac_loads_l2", name: "AC loads display L2", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für normale AC-Lasten L2." },
    { id: "ac_loads_l3", name: "AC loads display L3", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für normale AC-Lasten L3." },
    { id: "essential_loads_total", name: "Essential loads display total", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für essentielle Lasten / Wechselrichter-Ausgang." },
    { id: "essential_loads_l1", name: "Essential loads display L1", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für essentielle Lasten L1." },
    { id: "essential_loads_l2", name: "Essential loads display L2", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für essentielle Lasten L2." },
    { id: "essential_loads_l3", name: "Essential loads display L3", unit: "W", role: "value.power", description: "Eindeutiger Anzeigenwert für essentielle Lasten L3." },
    { id: "pv_ac_output_total", name: "AC PV on inverter output total", unit: "W", role: "value.power" },
    { id: "pv_ac_grid_total", name: "AC PV on grid/input total", unit: "W", role: "value.power" },
    { id: "pv_ac_genset_total", name: "AC PV on generator total", unit: "W", role: "value.power" },
    { id: "pv_ac_total", name: "AC-coupled PV total", unit: "W", role: "value.power" },
    { id: "pv_dc_total", name: "DC-coupled PV total", unit: "W", role: "value.power" },
    { id: "pv_total", name: "PV total AC plus DC", unit: "W", role: "value.power" },
    { id: "battery_power", name: "Battery power signed", unit: "W", role: "value.power", description: "Positive charging, negative discharging." },
    { id: "battery_charge", name: "Battery charging power", unit: "W", role: "value.power" },
    { id: "battery_discharge", name: "Battery discharging power", unit: "W", role: "value.power" },
    { id: "genset_total", name: "Generator total power", unit: "W", role: "value.power" },
    { id: "inverter_charger_power", name: "Inverter/charger DC power", unit: "W", role: "value.power" }
];

const CONTROL_REGISTERS = [
    { id: "grid_power_setpoint_w", name: "ESS grid power setpoint 32-bit volatile", address: 2716, type: "int32", scale: 1, unit: "W", role: "level.power", write: true, requiresNewSetpoint: true, description: "Positive import from grid, negative feed into grid. Volatile override; not for Dynamic ESS." },
    { id: "grid_power_setpoint_legacy_w", name: "ESS grid power setpoint legacy 2700", address: 2700, type: "int16", scale: 1, unit: "W", role: "level.power", write: true, requiresLegacySetpoint: true, description: "Legacy 16-bit persistent setpoint. Use only if 2716 is not available." },
    { id: "grid_power_setpoint_legacy_large_w", name: "ESS grid power setpoint legacy 2703 large", address: 2703, type: "int16", scale: 100, rawScaleForWrite: 0.01, unit: "W", role: "level.power", write: true, requiresLegacySetpoint: true, description: "Legacy large range setpoint, Victron scale factor 0.01." },
    { id: "max_charge_percent", name: "ESS max charge percentage", address: 2701, type: "uint16", scale: 1, unit: "%", role: "level", write: true },
    { id: "max_discharge_percent", name: "ESS max discharge percentage", address: 2702, type: "uint16", scale: 1, unit: "%", role: "level", write: true },
    { id: "max_discharge_power_w", name: "Maximum discharge power", address: 2704, type: "int16", scale: 10, rawScaleForWrite: 0.1, unit: "W", role: "level.power", write: true, description: "-1 means no limit where supported. Victron scale factor 0.1 = 10 W steps." },
    { id: "max_charge_current_a", name: "DVCC maximum system charge current", address: 2705, type: "int16", scale: 1, unit: "A", role: "level.current", write: true, description: "-1 disables where supported." },
    { id: "max_grid_feed_in_w", name: "Maximum system grid feed-in", address: 2706, type: "int16", scale: 100, rawScaleForWrite: 0.01, unit: "W", role: "level.power", write: true, description: "-1 no limit, >=0 limit system feed-in. Victron scale factor 0.01 = 100 W steps." },
    { id: "feed_excess_dc_pv", name: "Feed excess DC-coupled PV into grid", address: 2707, type: "int16", scale: 1, role: "switch", write: true, boolean: true, description: "0 = disabled, 1 = enabled." },
    { id: "prevent_ac_pv_feedback", name: "Prevent excess AC-coupled PV feedback", address: 2708, type: "int16", scale: 1, role: "switch", write: true, boolean: true, description: "0 = AC excess feed-in allowed, 1 = prevented." },
    { id: "grid_limiting_status", name: "Grid limiting status", address: 2709, type: "int16", scale: 1, role: "indicator", write: false, boolean: true },
    { id: "max_charge_voltage_v", name: "Limit managed battery voltage", address: 2710, type: "uint16", scale: 0.1, rawScaleForWrite: 10, unit: "V", role: "level.voltage", write: true },
    { id: "ac_input_1_source", name: "AC input 1 source", address: 2711, type: "uint16", scale: 1, role: "level", write: true, description: "0=Unused;1=Grid;2=Genset;3=Shore" },
    { id: "ac_input_2_source", name: "AC input 2 source", address: 2712, type: "uint16", scale: 1, role: "level", write: true, description: "0=Unused;1=Grid;2=Genset;3=Shore" },
    { id: "peakshaving_export_limit_w", name: "AC export limit when peakshaving", address: 2713, type: "int16", scale: 1, unit: "W", role: "level.power", write: true },
    { id: "peakshaving_import_limit_w", name: "AC import limit when peakshaving", address: 2714, type: "int16", scale: 1, unit: "W", role: "level.power", write: true },
    { id: "peakshaving_mode", name: "Mode for peakshaving", address: 2715, type: "uint16", scale: 1, role: "level", write: true, description: "0=Above minimum SOC only;1=Always" },
    { id: "grid_metering_mode", name: "Grid metering mode", address: 2718, type: "uint16", scale: 1, role: "level", write: true, description: "0=External meter;1=Inverter/Charger" },
    { id: "battery_life_state", name: "ESS BatteryLife state", address: 2900, type: "uint16", scale: 1, role: "value", write: true },
    { id: "minimum_soc_limit", name: "ESS Minimum SOC unless grid fails", address: 2901, type: "uint16", scale: 0.1, rawScaleForWrite: 10, unit: "%", role: "level", write: true },
    { id: "ess_mode", name: "ESS Mode", address: 2902, type: "uint16", scale: 1, role: "level", write: true, description: "1=ESS with phase compensation;2=ESS without phase compensation;3=Disabled/External Control" },
    { id: "battery_life_soc_limit", name: "ESS BatteryLife SOC limit read only", address: 2903, type: "uint16", scale: 0.1, unit: "%", role: "value.battery", write: false },
    { id: "dynamic_ess_battery_capacity_kwh", name: "Dynamic ESS battery capacity", address: 5420, type: "uint16", scale: 0.1, rawScaleForWrite: 10, unit: "kWh", role: "level", write: true },
    { id: "dynamic_ess_mode", name: "Dynamic ESS mode", address: 5423, type: "uint16", scale: 1, role: "level", write: true, description: "0=Off;1=Auto;4=Node-RED" },
    { id: "dynamic_ess_schedule_allow_grid_feed_in", name: "Dynamic ESS schedule allow grid feed-in", address: 5424, type: "uint16", scale: 1, role: "switch", write: true, boolean: true },
    { id: "dynamic_ess_schedule_duration_s", name: "Dynamic ESS schedule duration", address: 5425, type: "uint16", scale: 1, unit: "s", role: "level", write: true },
    { id: "dynamic_ess_schedule_restrictions", name: "Dynamic ESS schedule restrictions", address: 5426, type: "uint16", scale: 1, role: "level", write: true },
    { id: "dynamic_ess_schedule_target_soc", name: "Dynamic ESS schedule target SOC", address: 5427, type: "uint16", scale: 1, unit: "%", role: "level", write: true },
    { id: "dynamic_ess_schedule_start_unix", name: "Dynamic ESS schedule start unix timestamp", address: 5428, type: "int32", scale: 1, role: "level", write: true },
    { id: "dynamic_ess_schedule_strategy", name: "Dynamic ESS schedule strategy", address: 5429, type: "uint16", scale: 1, role: "level", write: true }
];

const DEVICE_PROFILES = [
    { key: "vebus", name: "VE.Bus / Multi / Quattro", probe: { address: 33, type: "uint16" }, registers: [{ id: "input_voltage_l1", name: "Input voltage phase 1", address: 3, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_voltage_l2", name: "Input voltage phase 2", address: 4, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_voltage_l3", name: "Input voltage phase 3", address: 5, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_current_l1", name: "Input current phase 1", address: 6, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_current_l2", name: "Input current phase 2", address: 7, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_current_l3", name: "Input current phase 3", address: 8, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_frequency_1", name: "Input frequency 1", address: 9, type: "int16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "input_frequency_2", name: "Input frequency 2", address: 10, type: "int16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "input_frequency_3", name: "Input frequency 3", address: 11, type: "int16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "input_power_1", name: "Input power 1", address: 12, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_power_2", name: "Input power 2", address: 13, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_power_3", name: "Input power 3", address: 14, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_voltage_l1", name: "Output voltage phase 1", address: 15, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_voltage_l2", name: "Output voltage phase 2", address: 16, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_voltage_l3", name: "Output voltage phase 3", address: 17, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_current_l1", name: "Output current phase 1", address: 18, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_current_l2", name: "Output current phase 2", address: 19, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_current_l3", name: "Output current phase 3", address: 20, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_frequency", name: "Output frequency", address: 21, type: "int16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "output_power_1", name: "Output power 1", address: 23, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_power_2", name: "Output power 2", address: 24, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_power_3", name: "Output power 3", address: 25, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "battery_voltage", name: "Battery voltage", address: 26, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "battery_current", name: "Battery current", address: 27, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "phase_count", name: "Phase count", address: 28, type: "uint16", scale: 1, role: "value" }, { id: "active_input", name: "Active input", address: 29, type: "uint16", scale: 1, role: "value" }, { id: "ve_bus_state", name: "VE.Bus state", address: 31, type: "uint16", scale: 1, role: "value" }, { id: "ve_bus_error", name: "VE.Bus Error", address: 32, type: "uint16", scale: 1, role: "value" }, { id: "temperature_alarm", name: "Temperature alarm", address: 34, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_battery_alarm", name: "Low battery alarm", address: 35, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "overload_alarm", name: "Overload alarm", address: 36, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "temperatur_sensor_alarm", name: "Temperatur sensor alarm", address: 42, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "voltage_sensor_alarm", name: "Voltage sensor alarm", address: 43, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "temperature_alarm_l1", name: "Temperature alarm L1", address: 44, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_battery_alarm_l1", name: "Low battery alarm L1", address: 45, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "overload_alarm_l1", name: "Overload alarm L1", address: 46, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "ripple_alarm_l1", name: "Ripple alarm L1", address: 47, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "temperature_alarm_l2", name: "Temperature alarm L2", address: 48, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_battery_alarm_l2", name: "Low battery alarm L2", address: 49, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "overload_alarm_l2", name: "Overload alarm L2", address: 50, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "ripple_alarm_l2", name: "Ripple alarm L2", address: 51, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "temperature_alarm_l3", name: "Temperature alarm L3", address: 52, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_battery_alarm_l3", name: "Low battery alarm L3", address: 53, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "overload_alarm_l3", name: "Overload alarm L3", address: 54, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "ripple_alarm_l3", name: "Ripple alarm L3", address: 55, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "ve_bus_bms_allows_battery_to_be_charged", name: "VE.Bus BMS allows battery to be charged", address: 57, type: "uint16", scale: 1, role: "value" }, { id: "ve_bus_bms_allows_battery_to_be_discharged", name: "VE.Bus BMS allows battery to be discharged", address: 58, type: "uint16", scale: 1, role: "value" }, { id: "ve_bus_bms_is_expected", name: "VE.Bus BMS is expected", address: 59, type: "uint16", scale: 1, role: "value" }, { id: "ve_bus_bms_error", name: "VE.Bus BMS error", address: 60, type: "uint16", scale: 1, role: "value" }, { id: "battery_temperature", name: "Battery temperature", address: 61, type: "int16", scale: 0.1, unit: "°C", role: "value.temperature" }, { id: "phase_rotation_warning", name: "Phase rotation warning", address: 63, type: "uint16", scale: 1, role: "value" }, { id: "grid_lost_alarm", name: "Grid lost alarm", address: 64, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "ac_input_1_ignored", name: "AC input 1 ignored", address: 69, type: "uint16", scale: 1, role: "value" }, { id: "ac_input_2_ignored", name: "AC input 2 ignored", address: 70, type: "uint16", scale: 1, role: "value" }, { id: "sustain_active", name: "Sustain active", address: 73, type: "uint16", scale: 1, role: "value" }, { id: "energy_from_ac_in_1_to_ac_out", name: "Energy from AC-In 1 to AC-out", address: 74, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_in_1_to_battery", name: "Energy from AC-In 1 to battery", address: 76, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_in_2_to_ac_out", name: "Energy from AC-In 2 to AC-out", address: 78, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_in_2_to_battery", name: "Energy from AC-In 2 to battery", address: 80, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_out_to_ac_in_1_reverse_fed_pv", name: "Energy from AC-out to AC-in 1 (reverse fed PV)", address: 82, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_out_to_ac_in_2_reverse_fed_pv", name: "Energy from AC-out to AC-in 2 (reverse fed PV)", address: 84, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_battery_to_ac_in_1", name: "Energy from battery to AC-in 1", address: 86, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_battery_to_ac_in_2", name: "Energy from battery to AC-in 2", address: 88, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_battery_to_ac_out", name: "Energy from battery to AC-out", address: 90, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_out_to_battery_typically_from_pv_inverter", name: "Energy from AC-out to battery (typically from PV-inverter)", address: 92, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "low_cell_voltage_imminent", name: "Low cell voltage imminent", address: 94, type: "uint16", scale: 1, role: "value" }, { id: "charge_state", name: "Charge state", address: 95, type: "uint16", scale: 1, role: "value" }, { id: "remote_generator_selected", name: "Remote generator selected", address: 104, type: "uint16", scale: 1, role: "value" }, { id: "nominal_inverter_power_total", name: "Nominal inverter power – Total", address: 130, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "nominal_inverter_power_l1", name: "Nominal inverter power – L1", address: 132, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "nominal_inverter_power_l2", name: "Nominal inverter power – L2", address: 134, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "nominal_inverter_power_l3", name: "Nominal inverter power – L3", address: 136, type: "uint32", scale: 1, unit: "W", role: "value.power" }] },
    { key: "battery", name: "Battery monitor / SmartShunt / BMS", probe: { address: 266, type: "uint16" }, registers: [{ id: "battery_power", name: "Battery power", address: 256, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "battery_power_258", name: "Battery power", address: 258, type: "int16", scale: 1, unit: "W", role: "value.power" }, { id: "battery_voltage", name: "Battery voltage", address: 259, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "starter_battery_voltage", name: "Starter battery voltage", address: 260, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "current", name: "Current", address: 261, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "battery_temperature", name: "Battery temperature", address: 262, type: "int16", scale: 0.1, unit: "°C", role: "value.temperature" }, { id: "mid_point_voltage_of_the_battery_bank", name: "Mid-point voltage of the battery bank", address: 263, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "mid_point_deviation_of_the_battery_bank", name: "Mid-point deviation of the battery bank", address: 264, type: "uint16", scale: 0.01, unit: "%", role: "value" }, { id: "consumed_amphours", name: "Consumed Amphours", address: 265, type: "uint16", scale: -0.1, unit: "Ah", role: "value" }, { id: "soc", name: "State of charge", address: 266, type: "uint16", scale: 0.1, unit: "%", role: "value.battery" }, { id: "alarm", name: "Alarm", address: 267, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_voltage_alarm", name: "Low voltage alarm", address: 268, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_voltage_alarm", name: "High voltage alarm", address: 269, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_starter_voltage_alarm", name: "Low starter-voltage alarm", address: 270, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_starter_voltage_alarm", name: "High starter-voltage alarm", address: 271, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_state_of_charge_alarm", name: "Low State-of-charge alarm", address: 272, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_temperature_alarm", name: "Low temperature alarm", address: 273, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_temperature_alarm", name: "High temperature alarm", address: 274, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "mid_voltage_alarm", name: "Mid-voltage alarm", address: 275, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_fused_voltage_alarm", name: "Low fused-voltage alarm", address: 276, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_fused_voltage_alarm", name: "High fused-voltage alarm", address: 277, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "fuse_blown_alarm", name: "Fuse blown alarm", address: 278, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_internal_temperature_alarm", name: "High internal-temperature alarm", address: 279, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "deepest_discharge", name: "Deepest discharge", address: 281, type: "uint16", scale: -0.1, unit: "Ah", role: "value" }, { id: "last_discharge", name: "Last discharge", address: 282, type: "uint16", scale: -0.1, unit: "Ah", role: "value" }, { id: "average_discharge", name: "Average discharge", address: 283, type: "uint16", scale: -0.1, unit: "Ah", role: "value" }, { id: "charge_cycles", name: "Charge cycles", address: 284, type: "uint16", scale: 1, role: "value" }, { id: "full_discharges", name: "Full discharges", address: 285, type: "uint16", scale: 1, role: "value" }, { id: "total_ah_drawn", name: "Total Ah drawn", address: 286, type: "uint16", scale: -0.1, unit: "Ah", role: "value" }, { id: "minimum_voltage", name: "Minimum voltage", address: 287, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "maximum_voltage", name: "Maximum voltage", address: 288, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "time_since_last_full_charge", name: "Time since last full charge", address: 289, type: "uint16", scale: 100, unit: "s", role: "value" }, { id: "automatic_syncs", name: "Automatic syncs", address: 290, type: "uint16", scale: 1, role: "value" }, { id: "low_voltage_alarms", name: "Low voltage alarms", address: 291, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_voltage_alarms", name: "High voltage alarms", address: 292, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_starter_voltage_alarms", name: "Low starter voltage alarms", address: 293, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_starter_voltage_alarms", name: "High starter voltage alarms", address: 294, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "minimum_starter_voltage", name: "Minimum starter voltage", address: 295, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "maximum_starter_voltage", name: "Maximum starter voltage", address: 296, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "low_fused_voltage_alarms", name: "Low fused-voltage alarms", address: 297, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_fused_voltage_alarms", name: "High fused-voltage alarms", address: 298, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "minimum_fused_voltage", name: "Minimum fused voltage", address: 299, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "maximum_fused_voltage", name: "Maximum fused voltage", address: 300, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "discharged_energy", name: "Discharged Energy", address: 301, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "charged_energy", name: "Charged Energy", address: 302, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "time_to_go", name: "Time to go", address: 303, type: "uint16", scale: 100, unit: "s", role: "value" }, { id: "state_of_health", name: "State of health", address: 304, type: "uint16", scale: 0.1, unit: "%", role: "value" }, { id: "max_charge_voltage", name: "Max charge voltage", address: 305, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "min_discharge_voltage", name: "Min discharge voltage", address: 306, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "max_charge_current", name: "Max charge current", address: 307, type: "uint16", scale: 0.1, unit: "A", role: "value.current" }, { id: "max_discharge_current", name: "Max discharge current", address: 308, type: "uint16", scale: 0.1, unit: "A", role: "value.current" }] },
    { key: "solarcharger", name: "Solar charger / MPPT", probe: { address: 792, type: "uint16" }, registers: [{ id: "battery_voltage", name: "Battery voltage", address: 771, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "battery_current", name: "Battery current", address: 772, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "battery_temperature", name: "Battery temperature", address: 773, type: "int16", scale: 0.1, unit: "°C", role: "value.temperature" }, { id: "charge_state", name: "Charge state", address: 775, type: "uint16", scale: 1, role: "value" }, { id: "pv_voltage", name: "PV voltage", address: 776, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "pv_current", name: "PV current", address: 777, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "equalization_pending", name: "Equalization pending", address: 778, type: "uint16", scale: 1, role: "value" }, { id: "equalization_time_remaining", name: "Equalization time remaining", address: 779, type: "uint16", scale: 0.1, unit: "s", role: "value" }, { id: "relay_on_the_charger", name: "Relay on the charger", address: 780, type: "uint16", scale: 1, role: "value" }, { id: "yield_today", name: "Yield today", address: 784, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "maximum_charge_power_today", name: "Maximum charge power today", address: 785, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "yield_yesterday", name: "Yield yesterday", address: 786, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "maximum_charge_power_yesterday", name: "Maximum charge power yesterday", address: 787, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "error_code", name: "Error code", address: 788, type: "uint16", scale: 1, role: "value" }, { id: "pv_power", name: "PV power", address: 789, type: "uint16", scale: 0.1, unit: "W", role: "value.power" }, { id: "user_yield", name: "User yield", address: 790, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "mpp_operation_mode", name: "MPP operation mode", address: 791, type: "uint16", scale: 1, role: "value" }, { id: "pv_power_792", name: "PV power", address: 792, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "pv_voltage_for_tracker_0", name: "PV voltage for tracker 0", address: 3700, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "pv_voltage_for_tracker_1", name: "PV voltage for tracker 1", address: 3701, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "pv_voltage_for_tracker_2", name: "PV voltage for tracker 2", address: 3702, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "pv_voltage_for_tracker_3", name: "PV voltage for tracker 3", address: 3703, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "yield_today_for_tracker_0", name: "Yield today for tracker 0", address: 3708, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_today_for_tracker_1", name: "Yield today for tracker 1", address: 3709, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_today_for_tracker_2", name: "Yield today for tracker 2", address: 3710, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_today_for_tracker_3", name: "Yield today for tracker 3", address: 3711, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_0", name: "Yield yesterday for tracker 0", address: 3712, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_1", name: "Yield yesterday for tracker 1", address: 3713, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_2", name: "Yield yesterday for tracker 2", address: 3714, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_3", name: "Yield yesterday for tracker 3", address: 3715, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "maximum_charge_power_today_for_tracker_0", name: "Maximum charge power today for tracker 0", address: 3716, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_today_for_tracker_1", name: "Maximum charge power today for tracker 1", address: 3717, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_today_for_tracker_2", name: "Maximum charge power today for tracker 2", address: 3718, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_today_for_tracker_3", name: "Maximum charge power today for tracker 3", address: 3719, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_0", name: "Maximum charge power yesterday tracker 0", address: 3720, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_1", name: "Maximum charge power yesterday tracker 1", address: 3721, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_2", name: "Maximum charge power yesterday tracker 2", address: 3722, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_3", name: "Maximum charge power yesterday tracker 3", address: 3723, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_0", name: "PV power for tracker 0", address: 3724, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_1", name: "PV power for tracker 1", address: 3725, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_2", name: "PV power for tracker 2", address: 3726, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_3", name: "PV power for tracker 3", address: 3727, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "user_yield", name: "User yield", address: 3728, type: "uint32", scale: 1, unit: "kWh", role: "value.energy" }, { id: "pv_power", name: "PV power", address: 3730, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "mpp_operation_mode_tracker_1", name: "MPP operation mode tracker 1", address: 3731, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode_tracker_2", name: "MPP operation mode tracker 2", address: 3732, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode_tracker_3", name: "MPP operation mode tracker 3", address: 3733, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode_tracker_4", name: "MPP operation mode tracker 4", address: 3734, type: "uint16", scale: 1, role: "value" }] },
    { key: "gridmeter", name: "Grid meter / Energy meter", probe: { address: 2638, type: "uint16" }, registers: [{ id: "grid_l1_power", name: "Grid L1 - Power", address: 2600, type: "int16", scale: 1, unit: "W", role: "value.power" }, { id: "grid_l2_power", name: "Grid L2 - Power", address: 2601, type: "int16", scale: 1, unit: "W", role: "value.power" }, { id: "grid_l3_power", name: "Grid L3 - Power", address: 2602, type: "int16", scale: 1, unit: "W", role: "value.power" }, { id: "grid_l1_energy_from_net", name: "Grid L1 - Energy from net", address: 2603, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l2_energy_from_net", name: "Grid L2 - Energy from net", address: 2604, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l3_energy_from_net", name: "Grid L3 - Energy from net", address: 2605, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l1_energy_to_net", name: "Grid L1 - Energy to net", address: 2606, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l2_energy_to_net", name: "Grid L2 - Energy to net", address: 2607, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l3_energy_to_net", name: "Grid L3 - Energy to net", address: 2608, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l1_voltage", name: "Grid L1 – Voltage", address: 2616, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "grid_l1_current", name: "Grid L1 – Current", address: 2617, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "grid_l2_voltage", name: "Grid L2 – Voltage", address: 2618, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "grid_l2_current", name: "Grid L2 – Current", address: 2619, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "grid_l3_voltage", name: "Grid L3 – Voltage", address: 2620, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "grid_l3_current", name: "Grid L3 – Current", address: 2621, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "grid_l1_energy_from_net_2622", name: "Grid L1 - Energy from net", address: 2622, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l2_energy_from_net_2624", name: "Grid L2 - Energy from net", address: 2624, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l3_energy_from_net_2626", name: "Grid L3 - Energy from net", address: 2626, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l1_energy_to_net_2628", name: "Grid L1 - Energy to net", address: 2628, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l2_energy_to_net_2630", name: "Grid L2 - Energy to net", address: 2630, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l3_energy_to_net_2632", name: "Grid L3 - Energy to net", address: 2632, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "total_energy_from_net", name: "Total Energy from net", address: 2634, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "total_energy_to_net", name: "Total Energy to net", address: 2636, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "grid_l1_power_2638", name: "Grid L1 - Power", address: 2638, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "grid_l2_power_2640", name: "Grid L2 - Power", address: 2640, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "grid_l3_power_2642", name: "Grid L3 - Power", address: 2642, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "ac_frequency", name: "AC Frequency", address: 2644, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "l1_power_factor", name: "L1 Power Factor", address: 2645, type: "int16", scale: 0.001, role: "value" }, { id: "l2_power_factor", name: "L2 Power Factor", address: 2646, type: "int16", scale: 0.001, role: "value" }, { id: "l3_power_factor", name: "L3 Power Factor", address: 2647, type: "int16", scale: 0.001, role: "value" }, { id: "total_power_factor", name: "Total Power Factor", address: 2648, type: "int16", scale: 0.001, role: "value" }] },
    { key: "pvinverter", name: "AC PV inverter", probe: { address: 1052, type: "uint16" }, registers: [{ id: "position", name: "Position", address: 1026, type: "uint16", scale: 1, role: "value" }, { id: "l1_voltage", name: "L1 Voltage", address: 1027, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "l1_current", name: "L1 Current", address: 1028, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "l1_power", name: "L1 Power", address: 1029, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l1_energy", name: "L1 Energy", address: 1030, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l2_voltage", name: "L2 Voltage", address: 1031, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "l2_current", name: "L2 Current", address: 1032, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "l2_power", name: "L2 Power", address: 1033, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l2_energy", name: "L2 Energy", address: 1034, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l3_voltage", name: "L3 Voltage", address: 1035, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "l3_current", name: "L3 Current", address: 1036, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "l3_power", name: "L3 Power", address: 1037, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l3_energy", name: "L3 Energy", address: 1038, type: "uint16", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l1_energy_1046", name: "L1 Energy", address: 1046, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l2_energy_1048", name: "L2 Energy", address: 1048, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l3_energy_1050", name: "L3 Energy", address: 1050, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "total_power", name: "Total Power", address: 1052, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_power_capacity", name: "Maximum Power Capacity", address: 1054, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "l1_power_1058", name: "L1 Power", address: 1058, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "l2_power_1060", name: "L2 Power", address: 1060, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "l3_power_1062", name: "L3 Power", address: 1062, type: "uint32", scale: 1, unit: "W", role: "value.power" }, { id: "ac_frequency", name: "AC Frequency", address: 1064, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }] },
    { key: "acload", name: "AC load meter", probe: { address: 3924, type: "uint16" }, registers: [{ id: "l1_power", name: "L1 Power", address: 3900, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l2_power", name: "L2 Power", address: 3901, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l3_power", name: "L3 Power", address: 3902, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l1_voltage", name: "L1 Voltage", address: 3910, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "l1_current", name: "L1 Current", address: 3911, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "l2_voltage", name: "L2 Voltage", address: 3912, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "l2_current", name: "L2 Current", address: 3913, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "l3_voltage", name: "L3 Voltage", address: 3914, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "l3_current", name: "L3 Current", address: 3915, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "l1_energy", name: "L1 Energy", address: 3916, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l2_energy", name: "L2 Energy", address: 3918, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l3_energy", name: "L3 Energy", address: 3920, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "ac_frequency", name: "AC Frequency", address: 3922, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "l1_power_3924", name: "L1 Power", address: 3924, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "l2_power_3926", name: "L2 Power", address: 3926, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "l3_power_3928", name: "L3 Power", address: 3928, type: "int32", scale: 1, unit: "W", role: "value.power" }, { id: "l1_power_factor", name: "L1 Power Factor", address: 3930, type: "int16", scale: 0.001, role: "value" }, { id: "l2_power_factor", name: "L2 Power Factor", address: 3931, type: "int16", scale: 0.001, role: "value" }, { id: "l3_power_factor", name: "L3 Power Factor", address: 3932, type: "int16", scale: 0.001, role: "value" }, { id: "total_power_factor", name: "Total Power Factor", address: 3933, type: "int16", scale: 0.001, role: "value" }] },
    { key: "evcharger", name: "EV charger", probe: { address: 3821, type: "uint16" }, registers: [{ id: "energy_consumed_by_charger", name: "Energy consumed by charger", address: 3816, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "l1_power", name: "L1 Power", address: 3818, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l2_power", name: "L2 Power", address: 3819, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "l3_power", name: "L3 Power", address: 3820, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "total_power", name: "Total power", address: 3821, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "charging_time", name: "Charging time", address: 3822, type: "uint16", scale: 100, unit: "s", role: "value" }, { id: "charge_current", name: "Charge current", address: 3823, type: "uint16", scale: 1, unit: "A", role: "value.current" }, { id: "status", name: "Status", address: 3824, type: "uint16", scale: 1, role: "value" }] },
    { key: "multi_rs", name: "Multi RS / Inverter RS", probe: { address: 4530, type: "uint16" }, registers: [{ id: "input_voltage_l1", name: "Input voltage phase 1", address: 4500, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_voltage_l2", name: "Input voltage phase 2", address: 4501, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_voltage_l3", name: "Input voltage phase 3", address: 4502, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_current_l1", name: "Input current phase 1", address: 4503, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_current_l2", name: "Input current phase 2", address: 4504, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_current_l3", name: "Input current phase 3", address: 4505, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_power_l1", name: "Input power phase 1", address: 4506, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_power_l2", name: "Input power phase 2", address: 4507, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_power_l3", name: "Input power phase 3", address: 4508, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_frequency", name: "Input frequency", address: 4509, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "output_voltage_l1", name: "Output voltage phase 1", address: 4510, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_voltage_l2", name: "Output voltage phase 2", address: 4511, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_voltage_l3", name: "Output voltage phase 3", address: 4512, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_current_l1", name: "Output current phase 1", address: 4513, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_current_l2", name: "Output current phase 2", address: 4514, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_current_l3", name: "Output current phase 3", address: 4515, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_power_l1", name: "Output power phase 1", address: 4516, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_power_l2", name: "Output power phase 2", address: 4517, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_power_l3", name: "Output power phase 3", address: 4518, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_frequency", name: "Output frequency", address: 4519, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "ac_input_1_source_type", name: "AC input 1 source type", address: 4520, type: "uint16", scale: 1, role: "value" }, { id: "ac_input_2_source_type", name: "AC input 2 source type", address: 4521, type: "uint16", scale: 1, role: "value" }, { id: "phase_count", name: "Phase count", address: 4524, type: "uint16", scale: 1, role: "value" }, { id: "active_ac_input", name: "Active AC input", address: 4525, type: "uint16", scale: 1, role: "value" }, { id: "battery_voltage", name: "Battery voltage", address: 4526, type: "uint16", scale: 0.01, unit: "V", role: "value.voltage" }, { id: "battery_current", name: "Battery current", address: 4527, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "battery_temperature", name: "Battery temperature", address: 4528, type: "int16", scale: 0.1, unit: "°C", role: "value.temperature" }, { id: "battery_state_of_charge", name: "Battery State of Charge", address: 4529, type: "uint16", scale: 0.1, unit: "%", role: "value.battery" }, { id: "inverter_charger_state", name: "Inverter/Charger state", address: 4530, type: "uint16", scale: 1, role: "value" }, { id: "temperature_alarm", name: "Temperature alarm", address: 4532, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_voltage_alarm", name: "High voltage alarm", address: 4533, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_ac_out_voltage_alarm", name: "High AC-Out voltage alarm", address: 4534, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_battery_temperature_alarm", name: "Low battery temperature alarm", address: 4535, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_voltage_alarm", name: "Low voltage alarm", address: 4536, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "low_ac_out_voltage_alarm", name: "Low AC-Out voltage alarm", address: 4537, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "overload_alarm", name: "Overload alarm", address: 4538, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "high_dc_ripple_alarm", name: "High DC ripple alarm", address: 4539, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "pv_power", name: "PV power", address: 4540, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "user_yield", name: "User yield", address: 4541, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "relay_on_the_multi_rs", name: "Relay on the Multi RS", address: 4542, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode", name: "MPP operation mode", address: 4543, type: "uint16", scale: 1, role: "value" }, { id: "pv_voltage", name: "PV voltage", address: 4544, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "error_code", name: "Error code", address: 4545, type: "uint16", scale: 1, role: "value" }, { id: "energy_from_ac_in_1_to_ac_out", name: "Energy from AC-in-1 to AC-out", address: 4546, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_in_1_to_battery", name: "Energy from AC-in-1 to battery", address: 4548, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_in_2_to_ac_out", name: "Energy from AC-in-2 to AC-out", address: 4550, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_in_2_to_battery", name: "Energy from AC-in-2 to battery", address: 4552, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_out_to_ac_in_1", name: "Energy from AC-out to AC-in-1", address: 4554, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_out_to_ac_in_2", name: "Energy from AC-out to AC-in-2", address: 4556, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_battery_to_ac_in_1", name: "Energy from battery to AC-in-1", address: 4558, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_battery_to_ac_in_2", name: "Energy from battery to AC-in-2", address: 4560, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_battery_to_ac_out", name: "Energy from battery to AC-out", address: 4562, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_ac_out_to_battery", name: "Energy from AC-out to battery", address: 4564, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_solar_to_ac_in_1", name: "Energy from solar to AC-in-1", address: 4566, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_solar_to_ac_in_2", name: "Energy from solar to AC-in-2", address: 4568, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_solar_to_ac_out", name: "Energy from solar to AC-out", address: 4570, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "energy_from_solar_to_battery", name: "Energy from solar to battery", address: 4572, type: "uint32", scale: 0.01, unit: "kWh", role: "value.energy" }, { id: "yield_today", name: "Yield today", address: 4574, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "maximum_charge_power_today", name: "Maximum charge power today", address: 4575, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "yield_yesterday", name: "Yield yesterday", address: 4576, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "maximum_charge_power_yesterday", name: "Maximum charge power yesterday", address: 4577, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "yield_today_for_tracker_0", name: "Yield today for tracker 0", address: 4578, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_today_for_tracker_1", name: "Yield today for tracker 1", address: 4579, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_today_for_tracker_2", name: "Yield today for tracker 2", address: 4580, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_today_for_tracker_3", name: "Yield today for tracker 3", address: 4581, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_0", name: "Yield yesterday for tracker 0", address: 4582, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_1", name: "Yield yesterday for tracker 1", address: 4583, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_2", name: "Yield yesterday for tracker 2", address: 4584, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "yield_yesterday_for_tracker_3", name: "Yield yesterday for tracker 3", address: 4585, type: "uint16", scale: 0.1, unit: "kWh", role: "value.energy" }, { id: "maximum_charge_power_today_for_tracker_0", name: "Maximum charge power today for tracker 0", address: 4586, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_today_for_tracker_1", name: "Maximum charge power today for tracker 1", address: 4587, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_today_for_tracker_2", name: "Maximum charge power today for tracker 2", address: 4588, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_today_for_tracker_3", name: "Maximum charge power today for tracker 3", address: 4589, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_0", name: "Maximum charge power yesterday tracker 0", address: 4590, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_1", name: "Maximum charge power yesterday tracker 1", address: 4591, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_2", name: "Maximum charge power yesterday tracker 2", address: 4592, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "maximum_charge_power_yesterday_tracker_3", name: "Maximum charge power yesterday tracker 3", address: 4593, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_voltage_for_tracker_0", name: "PV voltage for tracker 0", address: 4594, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "pv_voltage_for_tracker_1", name: "PV voltage for tracker 1", address: 4595, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "pv_voltage_for_tracker_2", name: "PV voltage for tracker 2", address: 4596, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "pv_voltage_for_tracker_3", name: "PV voltage for tracker 3", address: 4597, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "pv_power_for_tracker_0", name: "PV power for tracker 0", address: 4598, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_1", name: "PV power for tracker 1", address: 4599, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_2", name: "PV power for tracker 2", address: 4600, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "pv_power_for_tracker_3", name: "PV power for tracker 3", address: 4601, type: "uint16", scale: 1, unit: "W", role: "value.power" }, { id: "low_soc_alarm", name: "Low SOC alarm", address: 4602, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "user_yield_4603", name: "User yield", address: 4603, type: "uint32", scale: 1, unit: "kWh", role: "value.energy" }, { id: "mpp_operation_mode_tracker_1", name: "MPP operation mode tracker 1", address: 4605, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode_tracker_2", name: "MPP operation mode tracker 2", address: 4606, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode_tracker_3", name: "MPP operation mode tracker 3", address: 4607, type: "uint16", scale: 1, role: "value" }, { id: "mpp_operation_mode_tracker_4", name: "MPP operation mode tracker 4", address: 4608, type: "uint16", scale: 1, role: "value" }, { id: "sustain_active", name: "Sustain active", address: 4615, type: "uint16", scale: 1, role: "value" }, { id: "short_circuit_alarm", name: "Short Circuit Alarm", address: 4620, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "tracker_1_enabled", name: "Tracker 1 enabled", address: 4630, type: "uint16", scale: 1, role: "value" }, { id: "tracker_2_enabled", name: "Tracker 2 enabled", address: 4631, type: "uint16", scale: 1, role: "value" }, { id: "tracker_3_enabled", name: "Tracker 3 enabled", address: 4632, type: "uint16", scale: 1, role: "value" }, { id: "tracker_4_enabled", name: "Tracker 4 enabled", address: 4633, type: "uint16", scale: 1, role: "value" }] },
    { key: "acsystem", name: "AC system", probe: { address: 4900, type: "uint16" }, registers: [{ id: "system_state", name: "System state", address: 4900, type: "uint16", scale: 1, role: "value" }, { id: "input_voltage_l1", name: "Input voltage phase 1", address: 4901, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_voltage_l2", name: "Input voltage phase 2", address: 4902, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_voltage_l3", name: "Input voltage phase 3", address: 4903, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "input_current_l1", name: "Input current phase 1", address: 4904, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_current_l2", name: "Input current phase 2", address: 4905, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_current_l3", name: "Input current phase 3", address: 4906, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "input_power_l1", name: "Input power phase 1", address: 4907, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_power_l2", name: "Input power phase 2", address: 4908, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_power_l3", name: "Input power phase 3", address: 4909, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "input_frequency", name: "Input frequency", address: 4910, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "output_voltage_l1", name: "Output voltage phase 1", address: 4911, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_voltage_l2", name: "Output voltage phase 2", address: 4912, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_voltage_l3", name: "Output voltage phase 3", address: 4913, type: "uint16", scale: 0.1, unit: "V", role: "value.voltage" }, { id: "output_current_l1", name: "Output current phase 1", address: 4914, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_current_l2", name: "Output current phase 2", address: 4915, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_current_l3", name: "Output current phase 3", address: 4916, type: "int16", scale: 0.1, unit: "A", role: "value.current" }, { id: "output_power_l1", name: "Output power phase 1", address: 4917, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_power_l2", name: "Output power phase 2", address: 4918, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_power_l3", name: "Output power phase 3", address: 4919, type: "int16", scale: 10, unit: "W", role: "value.power" }, { id: "output_frequency", name: "Output frequency", address: 4920, type: "uint16", scale: 0.01, unit: "Hz", role: "value.frequency" }, { id: "ess_active_soc_limit", name: "ESS Active SOC Limit", address: 4925, type: "uint16", scale: 1, unit: "%", role: "value.battery" }, { id: "grid_lost_alarm", name: "Grid Lost Alarm", address: 4930, type: "uint16", scale: 1, role: "indicator.alarm" }, { id: "phase_rotation_alarm", name: "Phase Rotation Alarm", address: 4931, type: "uint16", scale: 1, role: "indicator.alarm" }] }
];

function getRegisterLength(type) {
    return type === "uint32" || type === "int32" ? 2 : 1;
}

function decodeRegisters(registers, type, scale = 1, boolean = false) {
    if (!Array.isArray(registers) || registers.length === 0) {
        return null;
    }

    let value;
    switch (type) {
        case "int16": {
            value = registers[0] & 0xffff;
            if (value & 0x8000) value -= 0x10000;
            break;
        }
        case "uint32": {
            value = ((registers[0] & 0xffff) * 0x10000) + (registers[1] & 0xffff);
            break;
        }
        case "int32": {
            value = ((registers[0] & 0xffff) * 0x10000) + (registers[1] & 0xffff);
            if (value > 0x7fffffff) value -= 0x100000000;
            break;
        }
        case "uint16":
        default:
            value = registers[0] & 0xffff;
            break;
    }

    value *= scale;
    if (boolean) {
        return value !== 0;
    }
    return Number.isInteger(value) ? value : Number(value.toFixed(3));
}

function encodeValue(value, definition) {
    const type = definition.type || "uint16";
    let raw;

    if (definition.boolean) {
        raw = value === true || value === "true" || value === 1 || value === "1" ? 1 : 0;
    } else if (typeof definition.rawScaleForWrite === "number") {
        raw = Number(value) * definition.rawScaleForWrite;
    } else {
        raw = Number(value) / (definition.scale || 1);
    }

    if (!Number.isFinite(raw)) {
        throw new Error(`Value '${value}' is not numeric`);
    }

    raw = Math.round(raw);

    if (type === "int16") {
        if (raw < -32768 || raw > 32767) throw new Error(`Value ${value} is outside int16 range`);
        return [raw < 0 ? raw + 0x10000 : raw];
    }
    if (type === "uint16") {
        if (raw < 0 || raw > 65535) throw new Error(`Value ${value} is outside uint16 range`);
        return [raw];
    }
    if (type === "int32") {
        if (raw < -2147483648 || raw > 2147483647) throw new Error(`Value ${value} is outside int32 range`);
        if (raw < 0) raw += 0x100000000;
        return [(raw >>> 16) & 0xffff, raw & 0xffff];
    }
    if (type === "uint32") {
        if (raw < 0 || raw > 0xffffffff) throw new Error(`Value ${value} is outside uint32 range`);
        return [(raw >>> 16) & 0xffff, raw & 0xffff];
    }
    throw new Error(`Unsupported write type ${type}`);
}

function phaseTextFromId(id, fallbackName) {
    const source = String(id || fallbackName || '');
    const match = source.match(/(?:_|\b)(l|phase_?)([123])(?:_|\b)?/i) || source.match(/(?:L|phase\s*)([123])/i);
    if (!match) return '';
    const phase = match[2] || match[1];
    return ` Phase L${phase}`;
}

function friendlyName(definition) {
    const id = String(definition.id || '');
    const namesById = {
        grid_power_setpoint_w: 'ESS Zielwert Netzleistung',
        grid_power_setpoint_legacy_w: 'ESS Zielwert Netzleistung alt',
        grid_power_setpoint_legacy_large_w: 'ESS Zielwert Netzleistung alt großer Bereich',
        grid_limiting_status: 'Status Einspeisebegrenzung',
        dynamic_ess_restrictions: 'Dynamic ESS aktive Einschränkungen',
        dynamic_ess_strategy: 'Dynamic ESS aktuelle Strategie',
        dynamic_ess_schedule_strategy: 'Dynamic ESS Zeitplan Strategie'
    };
    if (namesById[id]) return namesById[id];

    let name = String(definition.name || definition.id || 'Victron Wert').trim();

    const replacements = [
        [/32-bit/gi, ''],
        [/GX Relay 1 state/gi, 'GX Relais 1 Zustand'],
        [/GX Relay 2 state/gi, 'GX Relais 2 Zustand'],
        [/PV AC-coupled on output/gi, 'PV AC am Wechselrichter-Ausgang'],
        [/PV AC-coupled on grid\/input/gi, 'PV AC am Netz-Eingang'],
        [/PV AC-coupled on generator/gi, 'PV AC am Generator'],
        [/AC consumption/gi, 'Hausverbrauch'],
        [/Power between meter and inverter\/charger/gi, 'Verbrauch zwischen Zähler und Wechselrichter'],
        [/Power on output of inverter\/charger/gi, 'Verbrauch am Wechselrichter-Ausgang'],
        [/Grid total power/gi, 'Netzleistung gesamt'],
        [/Current grid import/gi, 'Aktueller Netzbezug'],
        [/Current grid export/gi, 'Aktuelle Einspeisung'],
        [/Available PV surplus from grid export/gi, 'Verfügbarer PV-Überschuss'],
        [/AC house consumption total/gi, 'Hausverbrauch gesamt'],
        [/Critical loads \/ inverter output total/gi, 'Wichtige Verbraucher gesamt'],
        [/Non-Critical loads total/gi, 'Normale Verbraucher gesamt'],
        [/Loads between grid meter and inverter total/gi, 'Normale Verbraucher gesamt'],
        [/AC PV on inverter output total/gi, 'PV AC am Wechselrichter-Ausgang gesamt'],
        [/AC PV on grid\/input total/gi, 'PV AC am Netz-Eingang gesamt'],
        [/AC PV on generator total/gi, 'PV AC am Generator gesamt'],
        [/AC-coupled PV total/gi, 'PV-Erzeugung AC gesamt'],
        [/DC-coupled PV total/gi, 'PV-Erzeugung DC gesamt'],
        [/PV total AC plus DC/gi, 'PV-Erzeugung gesamt'],
        [/Battery power signed/gi, 'Batterieleistung mit Vorzeichen'],
        [/Battery charging power/gi, 'Batterie lädt mit'],
        [/Battery discharging power/gi, 'Batterie entlädt mit'],
        [/Generator total power/gi, 'Generatorleistung gesamt'],
        [/Inverter\/charger DC power/gi, 'Wechselrichter\/Ladegerät DC-Leistung'],
        [/Grid L/gi, 'Netzleistung L'],
        [/Genset L/gi, 'Generatorleistung L'],
        [/Active input source/gi, 'Aktive Eingangsquelle'],
        [/Battery voltage system/gi, 'Batteriespannung'],
        [/Battery current system/gi, 'Batteriestrom'],
        [/Battery power system/gi, 'Batterieleistung'],
        [/Battery state of charge system/gi, 'Batterie-Ladezustand'],
        [/Battery state system/gi, 'Batteriestatus'],
        [/Battery consumed amp hours system/gi, 'Verbrauchte Batteriekapazität'],
        [/Battery time to go system/gi, 'Restlaufzeit Batterie'],
        [/PV DC-coupled power/gi, 'PV DC-Leistung'],
        [/PV DC-coupled current/gi, 'PV DC-Strom'],
        [/Charger power/gi, 'Ladegerät-Leistung'],
        [/DC system power/gi, 'DC-Systemleistung'],
        [/VE\.Bus charge current system/gi, 'VE.Bus Ladestrom'],
        [/VE\.Bus charge power system/gi, 'VE.Bus Ladeleistung'],
        [/Inverter\/Charger DC current/gi, 'Wechselrichter\/Ladegerät DC-Strom'],
        [/ESS grid power setpoint 32-bit volatile/gi, 'ESS Zielwert Netzleistung'],
        [/ESS grid power setpoint legacy 2700/gi, 'ESS Zielwert Netzleistung alt'],
        [/ESS grid power setpoint legacy 2703 large/gi, 'ESS Zielwert Netzleistung alt großer Bereich'],
        [/ESS max charge percentage/gi, 'ESS maximale Ladeleistung in Prozent'],
        [/ESS max discharge percentage/gi, 'ESS maximale Entladeleistung in Prozent'],
        [/Maximum discharge power/gi, 'Maximale Entladeleistung'],
        [/DVCC maximum system charge current/gi, 'Maximaler Ladestrom'],
        [/Maximum system grid feed-in/gi, 'Maximale Einspeisung ins Netz'],
        [/Feed excess DC-coupled PV into grid/gi, 'DC-PV Überschuss ins Netz einspeisen'],
        [/Prevent excess AC-coupled PV feedback/gi, 'AC-PV Rückspeisung verhindern'],
        [/Grid limiting status/gi, 'Status Einspeisebegrenzung'],
        [/Limit managed battery voltage/gi, 'Maximale Batteriespannung begrenzen'],
        [/AC input 1 source/gi, 'Quelle AC-Eingang 1'],
        [/AC input 2 source/gi, 'Quelle AC-Eingang 2'],
        [/AC export limit when peakshaving/gi, 'Exportgrenze bei Lastspitzenbegrenzung'],
        [/AC import limit when peakshaving/gi, 'Importgrenze bei Lastspitzenbegrenzung'],
        [/Mode for peakshaving/gi, 'Modus Lastspitzenbegrenzung'],
        [/Grid metering mode/gi, 'Art der Netzmessung'],
        [/ESS BatteryLife state/gi, 'ESS BatteryLife Zustand'],
        [/ESS Minimum SOC unless grid fails/gi, 'ESS Mindest-Ladezustand'],
        [/ESS Mode/gi, 'ESS Modus'],
        [/ESS BatteryLife SOC limit read only/gi, 'ESS BatteryLife SOC-Grenze'],
        [/Dynamic ESS active/gi, 'Dynamic ESS aktiv'],
        [/Dynamic ESS allow grid feed-in/gi, 'Dynamic ESS Einspeisung erlaubt'],
        [/Dynamic ESS available/gi, 'Dynamic ESS verfügbar'],
        [/Dynamic ESS calculated rate of charge\/discharge/gi, 'Dynamic ESS berechnete Lade-/Entladerate'],
        [/Dynamic ESS error code/gi, 'Dynamic ESS Fehlercode'],
        [/Dynamic ESS active restrictions/gi, 'Dynamic ESS aktive Einschränkungen'],
        [/Dynamic ESS current strategy/gi, 'Dynamic ESS aktuelle Strategie'],
        [/Dynamic ESS target SOC/gi, 'Dynamic ESS Ziel-Ladezustand'],
        [/Dynamic ESS battery capacity/gi, 'Dynamic ESS Batteriekapazität'],
        [/Dynamic ESS mode/gi, 'Dynamic ESS Modus'],
        [/Dynamic ESS schedule allow grid feed-in/gi, 'Dynamic ESS Zeitplan Einspeisung erlaubt'],
        [/Dynamic ESS schedule duration/gi, 'Dynamic ESS Zeitplan Dauer'],
        [/Dynamic ESS schedule restrictions/gi, 'Dynamic ESS Zeitplan Einschränkungen'],
        [/Dynamic ESS schedule target SOC/gi, 'Dynamic ESS Zeitplan Ziel-Ladezustand'],
        [/Dynamic ESS schedule start unix timestamp/gi, 'Dynamic ESS Zeitplan Startzeit'],
        [/Dynamic ESS schedule strategy/gi, 'Dynamic ESS Zeitplan Strategie'],
        [/Input voltage phase/gi, 'Eingangsspannung Phase'],
        [/Input current phase/gi, 'Eingangsstrom Phase'],
        [/Input power phase/gi, 'Eingangsleistung Phase'],
        [/Input voltage/gi, 'Eingangsspannung'],
        [/Input current/gi, 'Eingangsstrom'],
        [/Input power/gi, 'Eingangsleistung'],
        [/Input frequency/gi, 'Eingangsfrequenz'],
        [/Output voltage phase/gi, 'Ausgangsspannung Phase'],
        [/Output current phase/gi, 'Ausgangsstrom Phase'],
        [/Output power phase/gi, 'Ausgangsleistung Phase'],
        [/Output voltage/gi, 'Ausgangsspannung'],
        [/Output current/gi, 'Ausgangsstrom'],
        [/Output power/gi, 'Ausgangsleistung'],
        [/Output frequency/gi, 'Ausgangsfrequenz'],
        [/System state/gi, 'Systemzustand'],
        [/Low SOC alarm/gi, 'Alarm niedriger Ladezustand'],
        [/Grid Lost Alarm/gi, 'Alarm Netz verloren'],
        [/Phase Rotation Alarm/gi, 'Alarm falsche Phasenfolge'],
        [/Short Circuit Alarm/gi, 'Alarm Kurzschluss'],
        [/Battery/gi, 'Batterie'],
        [/Voltage/gi, 'Spannung'],
        [/Current/gi, 'Strom'],
        [/Power/gi, 'Leistung'],
        [/State of charge|SOC/gi, 'Ladezustand'],
        [/State/gi, 'Zustand'],
        [/Alarm/gi, 'Alarm'],
        [/Relay/gi, 'Relais'],
        [/Generator/gi, 'Generator'],
        [/Grid/gi, 'Netz'],
        [/Phase/gi, 'Phase'],
        [/Tracker/gi, 'Tracker'],
        [/Today/gi, 'heute'],
        [/Yesterday/gi, 'gestern'],
        [/Maximum/gi, 'Maximum'],
        [/Minimum/gi, 'Minimum']
    ];

    for (const [from, to] of replacements) {
        name = name.replace(from, to);
    }
    name = name.replace(/\s+/g, ' ').trim();
    name = name.replace(/L([123])\s*$/i, 'L$1');
    return name;
}

function translateKnownDescription(description) {
    if (!description) return '';
    let text = String(description);
    const replacements = [
        [/Positive import from grid, negative feed-in\./gi, 'Positiv = Netzbezug, negativ = Einspeisung.'],
        [/Positive import, negative feed-in\./gi, 'Positiv = Netzbezug, negativ = Einspeisung.'],
        [/Positive charging, negative discharging\./gi, 'Positiv = Batterie lädt, negativ = Batterie entlädt.'],
        [/0=Open;1=Closed/gi, '0 = offen, 1 = geschlossen.'],
        [/0=Unknown;1=Grid;2=Generator;3=Shore power;240=Not connected/gi, '0 = unbekannt, 1 = Netz, 2 = Generator, 3 = Landstrom, 240 = nicht verbunden.'],
        [/0=idle;1=charging;2=discharging/gi, '0 = inaktiv, 1 = lädt, 2 = entlädt.'],
        [/Positive import from grid, negative feed into grid\. Volatile override; not for Dynamic ESS\./gi, 'Sollwert für die Netzleistung: positiv = Netzbezug, negativ = Einspeisung. Flüchtiger Sollwert, nicht für Dynamic ESS verwenden.'],
        [/Legacy 16-bit persistent setpoint\. Use only if 2716 is not available\./gi, 'Alter dauerhaft gespeicherter 16-Bit-Sollwert. Nur verwenden, wenn der neue 32-Bit-Sollwert nicht funktioniert.'],
        [/Legacy large range setpoint, Victron scale factor 0\.01\./gi, 'Alter Sollwert mit größerem Wertebereich. Internes Victron-Format mit Faktor 0,01.'],
        [/-1 means no limit where supported\. Victron scale factor 0\.1 = 10 W steps\./gi, '-1 bedeutet ohne Begrenzung, sofern unterstützt. Eingabe erfolgt in 10-W-Schritten.'],
        [/-1 disables where supported\./gi, '-1 deaktiviert die Begrenzung, sofern unterstützt.'],
        [/-1 no limit, >=0 limit system feed-in\. Victron scale factor 0\.01 = 100 W steps\./gi, '-1 bedeutet ohne Begrenzung, Werte ab 0 begrenzen die Einspeisung. Eingabe erfolgt in 100-W-Schritten.'],
        [/0 = disabled, 1 = enabled\./gi, '0 = aus, 1 = ein.'],
        [/0 = AC excess feed-in allowed, 1 = prevented\./gi, '0 = AC-Überschuss darf eingespeist werden, 1 = Rückspeisung wird verhindert.'],
        [/0=Unused;1=Grid;2=Genset;3=Shore/gi, '0 = unbenutzt, 1 = Netz, 2 = Generator, 3 = Landstrom.'],
        [/0=Above minimum SOC only;1=Always/gi, '0 = nur oberhalb Mindest-Ladezustand, 1 = immer.'],
        [/0=External meter;1=Inverter\/Charger/gi, '0 = externer Energiezähler, 1 = Wechselrichter/Ladegerät.'],
        [/1=ESS with phase compensation;2=ESS without phase compensation;3=Disabled\/External Control/gi, '1 = ESS mit Phasenkompensation, 2 = ESS ohne Phasenkompensation, 3 = deaktiviert/externe Steuerung.'],
        [/0=Off;1=Auto;4=Node-RED/gi, '0 = aus, 1 = automatisch, 4 = Node-RED.']
    ];
    for (const [from, to] of replacements) {
        text = text.replace(from, to);
    }
    return text.replace(/\s+/g, ' ').trim();
}

function friendlyDescription(definition, readableName) {
    const translated = translateKnownDescription(definition.description);
    if (translated) return translated;

    const id = String(definition.id || '');
    const phase = phaseTextFromId(id, definition.name);
    const name = readableName || friendlyName(definition);

    if (/^ac_consumption_l[123]/.test(id)) return `Aktueller Hausverbrauch${phase}.`;
    if (/^grid_l[123]/.test(id)) return `Aktuelle Netzleistung${phase}: positiv = Netzbezug, negativ = Einspeisung.`;
    if (/^genset_l[123]/.test(id)) return `Aktuelle Generatorleistung${phase}.`;
    if (/^pv_ac_output_l[123]/.test(id)) return `PV-Leistung auf der Wechselrichter-Ausgangsseite${phase}.`;
    if (/^pv_ac_input_l[123]/.test(id)) return `PV-Leistung auf der Netz-/Eingangsseite${phase}.`;
    if (/^pv_ac_genset_l[123]/.test(id)) return `PV-Leistung auf der Generatorseite${phase}.`;
    if (/^consumption_on_input_l[123]/.test(id)) return `AC-Lasten / Loads-Box zwischen Netz-/Energiezähler und Wechselrichter${phase}.`;
    if (/^consumption_on_output_l[123]/.test(id)) return `Essentielle Lasten am Ausgang des Wechselrichters${phase}.`;

    const descriptionsById = {
        relay_1_state: 'Zustand von GX-Relais 1.',
        relay_2_state: 'Zustand von GX-Relais 2.',
        active_input_source: 'Zeigt, ob die Anlage aktuell Netz, Generator, Landstrom oder keine Quelle nutzt.',
        battery_voltage: 'Aktuelle Batteriespannung der Anlage.',
        battery_current: 'Aktueller Batteriestrom: positiv = laden, negativ = entladen.',
        battery_power: 'Aktuelle Batterieleistung: positiv = laden, negativ = entladen.',
        battery_soc: 'Aktueller Ladezustand der Batterie in Prozent.',
        battery_state: 'Aktueller Batteriezustand, zum Beispiel inaktiv, laden oder entladen.',
        battery_consumed_ah: 'Seit Volladung entnommene Batteriekapazität.',
        battery_time_to_go_s: 'Geschätzte Restlaufzeit der Batterie in Sekunden.',
        pv_dc_power: 'Aktuelle PV-Leistung von DC-gekoppelten Solarladereglern.',
        pv_dc_current: 'Aktueller PV-Strom von DC-gekoppelten Solarladereglern.',
        charger_power: 'Aktuelle Ladeleistung der Ladegeräte.',
        dc_system_power: 'Aktuelle Leistung des DC-Systems.',
        charge_current: 'Aktueller Ladestrom über VE.Bus.',
        charge_power: 'Aktuelle Ladeleistung über VE.Bus.',
        inverter_charger_current: 'Aktueller DC-Strom des Wechselrichters/Ladegeräts.',
        inverter_charger_power: 'Aktuelle DC-Leistung des Wechselrichters/Ladegeräts.',
        grid_total: 'Gesamte Netzleistung aller Phasen: positiv = Netzbezug, negativ = Einspeisung.',
        grid_import: 'Aktueller Netzbezug. Ist 0, wenn gerade eingespeist wird.',
        grid_export: 'Aktuelle Einspeisung ins Netz. Ist 0, wenn gerade Strom aus dem Netz bezogen wird.',
        available_surplus: 'Aktuell verfügbarer Überschuss für Verbraucher wie Wallbox, Wärmepumpe oder Heizstab.',
        ac_consumption_total: 'Gesamter aktueller Hausverbrauch aller Phasen. Das ist nicht identisch mit der Kachel AC-Lasten, wenn essentielle Lasten getrennt vorhanden sind.',
        critical_loads_total: 'Essentielle Lasten am Wechselrichter-Ausgang, die bei Netzausfall weiter versorgt werden.',
        critical_loads_l1: 'Essentielle Lasten auf Phase L1.',
        critical_loads_l2: 'Essentielle Lasten auf Phase L2.',
        critical_loads_l3: 'Essentielle Lasten auf Phase L3.',
        non_critical_loads_total: 'Normale AC-Lasten zwischen Netz-/Energiezähler und Wechselrichter. Diese Kachel entspricht in Victron der Anzeige AC-Lasten.',
        non_critical_loads_l1: 'Normale AC-Lasten auf Phase L1.',
        non_critical_loads_l2: 'Normale AC-Lasten auf Phase L2.',
        non_critical_loads_l3: 'Normale AC-Lasten auf Phase L3.',
        pv_ac_output_total: 'Gesamte AC-PV-Leistung am Wechselrichter-Ausgang.',
        pv_ac_grid_total: 'Gesamte AC-PV-Leistung auf der Netz-/Eingangsseite.',
        pv_ac_genset_total: 'Gesamte AC-PV-Leistung auf der Generatorseite.',
        pv_ac_total: 'Gesamte AC-gekoppelte PV-Erzeugung.',
        pv_dc_total: 'Gesamte DC-gekoppelte PV-Erzeugung.',
        pv_total: 'Gesamte PV-Erzeugung aus AC- und DC-gekoppelten Quellen.',
        battery_charge: 'Leistung, mit der die Batterie aktuell geladen wird.',
        battery_discharge: 'Leistung, mit der die Batterie aktuell entladen wird.',
        genset_total: 'Gesamte Generatorleistung aller Phasen.',
        grid_power_setpoint_w: 'Zielwert für Netzbezug oder Einspeisung. Positiv = Netzbezug, negativ = Einspeisung.',
        grid_power_setpoint_legacy_w: 'Alter Zielwert für Netzbezug oder Einspeisung. Nur nutzen, wenn der neue Zielwert nicht funktioniert.',
        grid_power_setpoint_legacy_large_w: 'Alter Zielwert mit größerem Wertebereich. Nur für Sonderfälle.',
        max_charge_percent: 'Begrenzt die maximale Ladeleistung des ESS in Prozent.',
        max_discharge_percent: 'Begrenzt die maximale Entladeleistung des ESS in Prozent.',
        max_discharge_power_w: 'Maximal erlaubte Entladeleistung der Batterie.',
        max_charge_current_a: 'Maximal erlaubter Ladestrom für das System.',
        max_grid_feed_in_w: 'Maximal erlaubte Einspeisung ins öffentliche Netz.',
        feed_excess_dc_pv: 'Erlaubt, überschüssige DC-PV-Energie ins Netz einzuspeisen.',
        prevent_ac_pv_feedback: 'Verhindert die Rückspeisung von überschüssiger AC-PV-Energie.',
        grid_limiting_status: 'Zeigt, ob die Einspeise-/Netzbegrenzung gerade aktiv ist.',
        max_charge_voltage_v: 'Begrenzt die maximale Ladespannung der Batterie.',
        ac_input_1_source: 'Festlegung der Quelle für AC-Eingang 1.',
        ac_input_2_source: 'Festlegung der Quelle für AC-Eingang 2.',
        peakshaving_export_limit_w: 'Exportgrenze für Lastspitzenbegrenzung.',
        peakshaving_import_limit_w: 'Importgrenze für Lastspitzenbegrenzung.',
        peakshaving_mode: 'Betriebsart der Lastspitzenbegrenzung.',
        grid_metering_mode: 'Legt fest, ob ein externer Energiezähler oder der Wechselrichter zur Netzmessung genutzt wird.',
        battery_life_state: 'Aktueller BatteryLife-Zustand des ESS.',
        minimum_soc_limit: 'Mindest-Ladezustand der Batterie im ESS-Betrieb.',
        ess_mode: 'Betriebsmodus des ESS.',
        battery_life_soc_limit: 'Von BatteryLife berechnete Ladezustandsgrenze.',
        dynamic_ess_active: 'Zeigt, ob Dynamic ESS aktuell aktiv ist.',
        dynamic_ess_allow_grid_feed_in: 'Zeigt, ob Dynamic ESS Einspeisung erlaubt.',
        dynamic_ess_available: 'Zeigt, ob Dynamic ESS verfügbar ist.',
        dynamic_ess_charge_rate: 'Von Dynamic ESS berechnete Lade- oder Entladerate.',
        dynamic_ess_error_code: 'Fehlercode von Dynamic ESS.',
        dynamic_ess_restrictions: 'Aktive Einschränkungen von Dynamic ESS.',
        dynamic_ess_strategy: 'Aktuelle Strategie von Dynamic ESS.',
        dynamic_ess_target_soc: 'Ziel-Ladezustand von Dynamic ESS.',
        dynamic_ess_battery_capacity_kwh: 'Eingestellte Batteriekapazität für Dynamic ESS.',
        dynamic_ess_mode: 'Betriebsmodus von Dynamic ESS.',
        dynamic_ess_schedule_allow_grid_feed_in: 'Gibt im Dynamic-ESS-Zeitplan Einspeisung frei oder sperrt sie.',
        dynamic_ess_schedule_duration_s: 'Dauer des Dynamic-ESS-Zeitplans in Sekunden.',
        dynamic_ess_schedule_restrictions: 'Einschränkungen des Dynamic-ESS-Zeitplans.',
        dynamic_ess_schedule_target_soc: 'Ziel-Ladezustand im Dynamic-ESS-Zeitplan.',
        dynamic_ess_schedule_start_unix: 'Startzeit des Dynamic-ESS-Zeitplans als Unix-Zeitstempel.',
        dynamic_ess_schedule_strategy: 'Strategie des Dynamic-ESS-Zeitplans.'
    };
    if (descriptionsById[id]) return descriptionsById[id];

    if (/voltage/i.test(id)) return `${name}: gemessene Spannung.`;
    if (/current/i.test(id)) return `${name}: gemessener Strom.`;
    if (/power/i.test(id)) return `${name}: aktuelle Leistung.`;
    if (/frequency/i.test(id)) return `${name}: aktuelle Frequenz.`;
    if (/alarm/i.test(id)) return `${name}: Alarmstatus.`;
    if (/soc|state_of_charge/i.test(id)) return `${name}: Ladezustand in Prozent.`;
    if (/state|status|mode/i.test(id)) return `${name}: aktueller Zustand oder Betriebsmodus.`;

    if (definition.address !== undefined) {
        return `${name}. Technische Quelle: Victron-Register ${definition.address}.`;
    }
    return `${name}.`;
}

function stateCommon(definition, writable = false) {
    const name = definition.friendlyName || friendlyName(definition);
    const explicitCommonType = definition.commonType || definition.objectType || definition.type;
    const ioBrokerType = ["string", "number", "boolean", "mixed", "array", "object"].includes(explicitCommonType)
        ? explicitCommonType
        : (definition.boolean ? "boolean" : "number");
    const common = {
        name,
        type: ioBrokerType,
        role: definition.role || (definition.boolean ? "indicator" : "value"),
        read: true,
        write: Boolean(writable),
        desc: friendlyDescription(definition, name)
    };
    if (definition.unit) common.unit = definition.unit;
    return common;
}

module.exports = {
    SYSTEM_REGISTERS,
    FLOW_STATES,
    CONTROL_REGISTERS,
    DEVICE_PROFILES,
    getRegisterLength,
    decodeRegisters,
    encodeValue,
    stateCommon
};
