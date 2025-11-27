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
// 模块标题组件
// ============================================================
const SectionTitle = ({ icon, title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
      <span>{icon}</span>
      <span>{title}</span>
    </h2>
    {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
  </div>
);

// ============================================================
// 模块容器组件
// ============================================================
const SectionContainer = ({ children, className = "" }) => (
  <div className={`bg-gray-900/50 rounded-2xl p-6 border border-gray-800 ${className}`}>
    {children}
  </div>
);

// ============================================================
// 日期选择器组件
// ============================================================
const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange, onApply }) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
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
      <button
        onClick={() => {
          const today = new Date();
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          onStartDateChange(formatDate(monthAgo));
          onEndDateChange(formatDate(today));
          setTimeout(onApply, 0);
        }}
        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-sm transition-colors"
      >
        最近30天
      </button>
    </div>
  );
};


// ============================================================
// Sankey 图组件
// ============================================================
const SankeyFlow = ({ data, title = "能量流向", unit = "kW", height = 420, instanceId = "default" }) => {
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

  // 总输入和总输出
  const totalInput = solar + batteryOut + grid_import;
  const totalOutput = load + batteryIn + grid_export;

  // 对于历史统计数据，使用比例分配而不是优先级分配
  // 这样更准确地反映实际能量流向
  
  let solarToLoad, solarToBatteryIn, solarToGridOut;
  let batteryOutToLoad;
  let gridInToLoad, gridInToBatteryIn;

  if (totalInput > 0.001 && totalOutput > 0.001) {
    // 按比例分配：每个输入源按输出的比例分配
    const loadRatio = load / totalOutput;
    const batteryInRatio = batteryIn / totalOutput;
    const gridOutRatio = grid_export / totalOutput;

    solarToLoad = solar * loadRatio;
    solarToBatteryIn = solar * batteryInRatio;
    solarToGridOut = solar * gridOutRatio;

    batteryOutToLoad = batteryOut * loadRatio;
    // batteryOut 一般不会去充电或卖电，但如果有剩余也按比例
    
    gridInToLoad = grid_import * loadRatio;
    gridInToBatteryIn = grid_import * batteryInRatio;
  } else {
    // Fallback: 原来的优先级逻辑（用于实时数据）
    solarToLoad = Math.min(solar, load);
    solarToBatteryIn = Math.min(Math.max(0, solar - solarToLoad), batteryIn);
    solarToGridOut = Math.max(0, solar - solarToLoad - solarToBatteryIn);

    const remainingLoadAfterSolar = Math.max(0, load - solarToLoad);
    batteryOutToLoad = Math.min(batteryOut, remainingLoadAfterSolar);

    const remainingLoadAfterBattery = Math.max(0, remainingLoadAfterSolar - batteryOutToLoad);
    gridInToLoad = Math.min(grid_import, remainingLoadAfterBattery);
    gridInToBatteryIn = Math.max(0, grid_import - gridInToLoad);
  }

  // 定义所有可能的节点（按左右顺序：输入源在前，输出在后）
  const allNodes = [
    { name: "Solar", side: "input" },
    { name: "Battery Out", side: "input" },
    { name: "Grid In", side: "input" },
    { name: "Battery In", side: "output" },
    { name: "Load", side: "output" },
    { name: "Grid Out", side: "output" },
  ];

  const nodeColors = {
    Solar: "#FCD34D",
    "Battery Out": "#22D3EE",
    "Grid In": "#60A5FA",
    "Battery In": "#22D3EE",
    Load: "#A78BFA",
    "Grid Out": "#34D399",
  };

  // 构建所有可能的连接（使用节点名称，稍后转换为索引）
  const allLinksDef = [
    { sourceName: "Solar", targetName: "Load", value: solarToLoad },
    { sourceName: "Solar", targetName: "Battery In", value: solarToBatteryIn },
    { sourceName: "Solar", targetName: "Grid Out", value: solarToGridOut },
    { sourceName: "Battery Out", targetName: "Load", value: batteryOutToLoad },
    { sourceName: "Grid In", targetName: "Load", value: gridInToLoad },
    { sourceName: "Grid In", targetName: "Battery In", value: gridInToBatteryIn },
  ];

  // 过滤有效的连接
  const validLinks = allLinksDef.filter(link => link.value > 0.001);

  // 找出所有被使用的节点名称
  const usedNodeNames = new Set();
  validLinks.forEach(link => {
    usedNodeNames.add(link.sourceName);
    usedNodeNames.add(link.targetName);
  });

  // 按原始顺序过滤出被使用的节点
  const nodes = allNodes.filter(n => usedNodeNames.has(n.name));

  // 创建节点名称到索引的映射
  const nodeIndexMap = {};
  nodes.forEach((n, i) => {
    nodeIndexMap[n.name] = i;
  });

  // 转换连接的source/target为新的索引
  const links = validLinks.map(link => ({
    source: nodeIndexMap[link.sourceName],
    target: nodeIndexMap[link.targetName],
    value: link.value,
  }));

  if (links.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        🌙 No energy flow
      </div>
    );
  }

  // 为每个节点预计算百分比（基于原始数据）
  const nodePercentages = {
    "Solar": totalInput > 0 ? (solar / totalInput * 100).toFixed(1) : "0.0",
    "Grid In": totalInput > 0 ? (grid_import / totalInput * 100).toFixed(1) : "0.0",
    "Battery Out": totalInput > 0 ? (batteryOut / totalInput * 100).toFixed(1) : "0.0",
    "Load": totalOutput > 0 ? (load / totalOutput * 100).toFixed(1) : "0.0",
    "Grid Out": totalOutput > 0 ? (grid_export / totalOutput * 100).toFixed(1) : "0.0",
    "Battery In": totalOutput > 0 ? (batteryIn / totalOutput * 100).toFixed(1) : "0.0",
  };

  // 为每个节点预计算原始值（用于显示）
  const nodeValues = {
    "Solar": solar,
    "Grid In": grid_import,
    "Battery Out": batteryOut,
    "Load": load,
    "Grid Out": grid_export,
    "Battery In": batteryIn,
  };

  const CustomNode = (props) => {
    const { x, y, width, height } = props;
    const node = props.node ?? props.payload ?? (props?.payload?.node) ?? null;
    const maybeName = node?.name ?? props.name ?? null;
    if (!maybeName) return null;

    const name = node?.name ?? props.name;
    const color = nodeColors[name] || "#888";
    
    // 使用原始数据的值和百分比
    const displayValue = nodeValues[name] ?? 0;
    const percentage = nodePercentages[name] ?? "0.0";

    return (
      <Layer>
        <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} rx={6} ry={6} />
        <text x={x + width / 2} y={y + height / 2 - 12} textAnchor="middle" fill="#F3F4F6" fontSize={11} fontWeight="bold">
          {name}
        </text>
        <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="#FFFFFF" fontSize={13} fontWeight="bold">
          {displayValue.toFixed(2)} {unit}
        </text>
        <text x={x + width / 2} y={y + height / 2 + 20} textAnchor="middle" fill="#E5E7EB" fontSize={10}>
          ({percentage}%)
        </text>
      </Layer>
    );
  };

  const CustomLink = (props) => {
    const {
      sourceX, sourceY, targetX, targetY,
      sourceControlX, targetControlX,
      linkWidth, index, payload,
    } = props;

    // 检查坐标是否有效
    if (sourceX === undefined || sourceY === undefined || 
        targetX === undefined || targetY === undefined ||
        linkWidth === undefined || linkWidth < 0.1) {
      return null;
    }

    const sourceName = payload?.source?.name ?? "unknown";
    const color = nodeColors[sourceName] || "#888";
    const gradientId = `sankey-grad-${instanceId}-${index}-${sourceName.replace(/\s/g, '')}`;

    // 确保控制点有效
    const ctrlX1 = sourceControlX ?? (sourceX + (targetX - sourceX) / 3);
    const ctrlX2 = targetControlX ?? (targetX - (targetX - sourceX) / 3);

    return (
      <Layer>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.8} />
            <stop offset="100%" stopColor={color} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <path
          d={`M${sourceX},${sourceY} C${ctrlX1},${sourceY} ${ctrlX2},${targetY} ${targetX},${targetY}`}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={Math.max(linkWidth, 2)}
          strokeOpacity={0.9}
        />
      </Layer>
    );
  };

  // 生成唯一key，确保数据变化时重新渲染
  const nodeNames = nodes.map(n => n.name).join(',');
  const linkInfo = links.map(l => `${l.source}-${l.target}-${l.value.toFixed(3)}`).join('|');
  const sankeyKey = `${instanceId}-${nodeNames}-${linkInfo}`;

  return (
    <div style={{ width: "100%", height, overflowX: "auto" }}>
      <Sankey
        key={sankeyKey}
        width={750}
        height={height}
        data={{ nodes, links }}
        node={<CustomNode />}
        link={<CustomLink />}
        nodePadding={50}
        nodeWidth={110}
        margin={{ top: 25, right: 25, bottom: 25, left: 25 }}
      />
    </div>
  );
};


// ============================================================
// 状态卡片组件
// ============================================================
const StatCard = ({ title, value, unit, icon, color, subtitle }) => {
  const colorClasses = {
    yellow: 'from-yellow-500 to-orange-500',
    cyan: 'from-cyan-500 to-blue-500',
    'cyan-in': 'from-cyan-600 to-cyan-400',
    'cyan-out': 'from-teal-500 to-cyan-500',
    purple: 'from-purple-500 to-pink-500',
    blue: 'from-blue-500 to-indigo-500',
    'blue-in': 'from-blue-600 to-blue-400',
    'blue-out': 'from-indigo-500 to-blue-500',
    green: 'from-green-500 to-emerald-500',
    'green-out': 'from-emerald-500 to-green-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color] || colorClasses.blue} rounded-xl p-3 shadow-lg`}>
      <p className="text-white/80 text-xs font-medium">{icon} {title}</p>
      {subtitle && <p className="text-white/60 text-xs">{subtitle}</p>}
      <p className="text-white text-xl font-bold mt-1">
        {typeof value === 'number' ? value.toFixed(2) : value} <span className="text-sm">{unit}</span>
      </p>
    </div>
  );
};


// ============================================================
// 模块一：实时监控
// ============================================================
const RealtimeSection = ({ currentData, error }) => {
  return (
    <SectionContainer>
      <SectionTitle 
        icon="⚡" 
        title="实时监控" 
        subtitle={currentData.timestamp ? `最后更新: ${new Date(currentData.timestamp).toLocaleTimeString('zh-CN')}` : '等待数据...'}
      />
      
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：数据卡片 - 占1列 */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-gray-400 text-xs font-medium">功率数据 (kW)</h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniStatCard title="Solar" value={currentData.solar} icon="☀️" color="yellow" />
            <MiniStatCard title="Load" value={currentData.load} icon="🏠" color="purple" />
            <MiniStatCard title="Batt In" value={currentData.battery_charge} icon="🔋↓" color="cyan" />
            <MiniStatCard title="Batt Out" value={currentData.battery_discharge} icon="🔋↑" color="cyan" />
            <MiniStatCard title="Grid In" value={currentData.grid_import} icon="⬇️" color="blue" />
            <MiniStatCard title="Grid Out" value={currentData.grid_export} icon="⬆️" color="green" />
          </div>
          
          <h3 className="text-gray-400 text-xs font-medium">电池状态</h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniStatCard title="SOC INV" value={currentData.soc_inv} icon="📊" color="green" unit="%" />
            <MiniStatCard title="SOC BMS" value={currentData.soc_bms} icon="📈" color="green" unit="%" />
          </div>
        </div>

        {/* 右侧：Sankey图 - 占2列 */}
        <div className="lg:col-span-2 bg-gray-800/50 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm font-medium mb-2">能量流向</h3>
          <SankeyFlow data={currentData} height={320} instanceId="realtime" />
        </div>
      </div>
    </SectionContainer>
  );
};

// 紧凑版状态卡片
const MiniStatCard = ({ title, value, icon, color, unit = "kW" }) => {
  const colorClasses = {
    yellow: 'bg-yellow-500/20 text-yellow-400',
    purple: 'bg-purple-500/20 text-purple-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
  };

  return (
    <div className={`${colorClasses[color] || colorClasses.blue} rounded-lg p-2`}>
      <p className="text-xs opacity-80">{icon} {title}</p>
      <p className="text-white text-lg font-bold">
        {typeof value === 'number' ? value.toFixed(2) : value}
        <span className="text-xs ml-1 opacity-70">{unit}</span>
      </p>
    </div>
  );
};


// ============================================================
// 模块二：历史统计
// ============================================================
const StatisticsSection = ({ dailyData, isLoading, startDate, endDate, onStartDateChange, onEndDateChange, onApply }) => {
  const [viewMode, setViewMode] = useState('chart');
  
  // 当数据变化时，多天默认显示柱状图，单天默认显示sankey
  useEffect(() => {
    if (dailyData.length === 1) {
      setViewMode('sankey');
    } else if (dailyData.length > 1) {
      setViewMode('chart');
    }
  }, [dailyData.length]);

  // 计算汇总
  const totals = dailyData.reduce((acc, d) => ({
    solar: acc.solar + (d.solar_kwh || 0),
    load: acc.load + (d.load_kwh || 0),
    battery_charge: acc.battery_charge + (d.battery_charge_kwh || 0),
    battery_discharge: acc.battery_discharge + (d.battery_discharge_kwh || 0),
    grid_import: acc.grid_import + (d.grid_import_kwh || 0),
    grid_export: acc.grid_export + (d.grid_export_kwh || 0),
  }), { solar: 0, load: 0, battery_charge: 0, battery_discharge: 0, grid_import: 0, grid_export: 0 });

  const chartData = dailyData.map(d => ({
    date: d.date?.slice(5) || '',
    solar: d.solar_kwh || 0,
    load: d.load_kwh || 0,
    gridExport: d.grid_export_kwh || 0,
    gridImport: d.grid_import_kwh || 0,
    batteryCharge: d.battery_charge_kwh || 0,
    batteryDischarge: d.battery_discharge_kwh || 0,
  }));

  const dateRangeText = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;

  return (
    <SectionContainer>
      <SectionTitle 
        icon="📊" 
        title="历史统计" 
        subtitle={`查询范围: ${dateRangeText}`}
      />

      {/* 日期选择器 */}
      <div className="mb-6">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onApply={onApply}
        />
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">加载中...</div>
      ) : !dailyData || dailyData.length === 0 ? (
        <div className="text-gray-400 text-center py-12">暂无数据</div>
      ) : (
        <>
          {/* 汇总数据卡片 */}
          <div className="mb-6">
            <h3 className="text-gray-400 text-sm font-medium mb-3">
              {dailyData.length === 1 ? '当日统计 (kWh)' : `${dailyData.length}天汇总 (kWh)`}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-yellow-500/20 rounded-lg p-3">
                <div className="text-yellow-400 text-xs">☀️ Solar</div>
                <div className="text-white text-xl font-bold">{totals.solar.toFixed(2)}</div>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-3">
                <div className="text-purple-400 text-xs">🏠 Load</div>
                <div className="text-white text-xl font-bold">{totals.load.toFixed(2)}</div>
              </div>
              <div className="bg-cyan-500/20 rounded-lg p-3">
                <div className="text-cyan-400 text-xs">🔋↓ Charge</div>
                <div className="text-white text-xl font-bold">{totals.battery_charge.toFixed(2)}</div>
              </div>
              <div className="bg-cyan-500/20 rounded-lg p-3">
                <div className="text-cyan-400 text-xs">🔋↑ Discharge</div>
                <div className="text-white text-xl font-bold">{totals.battery_discharge.toFixed(2)}</div>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-3">
                <div className="text-blue-400 text-xs">⬇️ Grid Import</div>
                <div className="text-white text-xl font-bold">{totals.grid_import.toFixed(2)}</div>
              </div>
              <div className="bg-green-500/20 rounded-lg p-3">
                <div className="text-green-400 text-xs">⬆️ Grid Export</div>
                <div className="text-white text-xl font-bold">{totals.grid_export.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* 视图切换按钮 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 text-sm font-medium">
              {dailyData.length > 1 ? '详细数据' : '能量分布'}
            </h3>
            <div className="flex gap-2">
              {dailyData.length > 1 && (
                <button
                  onClick={() => setViewMode('chart')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    viewMode === 'chart' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  📊 柱状图
                </button>
              )}
              <button
                onClick={() => setViewMode('sankey')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'sankey' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⚡ 能量流向
              </button>
            </div>
          </div>

          {/* 柱状图（多天且选择chart时显示） */}
          {dailyData.length > 1 && viewMode === 'chart' && (
            <div className="bg-gray-800/50 rounded-xl p-4">
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
          )}

          {/* Sankey图（选择sankey时显示） */}
          {viewMode === 'sankey' && (
            <div className="bg-gray-800/50 rounded-xl p-4">
              <SankeyFlow 
                data={{
                  solar: totals.solar,
                  load: totals.load,
                  battery_charge: totals.battery_charge,
                  battery_discharge: totals.battery_discharge,
                  grid_import: totals.grid_import,
                  grid_export: totals.grid_export,
                  battery_net: totals.battery_charge - totals.battery_discharge,
                }}
                unit="kWh"
                height={420}
                instanceId="history"
              />
            </div>
          )}
        </>
      )}
    </SectionContainer>
  );
};


// ============================================================
// 模块三：曲线图
// ============================================================
const ChartSection = ({ historicalData, startDate, endDate }) => {
  const dateRangeText = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;

  return (
    <SectionContainer>
      <SectionTitle 
        icon="📈" 
        title="功率曲线" 
        subtitle={`时间范围: ${dateRangeText} | 数据点: ${historicalData.length}`}
      />

      {historicalData.length === 0 ? (
        <div className="text-gray-400 text-center py-12">暂无数据</div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" fontSize={11} />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend />
              <Line type="monotone" dataKey="solar" stroke="#FCD34D" strokeWidth={2} dot={false} name="Solar (kW)" />
              <Line type="monotone" dataKey="load" stroke="#A78BFA" strokeWidth={2} dot={false} name="Load (kW)" />
              <Line type="monotone" dataKey="battery" stroke="#22D3EE" strokeWidth={2} dot={false} name="Battery (kW)" />
              <Line type="monotone" dataKey="grid" stroke="#60A5FA" strokeWidth={2} dot={false} name="Grid (kW)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionContainer>
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

  // 实时数据轮询
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

  // 获取每日统计数据
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

  // 获取历史曲线数据
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

  // 初始加载
  useEffect(() => {
    fetchDailyRange();
  }, [fetchDailyRange]);

  // 查询按钮处理
  const handleApply = () => {
    fetchDailyRange();
    fetchHistoryRange();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* 头部 */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            ☀️ Growatt Solar Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm ${currentData.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {currentData.connected ? '● 已连接' : '○ 未连接'}
            </span>
          </div>
        </div>
      </div>

      {/* 三个模块 */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 模块一：实时监控 */}
        <RealtimeSection currentData={currentData} error={error} />

        {/* 模块二：历史统计 */}
        <StatisticsSection 
          dailyData={dailyData}
          isLoading={dailyLoading}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={handleApply}
        />

        {/* 模块三：曲线图 */}
        <ChartSection 
          historicalData={historicalData}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* 底部 */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-gray-500 text-sm">
        Growatt Solar Monitor | API: {API_BASE}
      </div>
    </div>
  );
}

export default App;
