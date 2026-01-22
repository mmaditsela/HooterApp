import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Driver } from '../models/driver.model';
import { GroupRoutes } from '../models/group-routes.model';
import { Passenger } from '../models/passenger.model';
import { Route, RouteState } from '../models/route.model';

@Injectable({ providedIn: 'root' })
export class RoutesService {
  private drivers: Driver[] = [];
  private groups: GroupRoutes[] = [];
  private passengers: Passenger[] = [];
  private routes: Route[] = [];
  private activeRouteSubject = new BehaviorSubject<string | null>(null);
  public activeRoute$ = this.activeRouteSubject.asObservable();

  constructor() {
    this.seedData();
  }

  // Simple GUID generator
  private guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private kmToLat(km: number) {
    return km / 111.0; // approximate
  }

  private kmToLng(km: number, lat: number) {
    return km / (111.320 * Math.cos((lat * Math.PI) / 180));
  }

  private randomOffsetKmFrom(lat: number, lng: number, km: number) {
    const angle = Math.random() * Math.PI * 2;
    const dy = Math.cos(angle) * km;
    const dx = Math.sin(angle) * km;
    return {
      lat: lat + this.kmToLat(dy),
      lng: lng + this.kmToLng(dx, lat),
    };
  }

  private seedData() {
    // Create 3 drivers with dummy coordinates around Fourways, South Africa
    // Base coordinates: -26.005°, 28.0038889°
    for (let i = 0; i < 3; i++) {
      const d: Driver = {
        id: this.guid(),
        name: ['John', 'Sarah', 'Alex'][i % 3],
        surname: ['Doe', 'Smith', 'Brown'][i % 3],
        location: {
          lat: -26.005 + (Math.random() - 0.5) * 0.05, // ~5km radius
          lng: 28.0038889 + (Math.random() - 0.5) * 0.05,
        },
        contact: {
          phone: `+27-7${Math.floor(Math.random() * 10)}-000-${String(i).padStart(4, '0')}`,
          email: `driver${i}@example.com`,
        },
      };
      this.drivers.push(d);
    }

    // Create groups and routes
    for (let i = 0; i < 6; i++) {
      const g: GroupRoutes = {
        id: this.guid(),
        name: `Route ${i + 1}`,
        startTime: `${7 + (i % 8)}:00`,
        endTime: `${8 + (i % 8)}:00`,
        activeDays: i % 2 === 0 ? ['Mon', 'Wed', 'Fri'] : ['Tue', 'Thu'],
        joiningCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      };
      this.groups.push(g);

      let driver = this.drivers[0]; // Assign all routes to driver0 first

      // Distribute route states: Active, Not-Active, Completed, then repeat
      const routeStates: RouteState[] = ['Active', 'Not-Active', 'Completed'];
      const routeState = routeStates[i % 3];

      const r: Route = {
        routeId: this.guid(),
        driverId: driver.id,
        groupId: g.id,
        routeState,
      };

      this.routes.push(r);

      // Create 3 passengers per group
      for (let p = 0; p < 3; p++) {
        const pickup = this.randomOffsetKmFrom(driver.location.lat, driver.location.lng, 3);
        const dropoff = this.randomOffsetKmFrom(pickup.lat, pickup.lng, 6);
        const statuses = ['ready', 'not-ready', 'absent', 'unset'];
        const passenger: Passenger = {
          id: this.guid(),
          groupId: g.id,
          nameSurname: `Passenger ${i + 1}-${p + 1}`,
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          contact: { phone: `+27-7${Math.floor(Math.random() * 10)}-100-${String(i).padStart(2, '0')}${String(p).padStart(2, '0')}`, email: `pass${i}${p}@example.com` },
          status: statuses[p % statuses.length] as any,
        };
        this.passengers.push(passenger);
      }
    }
  }

  getDrivers(): Driver[] {
    return this.drivers.slice();
  }

  getGroups(): GroupRoutes[] {
    return this.groups.slice();
  }

  getPassengers(): Passenger[] {
    return this.passengers.slice();
  }

  getRoutes(): Route[] {
    return this.routes.slice();
  }

  // Helpers to resolve relations
  getDriverById(id: string): Driver | undefined {
    return this.drivers.find(d => d.id === id);
  }

  getGroupById(id: string): GroupRoutes | undefined {
    return this.groups.find(g => g.id === id);
  }

  getPassengersByGroup(groupId: string): Passenger[] {
    return this.passengers.filter(p => p.groupId === groupId);
  }

  // Route activation/completion management
  getActiveRoute(): string | null {
    return this.activeRouteSubject.value;
  }

  activateRoute(routeId: string, driverId: string): boolean {
    // Check if driver already has an active route
    const currentActiveRoute = this.activeRouteSubject.value;
    if (currentActiveRoute) {
      const activeRoute = this.routes.find(r => r.routeId === currentActiveRoute);
      if (activeRoute && activeRoute.driverId === driverId && activeRoute.routeState !== 'Completed') {
        console.warn('Driver already has an active route');
        return false;
      }
    }

    const route = this.routes.find(r => r.routeId === routeId);
    if (route && route.driverId === driverId) {
      route.routeState = 'Active';
      this.activeRouteSubject.next(routeId);
      return true;
    }
    return false;
  }

  completeRoute(routeId: string): boolean {
    const route = this.routes.find(r => r.routeId === routeId);
    if (route) {
      route.routeState = 'Completed';
      this.activeRouteSubject.next(null);
      return true;
    }
    return false;
  }

  getRouteById(routeId: string): Route | undefined {
    return this.routes.find(r => r.routeId === routeId);
  }
}
