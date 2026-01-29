import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { RoutesService } from '../services/routes.service';
import { UsersService } from '../services/users.service';
import { Route } from '../models/route.model';
import { Driver } from '../models/driver.model';
import { GroupRoutes } from '../models/group-routes.model';
import { Passenger, PassengerStatus } from '../models/passenger.model';
import { User } from '../models/user.model';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit {
  selectedRoute: Route | null = null;
  groupDetails: GroupRoutes | undefined;
  driverDetails: Driver | undefined;
  passengers: Passenger[] = [];
  routeDetailsExpanded: boolean = false;
  activeRouteId: string | null = null;
  currentDriverId: string | null = null;
  currentPassengerId: string | null = null;
  loggedInUser: User | null = null;
  isDriver: boolean = false;
  newRouteName: string = '';
  newRouteStartTime: string = '';
  newRouteEndTime: string = '';
  newRouteDays: string[] = [];
  isCreatingRoute: boolean = false;
  showCreateRoute: boolean = false;
  showJoinRoute: boolean = false;
  joiningCode: string = '';
  isJoiningRoute: boolean = false;

  constructor(
    private router: Router,
    private routesService: RoutesService,
    private usersService: UsersService,
    private alertController: AlertController
  ) {}

  toggleRouteDetails() {
    this.routeDetailsExpanded = !this.routeDetailsExpanded;
  }

  toggleCreateRoute() {
    this.showCreateRoute = !this.showCreateRoute;
  }

  toggleJoinRoute() {
    this.showJoinRoute = !this.showJoinRoute;
  }

  async joinRouteByCode() {
    if (!this.currentPassengerId) {
      await this.presentAlert('Error', 'You must be logged in as a passenger to join a route.');
      return;
    }

    if (!this.joiningCode || this.joiningCode.trim() === '') {
      await this.presentAlert('Required', 'Please enter a joining code.');
      return;
    }

    this.isJoiningRoute = true;

    // Find the group by joining code
    const group = this.routesService.getGroupByJoiningCode(this.joiningCode.trim());
    
    if (!group) {
      this.isJoiningRoute = false;
      await this.presentAlert('Invalid Code', 'The joining code is invalid or does not exist.');
      return;
    }

    // Get the passenger and update their group
    const passenger = this.routesService.getPassengerById(this.currentPassengerId);
    if (passenger) {
      passenger.groupId = group.id;
      this.routesService.updatePassenger(passenger);
      
      this.joiningCode = '';
      this.showJoinRoute = false;
      this.isJoiningRoute = false;
      
      await this.presentAlert('Success', `You have joined the group: ${group.name}`);
    } else {
      this.isJoiningRoute = false;
      await this.presentAlert('Error', 'Failed to join route. Please try again.');
    }
  }

  async scanQRCode() {
    // Placeholder for QR code scanning functionality
    // This would require Capacitor's Barcode Scanner plugin
    await this.presentAlert('Coming Soon', 'QR Code scanning will be implemented with Capacitor Barcode Scanner plugin.');
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async activateRoute() {
    if (this.selectedRoute && this.currentDriverId) {
      const success = this.routesService.activateRoute(this.selectedRoute.routeId, this.currentDriverId);
      if (success) {
        this.activeRouteId = this.selectedRoute.routeId;
        await this.presentAlert('Success', 'Route activated!');
      } else {
        await this.presentAlert('Error', 'Cannot activate route. Driver may already have an active route.');
      }
    }
  }

  async completeRoute() {
    if (this.selectedRoute) {
      const success = this.routesService.completeRoute(this.selectedRoute.routeId);
      if (success) {
        this.activeRouteId = null;
        this.selectedRoute.routeState = 'Completed';
        await this.presentAlert('Success', 'Route completed!');
      }
    }
  }

  isDaySelected(day: string): boolean {
    return this.newRouteDays.includes(day);
  }

  toggleDay(day: string) {
    const index = this.newRouteDays.indexOf(day);
    if (index > -1) {
      this.newRouteDays.splice(index, 1);
    } else {
      this.newRouteDays.push(day);
    }
  }

  async createRoute() {
    if (!this.currentDriverId) {
      await this.presentAlert('Error', 'You must be logged in as a driver to create a route.');
      return;
    }

    if (!this.newRouteName || !this.newRouteStartTime || !this.newRouteEndTime) {
      await this.presentAlert('Required Fields', 'Please fill in route name, start time, and end time.');
      return;
    }

    const activeDays = this.newRouteDays;

    this.isCreatingRoute = true;
    const result = this.routesService.createRouteForDriver(this.currentDriverId, {
      name: this.newRouteName,
      startTime: this.newRouteStartTime,
      endTime: this.newRouteEndTime,
      activeDays,
    });

    this.isCreatingRoute = false;

    if (result) {
      this.selectedRoute = result.route;
      this.groupDetails = result.group;
      this.driverDetails = this.routesService.getDriverById(this.currentDriverId) || undefined;
      this.passengers = [];
      this.routeDetailsExpanded = true;

      this.newRouteName = '';
      this.newRouteStartTime = '';
      this.newRouteEndTime = '';
      this.newRouteDays = [];

      await this.presentAlert('Success', 'Route created successfully!');
    } else {
      await this.presentAlert('Error', 'Failed to create route.');
    }
  }

  async updatePassengerStatus(status: PassengerStatus) {
    if (this.currentPassengerId) {
      const success = this.routesService.updatePassengerStatus(this.currentPassengerId, status);
      if (success) {
        // Reload passengers from service to trigger map refresh
        if (this.selectedRoute) {
          this.passengers = this.routesService.getPassengersByGroup(this.selectedRoute.groupId);
        }
        await this.presentAlert('Success', `Status updated to: ${status}`);
      } else {
        await this.presentAlert('Error', 'Failed to update status');
      }
    }
  }

  getCurrentPassenger(): Passenger | undefined {
    if (this.currentPassengerId) {
      return this.passengers.find(p => p.id === this.currentPassengerId);
    }
    return undefined;
  }

  ngOnInit() {
    // Get current logged-in user
    this.loggedInUser = this.usersService.getLoggedInUser();
    if (this.loggedInUser) {
      if (this.loggedInUser.role === 'driver' && this.loggedInUser.driverId) {
        this.currentDriverId = this.loggedInUser.driverId;
        this.isDriver = true;
      } else if (this.loggedInUser.role === 'passenger' && this.loggedInUser.passengerId) {
        this.currentPassengerId = this.loggedInUser.passengerId;
        this.isDriver = false;
      }
    }

    // Subscribe to active route changes
    this.routesService.activeRoute$.subscribe((routeId) => {
      this.activeRouteId = routeId;
      
      // Automatically load the active route when it changes
      if (routeId) {
        const activeRoute = this.routesService.getRouteById(routeId);
        if (activeRoute) {
          // For drivers: show their own active route
          if (this.isDriver && this.currentDriverId && activeRoute.driverId === this.currentDriverId) {
            this.loadRouteDetails(activeRoute);
          }
          // For passengers: show the active route if they're part of it
          else if (!this.isDriver && this.currentPassengerId) {
            const passenger = this.routesService.getPassengerById(this.currentPassengerId);
            if (passenger && activeRoute.groupId === passenger.groupId) {
              this.loadRouteDetails(activeRoute);
            }
          }
        }
      } else {
        // Clear selected route when no active route
        this.selectedRoute = null;
        this.groupDetails = undefined;
        this.driverDetails = undefined;
        this.passengers = [];
      }
    });

    // Get the passed route data from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;

    if (state && state['selectedRoute']) {
      this.loadRouteDetails(state['selectedRoute']);
    }
  }

  private loadRouteDetails(route: Route) {
    this.selectedRoute = route;
    this.groupDetails = this.routesService.getGroupById(route.groupId);
    this.driverDetails = this.routesService.getDriverById(route.driverId);
    this.passengers = this.routesService.getPassengersByGroup(route.groupId);
    this.routeDetailsExpanded = true;
    
    // Update route state based on active route
    if (this.activeRouteId === route.routeId) {
      this.selectedRoute.routeState = 'Active';
    }
  }
}
