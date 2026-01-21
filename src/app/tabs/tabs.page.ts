import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {

  constructor(private authService: AuthService, private router: Router) {}

  openSettings() {
    this.router.navigate(['/tabs/settings']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
