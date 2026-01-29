import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { Driver } from '../../models/driver.model';
import { Passenger } from '../../models/passenger.model';
import { Geolocation } from '@capacitor/geolocation';
import { HttpClient } from '@angular/common/http';
import { UsersService } from '../../services/users.service';

declare let L: any; // Leaflet library

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: false,
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() driver: Driver | undefined;
  @Input() passengers: Passenger[] = [];
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private map: any;
  private driverMarker: any;
  private passengerMarkers: any[] = [];
  private route: any;
  isLoading: boolean = true;
  private currentLocation: { lat: number; lng: number } | null = null;

  constructor(private http: HttpClient, private usersService: UsersService) {}

  ngOnInit() {
    this.getCurrentLocation();
  }

  ngAfterViewInit() {
    // Wait a moment for location to be fetched
    setTimeout(() => {
      this.initMap();
    }, 500);
  }

  ngOnChanges(changes: SimpleChanges) {
    // Refresh map when passengers data changes
    if (changes['passengers'] && !changes['passengers'].firstChange && this.map) {
      this.refreshMap();
    }
  }

  private refreshMap() {
    // Remove existing passenger markers
    this.passengerMarkers.forEach(marker => {
      if (this.map && marker) {
        this.map.removeLayer(marker);
      }
    });
    this.passengerMarkers = [];

    // Remove existing route
    if (this.route && this.map) {
      this.map.removeLayer(this.route);
    }

    // Re-add markers and route
    this.addPassengerMarkersAndRoute();
  }

  private async getCurrentLocation() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      this.currentLocation = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };
    } catch (error) {
      console.warn('Geolocation failed, using default location:', error);
      // Fallback to Fourways, South Africa if geolocation fails
      this.currentLocation = {
        lat: -26.005,
        lng: 28.0038889,
      };
    }
  }

  private initMap() {
    if (!this.mapContainer || !this.driver) {
      this.isLoading = false;
      return;
    }

    // Use current location for driver marker, or driver location as fallback
    const mapCenter = this.currentLocation || {
      lat: this.driver.location.lat,
      lng: this.driver.location.lng,
    };

    // Initialize map centered on driver's current location
    this.map = L.map(this.mapContainer.nativeElement).setView([mapCenter.lat, mapCenter.lng], 13);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    // Add driver marker (blue drop icon) at current location
    const driverIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    
    this.driverMarker = L.marker([mapCenter.lat, mapCenter.lng], {
      icon: driverIcon
    })
      .addTo(this.map)
      .bindPopup(`<b>Driver (Current Location)</b><br/>${this.driver.name} ${this.driver.surname}`);

    // Add passenger markers and create route
    this.addPassengerMarkersAndRoute();

    this.isLoading = false;
  }

  private addPassengerMarkersAndRoute() {
    if (!this.map || this.passengers.length === 0) {
      return;
    }

    const mapCenter = this.currentLocation || {
      lat: this.driver!.location.lat,
      lng: this.driver!.location.lng,
    };

    const routeCoordinates: Array<[number, number]> = [[mapCenter.lat, mapCenter.lng]];
    const dropoffCoordinates: Array<[number, number]> = [];
    let markerIndex = 1;

    // First pass: Add all pickup markers and collect coordinates
    const activePassengers = this.passengers.filter((p) => p.status !== 'absent');
    
    activePassengers.forEach((p) => {
        // Determine marker color based on status
        const color = this.getStatusColor(p.status);
        
        // Check if this is the logged-in passenger
        const loggedInUser = this.usersService.getLoggedInUser();
        const isCurrentUser = loggedInUser?.role === 'passenger' && loggedInUser?.passengerId === p.id;

        const pickupMarker = L.circleMarker([p.pickupLocation.lat, p.pickupLocation.lng], {
          radius: isCurrentUser ? 10 : 6,
          fillColor: color,
          color: isCurrentUser ? '#003366' : color,
          weight: isCurrentUser ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.7,
          className: isCurrentUser ? 'current-user-marker' : ''
        })
          .addTo(this.map)
          .bindPopup(`<b>Passenger ${markerIndex} (Pickup)</b><br/>${p.nameSurname}<br/>Status: ${p.status}`);

        this.passengerMarkers.push(pickupMarker);
        routeCoordinates.push([p.pickupLocation.lat, p.pickupLocation.lng]);
        dropoffCoordinates.push([p.dropoffLocation.lat, p.dropoffLocation.lng]);
        markerIndex++;
      });

      // Second pass: Add all dropoff markers
      markerIndex = 1;
      activePassengers.forEach((p) => {
        // Check if this is the logged-in passenger
        const loggedInUser = this.usersService.getLoggedInUser();
        const isCurrentUser = loggedInUser?.role === 'passenger' && loggedInUser?.passengerId === p.id;
        
        // Add dropoff marker
        const dropoffMarker = L.circleMarker([p.dropoffLocation.lat, p.dropoffLocation.lng], {
          radius: isCurrentUser ? 10 : 6,
          fillColor: '#fd00b6',
          color: isCurrentUser ? '#003366' : '#fd00b6',
          weight: isCurrentUser ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.7,
          className: isCurrentUser ? 'current-user-marker' : ''
        })
          .addTo(this.map)
          .bindPopup(`<b>Passenger ${markerIndex} (Dropoff)</b><br/>${p.nameSurname}`);

        this.passengerMarkers.push(dropoffMarker);
        markerIndex++;
      });

      // Add all dropoff coordinates to route
      routeCoordinates.push(...dropoffCoordinates);

      // Get actual driving route from OSRM
      this.getActualRoute(routeCoordinates);

      // Fit bounds to show all markers
      const group = L.featureGroup([this.driverMarker, ...this.passengerMarkers]);
      this.map.fitBounds(group.getBounds().pad(0.1));
  }

  private getActualRoute(coordinates: [number, number][]) {
    // Format coordinates for OSRM API (lon,lat format)
    const osrmCoordinates = coordinates.map(([lat, lng]) => `${lng},${lat}`).join(';');
    
    // Call OSRM routing API
    const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoordinates}?geometries=geojson`;
    
    this.http.get<any>(url).subscribe(
      (response) => {
        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          const routeGeometry = route.geometry;

          // Convert GeoJSON coordinates to Leaflet format [lat, lng]
          const latLngRoute = routeGeometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

          // Draw the actual driving route
          if (this.route) {
            this.map.removeLayer(this.route);
          }
          
          this.route = L.polyline(latLngRoute, {
            color: '#4e63f1',
            weight: 5,
            opacity: 0.9,
          }).addTo(this.map);
        }
      },
      (error) => {
        console.warn('OSRM routing failed, using straight line:', error);
        // Fallback to straight line polyline
        this.route = L.polyline(coordinates, {
          color: '#4A90E2',
          weight: 5,
          opacity: 0.9,
        }).addTo(this.map);
      }
    );
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'ready':
        return '#10b981'; // green
      case 'not-ready':
        return '#f59e0b'; // yellow
      case 'absent':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }
}
