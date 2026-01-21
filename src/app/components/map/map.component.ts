import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Driver } from '../../models/driver.model';
import { Passenger } from '../../models/passenger.model';
import { Geolocation } from '@capacitor/geolocation';
import { HttpClient } from '@angular/common/http';

declare let L: any; // Leaflet library

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: false,
})
export class MapComponent implements OnInit, AfterViewInit {
  @Input() driver: Driver | undefined;
  @Input() passengers: Passenger[] = [];
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private map: any;
  private driverMarker: any;
  private passengerMarkers: any[] = [];
  private route: any;
  isLoading: boolean = true;
  private currentLocation: { lat: number; lng: number } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.getCurrentLocation();
  }

  ngAfterViewInit() {
    // Wait a moment for location to be fetched
    setTimeout(() => {
      this.initMap();
    }, 500);
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

    // Add driver marker (blue) at current location
    this.driverMarker = L.marker([mapCenter.lat, mapCenter.lng], {
      radius: 8,
      fillColor: '#0066cc',
      color: '#0066cc',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .addTo(this.map)
      .bindPopup(`<b>Driver (Current Location)</b><br/>${this.driver.name} ${this.driver.surname}`);

    // Add passenger markers and create route
    if (this.passengers.length > 0) {
      const routeCoordinates: Array<[number, number]> = [[mapCenter.lat, mapCenter.lng]];
      const dropoffCoordinates: Array<[number, number]> = [];
      let markerIndex = 1;

      // First pass: Add all pickup markers and collect coordinates
      const activePassengers = this.passengers.filter((p) => p.status !== 'absent');
      
      activePassengers.forEach((p) => {
        // Determine marker color based on status
        const color = this.getStatusColor(p.status);

        const pickupMarker = L.circleMarker([p.pickupLocation.lat, p.pickupLocation.lng], {
          radius: 6,
          fillColor: color,
          color: color,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
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
        // Add dropoff marker
        const dropoffMarker = L.circleMarker([p.dropoffLocation.lat, p.dropoffLocation.lng], {
          radius: 6,
          fillColor: '#fd00b6',
          color: '#fd00b6',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
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

    this.isLoading = false;
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
            color: '#ff7e00',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 5',
          }).addTo(this.map);
        }
      },
      (error) => {
        console.warn('OSRM routing failed, using straight line:', error);
        // Fallback to straight line polyline
        this.route = L.polyline(coordinates, {
          color: '#ff7e00',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 5',
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
