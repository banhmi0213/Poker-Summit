/** Isolated test bundle only; actual production admission component. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import Panel from '../../app/poker-ui/ring-admission-panel';
const id=/^\/poker-ring\/([a-f0-9-]{36})$/i.exec(location.pathname)?.[1]??null;
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1100,margin:'auto',padding:20}}><Panel enabled tableId={id}/></main>);
