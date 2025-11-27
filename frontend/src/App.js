import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Sankey, Rectangle, Layer } from 'recharts';

// ============================================================
// 配置 - 修改这里的 API 地址
// ============================================================
const API_BASE = 'http://localhost:5002';

// ============================================================
// 工具函数
// ============================================================
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getToday = () => formatDate(new Date());

// ============================================================
// 日期选择器组件
// ============================================================
const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange, onApply }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-gray-800 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <label className="text-gray-400 text-sm">开始:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-gray-400 text-sm">结束:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <button
        onClick={onApply}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium transition-colors"
      >
        查询
      </button>
      <button
        onClick={() => {
          const today = getToday();
          onStartDateChange(today);
          onEndDateChange(today);
          setTimeout(onApply, 0);
        }}
        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-sm transition-colors"
      >
        今天
      </button>
      <button
        onClick={() => {
          const today = new Date();
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          onStartDateChange(formatDate(weekAgo));
          onEndDateChange(formatDate(today));
          setTimeout(onApply, 0);
        }}
        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-sm transition-colors"
      >
        最近7天
      </button>
    </div>
  );
};


// --------- 用这个替换旧的 SankeyFlow 整个函数 ----------
const SankeyFlow = ({ data }) => {
  const { 
    solar = 0, 
    battery_discharge = 0, 
    grid_import = 0, 
    battery_charge = 0, 
    load = 0, 
    grid_export = 0, 
    battery_net = 0 
  } = data || {};

  const batteryOut = battery_discharge > 0.001 ? battery_discharge : Math.max(0, -battery_net);
  const batteryIn = battery_charge > 0.001 ? battery_charge : Math.max(0, battery_net);

  const solarToLoad = Math.min(solar, load);
  const solarToBatteryIn = Math.min(Math.max(0, solar - solarToLoad), batteryIn);
  const solarToGridOut = Math.max(0, solar - solarToLoad - solarToBatteryIn);

  const remainingLoadAfterSolar = Math.max(0, load - solarToLoad);
  const batteryOutToLoad = Math.min(batteryOut, remainingLoadAfterSolar);

  const remainingLoadAfterBattery = Math.max(0, remainingLoadAfterSolar - batteryOutToLoad);
  const gridInToLoad = Math.min(grid_import, remainingLoadAfterBattery);
  const gridInToBatteryIn = Math.max(0, grid_import - gridInToLoad);

  const nodes = [
    { name: "Solar" },
    { name: "Battery Out" },
    { name: "Grid In" },
    { name: "Battery In" },
    { name: "Load" },
    { name: "Grid Out" },
  ];

  const nodeColors = {
    Solar: "#FCD34D",
    "Battery Out": "#22D3EE",
    "Grid In": "#60A5FA",
    "Battery In": "#22D3EE",
    Load: "#A78BFA",
    "Grid Out": "#60A5FA",
  };

  const links = [];
  const addLink = (source, target, value) => {
    if (value > 0.001) links.push({ source, target, value });
  };
  addLink(0, 4, solarToLoad);
  addLink(0, 3, solarToBatteryIn);
  addLink(0, 5, solarToGridOut);
  addLink(1, 4, batteryOutToLoad);
  addLink(2, 4, gridInToLoad);
  addLink(2, 3, gridInToBatteryIn);

  if (links.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">⚡ Energy Flow (实时)</h2>
        <div className="flex items-center justify-center h-64 text-gray-500">
          🌙 No energy flow
        </div>
      </div>
    );
  }

  // 兼容不同版本的 node payload -> 返回一个“中心点”对象或 null
  const getNodeCenter = (n) => {
    if (!n) return null;

    // common patterns:
    // - { x, y, width, height, dy }
    // - { x0, x1, y0, y1 } (d3 style)
    // - { x, y, dx, dy }
    const x0 = n.x0 ?? n.x ?? (n.left ?? null);
    const x1 = n.x1 ?? (n.x != null && (n.width ?? n.dx) != null ? (n.x + (n.width ?? n.dx)) : null) ?? (n.right ?? null);
    const y0 = n.y0 ?? n.y ?? (n.top ?? null);
    const y1 = n.y1 ?? (n.y != null && (n.height ?? n.dy) != null ? (n.y + (n.height ?? n.dy)) : null) ?? (n.bottom ?? null);

    // center x
    let cx = null;
    if (x1 != null) cx = x1; // prefer the right edge (so link starts at node right)
    else if (x0 != null) cx = x0 + ((n.width ?? n.dx ?? 0) / 2);
    // center y
    let cy = null;
    if (y0 != null && y1 != null) cy = (y0 + y1) / 2;
    else if (y0 != null) cy = y0 + ((n.height ?? n.dy ?? 0) / 2);

    if (cx == null || cy == null) return null;
    return { cx, cy, left: x0, right: x1, top: y0, bottom: y1 };
  };

  const CustomNode = (props) => {
    const { x, y, width, height } = props;
    // 兼容 node/payload/props 多种形式
    const node = props.node ?? props.payload ?? (props?.payload?.node) ?? null;
    // 如果上面没拿到，部分版本会把 name/value 直接放在 props（极少见），兜底：
    const maybeName = node?.name ?? props.name ?? null;
    if (!maybeName) return null;

    const name = node?.name ?? props.name;
    const value = node?.value ?? props.value ?? 0;
    const color = nodeColors[name] || "#888";

    return (
      <Layer>
        <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} rx={6} ry={6} />
        <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#1a1a2e" fontSize={12} fontWeight="bold">
          {name}
        </text>
        <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#1a1a2e" fontSize={14} fontWeight="bold">
          {(value || 0).toFixed(2)} kW
        </text>
      </Layer>
    );
  };

  // const CustomLink = (props) => {
  //   console.log('Sankey link props:', props);
  //   // 先尝试从 props 解构常见字段
  //   let {
  //     source, target,
  //     sourceX, sourceY, targetX, targetY,
  //     linkWidth, index, payload
  //   } = props;

  //   // 不同版本字段适配：sourceNode/targetNode / payload.source/payload.target / sourceX/sourceY
  //   const sourceNode = props.sourceNode ?? source ?? payload?.source ?? payload?.sourceNode ?? null;
  //   const targetNode = props.targetNode ?? target ?? payload?.target ?? payload?.targetNode ?? null;

  //   // 情况1: 老版本直接给 XY（sourceX/sourceY）
  //   const hasXY = (sourceX !== undefined && sourceY !== undefined && targetX !== undefined && targetY !== undefined);

  //   let sourcePos = null;
  //   let targetPos = null;

  //   if (hasXY) {
  //     sourcePos = { cx: sourceX, cy: sourceY };
  //     targetPos = { cx: targetX, cy: targetY };
  //   } else {
  //     // 通过 node 对象推算
  //     sourcePos = getNodeCenter(sourceNode);
  //     targetPos = getNodeCenter(targetNode);
  //   }

  //   // 如果依然拿不到坐标，就放弃渲染这个 link（布局尚未完成）
  //   if (!sourcePos || !targetPos) {
  //     return null;
  //   }

  //   // 颜色与渐变 id
  //   const sourceName = (sourceNode && (sourceNode.name ?? sourceNode.payload?.name)) || "unknown";
  //   const color = nodeColors[sourceName] || "#888";
  //   const gid = `sankey-link-grad-${index}`;

  //   // linkWidth 兼容：有些版本传入的是 linkWidth，有些放在 payload.value
  //   const strokeW = linkWidth || Math.max(2, (payload?.value ?? props.value ?? 6));

  //   // 控制点偏移：根据节点间距自适应（不硬编码太大）
  //   const dx = Math.max(30, Math.abs(targetPos.cx - sourcePos.cx) / 3);

  //   return (
  //     <Layer>
  //       <defs>
  //         <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
  //           <stop offset="0%" stopColor={color} stopOpacity={0.9} />
  //           <stop offset="100%" stopColor={color} stopOpacity={0.2} />
  //         </linearGradient>
  //       </defs>

  //       <path
  //         d={`
  //           M${sourcePos.cx},${sourcePos.cy}
  //           C${sourcePos.cx + dx},${sourcePos.cy}
  //            ${targetPos.cx - dx},${targetPos.cy}
  //            ${targetPos.cx},${targetPos.cy}
  //         `}
  //         fill="none"
  //         stroke={`url(#${gid})`}
  //         strokeWidth={strokeW}
  //         strokeOpacity={0.9}
  //       />
  //     </Layer>
  //   );
  // };
  const CustomLink = (props) => {
    console.log('Sankey link props:', props);
    const {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourceControlX,
      targetControlX,
      linkWidth,
      index,
      payload,
    } = props;

    // 颜色取自 source 节点
    const sourceName = payload?.source?.name ?? "unknown";
    const color = nodeColors[sourceName] || "#888";
    const gradientId = `sankey-gradient-${index}`;

    return (
      <Layer>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.8} />
            <stop offset="100%" stopColor={color} stopOpacity={0.2} />
          </linearGradient>
        </defs>

        <path
          d={`
            M${sourceX},${sourceY}
            C${sourceControlX},${sourceY}
            ${targetControlX},${targetY}
            ${targetX},${targetY}
          `}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={linkWidth}
          strokeOpacity={0.9}
        />
      </Layer>
    );
  };


  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-4">⚡ Energy Flow (实时)</h2>
      <div style={{ width: "100%", height: 400 }}>
        <Sankey
          width={700}
          height={400}
          data={{ nodes, links }}
          node={<CustomNode />}
          link={<CustomLink />}
          nodePadding={40}
          nodeWidth={100}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        />
      </div>
    </div>
  );
};


// ============================================================
// 每日统计卡片组件
// ============================================================
const DailySummaryCard = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">📊 每日统计 (kWh)</h2>
        <div className="text-gray-400 text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">📊 每日统计 (kWh)</h2>
        <div className="text-gray-400 text-center py-8">暂无数据</div>
      </div>
    );
  }

  // 单天数据
  if (data.length === 1) {
    const d = data[0];
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">📊 {d.date} 统计 (kWh)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-yellow-500/20 rounded-lg p-4">
            <div className="text-yellow-400 text-sm">☀️ Solar</div>
            <div className="text-white text-2xl font-bold">{d.solar_kwh?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="bg-purple-500/20 rounded-lg p-4">
            <div className="text-purple-400 text-sm">🏠 Load</div>
            <div className="text-white text-2xl font-bold">{d.load_kwh?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="bg-cyan-500/20 rounded-lg p-4">
            <div className="text-cyan-400 text-sm">🔋 Charge</div>
            <div className="text-white text-2xl font-bold">{d.battery_charge_kwh?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="bg-cyan-500/20 rounded-lg p-4">
            <div className="text-cyan-400 text-sm">🔋 Discharge</div>
            <div className="text-white text-2xl font-bold">{d.battery_discharge_kwh?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="bg-blue-500/20 rounded-lg p-4">
            <div className="text-blue-400 text-sm">⬇️ Grid Import</div>
            <div className="text-white text-2xl font-bold">{d.grid_import_kwh?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="bg-green-500/20 rounded-lg p-4">
            <div className="text-green-400 text-sm">⬆️ Grid Export</div>
            <div className="text-white text-2xl font-bold">{d.grid_export_kwh?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      </div>
    );
  }

  // 多天数据 - 柱状图
  const chartData = data.map(d => ({
    date: d.date?.slice(5) || '',
    solar: d.solar_kwh || 0,
    load: d.load_kwh || 0,
    gridExport: d.grid_export_kwh || 0,
    gridImport: d.grid_import_kwh || 0,
  }));

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-4">📊 每日统计 (kWh)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <Legend />
          <Bar dataKey="solar" fill="#FCD34D" name="Solar" />
          <Bar dataKey="load" fill="#A78BFA" name="Load" />
          <Bar dataKey="gridExport" fill="#34D399" name="Grid Export" />
          <Bar dataKey="gridImport" fill="#60A5FA" name="Grid Import" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================
// 状态卡片组件
// ============================================================
const StatCard = ({ title, value, unit, icon, color }) => {
  const colorClasses = {
    yellow: 'from-yellow-500 to-orange-500',
    cyan: 'from-cyan-500 to-blue-500',
    purple: 'from-purple-500 to-pink-500',
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-green-500 to-emerald-500',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 shadow-lg`}>
      <div>
        <p className="text-white/80 text-sm font-medium">{icon} {title}</p>
        <p className="text-white text-2xl font-bold mt-1">
          {typeof value === 'number' ? value.toFixed(2) : value} <span className="text-lg">{unit}</span>
        </p>
      </div>
    </div>
  );
};

// ============================================================
// 主 Dashboard 组件
// ============================================================
function App() {
  const [currentData, setCurrentData] = useState({
    solar: 0, battery_discharge: 0, grid_import: 0, battery_charge: 0,
    load: 0, grid_export: 0, battery_net: 0, soc_inv: 0, soc_bms: 0,
    timestamp: null, connected: false
  });

  const [historicalData, setHistoricalData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/current`);
        if (!response.ok) throw new Error('API 请求失败');
        const data = await response.json();
        setCurrentData(data);
        setError(null);
        
        setHistoricalData(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            solar: data.solar,
            load: data.load,
            battery: data.battery_net,
            grid: data.grid_export - data.grid_import
          }];
          return newData.slice(-60);
        });
      } catch (err) {
        setError(`连接失败: ${err.message}`);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDailyRange = useCallback(async () => {
    setDailyLoading(true);
    try {
      if (startDate === endDate) {
        const response = await fetch(`${API_BASE}/api/daily?date=${startDate}`);
        if (!response.ok) throw new Error('获取每日数据失败');
        const data = await response.json();
        setDailyData([data]);
      } else {
        const response = await fetch(`${API_BASE}/api/daily/range?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) throw new Error('获取日期范围数据失败');
        const result = await response.json();
        setDailyData(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch daily data:', err);
      setDailyData([]);
    } finally {
      setDailyLoading(false);
    }
  }, [startDate, endDate]);

  const fetchHistoryRange = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history/range?start_date=${startDate}&end_date=${endDate}&limit=300`);
      if (!response.ok) return;
      const result = await response.json();
      
      if (result.data && result.data.length > 0) {
        const chartData = result.data.map(d => ({
          time: new Date(d.timestamp).toLocaleString('zh-CN', { 
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
          }),
          solar: d.solar,
          load: d.load,
          battery: d.battery_net,
          grid: d.grid_export - d.grid_import
        }));
        setHistoricalData(chartData);
      }
    } catch (err) {
      console.error('Failed to fetch history range:', err);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDailyRange();
  }, [fetchDailyRange]);

  const handleApply = () => {
    fetchDailyRange();
    fetchHistoryRange();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            ☀️ Growatt Solar Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm ${currentData.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {currentData.connected ? '● 已连接' : '○ 未连接'}
            </span>
            {currentData.timestamp && (
              <span className="text-gray-400 text-sm">
                更新: {new Date(currentData.timestamp).toLocaleTimeString('zh-CN')}
              </span>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            ⚠️ {error}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Solar" value={currentData.solar} unit="kW" icon="☀️" color="yellow" />
          <StatCard title="Load" value={currentData.load} unit="kW" icon="🏠" color="purple" />
          <StatCard title="Battery" value={currentData.battery_net} unit="kW" icon="🔋" color="cyan" />
          <StatCard title="Grid" value={currentData.grid_export - currentData.grid_import} unit="kW" icon="🔌" color="blue" />
          <StatCard title="SOC (INV)" value={currentData.soc_inv} unit="%" icon="📊" color="green" />
          <StatCard title="SOC (BMS)" value={currentData.soc_bms} unit="%" icon="📈" color="green" />
        </div>

        <SankeyFlow data={currentData} />

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={handleApply}
        />

        <DailySummaryCard data={dailyData} isLoading={dailyLoading} />

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-white mb-4">📈 Power History (kW)</h2>
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
              <Line type="monotone" dataKey="load" stroke="#A78BFA" strokeWidth={2} dot={false} name="Load" />
              <Line type="monotone" dataKey="battery" stroke="#22D3EE" strokeWidth={2} dot={false} name="Battery" />
              <Line type="monotone" dataKey="grid" stroke="#60A5FA" strokeWidth={2} dot={false} name="Grid" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 text-center text-gray-500 text-sm">
        Growatt Solar Monitor | API: {API_BASE}
      </div>
    </div>
  );
}

export default App;
