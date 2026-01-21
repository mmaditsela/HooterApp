export interface GroupRoutes {
  id: string;
  name: string;
  startTime: string; // ISO time or HH:mm
  endTime: string;   // ISO time or HH:mm
  activeDays: string[]; // e.g. ['Mon','Wed','Fri']
  joiningCode: string; // used for QR later
}
