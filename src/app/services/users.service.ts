import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { Driver } from '../models/driver.model';
import { RoutesService } from './routes.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private users: User[] = [];
  private loggedInUserSubject = new BehaviorSubject<User | null>(null);
  public loggedInUser$ = this.loggedInUserSubject.asObservable();

  constructor(private routesService: RoutesService) {
    this.seedUsers();
    this.checkSessionUser();
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
  }

  private checkSessionUser() {
    const storedUserId = sessionStorage.getItem('loggedInUserId');
    if (storedUserId) {
      const user = this.users.find(u => u.id === storedUserId);
      if (user) {
        this.loggedInUserSubject.next(user);
      }
    }
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
        sessionStorage.setItem('loggedInUserId', user.id);
        observer.next(true);
      } else {
        observer.next(false);
      }
      observer.complete();
    });
  }

  logout(): void {
    this.loggedInUserSubject.next(null);
    sessionStorage.removeItem('loggedInUserId');
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
}
