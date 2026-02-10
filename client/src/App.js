// App.js - Version sans les fonctionnalités IA
import React from 'react';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import PrivateRoute from './auth/PrivateRoute';
import Login from './auth/LoginPage';
import MainLayout from './layout/MainLayout';

// Import des pages principales
import AdminDashboard from './pages/AdminDashboard';
import ContactsPage from './pages/ContactsPage';
import ProduitsPage from './pages/ProduitsPage';
import CommandesPage from './pages/CommandesPage';
import DocumentsListPage from './pages/DocumentsListPage';
import DocumentPage from './pages/DocumentPage';
import ProfilePage from './pages/ProfilePage';

// Import des pages IA (vous devez les créer)
import IADashboard from './pages/ia/IADashboard';
import IAChatPage from './pages/ia/IAChatPage';
import IAIntentsPage from './pages/ia/IAIntentsPage';
import IARulesPage from './pages/ia/IARulesPage';
import IAAnalyticsPage from './pages/ia/IAAnalyticsPage';
import IALearningPage from './pages/ia/IALearningPage';

function App() {
  return (
    <SnackbarProvider maxSnack={3}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Route publique - Page de connexion */}
            <Route path="/login" element={<Login />} />
            
            {/* Routes protégées - Layout principal */}
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <MainLayout />
                </PrivateRoute>
              }

              
            >
              {/* Redirection par défaut vers le tableau de bord */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              {/* Tableau de bord */}
              <Route path="dashboard" element={<AdminDashboard />} />
              
              {/* Gestion des contacts */}
              <Route path="contacts" element={<ContactsPage />} />
              
              {/* Gestion des produits */}
              <Route path="produits" element={<ProduitsPage />} />
              
              {/* Gestion des commandes */}
              <Route path="commandes" element={<CommandesPage />} />
              
              {/* Gestion des documents */}
              <Route path="documents" element={<DocumentsListPage />} />
              <Route path="documents/:id" element={<DocumentPage />} />

              <Route path="profile" element={<ProfilePage />} />

              {/* ==================== ROUTES IA ==================== */}
              
              {/* Dashboard IA */}
              <Route path="ia/dashboard" element={<IADashboard />} />
              
              {/* Chat IA */}
              <Route path="ia/chat" element={<IAChatPage />} />
              
              {/* Intentions d'achat */}
              <Route path="ia/intents" element={<IAIntentsPage />} />
              
              {/* Règles métier */}
              <Route path="ia/rules" element={<IARulesPage />} />
              
              {/* Analytics IA */}
              <Route path="ia/analytics" element={<IAAnalyticsPage />} />
              
              {/* Apprentissage IA */}
              <Route path="ia/learning" element={<IALearningPage />} />

              
              {/* Routes supplémentaires (si existantes) */}
              
              {/* <Route path="parametres" element={<SettingsPage />} /> */}
              {/* <Route path="rapports" element={<ReportsPage />} /> */}
              {/* <Route path="utilisateurs" element={<UsersPage />} /> */}
              
            </Route>
            
            {/* Gestion des erreurs 404 - Redirection vers le tableau de bord */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </SnackbarProvider>
  );
}

export default App;