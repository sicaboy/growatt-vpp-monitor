import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Sankey Flow Diagram Component
const SankeyFlow = ({ data }) => {
  const { solar, battery_discharge, grid_import, battery_charge, load, grid_export } = data;
  
  // Calculate totals
  const totalInput = solar + battery_discharge + grid_import;
  const totalOutput = battery_charge + load + grid_export;
  
  // Normalize for visualization (handle edge cases)
  const maxFlow = Math.max(totalInput, totalOutput, 1);
  
  // Calculate flow percentages
  const flows = {
    solarToBattery: Math.min(solar, battery_charge),
    solarToLoad: Math.max(0, Math.min(solar - battery_charge, load)),
    solarToGrid: Math.max(0, solar - battery_charge - load),
    batteryToLoad: Math.min(battery_discharge, load - solar),
    gridToLoad: Math.max(0, load - solar - battery_discharge),
    gridToBattery: Math.max(0, battery_charge - solar)
  };
  
  return (
    <div className="relative w-full h-96 bg-gray-900 rounded-xl p-6">
      <svg viewBox="0 0 800 400" className="w-full h-full">
        <defs>
          {/* Gradients for flow paths */}
          <linearGradient id="solarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FCD34D" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="batteryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#67E8F9" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        
        {/* Source Nodes (Left) */}
        <g id="sources">
          {/* Solar */}
          <rect x="20" y="50" width="120" height="80" rx="8" fill="#FCD34D" opacity="0.9" />
          <text x="80" y="85" textAnchor="middle" fill="#1F2937" fontSize="14" fontWeight="bold">SOLAR</text>
          <text x="80" y="105" textAnchor="middle" fill="#1F2937" fontSize="20" fontWeight="bold">{solar.toFixed(1)}</text>
          <text x="80" y="120" textAnchor="middle" fill="#1F2937" fontSize="12">kW</text>
          
          {/* Battery Discharge */}
          <rect x="20" y="160" width="120" height="80" rx="8" fill="#67E8F9" opacity="0.9" />
          <text x="80" y="195" textAnchor="middle" fill="#1F2937" fontSize="14" fontWeight="bold">BATTERY</text>
          <text x="80" y="215" textAnchor="middle" fill="#1F2937" fontSize="20" fontWeight="bold">{battery_discharge.toFixed(1)}</text>
          <text x="80" y="230" textAnchor="middle" fill="#1F2937" fontSize="12">kW</text>
          
          {/* Grid Import */}
          <rect x="20" y="270" width="120" height="80" rx="8" fill="#93C5FD" opacity="0.9" />
          <text x="80" y="305" textAnchor="middle" fill="#1F2937" fontSize="14" fontWeight="bold">GRID</text>
          <text x="80" y="325" textAnchor="middle" fill="#1F2937" fontSize="20" fontWeight="bold">{grid_import.toFixed(1)}</text>
          <text x="80" y="340" textAnchor="middle" fill="#1F2937" fontSize="12">kW</text>
        </g>
        
        {/* Flow Paths */}
        <g id="flows">
          {/* Solar to Battery */}
          {flows.solarToBattery > 0.1 && (
            <path
              d={`M 140 90 Q 400 90 660 110`}
              fill="none"
              stroke="url(#solarGrad)"
              strokeWidth={Math.max(2, flows.solarToBattery * 30 / maxFlow)}
              opacity="0.7"
            />
          )}
          
          {/* Solar to Load */}
          {flows.solarToLoad > 0.1 && (
            <path
              d={`M 140 90 Q 400 200 660 240`}
              fill="none"
              stroke="url(#solarGrad)"
              strokeWidth={Math.max(2, flows.solarToLoad * 30 / maxFlow)}
              opacity="0.7"
            />
          )}
          
          {/* Solar to Grid */}
          {flows.solarToGrid > 0.1 && (
            <path
              d={`M 140 90 Q 400 310 660 330`}
              fill="none"
              stroke="url(#solarGrad)"
              strokeWidth={Math.max(2, flows.solarToGrid * 30 / maxFlow)}
              opacity="0.7"
            />
          )}
          
          {/* Battery to Load */}
          {flows.batteryToLoad > 0.1 && (
            <path
              d={`M 140 200 Q 400 220 660 240`}
              fill="none"
              stroke="url(#batteryGrad)"
              strokeWidth={Math.max(2, flows.batteryToLoad * 30 / maxFlow)}
              opacity="0.7"
            />
          )}
          
          {/* Grid to Load */}
          {flows.gridToLoad > 0.1 && (
            <path
              d={`M 140 310 Q 400 270 660 240`}
              fill="none"
              stroke="url(#gridGrad)"
              strokeWidth={Math.max(2, flows.gridToLoad * 30 / maxFlow)}
              opacity="0.7"
            />
          )}
          
          {/* Grid to Battery */}
          {flows.gridToBattery > 0.1 && (
            <path
              d={`M 140 310 Q 400 210 660 110`}
              fill="none"
              stroke="url(#gridGrad)"
              strokeWidth={Math.max(2, flows.gridToBattery * 30 / maxFlow)}
              opacity="0.7"
            />
          )}
        </g>
        
        {/* Destination Nodes (Right) */}
        <g id="destinations">
          {/* Battery Charge */}
          <rect x="660" y="70" width="120" height="80" rx="8" fill="#67E8F9" opacity="0.9" />
          <text x="720" y="105" textAnchor="middle" fill="#1F2937" fontSize="14" fontWeight="bold">BATTERY</text>
          <text x="720" y="125" textAnchor="middle" fill="#1F2937" fontSize="20" fontWeight="bold">{battery_charge.toFixed(1)}</text>
          <text x="720" y="140" textAnchor="middle" fill="#1F2937" fontSize="12">kW</text>
          
          {/* Load */}
          <rect x="660" y="200" width="120" height="80" rx="8" fill="#C084FC" opacity="0.9" />
          <text x="720" y="235" textAnchor="middle" fill="#1F2937" fontSize="14" fontWeight="bold">LOAD</text>
          <text x="720" y="255" textAnchor="middle" fill="#1F2937" fontSize="20" fontWeight="bold">{load.toFixed(1)}</text>
          <text x="720" y="270" textAnchor="middle" fill="#1F2937" fontSize="12">kW</text>
          
          {/* Grid Export */}
          <rect x="660" y="310" width="120" height="40" rx="8" fill="#93C5FD" opacity="0.9" />
          <text x="720" y="335" textAnchor="middle" fill="#1F2937" fontSize="16" fontWeight="bold">{grid_export.toFixed(2)} kW</text>
        </g>
      </svg>
    </div>
  );
};

// Main Dashboard Component
const GrowattDashboard = () => {
  const [currentData, setCurrentData] = useState({
    solar: 0,
    battery_discharge: 0,
    grid_import: 0,
    battery_charge: 0,
    load: 0,
    grid_export: 0,
    soc_inv: 0,
    soc_bms: 0,
    timestamp: new Date().toISOString()
  });
  
  const [historicalData, setHistoricalData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState({
    ip: '192.168.9.242',
    port: 502,
    interval: 5
  });
  
  // Simulate data fetching (replace with actual API calls)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // This would be your actual API endpoint
        // const response = await fetch('/api/growatt/current');
        // const data = await response.json();
        
        // Simulated data for demonstration
        const simulatedData = {
          solar: Math.random() * 8 + 2,
          battery_discharge: Math.random() * 3,
          grid_import: Math.random() * 2,
          battery_charge: Math.random() * 4,
          load: Math.random() * 5 + 3,
          grid_export: Math.random() * 1.5,
          soc_inv: Math.floor(Math.random() * 30 + 60),
          soc_bms: Math.floor(Math.random() * 30 + 60),
          timestamp: new Date().toISOString()
        };
        
        setCurrentData(simulatedData);
        setIsConnected(true);
        
        // Add to historical data
        setHistoricalData(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString(),
            ...simulatedData
          }];
          return newData.slice(-20); // Keep last 20 data points
        });
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsConnected(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, config.interval * 1000);
    
    return () => clearInterval(interval);
  }, [config.interval]);
  
  // Calculate daily totals (simulated)
  const dailyTotals = {
    solar: 44.47,
    battery_charge: 50.17,
    battery_discharge: 27.06,
    load: 70.47,
    grid_import: 0.52,
    grid_export: 49.63
  };
  
  const dailyPercentages = {
    solar: 36.7,
    battery: 41.4,
    grid: 40.97,
    load: 58.18
  };
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-cyan-400 bg-clip-text text-transparent">
              Growatt Solar Monitor
            </h1>
            <p className="text-gray-400 mt-1">2025/11/26 - Real-time Energy Flow</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isConnected ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Daily Summary Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Solar */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="text-yellow-300 text-sm font-semibold mb-1">SOLAR</div>
          <div className="text-3xl font-bold text-yellow-100">{dailyTotals.solar}</div>
          <div className="text-yellow-200/70 text-sm">kWh</div>
          <div className="text-yellow-300/80 text-lg font-semibold mt-2">{dailyPercentages.solar}%</div>
        </div>
        
        {/* Battery Input */}
        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-4">
          <div className="text-cyan-300 text-sm font-semibold mb-1">BATTERY IN</div>
          <div className="text-3xl font-bold text-cyan-100">{dailyTotals.battery_charge}</div>
          <div className="text-cyan-200/70 text-sm">kWh</div>
          <div className="text-cyan-300/80 text-lg font-semibold mt-2">{dailyPercentages.battery}%</div>
        </div>
        
        {/* Load */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
          <div className="text-purple-300 text-sm font-semibold mb-1">LOAD</div>
          <div className="text-3xl font-bold text-purple-100">{dailyTotals.load}</div>
          <div className="text-purple-200/70 text-sm">kWh</div>
          <div className="text-purple-300/80 text-lg font-semibold mt-2">{dailyPercentages.load}%</div>
        </div>
        
        {/* Grid Export */}
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
          <div className="text-blue-300 text-sm font-semibold mb-1">GRID EXPORT</div>
          <div className="text-3xl font-bold text-blue-100">{dailyTotals.grid_export}</div>
          <div className="text-blue-200/70 text-sm">kWh</div>
          <div className="text-blue-300/80 text-lg font-semibold mt-2">{dailyPercentages.grid}%</div>
        </div>
      </div>
      
      {/* Real-time Power Flow */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-cyan-400">⚡</span>
            Real-time Power Flow
          </h2>
          <SankeyFlow data={currentData} />
        </div>
      </div>
      
      {/* Current Stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Solar Power</div>
          <div className="text-2xl font-bold text-yellow-400">{currentData.solar.toFixed(2)} kW</div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Load Power</div>
          <div className="text-2xl font-bold text-purple-400">{currentData.load.toFixed(2)} kW</div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Battery SOC</div>
          <div className="text-2xl font-bold text-cyan-400">{currentData.soc_bms}%</div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Grid Power</div>
          <div className={`text-2xl font-bold ${currentData.grid_export > 0.1 ? 'text-green-400' : 'text-red-400'}`}>
            {(currentData.grid_export - currentData.grid_import).toFixed(2)} kW
          </div>
        </div>
      </div>
      
      {/* Historical Chart */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Power Metrics (kW)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend />
              <Line type="monotone" dataKey="solar" stroke="#FCD34D" strokeWidth={2} dot={false} name="Solar" />
              <Line type="monotone" dataKey="load" stroke="#C084FC" strokeWidth={2} dot={false} name="Load" />
              <Line type="monotone" dataKey="battery_charge" stroke="#67E8F9" strokeWidth={2} dot={false} name="Battery Charge" />
              <Line type="monotone" dataKey="battery_discharge" stroke="#34D399" strokeWidth={2} dot={false} name="Battery Discharge" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default GrowattDashboard;
