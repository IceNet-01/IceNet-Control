import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';
import { api } from './api';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Automation from './pages/Automation';
import Scenarios from './pages/Scenarios';
import Coordinations from './pages/Coordinations';
import Settings from './pages/Settings';

function App() {
  useWebSocket();
  const { setDevices, setRules, setWeather } = useStore();

  useEffect(() => {
    // Initial data fetch
    const fetchData = async () => {
      try {
        const [devices, rules, weather] = await Promise.all([
          api.getDevices(),
          api.getRules(),
          api.getWeather(),
        ]);
        setDevices(devices);
        setRules(rules);
        setWeather(weather);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [setDevices, setRules, setWeather]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/coordinations" element={<Coordinations />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
