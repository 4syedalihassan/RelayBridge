import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './SplashCard.css';

export function SplashCard() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing secure storage...');

  useEffect(() => {
    // Smooth progress increment
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 1;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        
        // Cycle status messages based on progress
        if (next === 20) {
          setStatus('Checking credential vault keys...');
        } else if (next === 50) {
          setStatus('Synchronizing compliance databases...');
        } else if (next === 85) {
          setStatus('Establishing secure bridge tunnel...');
        }
        
        return next;
      });
    }, 25); // ~2.5 seconds total

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      // Small pause at 100% for smooth user transition
      const timeout = setTimeout(() => {
        invoke('close_splashscreen').catch((err) => {
          console.error('Failed to close splash screen:', err);
        });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [progress]);

  return (
    <div className="splash-screen">
      <div className="splash-card">
        {/* Shield logo — matches app icon exactly */}
        <div className="logo-container">
          <svg width="80" height="80" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            {/* Shield body — flat-bottomed wide shield matching the icon */}
            <path
              d="M100 22 L168 52 V112 C168 156 100 180 100 180 C100 180 32 156 32 112 V52 Z"
              fill="#1e3a8a"
            />
            {/* Wave 1 — top flow line (biconvex lens shape) */}
            <path
              d="M 54,83 C 70,74 132,74 148,83 C 132,92 70,92 54,83 Z"
              fill="#e6a817"
            />
            {/* Wave 2 — middle flow line */}
            <path
              d="M 52,103 C 68,94 134,94 150,103 C 134,112 68,112 52,103 Z"
              fill="#e6a817"
            />
            {/* Wave 3 — bottom flow line (slightly narrower as shield tapers) */}
            <path
              d="M 58,123 C 72,114 130,114 144,123 C 130,132 72,132 58,123 Z"
              fill="#e6a817"
            />
          </svg>
        </div>

        {/* Typography */}
        <h1 className="splash-title">RelayBridge</h1>
        <p className="splash-subtitle">Discord-to-Global Relay Archival Bridge</p>

        {/* Loading Progress Section */}
        <div className="progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-status-container">
            <span className="status-text">{status}</span>
            <span className="version-text">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
