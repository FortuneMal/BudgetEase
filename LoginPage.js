import React from 'react';

export default function LoginPage({ onLogin }) {
  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>BudgetEase Login</h1>
      <input type="text" placeholder="Email" /><br/><br/>
      <input type="password" placeholder="Password" /><br/><br/>
      <button onClick={onLogin}>Login</button>
    </div>
  );
}