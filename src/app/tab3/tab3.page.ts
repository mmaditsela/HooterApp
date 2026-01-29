import { Component, OnInit, OnDestroy } from '@angular/core';
import { RoutesService } from '../services/routes.service';
import { UsersService } from '../services/users.service';
import { Passenger } from '../models/passenger.model';
import { Route } from '../models/route.model';
import { Driver } from '../models/driver.model';
import { GroupRoutes } from '../models/group-routes.model';
import { User } from '../models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit, OnDestroy {
  loggedInUser: User | null = null;
  isPassenger: boolean = false;
  activeRoute: Route | undefined;
  currentPassenger: Passenger | undefined;
  driver: Driver | undefined;
  distanceToDriver: number = 0;
  tripHistory: Array<{
    route: Route;
    group: GroupRoutes;
    driver: Driver;
    passenger: Passenger;
  }> = [];
  tripHistoryExpanded: boolean = false;
  private routeSubscription: Subscription | undefined;
  private distanceInterval: any;

  constructor(
    private routesService: RoutesService,
    private usersService: UsersService
  ) {}

  ngOnInit() {
    this.loggedInUser = this.usersService.getLoggedInUser();
    
    if (this.loggedInUser) {
      this.isPassenger = this.loggedInUser.role === 'passenger';
      
      if (this.isPassenger && this.loggedInUser.passengerId) {
        this.loadPassengerData();
      }
    }
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
    }
  }

  private loadPassengerData() {
    if (!this.loggedInUser?.passengerId) return;

    // Get passenger data
    this.currentPassenger = this.routesService.getPassengerById(this.loggedInUser.passengerId);
    
    // Load trip history
    this.tripHistory = this.routesService.getPassengerTripHistory(this.loggedInUser.passengerId);
    
    if (this.currentPassenger) {
      // Subscribe to active route changes
      this.routeSubscription = this.routesService.activeRoute$.subscribe((activeRouteId) => {
        if (activeRouteId) {
          this.activeRoute = this.routesService.getRouteById(activeRouteId);
          
          // Check if this passenger is part of the active route
          if (this.activeRoute && this.currentPassenger && 
              this.activeRoute.groupId === this.currentPassenger.groupId) {
            this.driver = this.routesService.getDriverById(this.activeRoute.driverId);
            this.startDistanceCalculation();
          } else {
            this.activeRoute = undefined;
            this.stopDistanceCalculation();
          }
        } else {
          this.activeRoute = undefined;
          this.stopDistanceCalculation();
          // Reload trip history when route completes
          this.tripHistory = this.routesService.getPassengerTripHistory(this.loggedInUser!.passengerId!);
        }
      });
    }
  }

  private startDistanceCalculation() {
    // Calculate distance every 2 seconds
    this.calculateDistance();
    this.distanceInterval = setInterval(() => {
      this.calculateDistance();
    }, 2000);
  }

  private stopDistanceCalculation() {
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
      this.distanceInterval = null;
    }
  }

  private calculateDistance() {
    if (!this.driver || !this.currentPassenger) return;

    const driverLat = this.driver.location.lat;
    const driverLng = this.driver.location.lng;
    const passengerLat = this.currentPassenger.pickupLocation.lat;
    const passengerLng = this.currentPassenger.pickupLocation.lng;

    // Haversine formula to calculate distance in meters
    const R = 6371e3; // Earth radius in meters
    const φ1 = driverLat * Math.PI / 180;
    const φ2 = passengerLat * Math.PI / 180;
    const Δφ = (passengerLat - driverLat) * Math.PI / 180;
    const Δλ = (passengerLng - driverLng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    this.distanceToDriver = R * c; // Distance in meters
  }

  getThisWeekTrips() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return this.tripHistory.filter(trip => {
      const completedDate = trip.route.completedAt;
      return completedDate && completedDate >= oneWeekAgo;
    });
  }

  formatTime(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  }
}
