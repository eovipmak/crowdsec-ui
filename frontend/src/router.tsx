import type { RouteObject } from 'react-router-dom';
import App from './App';

/**
 * Route table for the SPA. task-09 exposes the layout + placeholder routing;
 * task-10 wires the six read-only pages (overview/alerts/decisions/machines/
 * bouncers/allowlists) onto the <App /> route tree.
 */
export const routes: RouteObject[] = [{ path: '*', element: <App /> }];
