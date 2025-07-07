import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return loggedIn ? <Dashboard /> : <LoginPage onLogin={() => setLoggedIn(true)} />;
}