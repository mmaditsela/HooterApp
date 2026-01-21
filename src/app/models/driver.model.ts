export interface Driver {
  id: string;
  name: string;
  surname: string;
  location: {
    lat: number;
    lng: number;
  };
  contact: {
    phone?: string;
    email?: string;
  };
}
