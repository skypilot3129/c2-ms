export interface ManifestItem {
    noSTT: string;
    koli: number;
    berat: number; // kg
    isiBarang: string;
    pengirim: string;
    penerima: string;
    keterangan: string;
}

export interface CargoManifest {
    id?: string;
    tanggal: string; // YYYY-MM-DD
    kapal: string;
    nopol: string;
    sopir: string;
    kepadaYth: string;
    items: ManifestItem[];
    createdBy: string;
    createdByName?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
