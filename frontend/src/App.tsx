import {lazy,Suspense} from 'react';
import Landing from './Landing';
const Workspace=lazy(()=>import('./Workspace'));
export default function App(){const path=window.location.pathname;return path==='/app'||path==='/app/'?<Suspense fallback={<div className="loading-app" role="status">Opening your ShareShield workspace…</div>}><Workspace/></Suspense>:path==='/'?<Landing/>:<div className="loading-app"><h1>Page not found</h1><a href="/">Return to ShareShield</a></div>;}
