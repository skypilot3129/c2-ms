export type FleetStatus = 'Available' | 'On Trip' | 'Maintenance';

export interface Fleet {
    id: string;
    userId: string;
    name: string; // e.g. "Truck A", "Blind Van 2"
    plateNumber: string;
    type: string; // e.g. "CDD Box", "Grand Max"
    status: FleetStatus;
    driverName?: string; // Optional default driver
    createdAt: Date;
    updatedAt: Date;
}

export type ServiceType = 'Service Rutin' | 'Ganti Oli' | 'Ban' | 'Sparepart' | 'Perbaikan Berat' | 'Lainnya';

export interface MaintenanceLog {
    id: string;
    userId: string;
    fleetId: string;
    fleetName: string; // Denormalized for easier display
    date: Date;
    serviceType: ServiceType;
    description: string;
    cost: number;
    provider: string; // Bengkel name
    expenseId?: string; // Link to the created expense record
    createdAt: Date;
}
