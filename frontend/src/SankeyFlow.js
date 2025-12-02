import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ============================================================
// D3 Sankey 图组件
// ============================================================
const SankeyFlow = ({ data, title = "能量流向", unit = "kW", height = 420, instanceId = "default" }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(700);

  const { 
    solar = 0, 
    battery_discharge = 0, 
    grid_import = 0, 
    battery_charge = 0, 
    load = 0, 
    grid_export = 0, 
    battery_net = 0 
  } = data || {};

  // 计算电池净值：避免同时显示充电和放电
  // 如果有 battery_net，用它来决定方向
  // 否则用 battery_charge 和 battery_discharge 的差值
  let batteryIn = 0;
  let batteryOut = 0;
  
  if (battery_net !== undefined && Math.abs(battery_net) > 0.001) {
    // 有 battery_net 值，用它决定方向
    if (battery_net > 0) {
      batteryIn = battery_net;  // 正值表示充电
      batteryOut = 0;
    } else {
      batteryIn = 0;
      batteryOut = -battery_net;  // 负值表示放电
    }
  } else {
    // 没有 battery_net，用充放电差值
    const netCharge = battery_charge - battery_discharge;
    if (netCharge > 0.001) {
      batteryIn = netCharge;  // 净充电
      batteryOut = 0;
    } else if (netCharge < -0.001) {
      batteryIn = 0;
      batteryOut = -netCharge;  // 净放电
    } else {
      // 充放电基本相等，都显示为0
      batteryIn = 0;
      batteryOut = 0;
    }
  }

  // 总输入和总输出
  const totalInput = solar + batteryOut + grid_import;
  const totalOutput = load + batteryIn + grid_export;

  // 节点颜色
  const nodeColors = {
    "Solar": "#FCD34D",
    "Battery Out": "#22D3EE",
    "Grid In": "#60A5FA",
    "Battery In": "#22D3EE",
    "Load": "#A78BFA",
    "Grid Out": "#34D399",
  };

  // 节点原始值
  const nodeValues = {
    "Solar": solar,
    "Battery Out": batteryOut,
    "Grid In": grid_import,
    "Battery In": batteryIn,
    "Load": load,
    "Grid Out": grid_export,
  };

  // 节点百分比
  const nodePercentages = {
    "Solar": totalInput > 0 ? (solar / totalInput * 100).toFixed(1) : "0.0",
    "Battery Out": totalInput > 0 ? (batteryOut / totalInput * 100).toFixed(1) : "0.0",
    "Grid In": totalInput > 0 ? (grid_import / totalInput * 100).toFixed(1) : "0.0",
    "Battery In": totalOutput > 0 ? (batteryIn / totalOutput * 100).toFixed(1) : "0.0",
    "Load": totalOutput > 0 ? (load / totalOutput * 100).toFixed(1) : "0.0",
    "Grid Out": totalOutput > 0 ? (grid_export / totalOutput * 100).toFixed(1) : "0.0",
  };

  // 计算流向
  let solarToLoad, solarToBatteryIn, solarToGridOut;
  let batteryOutToLoad, batteryOutToBatteryIn, batteryOutToGridOut;
  let gridInToLoad, gridInToBatteryIn;

  if (totalInput > 0.001 && totalOutput > 0.001) {
    const loadRatio = load / totalOutput;
    const batteryInRatio = batteryIn / totalOutput;
    const gridOutRatio = grid_export / totalOutput;

    solarToLoad = solar * loadRatio;
    solarToBatteryIn = solar * batteryInRatio;
    solarToGridOut = solar * gridOutRatio;

    batteryOutToLoad = batteryOut * loadRatio;
    batteryOutToBatteryIn = batteryOut * batteryInRatio;
    batteryOutToGridOut = batteryOut * gridOutRatio;

    gridInToLoad = grid_import * loadRatio;
    gridInToBatteryIn = grid_import * batteryInRatio;
  } else {
    solarToLoad = solarToBatteryIn = solarToGridOut = 0;
    batteryOutToLoad = batteryOutToBatteryIn = batteryOutToGridOut = 0;
    gridInToLoad = gridInToBatteryIn = 0;
  }

  // 监听容器宽度变化
  const initialWidthRef = useRef(null);
  
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    
    if (isMobile) {
      // 手机上直接用屏幕宽度减去 padding
      const mobileWidth = window.innerWidth - 80;
      setContainerWidth(mobileWidth);
      initialWidthRef.current = mobileWidth;
    } else {
      // 电脑上：延迟获取容器宽度，等布局稳定
      const updateWidth = () => {
        if (containerRef.current) {
          const width = containerRef.current.getBoundingClientRect().width;
          if (width > 100) { // 确保宽度合理
            setContainerWidth(width);
            initialWidthRef.current = width;
          }
        }
      };
      
      // 立即尝试一次
      updateWidth();
      
      // 延迟再试几次，确保布局稳定
      const timer1 = setTimeout(updateWidth, 100);
      const timer2 = setTimeout(updateWidth, 300);
      const timer3 = setTimeout(updateWidth, 500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
    
    // 监听窗口 resize
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        const mobileWidth = window.innerWidth - 80;
        setContainerWidth(mobileWidth);
      } else if (containerRef.current) {
        const width = containerRef.current.getBoundingClientRect().width;
        if (width > 100) {
          setContainerWidth(width);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // D3 绘制
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 15, right: 20, bottom: 15, left: 20 };
    const width = containerWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", containerWidth)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 定义节点：左边3个输入，右边3个输出
    // 节点宽度根据容器宽度自适应：小屏幕用更窄的节点
    const nodeWidth = Math.min(90, Math.max(60, containerWidth * 0.12));
    const nodeMinHeight = Math.min(50, (innerHeight - 30) / 3 - 10);
    
    // 计算左侧节点高度（按值比例，但有最小高度）
    const leftNodes = ["Solar", "Battery Out", "Grid In"];
    const rightNodes = ["Battery In", "Load", "Grid Out"];
    
    const leftTotal = Math.max(totalInput, 0.001);
    const rightTotal = Math.max(totalOutput, 0.001);
    
    const availableHeight = innerHeight - 30; // 留一些间距

    // 计算节点位置和大小
    const nodeData = [];
    
    // 节点间距 - 减小间距
    const nodeGap = 4;
    
    // 左侧节点
    let leftY = 0;
    leftNodes.forEach((name, i) => {
      const value = nodeValues[name];
      const ratio = leftTotal > 0 ? value / leftTotal : 0;
      const nodeMaxHeight = (innerHeight - 30) / 3;
      const h = Math.min(Math.max(ratio * availableHeight * 0.8, nodeMinHeight), nodeMaxHeight);
      nodeData.push({
        name,
        x: 0,
        y: leftY,
        width: nodeWidth,
        height: h,
        value,
        side: "left",
        color: nodeColors[name],
        percentage: nodePercentages[name],
      });
      leftY += h + nodeGap;
    });

    // 右侧节点
    let rightY = 0;
    rightNodes.forEach((name, i) => {
      const value = nodeValues[name];
      const ratio = rightTotal > 0 ? value / rightTotal : 0;
      const nodeMaxHeight = (innerHeight - 30) / 3;
      const h = Math.min(Math.max(ratio * availableHeight * 0.8, nodeMinHeight), nodeMaxHeight);
      nodeData.push({
        name,
        x: width - nodeWidth,
        y: rightY,
        width: nodeWidth,
        height: h,
        value,
        side: "right",
        color: nodeColors[name],
        percentage: nodePercentages[name],
      });
      rightY += h + nodeGap;
    });

    // 创建节点名到数据的映射
    const nodeMap = {};
    nodeData.forEach(n => { nodeMap[n.name] = n; });

    // 定义连接
    const linkData = [
      { source: "Solar", target: "Load", value: solarToLoad },
      { source: "Solar", target: "Battery In", value: solarToBatteryIn },
      { source: "Solar", target: "Grid Out", value: solarToGridOut },
      { source: "Battery Out", target: "Load", value: batteryOutToLoad },
      { source: "Battery Out", target: "Battery In", value: batteryOutToBatteryIn },
      { source: "Battery Out", target: "Grid Out", value: batteryOutToGridOut },
      { source: "Grid In", target: "Load", value: gridInToLoad },
      { source: "Grid In", target: "Battery In", value: gridInToBatteryIn },
    ].filter(l => l.value > 0.001);

    // 计算每个节点的流入/流出偏移
    const nodeSourceOffset = {};
    const nodeTargetOffset = {};
    nodeData.forEach(n => {
      nodeSourceOffset[n.name] = 0;
      nodeTargetOffset[n.name] = 0;
    });

    // 计算每个源节点的总流出值，用于计算连接线宽度比例
    const sourceFlowTotals = {};
    const targetFlowTotals = {};
    linkData.forEach(link => {
      sourceFlowTotals[link.source] = (sourceFlowTotals[link.source] || 0) + link.value;
      targetFlowTotals[link.target] = (targetFlowTotals[link.target] || 0) + link.value;
    });

    // 绘制渐变定义 - 从source颜色渐变到target颜色
    const defs = g.append("defs");
    
    linkData.forEach((link, i) => {
      const sourceNode = nodeMap[link.source];
      const targetNode = nodeMap[link.target];
      const gradientId = `gradient-${instanceId}-${i}`;
      
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");
      
      // 从source颜色渐变到target颜色
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", sourceNode.color)
        .attr("stop-opacity", 0.85);
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", targetNode.color)
        .attr("stop-opacity", 0.85);
    });
    
    // 为节点创建渐变定义
    nodeData.forEach((node, i) => {
      const nodeGradientId = `node-gradient-${instanceId}-${node.name.replace(/\s+/g, '-')}`;
      
      // 根据节点位置决定渐变方向
      const nodeGradient = defs.append("linearGradient")
        .attr("id", nodeGradientId)
        .attr("x1", node.side === "left" ? "0%" : "100%")
        .attr("x2", node.side === "left" ? "100%" : "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");
      
      // 主色调到稍亮的版本
      nodeGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", node.color)
        .attr("stop-opacity", 1);
      
      nodeGradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", d3.color(node.color).brighter(0.3))
        .attr("stop-opacity", 0.95);
      
      nodeGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", node.color)
        .attr("stop-opacity", 0.9);
    });

    // 计算并绘制连接
    linkData.forEach((link, i) => {
      const sourceNode = nodeMap[link.source];
      const targetNode = nodeMap[link.target];
      
      // 计算link的粗细：同时考虑源节点和目标节点的比例
      const sourceTotal = sourceFlowTotals[link.source] || link.value;
      const targetTotal = targetFlowTotals[link.target] || link.value;
      const sourceRatio = link.value / sourceTotal;
      const targetRatio = link.value / targetTotal;
      // 分别计算在源和目标节点的宽度
      const sourceWidth = Math.max(2, sourceRatio * (sourceNode.height - 10));
      const targetWidth = Math.max(2, targetRatio * (targetNode.height - 10));
      
      
      // 计算起点和终点
      const x0 = sourceNode.x + sourceNode.width;
      const y0 = sourceNode.y + nodeSourceOffset[link.source] + sourceWidth / 2 + 5;
      const x1 = targetNode.x;
      const y1 = targetNode.y + nodeTargetOffset[link.target] + targetWidth / 2 + 5;
      // 源端和目标端的上下边界
      const sy0 = y0 - sourceWidth / 2;
      const sy1 = y0 + sourceWidth / 2;
      const ty0 = y1 - targetWidth / 2;
      const ty1 = y1 + targetWidth / 2;
      
      // 更新偏移
      nodeSourceOffset[link.source] += sourceWidth;
      nodeTargetOffset[link.target] += targetWidth;

      // 绘制贝塞尔曲线
      const curvature = 0.5;
      const xi = d3.interpolateNumber(x0, x1);
      const x2 = xi(curvature);
      const x3 = xi(1 - curvature);
    
      
      // 绘制填充区域（四边形，用贝塞尔曲线连接）      
      g.append("path")
        .attr("d", `
          M${x0},${sy0}
          C${x2},${sy0} ${x3},${ty0} ${x1},${ty0}
          L${x1},${ty1}
          C${x3},${ty1} ${x2},${sy1} ${x0},${sy1}
          Z
        `)
        .attr("fill", `url(#gradient-${instanceId}-${i})`)
        .attr("opacity", 0.9);
    });

    // 绘制节点（使用渐变）
    nodeData.forEach(node => {
      const nodeG = g.append("g").attr("transform", `translate(${node.x},${node.y})`);
      const nodeGradientId = `node-gradient-${instanceId}-${node.name.replace(/\s+/g, '-')}`;
      
      // 节点矩形 - 使用渐变填充
      nodeG.append("rect")
        .attr("width", node.width)
        .attr("height", node.height)
        .attr("rx", 6)
        .attr("fill", `url(#${nodeGradientId})`);
      
      // 节点文字
      const textY = node.height / 2;
      
      nodeG.append("text")
        .attr("x", node.width / 2)
        .attr("y", textY - 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#F3F4F6")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .text(node.name);
      
      nodeG.append("text")
        .attr("x", node.width / 2)
        .attr("y", textY + 4)
        .attr("text-anchor", "middle")
        .attr("fill", "#FFFFFF")
        .attr("font-size", "13px")
        .attr("font-weight", "bold")
        .text(node.value.toFixed(2));
      
      nodeG.append("text")
        .attr("x", node.width / 2)
        .attr("y", textY + 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#E5E7EB")
        .attr("font-size", "10px")
        .text(`(${node.percentage}%)`);
    });

  }, [data, containerWidth, height, instanceId, unit, solar, batteryOut, grid_import, batteryIn, load, grid_export, totalInput, totalOutput, solarToLoad, solarToBatteryIn, solarToGridOut, batteryOutToLoad, batteryOutToBatteryIn, batteryOutToGridOut, gridInToLoad, gridInToBatteryIn, nodeColors, nodeValues, nodePercentages]);

  // 检查是否有能量流
  const hasFlow = totalInput > 0.001 || totalOutput > 0.001;

  if (!hasFlow) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        🌙 No energy flow
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height, overflow: "hidden" }}>
      <svg ref={svgRef} style={{ maxWidth: "100%", display: "block" }}></svg>
    </div>
  );
};

export default SankeyFlow;
