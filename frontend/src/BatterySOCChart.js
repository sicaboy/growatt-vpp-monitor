import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ============================================================
// 工具函数
// ============================================================
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================
// 模块容器组件
// ============================================================
const SectionContainer = ({ children, className = "" }) => (
  <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-800 ${className}`}>
    {children}
  </div>
);

// ============================================================
// 模块四：电池电量曲线
// ============================================================
const BatterySOCChart = ({ socData, startDate, endDate, onStartDateChange, onEndDateChange, onApply, isLoading }) => {
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const dateRangeText = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
  
  // 计算图表宽度：每个数据点 30px，24个点刚好一屏；超过24个才滚动
  const hoursCount = socData.length;
  const chartWidth = hoursCount * 30;
  const needsScroll = hoursCount > 24;
  
  // 数据加载完成后，滚动到最右端（最新数据）
  useEffect(() => {
    if (needsScroll && scrollContainerRef.current) {
      // 延迟一点确保图表已渲染
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [socData, needsScroll]);
  
  // 鼠标/触摸拖动处理
  const handleMouseDown = (e) => {
    if (!needsScroll) return;
    setIsDragging(true);
    setStartX(e.pageX || e.touches?.[0]?.pageX);
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX || e.touches?.[0]?.pageX;
    const walk = (startX - x) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft + walk;
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 格式化时间显示（只显示小时）
  const formatHour = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SectionContainer>
      {/* 标题和日期选择器 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔋</span>
          <div>
            <h2 className="text-lg font-bold text-white">电池电量曲线</h2>
            <p className="text-gray-400 text-xs">{dateRangeText} | 数据点: {socData.length}</p>
          </div>
        </div>
        
        {/* 日期选择器 */}
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
            onClick={() => onApply()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
          >
            查询
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              const todayStr = formatDate(now);
              const yesterdayStr = formatDate(yesterday);
              onStartDateChange(yesterdayStr);
              onEndDateChange(todayStr);
              onApply(yesterdayStr, todayStr, now.getTime() - 24 * 60 * 60 * 1000);
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            过去24小时
          </button>
          <button
            onClick={() => {
              const today = formatDate(new Date());
              const weekAgo = formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
              onStartDateChange(weekAgo);
              onEndDateChange(today);
              onApply(weekAgo, today);
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            过去7天
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-8">加载中...</div>
      ) : socData.length === 0 ? (
        <div className="text-gray-400 text-center py-8">暂无数据</div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl p-4">
          {/* 滚动提示 */}
          {needsScroll && (
            <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">
              <span>👆</span>
              <span>左右拖动查看更多数据</span>
            </div>
          )}
          
          {/* 可滚动的图表容器 */}
          <div 
            ref={scrollContainerRef}
            className={`overflow-x-auto ${needsScroll ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #1F2937'
            }}
          >
            {needsScroll ? (
              // 滚动模式：固定宽度
              <LineChart 
                data={socData} 
                width={chartWidth} 
                height={350}
                margin={{ top: 10, right: 30, left: 40, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9CA3AF" 
                  fontSize={10}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value) => [`${value}%`, 'SOC']}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="soc" 
                  stroke="#34D399" 
                  strokeWidth={2} 
                  dot={false} 
                  name="电池电量 (%)"
                  connectNulls
                />
              </LineChart>
            ) : (
              // 非滚动模式：响应式宽度
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={socData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9CA3AF" 
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value) => [`${value}%`, 'SOC']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="soc" 
                    stroke="#34D399" 
                    strokeWidth={2} 
                    dot={false} 
                    name="电池电量 (%)"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </SectionContainer>
  );
};

export default BatterySOCChart;
