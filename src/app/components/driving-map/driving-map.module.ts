import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DrivingMapComponent } from './driving-map.component';

@NgModule({
  declarations: [DrivingMapComponent],
  imports: [CommonModule, IonicModule],
  exports: [DrivingMapComponent]
})
export class DrivingMapModule {}
