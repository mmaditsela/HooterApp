import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {

  constructor(
    private authService: AuthService,
    private router: Router,
    private location: Location,
    private alertController: AlertController
  ) {}

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async presentConfirm(header: string, message: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'OK',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  async clearAllData() {
    const confirmed = await this.presentConfirm('Clear All Data', 'This will clear all data and reset the app. Continue?');
    if (confirmed) {
      // Clear all localStorage
      localStorage.clear();
      await this.presentAlert('Success', 'All data cleared! The app will reload.');
      window.location.reload();
    }
  }

  goBack() {
    this.location.back();
  }
}
