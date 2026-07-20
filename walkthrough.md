# Walkthrough — Import CSV/Excel, Riwayat Harga Edit, & Satuan KG/Volume

Saya telah menyelesaikan implementasi fitur import massal transaksi, riwayat harga, dukungan satuan baru `KG/Volume`, serta penyesuaian cetak invoice untuk satuan `KG/Volume`.

---

## 🛠️ Ringkasan Fitur yang Ditambahkan

### 1. 📥 Menu Import Transaksi (CSV & Excel)
* **Lokasi Halaman**: `/app/transactions/import` (diakses lewat tombol **Import CSV/Excel** di samping "Buat Resi").
* **Dua Cara Input**:
  1. **Upload File (.csv, .xlsx, .xls)**: Sistem memuat modul `xlsx` (SheetJS) secara *on-demand* dari CDN agar bundle tetap ringan.
  2. **Copy-Paste Instan**: Salin (`Ctrl+C`) baris dari Excel/Google Sheets dan tempelkan (`Ctrl+V`) ke area teks.
* **Mapping Kolom Otomatis**: Mendeteksi nama kolom dari file secara cerdas (`NO STT`, `KOLI`, `BERAT`, `PENGIRIM`, `PENERIMA`, `ISI BARANG`, `ALAMAT`, `TUJUAN`).
* **Editable Preview Grid**: Tinjau, validasi, dan edit data sebelum masuk database.
* **Nama Pengirim Tidak Terdaftar**: Pengirim yang tidak cocok dengan database akan dikosongkan `pengirimId`-nya (`""`), tetapi `pengirimName` tetap disimpan sesuai nama di file.

### 2. ⚡ Riwayat Harga pada Halaman Edit Transaksi
* Menampilkan daftar harga satuan regular sebelumnya yang pernah di-input untuk client pengirim terpilih di bawah input *Harga Satuan*.

### 3. ⚖️ Dukungan Satuan Baru: `KG/Volume` (3 Satuan)
* Menambahkan satuan `KG/Volume` ke jenis data `BeratUnit` di sistem.
* Kini operator memiliki 3 pilihan satuan:
  1. **KG** (Kilogram)
  2. **KG/Volume** (KG per Volume)
  3. **M3** (Kubikasi)
* Pilihan ini telah diintegrasikan pada:
  - Form Pembuatan Transaksi Baru (`/transactions/new`).
  - Form Edit Transaksi (`/transactions/[id]/edit`).
  - Form Import Transaksi (`/transactions/import`).
  - Skema AI parsing suara (Voice Assistant).

### 🖨️ 4. Penyesuaian Cetak Invoice & Cetak Bulk
* Mengubah tabel cetak invoice secara dinamis: jika data transaksi yang dicetak menggunakan satuan **KG/Volume**, maka judul kolom tabel di kertas cetak yang tadinya `KG/M3` otomatis akan berubah menjadi **KG VOLUME**.
* Perubahan ini diterapkan di:
  - Cetak Invoice Client (`/finance/invoices/[id]/print`).
  - Cetak Resi/Invoice Transaksi Tunggal (`/transactions/[id]/print`).
  - Cetak Invoice Gabungan/Bulk (`/transactions/print-bulk`).

---

## 🧪 Hasil Pengujian & Verifikasi
* Verifikasi tipe data (`npx tsc --noEmit`) berhasil diselesaikan **tanpa error kompilasi**.
* Perubahan kode telah di-push ke repositori GitHub:
  * **Commit Hash**: `60d2612`
  * **Pesan Commit**: `feat(print): dynamically render KG VOLUME column header on printed invoice templates if transactions have KG/VOLUME unit`
