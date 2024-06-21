import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import MainScreen from './components/MainScreen';
import { ThemeProvider } from './components/ThemeContext';
import { SettingsProvider } from './components/SettingsContext';

export default function App() {
  return (<SettingsProvider>
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainScreen />} />
        </Routes>
      </Router>
    </ThemeProvider>
  </SettingsProvider>);
}
