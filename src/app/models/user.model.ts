import { Driver } from './driver.model';

export interface User {
  id: string;
  username: string;
  password?: string; // optional, for demo/auth
  driverId: string; // reference to driver
  driver?: Driver; // populated driver object
  role: 'driver' | 'passenger' | 'admin';
  createdAt?: Date;
}
