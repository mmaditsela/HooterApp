export type RouteState = 'Active' | 'Not-Active' | 'Completed';

export interface Route {
  routeId: string;
  driverId: string;
  groupId: string;
  routeState: RouteState;
}
