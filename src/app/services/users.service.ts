import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { Driver } from '../models/driver.model';
import { Passenger } from '../models/passenger.model';
import { Route } from '../models/route.model';
import { RoutesService } from './routes.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly USERS_KEY = 'hooter_users';
  private readonly LOGGED_IN_USER_KEY = 'hooter_logged_in_user';

  private users: User[] = [];
  private loggedInUserSubject = new BehaviorSubject<User | null>(null);
  public loggedInUser$ = this.loggedInUserSubject.asObservable();

  constructor(private routesService: RoutesService) {
    this.loadFromStorage();
    this.listenToStorageChanges();
  }

  private loadFromStorage() {
    const usersJson = localStorage.getItem(this.USERS_KEY);
    const loggedInUserJson = localStorage.getItem(this.LOGGED_IN_USER_KEY);

    if (usersJson) {
      this.users = JSON.parse(usersJson);
    } else {
      // First time - seed users
      this.seedUsers();
      this.saveToStorage();
    }

    if (loggedInUserJson) {
      const user = JSON.parse(loggedInUserJson);
      this.loggedInUserSubject.next(user);
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users));
    const loggedInUser = this.loggedInUserSubject.value;
    if (loggedInUser) {
      localStorage.setItem(this.LOGGED_IN_USER_KEY, JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem(this.LOGGED_IN_USER_KEY);
    }
  }

  private listenToStorageChanges() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.LOGGED_IN_USER_KEY) {
        const user = event.newValue ? JSON.parse(event.newValue) : null;
        this.loggedInUserSubject.next(user);
      } else if (event.key === this.USERS_KEY) {
        this.loadFromStorage();
      }
    });
  }

  private seedUsers() {
    // Create users mapped to drivers
    const drivers = this.routesService.getDrivers();
    
    drivers.forEach((driver, index) => {
      const user: User = {
        id: `user-${index}`,
        username: `driver${index}`, // e.g. driver0, driver1, driver2
        password: 'password', // demo password - same for all drivers
        driverId: driver.id,
        driver: driver,
        role: 'driver',
        createdAt: new Date(),
      };
      this.users.push(user);
    });

    // Create users mapped to passengers
    const passengers = this.routesService.getPassengers();
    passengers.forEach((passenger, index) => {
      const user: User = {
        id: `user-passenger-${index}`,
        username: `passenger${index}`, // e.g. passenger0, passenger1, passenger2
        password: 'password', // demo password - same for all passengers
        passengerId: passenger.id,
        role: 'passenger',
        createdAt: new Date(),
      };
      this.users.push(user);
    });
  }

  /**
   * Login with username and password
   * Demo users: driver0/password, driver1/password, driver2/password
   */
  login(username: string, password: string): Observable<boolean> {
    return new Observable(observer => {
      const user = this.users.find(u => u.username === username && u.password === password);
      
      if (user) {
        this.loggedInUserSubject.next(user);
        this.saveToStorage();
        observer.next(true);
      } else {
        observer.next(false);
      }
      observer.complete();
    });
  }

  logout(): void {
    this.loggedInUserSubject.next(null);
    localStorage.removeItem(this.LOGGED_IN_USER_KEY);
  }

  getLoggedInUser(): User | null {
    return this.loggedInUserSubject.value;
  }

  getUsers(): User[] {
    return this.users.slice();
  }

  getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserByUsername(username: string): User | undefined {
    return this.users.find(u => u.username === username);
  }

  getDriverRoutes(driverId: string) {
    const routes = this.routesService.getRoutes();
    return routes.filter(r => r.driverId === driverId);
  }

  registerDriver(driverData: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    carRegistration: string;
    carColor: string;
    carCapacity: number;
  }): boolean {
    // Check if username already exists
    if (this.getUserByUsername(driverData.username)) {
      return false;
    }

    // Create new driver
    const newDriver: Driver = {
      id: this.generateId(),
      name: driverData.firstName,
      surname: driverData.lastName,
      location: {
        lat: -26.005, // Default Fourways location
        lng: 28.0038889,
      },
      contact: {
        phone: driverData.phone,
        email: driverData.email,
      },
      car: {
        registration: driverData.carRegistration,
        color: driverData.carColor,
        numberOfPassengers: driverData.carCapacity,
      },
    };

    // Add driver to routes service
    this.routesService.addDriver(newDriver);

    // Create user account
    const newUser: User = {
      id: this.generateId(),
      username: driverData.username,
      password: driverData.password,
      driverId: newDriver.id,
      driver: newDriver,
      role: 'driver',
      createdAt: new Date(),
    };

    this.users.push(newUser);
    this.saveToStorage();
    return true;
  }

  registerPassenger(passengerData: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    groupId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }): boolean {
    // Check if username already exists
    if (this.getUserByUsername(passengerData.username)) {
      return false;
    }

    // Create new passenger
    const newPassenger: Passenger = {
      id: this.generateId(),
      groupId: passengerData.groupId,
      nameSurname: `${passengerData.firstName} ${passengerData.lastName}`,
      pickupLocation: {
        lat: passengerData.pickupLat,
        lng: passengerData.pickupLng,
      },
      dropoffLocation: {
        lat: passengerData.dropoffLat,
        lng: passengerData.dropoffLng,
      },
      contact: {
        phone: passengerData.phone,
        email: passengerData.email,
      },
      status: 'unset',
    };

    // Add passenger to routes service
    this.routesService.addPassenger(newPassenger);

    // Create user account
    const newUser: User = {
      id: this.generateId(),
      username: passengerData.username,
      password: passengerData.password,
      passengerId: newPassenger.id,
      role: 'passenger',
      createdAt: new Date(),
    };

    this.users.push(newUser);
    this.saveToStorage();
    return true;
  }

  getPassengerRoutes(passengerId: string): Route[] {
    // Get passenger to find their groupId
    const passenger = this.routesService.getPassengerById(passengerId);
    if (!passenger) {
      return [];
    }

    // Find all routes that match this passenger's groupId
    const routes = this.routesService.getRoutes();
    return routes.filter(r => r.groupId === passenger.groupId);
  }

  private generateId(): string {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }
}
