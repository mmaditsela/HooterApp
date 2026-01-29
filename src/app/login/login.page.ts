import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  username: string = '';
  password: string = '';
  loginRole: string = 'driver';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {}

  login() {
    this.errorMessage = '';
    
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter username and password';
      return;
    }

    this.isLoading = true;
    this.authService.login(this.username, this.password).subscribe(
      (success: boolean) => {
        this.isLoading = false;
        if (success) {
          // Navigate to tabs/tab1 on successful login
          this.router.navigate(['/tabs/tab1']);
        } else {
          this.errorMessage = 'Invalid username or password';
        }
      }
    );
  }
}
