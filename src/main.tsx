import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OverlayHUD from './OverlayHUD';
import "./styles/index.css";

const isOverlay = window.location.href.includes('overlay');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isOverlay ? <OverlayHUD /> : <App />}
  </React.StrictMode>
);