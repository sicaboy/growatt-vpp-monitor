#!/usr/bin/env python3
"""
Flask API server for Growatt Solar Monitor
Provides REST endpoints for real-time and historical data
"""

import os
import json
import time
import csv
from datetime import datetime, timedelta
from threading import Thread, Lock
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusIOException, ConnectionException


app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------
CONFIG_FILE = os.getenv('GROWATT_CONFIG', './config.json')
DEFAULT_CONFIG = {
    "modbus": {
        "ip": "192.168.9.242",
        "port": 502,
        "unit_id": 1
    },
    "polling_interval": 5,
    "history_size": 1000,
    "log_file": "growatt_log.csv"
}

config = DEFAULT_CONFIG.copy()
if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, 'r') as f:
        user_config = json.load(f)
        config.update(user_config)

# Global state
current_data = {
    "timestamp": None,
    "solar": 0,
    "battery_discharge": 0,
    "grid_import": 0,
    "battery_charge": 0,
    "load": 0,
    "grid_export": 0,
    "battery_net": 0,
    "soc_inv": 0,
    "soc_bms": 0,
    "connected": False
}

historical_data = []
data_lock = Lock()

RETRY_TIMEOUT_SEC = 10
RETRY_DELAY_SEC = 0.5


# ---------------------------------------------------------------------
# Modbus helpers
# ---------------------------------------------------------------------
def robust_read_input_registers(client, addr, count, unit_id):
    """Read input registers with retry mechanism"""
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

        if time.time() - start > RETRY_TIMEOUT_SEC:
            return None

        time.sleep(RETRY_DELAY_SEC)


def read_u16(client, addr, unit_id):
    regs = robust_read_input_registers(client, addr, 1, unit_id)
    return None if regs is None else regs[0]


def read_u32(client, addr, unit_id):
    regs = robust_read_input_registers(client, addr, 2, unit_id)
    if regs is None:
        return None
    hi, lo = regs
    return (hi << 16) | lo


def read_s32(client, addr, unit_id):
    val = read_u32(client, addr, unit_id)
    if val is None:
        return None
    if val & 0x80000000:
        val -= 0x100000000
    return val


# ---------------------------------------------------------------------
# Data polling thread
# ---------------------------------------------------------------------
def poll_inverter():
    """Background thread to continuously poll inverter data"""
    global current_data, historical_data
    
    ip = config["modbus"]["ip"]
    port = config["modbus"]["port"]
    unit_id = config["modbus"]["unit_id"]
    interval = config["polling_interval"]
    
    client = ModbusTcpClient(ip, port=port)
    
    print(f"🔌 Starting Growatt polling: {ip}:{port}, interval={interval}s")
    
    while True:
        try:
            # Read all registers
            pv_raw = read_u32(client, 1, unit_id)
            grid_raw = read_s32(client, 1029, unit_id)
            load_raw = read_s32(client, 1037, unit_id)
            soc_inv = read_u16(client, 1014, unit_id)
            soc_bms = read_u16(client, 1086, unit_id)
            
            # Convert to watts/kW
            pv = (pv_raw / 10.0 / 1000.0) if pv_raw is not None else 0
            grid = (grid_raw / 10.0 / 1000.0) if grid_raw is not None else 0
            load_val = (load_raw / 10.0 / 1000.0) if load_raw is not None else 0
            
            # Calculate battery power using energy balance
            if pv is not None and load_val is not None and grid is not None:
                battery_net = pv - load_val - grid
                battery_charge = max(battery_net, 0)
                battery_discharge = max(-battery_net, 0)
                grid_export = max(grid, 0)
                grid_import = max(-grid, 0)
            else:
                battery_net = battery_charge = battery_discharge = 0
                grid_export = max(grid, 0) if grid else 0
                grid_import = max(-grid, 0) if grid else 0
            
            timestamp = datetime.now().isoformat()
            
            # Update global state
            with data_lock:
                current_data.update({
                    "timestamp": timestamp,
                    "solar": round(pv, 3),
                    "battery_discharge": round(battery_discharge, 3),
                    "grid_import": round(grid_import, 3),
                    "battery_charge": round(battery_charge, 3),
                    "load": round(load_val, 3),
                    "grid_export": round(grid_export, 3),
                    "battery_net": round(battery_net, 3),
                    "soc_inv": soc_inv if soc_inv else 0,
                    "soc_bms": soc_bms if soc_bms else 0,
                    "connected": True
                })
                
                # Add to historical data
                historical_data.append(current_data.copy())
                
                # Keep only recent history
                max_history = config.get("history_size", 1000)
                if len(historical_data) > max_history:
                    historical_data.pop(0)
            
            # Log to CSV if configured
            log_file = config.get("log_file")
            if log_file:
                log_to_csv(log_file, current_data)
            
            print(f"📊 [{timestamp}] PV={pv:.2f}kW Load={load_val:.2f}kW Grid={grid:.2f}kW Batt={battery_net:.2f}kW SOC={soc_bms}%")
            
        except Exception as e:
            print(f"❌ Error polling inverter: {e}")
            with data_lock:
                current_data["connected"] = False
        
        time.sleep(interval)


def log_to_csv(filepath, data):
    """Append data to CSV log file"""
    file_exists = os.path.exists(filepath)
    
    with open(filepath, 'a', newline='') as f:
        fieldnames = ['timestamp', 'solar', 'load', 'grid_export', 'grid_import', 
                      'battery_charge', 'battery_discharge', 'battery_net', 
                      'soc_inv', 'soc_bms']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        if not file_exists or os.path.getsize(filepath) == 0:
            writer.writeheader()
        
        writer.writerow({k: data.get(k, 0) for k in fieldnames})


# ---------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------
@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current system status and connection state"""
    with data_lock:
        return jsonify({
            "connected": current_data["connected"],
            "timestamp": current_data["timestamp"],
            "config": {
                "ip": config["modbus"]["ip"],
                "port": config["modbus"]["port"],
                "interval": config["polling_interval"]
            }
        })


@app.route('/api/current', methods=['GET'])
def get_current():
    """Get current real-time data"""
    with data_lock:
        return jsonify(current_data)


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get historical data with optional filtering"""
    limit = request.args.get('limit', type=int, default=100)
    minutes = request.args.get('minutes', type=int)
    
    with data_lock:
        data = historical_data.copy()
    
    # Filter by time range if specified
    if minutes:
        cutoff = datetime.now() - timedelta(minutes=minutes)
        data = [d for d in data if datetime.fromisoformat(d["timestamp"]) >= cutoff]
    
    # Limit number of results
    if limit and len(data) > limit:
        step = len(data) // limit
        data = data[::step]
    
    return jsonify({
        "count": len(data),
        "data": data
    })


@app.route('/api/history/range', methods=['GET'])
def get_history_range():
    """
    Get historical data for a date range from CSV log.
    
    Query parameters:
    - start_date: Start date in YYYY-MM-DD format (required)
    - end_date: End date in YYYY-MM-DD format (optional, defaults to start_date)
    - limit: Maximum number of data points to return (optional, default 500)
    
    Example: /api/history/range?start_date=2025-11-26&end_date=2025-11-26&limit=200
    """
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date', start_date_str)
    limit = request.args.get('limit', type=int, default=500)
    
    if not start_date_str:
        return jsonify({"error": "start_date is required (YYYY-MM-DD)"}), 400
    
    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    if end_date < start_date:
        return jsonify({"error": "end_date cannot be before start_date"}), 400
    
    # Read from CSV log
    log_file = config.get("log_file")
    if not log_file or not os.path.exists(log_file):
        # Fallback to in-memory data
        with data_lock:
            data = [
                d for d in historical_data
                if start_date <= datetime.fromisoformat(d["timestamp"]).date() <= end_date
            ]
        return jsonify({
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "count": len(data),
            "data": data[:limit] if limit else data
        })
    
    # Read from CSV
    data = []
    with open(log_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                ts = datetime.fromisoformat(row["timestamp"])
                if start_date <= ts.date() <= end_date:
                    data.append({
                        "timestamp": row["timestamp"],
                        "solar": float(row.get("solar", 0)),
                        "load": float(row.get("load", 0)),
                        "grid_export": float(row.get("grid_export", 0)),
                        "grid_import": float(row.get("grid_import", 0)),
                        "battery_charge": float(row.get("battery_charge", 0)),
                        "battery_discharge": float(row.get("battery_discharge", 0)),
                        "battery_net": float(row.get("battery_net", 0)),
                        "soc_inv": int(float(row.get("soc_inv", 0))),
                        "soc_bms": int(float(row.get("soc_bms", 0)))
                    })
            except (ValueError, KeyError):
                continue
    
    # Downsample if needed
    if limit and len(data) > limit:
        step = len(data) // limit
        data = data[::step]
    
    return jsonify({
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "count": len(data),
        "data": data
    })


@app.route('/api/daily', methods=['GET'])
def get_daily():
    """Calculate daily totals from historical data"""
    date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    # Read from CSV log if available
    log_file = config.get("log_file")
    if log_file and os.path.exists(log_file):
        daily_data = calculate_daily_from_csv(log_file, target_date)
    else:
        # Fallback to in-memory data
        with data_lock:
            daily_data = calculate_daily_from_memory(historical_data, target_date)
    
    return jsonify(daily_data)


@app.route('/api/daily/range', methods=['GET'])
def get_daily_range():
    """
    Get daily totals for a date range.
    
    Query parameters:
    - start_date: Start date in YYYY-MM-DD format (required)
    - end_date: End date in YYYY-MM-DD format (optional, defaults to today)
    
    Example: /api/daily/range?start_date=2025-11-20&end_date=2025-11-26
    """
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
    
    if not start_date_str:
        return jsonify({"error": "start_date is required (YYYY-MM-DD)"}), 400
    
    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    if end_date < start_date:
        return jsonify({"error": "end_date cannot be before start_date"}), 400
    
    # Limit to 90 days max
    if (end_date - start_date).days > 90:
        return jsonify({"error": "Date range cannot exceed 90 days"}), 400
    
    results = []
    current = start_date
    while current <= end_date:
        log_file = config.get("log_file")
        if log_file and os.path.exists(log_file):
            daily_data = calculate_daily_from_csv(log_file, current)
        else:
            with data_lock:
                daily_data = calculate_daily_from_memory(historical_data, current)
        results.append(daily_data)
        current += timedelta(days=1)
    
    return jsonify({
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "count": len(results),
        "data": results
    })


def calculate_daily_from_memory(data, target_date):
    """Calculate daily totals from in-memory data"""
    filtered = [
        d for d in data 
        if datetime.fromisoformat(d["timestamp"]).date() == target_date
    ]
    
    if not filtered:
        return {
            "date": target_date.isoformat(),
            "solar_kwh": 0,
            "load_kwh": 0,
            "grid_export_kwh": 0,
            "grid_import_kwh": 0,
            "battery_charge_kwh": 0,
            "battery_discharge_kwh": 0,
            "count": 0
        }
    
    # Simple integration (trapezoidal rule approximation)
    interval_hours = config["polling_interval"] / 3600.0
    
    totals = {
        "solar_kwh": sum(d["solar"] for d in filtered) * interval_hours,
        "load_kwh": sum(d["load"] for d in filtered) * interval_hours,
        "grid_export_kwh": sum(d["grid_export"] for d in filtered) * interval_hours,
        "grid_import_kwh": sum(d["grid_import"] for d in filtered) * interval_hours,
        "battery_charge_kwh": sum(d["battery_charge"] for d in filtered) * interval_hours,
        "battery_discharge_kwh": sum(d["battery_discharge"] for d in filtered) * interval_hours,
        "count": len(filtered)
    }
    
    totals["date"] = target_date.isoformat()
    return totals


def calculate_daily_from_csv(filepath, target_date):
    """Calculate daily totals from CSV log file"""
    totals = {
        "solar_kwh": 0,
        "load_kwh": 0,
        "grid_export_kwh": 0,
        "grid_import_kwh": 0,
        "battery_charge_kwh": 0,
        "battery_discharge_kwh": 0,
        "count": 0
    }
    
    interval_hours = config["polling_interval"] / 3600.0
    
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                ts = datetime.fromisoformat(row["timestamp"])
                if ts.date() == target_date:
                    totals["solar_kwh"] += float(row.get("solar", 0)) * interval_hours
                    totals["load_kwh"] += float(row.get("load", 0)) * interval_hours
                    totals["grid_export_kwh"] += float(row.get("grid_export", 0)) * interval_hours
                    totals["grid_import_kwh"] += float(row.get("grid_import", 0)) * interval_hours
                    totals["battery_charge_kwh"] += float(row.get("battery_charge", 0)) * interval_hours
                    totals["battery_discharge_kwh"] += float(row.get("battery_discharge", 0)) * interval_hours
                    totals["count"] += 1
            except (ValueError, KeyError):
                continue
    
    totals["date"] = target_date.isoformat()
    return totals


@app.route('/api/config', methods=['GET', 'POST'])
def manage_config():
    """Get or update configuration"""
    global config
    
    if request.method == 'GET':
        return jsonify(config)
    
    elif request.method == 'POST':
        new_config = request.json
        config.update(new_config)
        
        # Save to file
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        
        return jsonify({"message": "Configuration updated", "config": config})


# ---------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5000)
    args = parser.parse_args()
    
    # Start polling thread
    polling_thread = Thread(target=poll_inverter, daemon=True)
    polling_thread.start()
    
    # Start Flask server
    port = int(os.getenv('PORT', args.port))
    print(f"🚀 Starting Flask API server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
