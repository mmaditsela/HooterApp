export type PassengerStatus = 'ready' | 'not-ready' | 'absent' | 'unset';

export interface Passenger {
  id: string;
  groupId: string;
  nameSurname: string;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  contact: { phone?: string; email?: string };
  status: PassengerStatus;
}
