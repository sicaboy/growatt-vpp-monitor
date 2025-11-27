# Growatt Solar Dashboard (React)

## 快速开始

### 1. 安装依赖

```bash
cd growatt-react-dashboard
npm install
```

### 2. 确保 API 服务器已启动

```bash
PORT=5001 python3 api_server.py
```

### 3. 启动 React 开发服务器

```bash
npm start
```

浏览器会自动打开 http://localhost:3000

## 配置

如果你的 API 服务器不在 `http://localhost:5001`，修改 `src/App.js` 第 8 行：

```javascript
const API_BASE = 'http://localhost:5001';  // 改成你的地址
```

## 功能

- ☀️ 实时 Sankey 能量流图
- 📊 电力统计卡片
- 📈 历史趋势图表
- 🔄 每 5 秒自动刷新
- 📱 响应式设计

## 技术栈

- React 18
- Recharts (图表库)
- Tailwind CSS (样式)
