import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Pages
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import PrescriptionAnalyzer from './pages/PrescriptionAnalyzer.jsx';
import SymptomChecker from './pages/SymptomChecker.jsx';
import Recommendations from './pages/Recommendations.jsx';
import CareNearMe from './pages/CareNearMe.jsx';
import Teleconsultation from './pages/Teleconsultation.jsx';
import History from './pages/History.jsx';
import ModelAnalytics from './pages/ModelAnalytics.jsx';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route
              path="/prescription"
              element={
                <ProtectedRoute>
                  <PrescriptionAnalyzer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/symptoms"
              element={
                <ProtectedRoute>
                  <SymptomChecker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <Recommendations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/care-near-me"
              element={
                <ProtectedRoute>
                  <CareNearMe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teleconsultation"
              element={
                <ProtectedRoute>
                  <Teleconsultation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <ModelAnalytics />
                </ProtectedRoute>
              }
            />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
