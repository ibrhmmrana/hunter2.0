export interface User {
  id: string;
  email?: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

