import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RoutesService } from '../services/routes.service';
import { UsersService } from '../services/users.service';
import { Route } from '../models/route.model';
import { Driver } from '../models/driver.model';
import { GroupRoutes } from '../models/group-routes.model';
import { User } from '../models/user.model';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit {
  routes: Route[] = [];
  driversMap: Record<string, Driver> = {};
  groupsMap: Record<string, GroupRoutes> = {};
  loggedInUser: User | null = null;
  activeRoutes: Route[] = [];
  notActiveRoutes: Route[] = [];
  completedRoutes: Route[] = [];

  constructor(
    private routesService: RoutesService,
    private usersService: UsersService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loggedInUser = this.usersService.getLoggedInUser();
    
    // Load all drivers and groups
    this.routesService.getDrivers().forEach(d => (this.driversMap[d.id] = d));
    this.routesService.getGroups().forEach(g => (this.groupsMap[g.id] = g));
    
    // Get all routes for logged-in driver
    if (this.loggedInUser && this.loggedInUser.driverId) {
      this.routes = this.usersService.getDriverRoutes(this.loggedInUser.driverId);
    } else {
      // If no user logged in, show all routes (fallback)
      this.routes = this.routesService.getRoutes();
    }
    
    // Organize routes by state
    this.organizeRoutesByState();
  }

  organizeRoutesByState() {
    this.activeRoutes = this.routes.filter(r => r.routeState === 'Active');
    this.notActiveRoutes = this.routes.filter(r => r.routeState === 'Not-Active');
    this.completedRoutes = this.routes.filter(r => r.routeState === 'Completed');
  }

  passengerCount(groupId: string) {
    return this.routesService.getPassengersByGroup(groupId).length;
  }

  viewRoute(routeId: string) {
    this.routes.forEach(r => {
      if (r.routeId === routeId) {
        // Navigate to tab2 with route data
        const navigationExtras = { state: { selectedRoute: r, groupId: r.groupId } };
        this.router.navigate(['/tabs/tab2'], navigationExtras);
      }
    });
  }
}
