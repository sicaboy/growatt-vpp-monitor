import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SankeyFlow from './SankeyFlow';

// ============================================================
// 工具函数
// ============================================================
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getToday = () => formatDate(new Date());

// ============================================================
// 模块容器组件
// ============================================================
const SectionContainer = ({ children, className = "" }) => (
  <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-800 ${className}`}>
    {children}
  </div>
);

// ============================================================
// 模块二：历史统计
// ============================================================
const StatisticsSection = ({ dailyData, isLoading, startDate, endDate, onStartDateChange, onEndDateChange, onApply }) => {
  // 计算汇总
  const totals = dailyData.reduce((acc, d) => ({
    solar: acc.solar + (d.solar_kwh || 0),
    load: acc.load + (d.load_kwh || 0),
    battery_charge: acc.battery_charge + (d.battery_charge_kwh || 0),
    battery_discharge: acc.battery_discharge + (d.battery_discharge_kwh || 0),
    grid_import: acc.grid_import + (d.grid_import_kwh || 0),
    grid_export: acc.grid_export + (d.grid_export_kwh || 0),
  }), { solar: 0, load: 0, battery_charge: 0, battery_discharge: 0, grid_import: 0, grid_export: 0 });

  // 收支曲线图数据：In (Solar + Grid Import) vs Out (Load + Grid Export)
  const balanceChartData = dailyData.map(d => ({
    date: d.date?.slice(5) || '',
    energyIn: (d.solar_kwh || 0) + (d.grid_import_kwh || 0),
    energyOut: (d.load_kwh || 0) + (d.grid_export_kwh || 0),
  }));

  const dateRangeText = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
  const isMultiDay = dailyData.length > 1;

  // 快捷按钮处理函数
  const handleQuickSelect = (start, end) => {
    onStartDateChange(start);
    onEndDateChange(end);
    onApply(start, end);
  };

  return (
    <SectionContainer>
      {/* 标题和日期选择器在同一行 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <div>
            <h2 className="text-lg font-bold text-white">历史统计 History</h2>
            <p className="text-gray-400 text-xs">{dateRangeText}</p>
          </div>
        </div>
        
        {/* 紧凑版日期选择器 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-gray-400 text-xs">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => onApply(startDate, endDate)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
          >
            查询
          </button>
          <button
            onClick={() => {
              const today = getToday();
              handleQuickSelect(today, today);
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => {
              const today = formatDate(new Date());
              const weekAgo = formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
              handleQuickSelect(weekAgo, today);
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            过去7天
          </button>
          <button
            onClick={() => {
              const today = formatDate(new Date());
              const monthAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
              handleQuickSelect(monthAgo, today);
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            过去30天
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-8">加载中...</div>
      ) : !dailyData || dailyData.length === 0 ? (
        <div className="text-gray-400 text-center py-8">暂无数据</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Sankey 流向图 */}
          <div className="bg-gray-800/50 rounded-xl p-3">
            <h3 className="text-gray-400 text-xs font-medium mb-1">
              能量流向 <span className="text-gray-500">({isMultiDay ? `${dailyData.length}天汇总` : '当日'} kWh)</span>
            </h3>
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
              height={250}
              instanceId="history"
            />
          </div>

          {/* 曲线图 - 始终显示 */}
          <div className="bg-gray-800/50 rounded-xl p-3">
            <h3 className="text-gray-400 text-xs font-medium mb-1">
              每日能量收支 <span className="text-gray-500">(kWh)</span>
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={balanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value, name) => [
                    `${value.toFixed(2)} kWh`,
                    name === 'energyIn' ? '获取 (Solar + Grid In)' : '消耗 (Load + Grid Out)'
                  ]}
                />
                <Legend 
                  formatter={(value) => value === 'energyIn' ? '能量获取' : '能量消耗'}
                />
                <Line type="monotone" dataKey="energyIn" stroke="#FCD34D" strokeWidth={2} dot={{ fill: '#FCD34D', r: 4 }} name="energyIn" />
                <Line type="monotone" dataKey="energyOut" stroke="#A78BFA" strokeWidth={2} dot={{ fill: '#A78BFA', r: 4 }} name="energyOut" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </SectionContainer>
  );
};

export default StatisticsSection;
