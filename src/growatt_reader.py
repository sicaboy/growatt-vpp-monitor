import os
import json
import time
import argparse
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusIOException, ConnectionException


# ---------------------------------------------------------------------
# Default configuration (used if no config.json is provided)
# ---------------------------------------------------------------------
DEFAULT_CONFIG = {
    "modbus": {
        "ip": "192.168.1.50",     # <-- Updated default IP
        "port": 502,
        "unit_id": 1
    },
    "retry_timeout_sec": 30,
    "retry_delay_sec": 1
}

CONFIG_SEARCH_PATHS = [
    "./config.json",
    "/etc/growatt-monitor/config.json"
]


# ---------------------------------------------------------------------
# Tools: merge dictionaries recursively
# ---------------------------------------------------------------------
def deep_merge_dict(base, override):
    result = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = deep_merge_dict(result[k], v)
        else:
            result[k] = v
    return result


# ---------------------------------------------------------------------
# Load configuration: CLI > local config.json > system config > default
# ---------------------------------------------------------------------
def load_config(cmd_path=None):
    cfg = DEFAULT_CONFIG.copy()

    # 1) Command-line override
    if cmd_path:
        if os.path.exists(cmd_path):
            with open(cmd_path, "r", encoding="utf-8") as f:
                user_cfg = json.load(f)
            cfg = deep_merge_dict(cfg, user_cfg)
            print(f"✔ Using config file: {cmd_path}")
            return cfg
        else:
            print(f"⚠ Config file not found: {cmd_path}")

    # 2) Auto-search for config.json
    for path in CONFIG_SEARCH_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    user_cfg = json.load(f)
                cfg = deep_merge_dict(cfg, user_cfg)
                print(f"✔ Loaded config file: {path}")
                return cfg
            except Exception as e:
                print(f"⚠ Failed reading {path}: {e}")

    # 3) Use default config
    print("⚠ No config.json found — using default configuration.")
    return cfg


# ---------------------------------------------------------------------
# Modbus reading with retry mechanism (up to retry_timeout)
# ---------------------------------------------------------------------
def robust_read_input_registers(client, addr, count, unit_id, timeout, delay):
    start = time.time()
    while True:
        if not client.connected:
            try:
                client.connect()
            except Exception:
                pass

        try:
            rr = client.read_input_registers(address=addr, count=count, unit=unit_id)
            if (not isinstance(rr, ModbusIOException)) and (not rr.isError()):
                return rr.registers
        except (ConnectionException, OSError, Exception):
            pass

        if time.time() - start > timeout:
            return None

        time.sleep(delay)


def read_input_u16(client, addr, unit_id, timeout, delay):
    regs = robust_read_input_registers(client, addr, 1, unit_id, timeout, delay)
    return None if regs is None else regs[0]


def read_input_u32(client, addr, unit_id, timeout, delay):
    regs = robust_read_input_registers(client, addr, 2, unit_id, timeout, delay)
    if regs is None:
        return None
    hi, lo = regs
    return (hi << 16) | lo


def read_input_s32(client, addr, unit_id, timeout, delay):
    val = read_input_u32(client, addr, unit_id, timeout, delay)
    if val is None:
        return None
    if val & 0x80000000:
        val -= 0x100000000
    return val


# ---------------------------------------------------------------------
# Reader demo: prints a single snapshot of inverter values
# ---------------------------------------------------------------------
def read_once(cfg):
    ip = cfg["modbus"]["ip"]
    port = cfg["modbus"]["port"]
    unit_id = cfg["modbus"]["unit_id"]
    timeout = cfg.get("retry_timeout_sec", 30)
    delay = cfg.get("retry_delay_sec", 1)

    client = ModbusTcpClient(ip, port=port)
    client.connect()

    print(f"\nReading Growatt inverter @ {ip}:{port} (unit {unit_id})…")

    # PV input power
    pv_raw = read_input_u32(client, 1, unit_id, timeout, delay)
    pv = pv_raw / 10 if pv_raw is not None else None

    # Grid power (+ import, – export)
    grid_raw = read_input_s32(client, 1029, unit_id, timeout, delay)
    grid = grid_raw / 10 if grid_raw is not None else None

    # Load power
    load_raw = read_input_s32(client, 1037, unit_id, timeout, delay)
    load = load_raw / 10 if load_raw is not None else None

    # Battery SOC (inverter)
    soc_inv = read_input_u16(client, 1014, unit_id, timeout, delay)

    # Battery SOC (BMS)
    soc_bms = read_input_u16(client, 1086, unit_id, timeout, delay)

    # Energy balance battery power
    if pv is not None and load is not None and grid is not None:
        batt_net = pv - load - grid
        batt_charge = max(batt_net, 0)
        batt_discharge = max(-batt_net, 0)
    else:
        batt_net = batt_charge = batt_discharge = None

    client.close()

    print("\n--- Inverter Snapshot ---")
    print(f"PV Input Power:        {pv} W")
    print(f"Load Power:            {load} W")
    print(f"Grid Power:            {grid} W (positive=export)")
    print(f"Battery Charging:      {batt_charge} W")
    print(f"Battery Discharging:   {batt_discharge} W")
    print(f"Battery Net Charging:  {batt_net} W")
    print(f"SOC (Inverter 1014):   {soc_inv} %")
    print(f"SOC (BMS 1086):        {soc_bms} %")
    print("-------------------------\n")


# ---------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Growatt SPH Reader")
    parser.add_argument("-c", "--config", help="Specify config file path", default=None)
    args = parser.parse_args()

    cfg = load_config(args.config)

    read_once(cfg)


if __name__ == "__main__":
    main()

