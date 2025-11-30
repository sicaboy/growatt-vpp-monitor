import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle, Wind, CloudFog } from 'lucide-react';

const WeatherDisplay = ({ latitude: propLat, longitude: propLon }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState({ lat: propLat, lon: propLon });

  // 获取用户位置
  useEffect(() => {
    // 如果已经提供了坐标，就不需要获取
    if (propLat && propLon) {
      setCoords({ lat: propLat, lon: propLon });
      return;
    }

    // 检查是否有缓存的位置
    const cachedLat = localStorage.getItem('userLatitude');
    const cachedLon = localStorage.getItem('userLongitude');
    
    if (cachedLat && cachedLon) {
      console.log('Using cached location');
      setCoords({ lat: parseFloat(cachedLat), lon: parseFloat(cachedLon) });
      return;
    }

    // 获取用户当前位置
    if (navigator.geolocation) {
      console.log('Requesting user location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          console.log('Location obtained:', { lat, lon });
          
          setCoords({ lat, lon });
          // 缓存位置，避免每次都请求
          localStorage.setItem('userLatitude', lat.toString());
          localStorage.setItem('userLongitude', lon.toString());
        },
        (error) => {
          console.warn('Geolocation error, weather display disabled:', error);
          setLoading(false); // 停止加载状态
          // 不设置坐标，组件将不显示
        }
      );
    } else {
      console.warn('Geolocation not supported, weather display disabled');
      setLoading(false); // 停止加载状态
      // 不设置坐标，组件将不显示
    }
  }, [propLat, propLon]);

  const fetchWeather = async () => {
    // 等待坐标获取完成
    if (!coords.lat || !coords.lon) {
      return;
    }

    try {
      const cached = localStorage.getItem('weatherData');
      const cacheTime = localStorage.getItem('weatherCacheTime');
      
      const now = Date.now();
      const CACHE_DURATION = 30 * 60 * 1000; // 30分钟

      if (cached && cacheTime && (now - parseInt(cacheTime)) < CACHE_DURATION) {
        console.log('Using cached weather data');
        setWeather(JSON.parse(cached));
        setLoading(false);
        return;
      }

      console.log('Fetching fresh weather data for:', coords);
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
      );
      
      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = await response.json();
      
      const weatherData = {
        temperature: Math.round(data.current.temperature_2m),
        weatherCode: data.current.weather_code,
        windSpeed: Math.round(data.current.wind_speed_10m),
        timestamp: now
      };

      localStorage.setItem('weatherData', JSON.stringify(weatherData));
      localStorage.setItem('weatherCacheTime', now.toString());

      setWeather(weatherData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching weather:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(() => {
      fetchWeather();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [coords]);

  if (loading) {
    return null; // 加载时不显示任何内容
  }

  if (!weather || !coords.lat || !coords.lon) {
    return null; // 没有天气数据或没有位置信息时不显示
  }

  const getWeatherIcon = () => {
    const code = weather.weatherCode;
    const iconProps = { size: 24, strokeWidth: 2 };
    
    if (code === 0 || code === 1) {
      return <Sun {...iconProps} style={{ color: '#FDB813' }} />;
    }
    if (code >= 2 && code <= 3) {
      return <Cloud {...iconProps} style={{ color: '#94A3B8' }} />;
    }
    if (code >= 45 && code <= 48) {
      return <CloudFog {...iconProps} style={{ color: '#94A3B8' }} />;
    }
    if (code >= 51 && code <= 55) {
      return <CloudDrizzle {...iconProps} style={{ color: '#60A5FA' }} />;
    }
    if (code >= 61 && code <= 82) {
      return <CloudRain {...iconProps} style={{ color: '#3B82F6' }} />;
    }
    if (code >= 71 && code <= 86) {
      return <CloudSnow {...iconProps} style={{ color: '#BAE6FD' }} />;
    }
    if (code >= 95) {
      return <Wind {...iconProps} style={{ color: '#8B5CF6' }} />;
    }
    return <Cloud {...iconProps} style={{ color: '#94A3B8' }} />;
  };

  const getWeatherDesc = () => {
    const code = weather.weatherCode;
    if (code === 0 || code === 1) return '晴';
    if (code >= 2 && code <= 3) return '云';
    if (code >= 45 && code <= 48) return '雾';
    if (code >= 51 && code <= 55) return '小雨';
    if (code >= 61 && code <= 65) return '雨';
    if (code >= 71 && code <= 77) return '雪';
    if (code >= 80 && code <= 82) return '阵雨';
    if (code >= 85 && code <= 86) return '阵雪';
    if (code >= 95) return '雷暴';
    return '云';
  };

  return (
    <div 
      className="absolute top-2 right-2 rounded-lg px-2.5 py-1.5" 
      style={{ zIndex: 10 }}
    >
      <div className="flex items-center gap-2">
        {getWeatherIcon()}
        <div className="flex flex-col">
          <div className="text-base font-bold text-white leading-tight">
            {weather.temperature}°C
          </div>
          <div className="text-xs text-gray-400 leading-tight">
            {getWeatherDesc()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherDisplay;
