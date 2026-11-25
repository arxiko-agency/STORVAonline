import React from 'react';
import { createRoot } from 'react-dom/client';
import { Route } from '/home/claude/proj/src/routes/login.tsx';
window.__Route = Route;
createRoot(document.getElementById('root')).render(React.createElement(Route.options.component));
