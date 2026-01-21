import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  constructor(private usersService: UsersService) {
    // Check if user was already logged in (from session storage)
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    this.isLoggedInSubject.next(isLoggedIn);
  }

  /**
   * Login with username and password
   * Demo credentials: driver0/password, driver1/password, driver2/password
   */
  login(username: string, password: string): Observable<boolean> {
    return new Observable(observer => {
      this.usersService.login(username, password).subscribe((success: boolean) => {
        if (success) {
          this.isLoggedInSubject.next(true);
          sessionStorage.setItem('isLoggedIn', 'true');
          observer.next(true);
        } else {
          observer.next(false);
        }
        observer.complete();
      });
    });
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.isLoggedInSubject.next(false);
    sessionStorage.removeItem('isLoggedIn');
    this.usersService.logout();
  }

  /**
   * Check if user is currently logged in
   */
  isLoggedIn(): boolean {
    return this.isLoggedInSubject.value;
  }
}
