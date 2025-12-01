import React, { useState, useEffect } from 'react';

// 内联 SVG 天气图标组件
const WeatherIcons = {
  ClearDay: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <g>
        <circle cx="32" cy="32" r="10.5" fill="#fbbf24" stroke="#fbbf24" strokeWidth="0.5">
          <animate attributeName="r" values="10;11;10" dur="2s" repeatCount="indefinite"/>
        </circle>
        <g fill="none" stroke="#fbbf24" strokeLinecap="round" strokeWidth="2">
          <line x1="32" y1="15.71" x2="32" y2="11.21">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="43.52" y1="20.48" x2="46.7" y2="17.3">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="48.29" y1="32" x2="52.79" y2="32">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="43.52" y1="43.52" x2="46.7" y2="46.7">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="32" y1="48.29" x2="32" y2="52.79">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="20.48" y1="43.52" x2="17.3" y2="46.7">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="15.71" y1="32" x2="11.21" y2="32">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
          <line x1="20.48" y1="20.48" x2="17.3" y2="17.3">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite"/>
          </line>
        </g>
      </g>
    </svg>
  ),
  
  ClearNight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <path fill="#fbbf24" d="M32 20c-6.627 0-12 5.373-12 12s5.373 12 12 12c2.54 0 4.894-.79 6.834-2.135a10.5 10.5 0 01-4.334.885c-5.799 0-10.5-4.701-10.5-10.5 0-5.799 4.701-10.5 10.5-10.5 1.656 0 3.22.384 4.611 1.068A11.943 11.943 0 0032 20z">
        <animate attributeName="opacity" values="1;0.8;1" dur="3s" repeatCount="indefinite"/>
      </path>
      <circle cx="48" cy="24" r="1.5" fill="#fbbf24">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="42" cy="18" r="1" fill="#fbbf24">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" begin="0.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="50" cy="30" r="1" fill="#fbbf24">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" begin="1s" repeatCount="indefinite"/>
      </circle>
    </svg>
  ),
  
  Cloudy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <path fill="#94a3b8" d="M46.5 31.5h-.32a10.49 10.49 0 00-19.11-8 7 7 0 00-10.57 6 7.21 7.21 0 00.1 1.14A7.5 7.5 0 0018 45.5h28a7 7 0 000-14z">
        <animateTransform attributeName="transform" type="translate" values="0 0; -3 0; 0 0" dur="7s" repeatCount="indefinite"/>
      </path>
    </svg>
  ),
  
  Rainy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <path fill="#94a3b8" d="M46.5 31.5h-.32a10.49 10.49 0 00-19.11-8 7 7 0 00-10.57 6 7.21 7.21 0 00.1 1.14A7.5 7.5 0 0018 45.5h28a7 7 0 000-14z"/>
      <g fill="#3b82f6" stroke="#3b82f6" strokeLinecap="round" strokeWidth="2">
        <line x1="24.39" y1="43.03" x2="23.61" y2="47.97">
          <animate attributeName="y1" values="43;53;43" dur="1s" repeatCount="indefinite"/>
          <animate attributeName="y2" values="48;58;48" dur="1s" repeatCount="indefinite"/>
        </line>
        <line x1="31.39" y1="43.03" x2="30.61" y2="47.97">
          <animate attributeName="y1" values="43;53;43" dur="1s" begin="0.2s" repeatCount="indefinite"/>
          <animate attributeName="y2" values="48;58;48" dur="1s" begin="0.2s" repeatCount="indefinite"/>
        </line>
        <line x1="38.39" y1="43.03" x2="37.61" y2="47.97">
          <animate attributeName="y1" values="43;53;43" dur="1s" begin="0.4s" repeatCount="indefinite"/>
          <animate attributeName="y2" values="48;58;48" dur="1s" begin="0.4s" repeatCount="indefinite"/>
        </line>
      </g>
    </svg>
  ),
  
  Snowy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <path fill="#94a3b8" d="M46.5 31.5h-.32a10.49 10.49 0 00-19.11-8 7 7 0 00-10.57 6 7.21 7.21 0 00.1 1.14A7.5 7.5 0 0018 45.5h28a7 7 0 000-14z"/>
      <g fill="#bae6fd">
        <circle cx="24" cy="50" r="2">
          <animate attributeName="cy" values="45;55;45" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="32" cy="50" r="2">
          <animate attributeName="cy" values="45;55;45" dur="3s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;0" dur="3s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="40" cy="50" r="2">
          <animate attributeName="cy" values="45;55;45" dur="3s" begin="1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;0" dur="3s" begin="1s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
  ),
  
  Thunderstorm: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <path fill="#64748b" d="M46.5 31.5h-.32a10.49 10.49 0 00-19.11-8 7 7 0 00-10.57 6 7.21 7.21 0 00.1 1.14A7.5 7.5 0 0018 45.5h28a7 7 0 000-14z"/>
      <polygon fill="#fbbf24" points="30,36 26,44 30,44 28,54 36,42 32,42 34,36">
        <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite"/>
      </polygon>
    </svg>
  ),
  
  Fog: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32">
      <g stroke="#94a3b8" strokeLinecap="round" strokeWidth="3" fill="none">
        <line x1="17" y1="30" x2="47" y2="30">
          <animate attributeName="x1" values="17;15;17" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="47;49;47" dur="5s" repeatCount="indefinite"/>
        </line>
        <line x1="17" y1="38" x2="47" y2="38">
          <animate attributeName="x1" values="17;19;17" dur="5s" begin="0.3s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="47;45;47" dur="5s" begin="0.3s" repeatCount="indefinite"/>
        </line>
        <line x1="17" y1="46" x2="47" y2="46">
          <animate attributeName="x1" values="17;15;17" dur="5s" begin="0.6s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="47;49;47" dur="5s" begin="0.6s" repeatCount="indefinite"/>
        </line>
      </g>
    </svg>
  ),
};

const WeatherDisplay = ({ latitude: propLat, longitude: propLon }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState({ lat: propLat, lon: propLon });

  const isDaytime = () => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  };

  useEffect(() => {
    if (propLat && propLon) {
      setCoords({ lat: propLat, lon: propLon });
      return;
    }

    const cachedLat = localStorage.getItem('userLatitude');
    const cachedLon = localStorage.getItem('userLongitude');
    
    if (cachedLat && cachedLon) {
      console.log('Using cached location');
      setCoords({ lat: parseFloat(cachedLat), lon: parseFloat(cachedLon) });
      return;
    }

    if (navigator.geolocation) {
      console.log('Requesting user location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          console.log('Location obtained:', { lat, lon });
          
          setCoords({ lat, lon });
          localStorage.setItem('userLatitude', lat.toString());
          localStorage.setItem('userLongitude', lon.toString());
        },
        (error) => {
          console.warn('Geolocation error, weather display disabled:', error);
          setLoading(false);
        }
      );
    } else {
      console.warn('Geolocation not supported, weather display disabled');
      setLoading(false);
    }
  }, [propLat, propLon]);

  const fetchWeather = async () => {
    if (!coords.lat || !coords.lon) {
      return;
    }

    try {
      const cached = localStorage.getItem('weatherData');
      const cacheTime = localStorage.getItem('weatherCacheTime');
      
      const now = Date.now();
      const CACHE_DURATION = 60 * 60 * 1000;

      if (cached && cacheTime && (now - parseInt(cacheTime)) < CACHE_DURATION) {
        const cachedData = JSON.parse(cached);
        const source = cachedData.source === 'weatherapi' ? 'WeatherAPI.com' : 'Open-Meteo';
        console.log(`Using cached weather data (source: ${source})`);
        setWeather(cachedData);
        setLoading(false);
        return;
      }

      const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
      
      console.log('=== Weather API Debug ===');
      console.log('API Key configured:', apiKey ? `Yes (${apiKey.substring(0, 8)}...)` : 'No');
      console.log('Will use:', apiKey ? 'WeatherAPI.com' : 'Open-Meteo (fallback)');
      console.log('========================');
      
      let weatherData;
      
      if (apiKey) {
        console.log('Fetching weather from WeatherAPI.com for:', coords);
        const response = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${coords.lat},${coords.lon}&aqi=no`
        );
        
        if (!response.ok) {
          throw new Error('WeatherAPI request failed');
        }

        const data = await response.json();
        
        weatherData = {
          temperature: Math.round(data.current.temp_c),
          weatherCode: data.current.condition.code,
          weatherText: data.current.condition.text,
          isDay: data.current.is_day === 1,
          source: 'weatherapi',
          timestamp: now
        };
      } else {
        console.log('Fetching weather from Open-Meteo (fallback) for:', coords);
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`
        );
        
        if (!response.ok) {
          throw new Error('Open-Meteo API request failed');
        }

        const data = await response.json();
        
        weatherData = {
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: data.current.weather_code,
          isDay: data.current.is_day === 1,
          source: 'openmeteo',
          timestamp: now
        };
      }

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
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [coords]);

  if (loading) {
    return null;
  }

  if (!weather || !coords.lat || !coords.lon) {
    return null;
  }

  const getWeatherIcon = () => {
    const code = weather.weatherCode;
    const source = weather.source;
    const isDay = weather.isDay !== undefined ? weather.isDay : isDaytime();
    
    if (source === 'weatherapi') {
      if (code === 1000) return isDay ? <WeatherIcons.ClearDay /> : <WeatherIcons.ClearNight />;
      if ([1003, 1006, 1009].includes(code)) return <WeatherIcons.Cloudy />;
      if ([1030, 1135, 1147].includes(code)) return <WeatherIcons.Fog />;
      if ([1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code)) return <WeatherIcons.Rainy />;
      if ([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) return <WeatherIcons.Snowy />;
      if ([1087, 1273, 1276, 1279, 1282].includes(code)) return <WeatherIcons.Thunderstorm />;
    } else {
      if (code === 0 || code === 1) return isDay ? <WeatherIcons.ClearDay /> : <WeatherIcons.ClearNight />;
      if (code >= 2 && code <= 3) return <WeatherIcons.Cloudy />;
      if (code >= 45 && code <= 48) return <WeatherIcons.Fog />;
      if (code >= 51 && code <= 82) return <WeatherIcons.Rainy />;
      if (code >= 71 && code <= 86) return <WeatherIcons.Snowy />;
      if (code >= 95) return <WeatherIcons.Thunderstorm />;
    }
    
    return <WeatherIcons.Cloudy />;
  };

  const getWeatherDesc = () => {
    const code = weather.weatherCode;
    const source = weather.source;
    const isDay = weather.isDay !== undefined ? weather.isDay : isDaytime();
    
    if (source === 'weatherapi') {
      if (code === 1000) return isDay ? '晴' : '夜';
      if ([1003, 1006, 1009].includes(code)) return '云';
      if ([1030, 1135, 1147].includes(code)) return '雾';
      if ([1063, 1150, 1153, 1168, 1171, 1180, 1183, 1198, 1240].includes(code)) return '小雨';
      if ([1186, 1189, 1192, 1195, 1201, 1243, 1246].includes(code)) return '雨';
      if ([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) return '雪';
      if ([1087, 1273, 1276, 1279, 1282].includes(code)) return '雷暴';
    } else {
      if (code === 0 || code === 1) return isDay ? '晴' : '夜';
      if (code >= 2 && code <= 3) return '云';
      if (code >= 45 && code <= 48) return '雾';
      if (code >= 51 && code <= 55) return '小雨';
      if (code >= 61 && code <= 65) return '雨';
      if (code >= 71 && code <= 77) return '雪';
      if (code >= 80 && code <= 82) return '阵雨';
      if (code >= 85 && code <= 86) return '阵雪';
      if (code >= 95) return '雷暴';
    }
    
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
