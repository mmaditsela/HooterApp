import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RoutesService } from '../services/routes.service';
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

  constructor(
    private router: Router,
    private routesService: RoutesService
  ) {}

  toggleRouteDetails() {
    this.routeDetailsExpanded = !this.routeDetailsExpanded;
  }

  ngOnInit() {
    // Get the passed route data from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;

    if (state && state['selectedRoute']) {
      this.selectedRoute = state['selectedRoute'];
      if (this.selectedRoute) {
        this.groupDetails = this.routesService.getGroupById(this.selectedRoute.groupId);
        this.driverDetails = this.routesService.getDriverById(this.selectedRoute.driverId);
        this.passengers = this.routesService.getPassengersByGroup(this.selectedRoute.groupId);
      }
    }
  }
}
