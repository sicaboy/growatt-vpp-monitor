import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ============================================================
// 模块容器组件
// ============================================================
const SectionContainer = ({ children, className = "" }) => (
  <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-800 ${className}`}>
    {children}
  </div>
);

// ============================================================
// 模块标题组件
// ============================================================
const SectionTitle = ({ icon, title, subtitle }) => (
  <div className="mb-3">
    <h2 className="text-lg font-bold text-white flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <span>{title}</span>
    </h2>
    {subtitle && <p className="text-gray-400 text-xs">{subtitle}</p>}
  </div>
);

// ============================================================
// 模块三：曲线图
// ============================================================
const PowerChart = ({ historicalData, startDate, endDate }) => {
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

export default PowerChart;
