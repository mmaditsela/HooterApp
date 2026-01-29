import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { RoutesService } from '../../services/routes.service';
import { UsersService } from '../../services/users.service';
import { Driver } from '../../models/driver.model';
import { Passenger } from '../../models/passenger.model';
import { Route } from '../../models/route.model';
import { GroupRoutes } from '../../models/group-routes.model';
import { HttpClient } from '@angular/common/http';

declare let L: any;

interface RouteStop {
  lat: number;
  lng: number;
  type: 'pickup' | 'dropoff';
  passenger: Passenger;
  distance: number;
  marker?: any;
}

@Component({
  selector: 'app-driving-map',
  templateUrl: './driving-map.component.html',
  styleUrls: ['./driving-map.component.scss'],
  standalone: false,
})
export class DrivingMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private map: any;
  private driverMarker: any;
  private routePolyline: any;
  private simulationInterval: any;
  private actualRouteCoordinates: [number, number][] = [];
  private currentRouteSegmentIndex: number = 0;
  
  activeRoute: Route | undefined;
  driver: Driver | undefined;
  passengers: Passenger[] = [];
  routeStops: RouteStop[] = [];
  currentDriverPosition: { lat: number; lng: number } = { lat: -26.005, lng: 28.0038889 };
  isLoading: boolean = true;
  currentStopIndex: number = 0;
  completedRoutes: Array<{route: Route; group: GroupRoutes; driver: Driver}> = [];
  driversMap: Record<string, Driver> = {};
  groupsMap: Record<string, GroupRoutes> = {};
  isPassenger: boolean = false;

  constructor(
    private routesService: RoutesService,
    private usersService: UsersService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const loggedInUser = this.usersService.getLoggedInUser();
    this.isPassenger = loggedInUser?.role === 'passenger';
    this.loadActiveRoute();
    this.loadCompletedRoutes();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.activeRoute) {
        this.initMap();
      }
    }, 500);
  }

  ngOnDestroy() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
  }

  private loadCompletedRoutes() {
    // Load all drivers and groups for mapping
    this.routesService.getDrivers().forEach(d => (this.driversMap[d.id] = d));
    this.routesService.getGroups().forEach(g => (this.groupsMap[g.id] = g));

    // Get all routes for logged-in driver
    const loggedInUser = this.usersService.getLoggedInUser();
    if (loggedInUser && loggedInUser.driverId) {
      const allRoutes = this.usersService.getDriverRoutes(loggedInUser.driverId);
      const completed = allRoutes.filter(r => r.routeState === 'Completed');
      
      this.completedRoutes = completed.map(route => ({
        route,
        group: this.groupsMap[route.groupId],
        driver: this.driversMap[route.driverId]
      }));
    }
  }

  private loadActiveRoute() {
    const activeRouteId = this.routesService.getActiveRoute();
    if (activeRouteId) {
      this.activeRoute = this.routesService.getRouteById(activeRouteId);
      if (this.activeRoute) {
        this.driver = this.routesService.getDriverById(this.activeRoute.driverId);
        this.passengers = this.routesService.getPassengersByGroup(this.activeRoute.groupId)
          .filter(p => p.status !== 'absent');
        
        if (this.driver) {
          this.currentDriverPosition = { ...this.driver.location };
          this.buildRouteStops();
        }
      }
    }
  }

  private buildRouteStops() {
    this.routeStops = [];
    
    // Create pickup and dropoff lists
    const pickups = this.passengers.map(p => ({
      lat: p.pickupLocation.lat,
      lng: p.pickupLocation.lng,
      type: 'pickup' as const,
      passenger: p,
      distance: 0
    }));

    const dropoffs = this.passengers.map(p => ({
      lat: p.dropoffLocation.lat,
      lng: p.dropoffLocation.lng,
      type: 'dropoff' as const,
      passenger: p,
      distance: 0
    }));

    // Optimize pickup order starting from driver location
    const optimizedPickups = this.optimizeStopOrder(pickups, this.currentDriverPosition);
    this.routeStops.push(...optimizedPickups);

    // Optimize dropoff order starting from last pickup location
    const lastPickup = optimizedPickups[optimizedPickups.length - 1];
    const lastPickupLocation = { lat: lastPickup.lat, lng: lastPickup.lng };
    const optimizedDropoffs = this.optimizeStopOrder(dropoffs, lastPickupLocation);
    this.routeStops.push(...optimizedDropoffs);
  }

  private optimizeStopOrder(
    stops: RouteStop[],
    startLocation: { lat: number; lng: number }
  ): RouteStop[] {
    if (stops.length === 0) return [];
    if (stops.length === 1) return stops;

    const optimized: RouteStop[] = [];
    const remaining = [...stops];
    let currentLocation = startLocation;

    // Nearest neighbor algorithm
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = this.calculateDistance(currentLocation, remaining[0]);

      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(currentLocation, remaining[i]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);
      currentLocation = { lat: nearest.lat, lng: nearest.lng };
    }

    return optimized;
  }

  private initMap() {
    if (!this.mapContainer || !this.driver) {
      this.isLoading = false;
      return;
    }

    // Initialize map
    this.map = L.map(this.mapContainer.nativeElement).setView([this.currentDriverPosition.lat, this.currentDriverPosition.lng], 13);
    
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    // Add driver marker
    this.driverMarker = L.circleMarker([this.currentDriverPosition.lat, this.currentDriverPosition.lng], {
      radius: 10,
      fillColor: '#0066cc',
      color: '#0066cc',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9,
    })
      .addTo(this.map)
      .bindPopup(`<b>Driver</b><br/>${this.driver.name} ${this.driver.surname}`);

    // Add stop markers with numbered labels for pickup order
    let pickupNumber = 1;
    let dropoffNumber = 1;
    
    this.routeStops.forEach((stop, index) => {
      const color = stop.type === 'pickup' ? this.getStatusColor(stop.passenger.status) : '#fd00b6';
      const isPickup = stop.type === 'pickup';
      const orderNumber = isPickup ? pickupNumber++ : dropoffNumber++;
      
      // Create circle marker
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 8,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7,
      }).addTo(this.map);
      
      // Create number label with icon
      const iconHtml = `
        <div style="
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${orderNumber}
        </div>
      `;
      
      const numberMarker = L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({
          html: iconHtml,
          className: 'stop-number-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(this.map);
      
      // Add popup to both markers
      const popupContent = `<b>${stop.passenger.nameSurname}</b><br/>${stop.type} #${orderNumber}<br/>Distance: ${stop.distance.toFixed(0)}m`;
      marker.bindPopup(popupContent);
      numberMarker.bindPopup(popupContent);
      
      stop.marker = marker;
    });

    this.fetchActualRoute();
    this.isLoading = false;
  }

  private fetchActualRoute() {
    const coordinates = [
      [this.currentDriverPosition.lat, this.currentDriverPosition.lng],
      ...this.routeStops.slice(this.currentStopIndex).map(s => [s.lat, s.lng])
    ];

    // Format coordinates for OSRM API (lon,lat format)
    const osrmCoordinates = coordinates.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoordinates}?geometries=geojson&overview=full`;

    this.http.get<any>(url).subscribe(
      (response) => {
        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          const routeGeometry = route.geometry;

          // Convert GeoJSON coordinates [lng, lat] to [lat, lng]
          this.actualRouteCoordinates = routeGeometry.coordinates.map((coord: [number, number]) => 
            [coord[1], coord[0]] as [number, number]
          );
          
          this.currentRouteSegmentIndex = 0;
          this.drawRoute();
          this.startSimulation();
        }
      },
      (error) => {
        console.warn('OSRM routing failed, using fallback:', error);
        // Fallback to simple coordinates
        this.actualRouteCoordinates = coordinates as [number, number][];
        this.drawRoute();
        this.startSimulation();
      }
    );
  }

  private drawRoute() {
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
    }

    if (this.actualRouteCoordinates.length > 0) {
      // Show remaining route from current position
      const remainingRoute = this.actualRouteCoordinates.slice(this.currentRouteSegmentIndex);
      
      this.routePolyline = L.polyline(remainingRoute, {
        color: '#4A90E2',
        weight: 5,
        opacity: 0.9,
      }).addTo(this.map);
    }

    // Fit bounds
    const allMarkers = [this.driverMarker, ...this.routeStops.slice(this.currentStopIndex).map(s => s.marker).filter(m => m)];
    if (allMarkers.length > 0) {
      const group = L.featureGroup(allMarkers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private startSimulation() {
    this.simulationInterval = setInterval(() => {
      this.moveDriverTowardsNextStop();
    }, 2000);
  }

  private moveDriverTowardsNextStop() {
    if (this.currentStopIndex >= this.routeStops.length || this.actualRouteCoordinates.length === 0) {
      clearInterval(this.simulationInterval);
      return;
    }

    // Move along the actual route coordinates
    if (this.currentRouteSegmentIndex < this.actualRouteCoordinates.length - 1) {
      const currentPoint = this.actualRouteCoordinates[this.currentRouteSegmentIndex];
      const nextPoint = this.actualRouteCoordinates[this.currentRouteSegmentIndex + 1];
      
      const segmentDistance = this.calculateDistance(
        { lat: currentPoint[0], lng: currentPoint[1] },
        { lat: nextPoint[0], lng: nextPoint[1] }
      );

      if (segmentDistance <= 50) {
        // Move to next route segment
        this.currentRouteSegmentIndex++;
        this.currentDriverPosition = { 
          lat: this.actualRouteCoordinates[this.currentRouteSegmentIndex][0], 
          lng: this.actualRouteCoordinates[this.currentRouteSegmentIndex][1] 
        };
      } else {
        // Move 50 meters towards next point on route
        const bearing = this.calculateBearing(
          { lat: currentPoint[0], lng: currentPoint[1] },
          { lat: nextPoint[0], lng: nextPoint[1] }
        );
        this.currentDriverPosition = this.movePoint(
          { lat: currentPoint[0], lng: currentPoint[1] }, 
          bearing, 
          50
        );
        this.actualRouteCoordinates[this.currentRouteSegmentIndex] = [
          this.currentDriverPosition.lat,
          this.currentDriverPosition.lng
        ];
      }

      // Check if reached current stop
      const nextStop = this.routeStops[this.currentStopIndex];
      const distanceToStop = this.calculateDistance(this.currentDriverPosition, nextStop);
      
      if (distanceToStop <= 60) {
        // Reached the stop
        this.currentDriverPosition = { lat: nextStop.lat, lng: nextStop.lng };
        this.currentStopIndex++;
        if (nextStop.marker) {
          this.map.removeLayer(nextStop.marker);
        }
        
        // Fetch new route from current position
        if (this.currentStopIndex < this.routeStops.length) {
          this.fetchActualRoute();
          return;
        }
      }
    }

    // Update driver marker position
    this.driverMarker.setLatLng([this.currentDriverPosition.lat, this.currentDriverPosition.lng]);
    
    // Update driver location in service for real-time tracking
    if (this.driver) {
      this.driver.location = { ...this.currentDriverPosition };
    }
    
    // Update distances
    this.updateDistances();
    
    // Redraw route
    this.drawRoute();
    
    // Update popup info
    this.routeStops.slice(this.currentStopIndex).forEach(stop => {
      if (stop.marker) {
        stop.marker.setPopupContent(`<b>${stop.passenger.nameSurname}</b><br/>${stop.type}<br/>Distance: ${stop.distance.toFixed(0)}m`);
      }
    });
  }

  private updateDistances() {
    this.routeStops.forEach(stop => {
      stop.distance = this.calculateDistance(this.currentDriverPosition, stop);
    });
  }

  markAsPickedUp(stop: RouteStop): void {
    if (stop.type === 'pickup') {
      // Set the actual pickup time
      this.routesService.setPassengerPickupTime(stop.passenger.id);
      
      // Update local passenger object
      stop.passenger.actualPickupTime = new Date();
      
      // Find the index of this stop in the routeStops array
      const stopIndex = this.routeStops.findIndex(s => 
        s.passenger.id === stop.passenger.id && s.type === stop.type
      );
      
      if (stopIndex !== -1) {
        // Remove the marker from the map
        if (this.routeStops[stopIndex].marker) {
          this.map.removeLayer(this.routeStops[stopIndex].marker);
        }
        
        // If this was the current stop, advance to the next one
        if (stopIndex === this.currentStopIndex) {
          this.currentStopIndex++;
        }
        
        // Remove the stop from the array
        this.routeStops.splice(stopIndex, 1);
        
        // If there are more stops, recalculate the route
        if (this.currentStopIndex < this.routeStops.length) {
          this.fetchActualRoute();
        } else {
          // No more stops, just redraw the map
          this.drawRoute();
        }
        
        // Update distances for remaining stops
        this.updateDistances();
      }
    }
  }

  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
    const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  private calculateBearing(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    return Math.atan2(y, x);
  }

  private movePoint(point: { lat: number; lng: number }, bearing: number, distanceMeters: number): { lat: number; lng: number } {
    const R = 6371000; // Earth's radius in meters
    const lat1 = point.lat * Math.PI / 180;
    const lng1 = point.lng * Math.PI / 180;
    const angularDistance = distanceMeters / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      lat: lat2 * 180 / Math.PI,
      lng: lng2 * 180 / Math.PI
    };
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'ready':
        return '#10b981';
      case 'not-ready':
        return '#f59e0b';
      case 'absent':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }
}
