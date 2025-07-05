import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import SplashScreen from './SplashScreen';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
        <SplashScreen>

    <App />
        </SplashScreen>

  </React.StrictMode>
);