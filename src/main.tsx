import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AtelierExperience from './components/AtelierExperience';
import { lazy, Suspense } from 'react';
import './index.css';
import './mobile.css';
import './invoice-stationery.css';
import './order-receipt.css';

const BoutiqueLanding = lazy(() => import('./components/BoutiqueLanding'));
const App = lazy(() => import('./App.tsx'));
const isBoutique = /^\/boutique(?:\.html|\/)?$/.test(window.location.pathname) || (window.location.pathname === '/' && !new URLSearchParams(window.location.search).has('espace'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtelierExperience><Suspense fallback={<div className="boot-screen" role="status">Un instant de douceur…</div>}>
      {isBoutique ? <BoutiqueLanding /> : <App />}
    </Suspense></AtelierExperience>
  </StrictMode>,
);
