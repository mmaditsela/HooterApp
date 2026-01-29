import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Driver } from '../models/driver.model';
import { GroupRoutes } from '../models/group-routes.model';
import { Passenger } from '../models/passenger.model';
import { Route, RouteState } from '../models/route.model';

@Injectable({ providedIn: 'root' })
export class RoutesService {
  private readonly DRIVERS_KEY = 'hooter_drivers';
  private readonly GROUPS_KEY = 'hooter_groups';
  private readonly PASSENGERS_KEY = 'hooter_passengers';
  private readonly ROUTES_KEY = 'hooter_routes';
  private readonly ACTIVE_ROUTE_KEY = 'hooter_active_route';

  private drivers: Driver[] = [];
  private groups: GroupRoutes[] = [];
  private passengers: Passenger[] = [];
  private routes: Route[] = [];
  private activeRouteSubject = new BehaviorSubject<string | null>(null);
  public activeRoute$ = this.activeRouteSubject.asObservable();

  constructor() {
    this.loadFromStorage();
    this.listenToStorageChanges();
  }

  private loadFromStorage() {
    // Try to load from localStorage first
    const driversJson = localStorage.getItem(this.DRIVERS_KEY);
    const groupsJson = localStorage.getItem(this.GROUPS_KEY);
    const passengersJson = localStorage.getItem(this.PASSENGERS_KEY);
    const routesJson = localStorage.getItem(this.ROUTES_KEY);
    const activeRouteId = localStorage.getItem(this.ACTIVE_ROUTE_KEY);

    if (driversJson && groupsJson && passengersJson && routesJson) {
      // Load existing data
      this.drivers = JSON.parse(driversJson);
      this.groups = JSON.parse(groupsJson);
      this.passengers = JSON.parse(passengersJson);
      this.routes = JSON.parse(routesJson).map((r: any) => ({
        ...r,
        completedAt: r.completedAt ? new Date(r.completedAt) : undefined
      }));
      this.activeRouteSubject.next(activeRouteId);
    } else {
      // First time - seed data
      this.seedData();
      this.saveToStorage();
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.DRIVERS_KEY, JSON.stringify(this.drivers));
    localStorage.setItem(this.GROUPS_KEY, JSON.stringify(this.groups));
    localStorage.setItem(this.PASSENGERS_KEY, JSON.stringify(this.passengers));
    localStorage.setItem(this.ROUTES_KEY, JSON.stringify(this.routes));
    const activeRoute = this.activeRouteSubject.value;
    if (activeRoute) {
      localStorage.setItem(this.ACTIVE_ROUTE_KEY, activeRoute);
    } else {
      localStorage.removeItem(this.ACTIVE_ROUTE_KEY);
    }
  }

  private listenToStorageChanges() {
    // Listen for changes from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.ACTIVE_ROUTE_KEY) {
        this.activeRouteSubject.next(event.newValue);
      } else if (event.key === this.DRIVERS_KEY || event.key === this.GROUPS_KEY || 
                 event.key === this.PASSENGERS_KEY || event.key === this.ROUTES_KEY) {
        // Reload data when other tabs make changes
        this.loadFromStorage();
      }
    });
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
    const carColors = ['White', 'Black', 'Silver'];
    const carRegs = ['ABC 123 GP', 'XYZ 456 GP', 'DEF 789 GP'];
    
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
        car: {
          registration: carRegs[i],
          color: carColors[i],
          numberOfPassengers: 4 + i, // 4, 5, 6 passengers
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

      // Add completion date for completed routes (simulate past trips)
      if (routeState === 'Completed') {
        const daysAgo = (i === 2) ? 2 : 5; // Route 3 completed 2 days ago, Route 6 completed 5 days ago
        const completedDate = new Date();
        completedDate.setDate(completedDate.getDate() - daysAgo);
        r.completedAt = completedDate;
      }

      this.routes.push(r);

      // Create 3 passengers per group
      for (let p = 0; p < 3; p++) {
        const pickup = this.randomOffsetKmFrom(driver.location.lat, driver.location.lng, 3);
        const dropoff = this.randomOffsetKmFrom(pickup.lat, pickup.lng, 6);
        const passenger: Passenger = {
          id: this.guid(),
          groupId: g.id,
          nameSurname: `Passenger ${i + 1}-${p + 1}`,
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          contact: { phone: `+27-7${Math.floor(Math.random() * 10)}-100-${String(i).padStart(2, '0')}${String(p).padStart(2, '0')}`, email: `pass${i}${p}@example.com` },
          status: 'unset',
        };

        // Add pickup/dropoff times for completed routes
        if (routeState === 'Completed' && r.completedAt) {
          const pickupTime = new Date(r.completedAt);
          pickupTime.setHours(7 + (i % 8), 5 + p * 2, 0); // Stagger pickup times
          passenger.actualPickupTime = pickupTime;
          
          const dropoffTime = new Date(pickupTime);
          dropoffTime.setMinutes(dropoffTime.getMinutes() + 15 + p * 3); // 15-20 min trips
          passenger.actualDropoffTime = dropoffTime;
        }

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

  getGroupByJoiningCode(code: string): GroupRoutes | undefined {
    return this.groups.find(g => g.joiningCode === code);
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
      this.saveToStorage();
      return true;
    }
    return false;
  }

  completeRoute(routeId: string): boolean {
    const route = this.routes.find(r => r.routeId === routeId);
    if (route) {
      route.routeState = 'Completed';
      route.completedAt = new Date();
      this.activeRouteSubject.next(null);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  getRouteById(routeId: string): Route | undefined {
    return this.routes.find(r => r.routeId === routeId);
  }

  createRouteForDriver(driverId: string, groupData: {
    name: string;
    startTime: string;
    endTime: string;
    activeDays: string[];
  }): { route: Route; group: GroupRoutes } | null {
    const driver = this.getDriverById(driverId);
    if (!driver) {
      return null;
    }

    const group: GroupRoutes = {
      id: this.guid(),
      name: groupData.name,
      startTime: groupData.startTime,
      endTime: groupData.endTime,
      activeDays: groupData.activeDays,
      joiningCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    };

    const route: Route = {
      routeId: this.guid(),
      driverId,
      groupId: group.id,
      routeState: 'Not-Active',
    };

    this.groups.push(group);
    this.routes.push(route);
    this.saveToStorage();

    return { route, group };
  }

  addDriver(driver: Driver): void {
    this.drivers.push(driver);
    this.saveToStorage();
  }

  addPassenger(passenger: Passenger): void {
    this.passengers.push(passenger);
    this.saveToStorage();
  }

  getPassengerById(id: string): Passenger | undefined {
    return this.passengers.find(p => p.id === id);
  }

  updatePassengerStatus(passengerId: string, status: Passenger['status']): boolean {
    const passenger = this.passengers.find(p => p.id === passengerId);
    if (passenger) {
      passenger.status = status;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  setPassengerPickupTime(passengerId: string): void {
    const passenger = this.passengers.find(p => p.id === passengerId);
    if (passenger) {
      passenger.actualPickupTime = new Date();
      this.saveToStorage();
    }
  }

  setPassengerDropoffTime(passengerId: string): void {
    const passenger = this.passengers.find(p => p.id === passengerId);
    if (passenger) {
      passenger.actualDropoffTime = new Date();
      this.saveToStorage();
    }
  }

  updateDriver(driver: Driver): void {
    const index = this.drivers.findIndex(d => d.id === driver.id);
    if (index !== -1) {
      this.drivers[index] = driver;
      this.saveToStorage();
    }
  }

  updatePassenger(passenger: Passenger): void {
    const index = this.passengers.findIndex(p => p.id === passenger.id);
    if (index !== -1) {
      this.passengers[index] = passenger;
      this.saveToStorage();
    }
  }

  getPassengerTripHistory(passengerId: string): Array<{
    route: Route;
    group: GroupRoutes;
    driver: Driver;
    passenger: Passenger;
  }> {
    const passenger = this.getPassengerById(passengerId);
    if (!passenger) {
      return [];
    }

    // Find all completed routes for this passenger's group
    const completedRoutes = this.routes.filter(
      r => r.groupId === passenger.groupId && r.routeState === 'Completed' && r.completedAt
    );

    // Sort by completion date (most recent first)
    const sortedRoutes = completedRoutes.sort((a, b) => {
      const dateA = a.completedAt?.getTime() || 0;
      const dateB = b.completedAt?.getTime() || 0;
      return dateB - dateA;
    });

    // Map to include all related data
    return sortedRoutes.map(route => ({
      route,
      group: this.getGroupById(route.groupId)!,
      driver: this.getDriverById(route.driverId)!,
      passenger: passenger
    }));
  }
}
