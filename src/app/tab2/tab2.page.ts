import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RoutesService } from '../services/routes.service';
import { UsersService } from '../services/users.service';
import { Route } from '../models/route.model';
import { Driver } from '../models/driver.model';
import { GroupRoutes } from '../models/group-routes.model';
import { Passenger } from '../models/passenger.model';

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

  constructor(
    private router: Router,
    private routesService: RoutesService,
    private usersService: UsersService
  ) {}

  toggleRouteDetails() {
    this.routeDetailsExpanded = !this.routeDetailsExpanded;
  }

  activateRoute() {
    if (this.selectedRoute && this.currentDriverId) {
      const success = this.routesService.activateRoute(this.selectedRoute.routeId, this.currentDriverId);
      if (success) {
        this.activeRouteId = this.selectedRoute.routeId;
        alert('Route activated!');
      } else {
        alert('Cannot activate route. Driver may already have an active route.');
      }
    }
  }

  completeRoute() {
    if (this.selectedRoute) {
      const success = this.routesService.completeRoute(this.selectedRoute.routeId);
      if (success) {
        this.activeRouteId = null;
        this.selectedRoute.routeState = 'Completed';
        alert('Route completed!');
      }
    }
  }

  ngOnInit() {
    // Get current logged-in driver
    const loggedInUser = this.usersService.getLoggedInUser();
    if (loggedInUser && loggedInUser.driverId) {
      this.currentDriverId = loggedInUser.driverId;
    }

    // Subscribe to active route changes
    this.routesService.activeRoute$.subscribe((routeId) => {
      this.activeRouteId = routeId;
    });

    // Get the passed route data from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;

    if (state && state['selectedRoute']) {
      this.selectedRoute = state['selectedRoute'];
      if (this.selectedRoute) {
        this.groupDetails = this.routesService.getGroupById(this.selectedRoute.groupId);
        this.driverDetails = this.routesService.getDriverById(this.selectedRoute.driverId);
        this.passengers = this.routesService.getPassengersByGroup(this.selectedRoute.groupId);
        // Check if this route is already active
        if (this.activeRouteId === this.selectedRoute.routeId) {
          this.selectedRoute.routeState = 'Active';
        }
      }
    }
  }
}
