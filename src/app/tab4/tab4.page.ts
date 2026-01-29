import { Component, OnInit } from '@angular/core';
import { UsersService } from '../services/users.service';
import { RoutesService } from '../services/routes.service';
import { User } from '../models/user.model';
import { Driver } from '../models/driver.model';
import { Passenger } from '../models/passenger.model';
import { HttpClient } from '@angular/common/http';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page implements OnInit {
  currentUser: User | null = null;
  driver: Driver | undefined;
  passenger: Passenger | undefined;
  isDriver: boolean = false;
  hasActiveRoute: boolean = false;
  isEditing: boolean = false;

  // Form fields
  firstName: string = '';
  lastName: string = '';
  phone: string = '';
  email: string = '';
  carRegistration: string = '';
  carColor: string = '';
  carCapacity: number = 4;
  
  pickupAddress: string = '';
  dropoffAddress: string = '';
  pickupSearchQuery: string = '';
  dropoffSearchQuery: string = '';
  pickupSearchResults: any[] = [];
  dropoffSearchResults: any[] = [];
  pickupLat: number = 0;
  pickupLng: number = 0;
  dropoffLat: number = 0;
  dropoffLng: number = 0;
  pickupDebounceTimer: any;
  dropoffDebounceTimer: any;

  constructor(
    private usersService: UsersService,
    private routesService: RoutesService,
    private http: HttpClient,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadUserData();
  }

  ionViewWillEnter() {
    this.loadUserData();
  }

  loadUserData() {
    this.currentUser = this.usersService.getLoggedInUser();
    
    if (!this.currentUser) {
      return;
    }

    this.isDriver = this.currentUser.role === 'driver';

    if (this.isDriver && this.currentUser.driverId) {
      this.driver = this.routesService.getDriverById(this.currentUser.driverId);
      if (this.driver) {
        const nameParts = this.driver.name.split(' ');
        this.firstName = nameParts[0] || '';
        this.lastName = this.driver.surname || '';
        this.phone = this.driver.contact.phone || '';
        this.email = this.driver.contact.email || '';
        this.carRegistration = this.driver.car.registration || '';
        this.carColor = this.driver.car.color || '';
        this.carCapacity = this.driver.car.numberOfPassengers || 4;
      }
    } else if (this.currentUser.passengerId) {
      this.passenger = this.routesService.getPassengerById(this.currentUser.passengerId);
      if (this.passenger) {
        const nameParts = this.passenger.nameSurname.split(' ');
        this.firstName = nameParts[0] || '';
        this.lastName = nameParts.slice(1).join(' ') || '';
        this.phone = this.passenger.contact.phone || '';
        this.email = this.passenger.contact.email || '';
        this.pickupLat = this.passenger.pickupLocation.lat;
        this.pickupLng = this.passenger.pickupLocation.lng;
        this.dropoffLat = this.passenger.dropoffLocation.lat;
        this.dropoffLng = this.passenger.dropoffLocation.lng;
        this.reverseGeocodePickup(this.pickupLat, this.pickupLng);
        this.reverseGeocodeDropoff(this.dropoffLat, this.dropoffLng);
      }
      
      // Check if passenger has an active route
      const activeRouteId = this.routesService.getActiveRoute();
      if (activeRouteId) {
        const activeRoute = this.routesService.getRouteById(activeRouteId);
        if (activeRoute) {
          const passengerInRoute = this.routesService.getPassengersByGroup(activeRoute.groupId)
            .find(p => p.id === this.currentUser?.passengerId);
          this.hasActiveRoute = !!passengerInRoute;
        }
      }
    }
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      // Reload data if cancelled
      this.loadUserData();
    }
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async saveChanges() {
    if (!this.currentUser) {
      await this.presentAlert('Error', 'No user logged in');
      return;
    }

    if (!this.firstName || !this.lastName) {
      await this.presentAlert('Required Fields', 'Please enter first and last name');
      return;
    }

    if (this.isDriver && this.driver) {
      // Update driver details
      this.driver.name = this.firstName;
      this.driver.surname = this.lastName;
      this.driver.contact.phone = this.phone;
      this.driver.contact.email = this.email;
      this.driver.car.registration = this.carRegistration;
      this.driver.car.color = this.carColor;
      this.driver.car.numberOfPassengers = this.carCapacity;
      
      this.routesService.updateDriver(this.driver);
      await this.presentAlert('Success', 'Driver details updated successfully');
    } else if (this.passenger) {
      // Update passenger details
      this.passenger.nameSurname = `${this.firstName} ${this.lastName}`;
      this.passenger.contact.phone = this.phone;
      this.passenger.contact.email = this.email;
      
      // Only update addresses if no active route
      if (!this.hasActiveRoute) {
        this.passenger.pickupLocation = { lat: this.pickupLat, lng: this.pickupLng };
        this.passenger.dropoffLocation = { lat: this.dropoffLat, lng: this.dropoffLng };
      }
      
      this.routesService.updatePassenger(this.passenger);
      await this.presentAlert('Success', 'Passenger details updated successfully');
    }

    this.isEditing = false;
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
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.pickupSearchQuery)}&countrycodes=za&limit=5`;
      
      this.http.get<any[]>(url).subscribe(
        (results) => {
          this.pickupSearchResults = results;
        },
        (error) => {
          console.error('Geocoding error:', error);
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
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.dropoffSearchQuery)}&countrycodes=za&limit=5`;
      
      this.http.get<any[]>(url).subscribe(
        (results) => {
          this.dropoffSearchResults = results;
        },
        (error) => {
          console.error('Geocoding error:', error);
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
