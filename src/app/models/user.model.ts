import { Driver } from './driver.model';

export interface User {
  id: string;
  username: string;
  password?: string; // optional, for demo/auth
  driverId?: string; // reference to driver (optional, only for drivers)
  driver?: Driver; // populated driver object
  passengerId?: string; // reference to passenger (optional, only for passengers)
  role: 'driver' | 'passenger' | 'admin';
  createdAt?: Date;
}
