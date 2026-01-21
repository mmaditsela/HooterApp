import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Driver } from '../../models/driver.model';
import { Passenger } from '../../models/passenger.model';

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

  constructor() {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap() {
    if (!this.mapContainer || !this.driver) {
      this.isLoading = false;
      return;
    }

    // Initialize map centered on driver location
    this.map = L.map(this.mapContainer.nativeElement).setView(
      [this.driver.location.lat, this.driver.location.lng],
      13
    );
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    // Add driver marker (blue)
    this.driverMarker = L.circleMarker([this.driver.location.lat, this.driver.location.lng], {
      radius: 8,
      fillColor: '#0066cc',
      color: '#0066cc',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .addTo(this.map)
      .bindPopup(`<b>Driver</b><br/>${this.driver.name} ${this.driver.surname}`);

    // Add passenger markers and create route
    if (this.passengers.length > 0) {
      const routeCoordinates = [[this.driver.location.lat, this.driver.location.lng]];

      this.passengers.forEach((p, index) => {
        // Determine marker color based on status
        const color = this.getStatusColor(p.status);

        const marker = L.circleMarker([p.pickupLocation.lat, p.pickupLocation.lng], {
          radius: 6,
          fillColor: color,
          color: color,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        })
          .addTo(this.map)
          .bindPopup(`<b>Passenger ${index + 1}</b><br/>${p.nameSurname}<br/>Status: ${p.status}`);

        this.passengerMarkers.push(marker);
        routeCoordinates.push([p.pickupLocation.lat, p.pickupLocation.lng]);
      });

      // Draw route polyline
      this.route = L.polyline(routeCoordinates, {
        color: '#ff7e00',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5',
      }).addTo(this.map);

      // Fit bounds to show all markers
      const group = L.featureGroup([this.driverMarker, ...this.passengerMarkers]);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }

    this.isLoading = false;
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
