export type ManifestRowColor = 'white' | 'purple' | 'yellow' | 'green' | 'red' | 'blue';

export interface ManifestItem {
    noSTT: string;
    koli: number;
    berat: number | string; // kg or text (e.g. 5192.99 or "882 KV")
    pengirim: string;
    penerima: string;
    isiBarang: string;
    alamat: string;
    keterangan: string;
    color?: ManifestRowColor;
}

export interface CargoManifest {
    id?: string;
    tanggal: string; // YYYY-MM-DD or display date string
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
