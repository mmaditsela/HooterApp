import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UsersService } from '../services/users.service';
import { HttpClient } from '@angular/common/http';
import { Geolocation } from '@capacitor/geolocation';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage implements OnInit {
  registrationRole: string = 'driver';
  username: string = '';
  password: string = '';
  confirmPassword: string = '';
  firstName: string = '';
  lastName: string = '';
  phone: string = '';
  email: string = '';
  carRegistration: string = '';
  carColor: string = '';
  carCapacity: number = 4;
  joiningCode: string = '';
  groupId: string = '';
  pickupLat: number = -26.005;
  pickupLng: number = 28.0038889;
  dropoffLat: number = -26.01;
  dropoffLng: number = 28.01;
  
  pickupAddress: string = '';
  dropoffAddress: string = '';
  pickupSearchQuery: string = '';
  dropoffSearchQuery: string = '';
  pickupSearchResults: any[] = [];
  dropoffSearchResults: any[] = [];
  isSearchingPickup: boolean = false;
  isSearchingDropoff: boolean = false;
  pickupDebounceTimer: any;
  dropoffDebounceTimer: any;

  constructor(
    private usersService: UsersService,
    private router: Router,
    private http: HttpClient,
    private alertController: AlertController
  ) {}

  ngOnInit() {}

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async register() {
    // Validation
    if (!this.username || !this.password || !this.confirmPassword) {
      await this.presentAlert('Required Fields', 'Please fill in all required fields');
      return;
    }

    if (this.password !== this.confirmPassword) {
      await this.presentAlert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (this.password.length < 6) {
      await this.presentAlert('Invalid Password', 'Password must be at least 6 characters');
      return;
    }

    if (!this.firstName || !this.lastName) {
      await this.presentAlert('Required Fields', 'Please enter your first and last name');
      return;
    }

    let success = false;

    if (this.registrationRole === 'driver') {
      // Validate driver-specific fields
      if (!this.carRegistration || !this.carColor || !this.carCapacity) {
        await this.presentAlert('Required Fields', 'Please fill in all car details');
        return;
      }

      if (this.carCapacity < 1 || this.carCapacity > 20) {
        await this.presentAlert('Invalid Capacity', 'Car capacity must be between 1 and 20');
        return;
      }

      // Register the driver
      success = this.usersService.registerDriver({
        username: this.username,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        phone: this.phone,
        email: this.email,
        carRegistration: this.carRegistration,
        carColor: this.carColor,
        carCapacity: this.carCapacity,
      });
    } else {
      // For passengers, use default group or find by joining code
      let targetGroupId = 'g1'; // Default group
      
      if (this.joiningCode) {
        const groups = this.usersService['routesService'].getGroups();
        const foundGroup = groups.find(g => g.joiningCode === this.joiningCode);
        if (foundGroup) {
          targetGroupId = foundGroup.id;
        } else {
          await this.presentAlert('Invalid Code', 'Invalid joining code. Using default group.');
        }
      }

      // Register the passenger
      success = this.usersService.registerPassenger({
        username: this.username,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        phone: this.phone,
        email: this.email,
        groupId: targetGroupId,
        pickupLat: this.pickupLat,
        pickupLng: this.pickupLng,
        dropoffLat: this.dropoffLat,
        dropoffLng: this.dropoffLng,
      });
    }

    if (success) {
      await this.presentAlert('Success', 'Registration successful! Please login.');
      this.router.navigate(['/login']);
    } else {
      await this.presentAlert('Registration Failed', 'Registration failed. Username may already exist.');
    }
  }

  onRoleChange() {
    // Clear car details when switching to passenger
    if (this.registrationRole === 'passenger') {
      this.carRegistration = '';
      this.carColor = '';
      this.carCapacity = 4;
    }
    // Clear joining code when switching to driver
    if (this.registrationRole === 'driver') {
      this.joiningCode = '';
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  searchPickupAddress() {
    if (this.pickupSearchQuery.length < 3) {
      this.pickupSearchResults = [];
      return;
    }

    if (this.pickupDebounceTimer) {
      clearTimeout(this.pickupDebounceTimer);
    }

    this.pickupDebounceTimer = setTimeout(() => {
      this.isSearchingPickup = true;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.pickupSearchQuery)}&countrycodes=za&limit=5`;
      
      this.http.get<any[]>(url).subscribe(
        (results) => {
          this.pickupSearchResults = results;
          this.isSearchingPickup = false;
        },
        (error) => {
          console.error('Geocoding error:', error);
          this.isSearchingPickup = false;
          this.pickupSearchResults = [];
        }
      );
    }, 500);
  }

  onPickupSelected() {
    const result = this.pickupSearchResults.find(r => r.display_name === this.pickupAddress);
    if (result) {
      this.pickupLat = parseFloat(result.lat);
      this.pickupLng = parseFloat(result.lon);
    }
  }

  async useCurrentLocationForPickup() {
    try {
      const position = await Geolocation.getCurrentPosition();
      this.pickupLat = position.coords.latitude;
      this.pickupLng = position.coords.longitude;
      
      this.reverseGeocodePickup(this.pickupLat, this.pickupLng);
    } catch (error) {
      console.error('Error getting location:', error);
      await this.presentAlert('Location Error', 'Unable to get your current location. Please ensure location services are enabled.');
    }
  }

  reverseGeocodePickup(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    
    this.http.get<any>(url).subscribe(
      (result) => {
        if (result && result.display_name) {
          this.pickupAddress = result.display_name;
          this.pickupSearchQuery = result.display_name.split(',')[0];
        }
      },
      (error) => {
        console.error('Reverse geocoding error:', error);
        this.pickupAddress = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        this.pickupSearchQuery = this.pickupAddress;
      }
    );
  }

  searchDropoffAddress() {
    if (this.dropoffSearchQuery.length < 3) {
      this.dropoffSearchResults = [];
      return;
    }

    if (this.dropoffDebounceTimer) {
      clearTimeout(this.dropoffDebounceTimer);
    }

    this.dropoffDebounceTimer = setTimeout(() => {
      this.isSearchingDropoff = true;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.dropoffSearchQuery)}&countrycodes=za&limit=5`;
      
      this.http.get<any[]>(url).subscribe(
        (results) => {
          this.dropoffSearchResults = results;
          this.isSearchingDropoff = false;
        },
        (error) => {
          console.error('Geocoding error:', error);
          this.isSearchingDropoff = false;
          this.dropoffSearchResults = [];
        }
      );
    }, 500);
  }

  onDropoffSelected() {
    const result = this.dropoffSearchResults.find(r => r.display_name === this.dropoffAddress);
    if (result) {
      this.dropoffLat = parseFloat(result.lat);
      this.dropoffLng = parseFloat(result.lon);
    }
  }

  async useCurrentLocationForDropoff() {
    try {
      const position = await Geolocation.getCurrentPosition();
      this.dropoffLat = position.coords.latitude;
      this.dropoffLng = position.coords.longitude;
      
      this.reverseGeocodeDropoff(this.dropoffLat, this.dropoffLng);
    } catch (error) {
      console.error('Error getting location:', error);
      await this.presentAlert('Location Error', 'Unable to get your current location. Please ensure location services are enabled.');
    }
  }

  reverseGeocodeDropoff(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    
    this.http.get<any>(url).subscribe(
      (result) => {
        if (result && result.display_name) {
          this.dropoffAddress = result.display_name;
          this.dropoffSearchQuery = result.display_name.split(',')[0];
        }
      },
      (error) => {
        console.error('Reverse geocoding error:', error);
        this.dropoffAddress = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        this.dropoffSearchQuery = this.dropoffAddress;
      }
    );
  }
}
