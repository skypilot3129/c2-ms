# Panduan Setup AI Agent WhatsApp CCE (Komputer Kantor Windows 8GB RAM)

Panduan ini dirancang untuk alur kerja Anda:
- **Laptop**: tempat Anda coding, edit sistem, lalu `git push` ke GitHub.
- **Komputer Kantor (Windows 8GB RAM)**: tempat **OpenWA Docker (`baileys`) + AI Agent CCE** menyala 24 jam dengan **Opsi A (Full Lokal, Rp 0 biaya VPS/tunnel)**.

> Penting: Di komputer kantor, pasang aplikasi di **`C:\cce_app`** (**di luar folder OneDrive**) agar tidak terkena error file terkunci saat build atau saat Docker berjalan.

---

## Langkah 0 — Di Laptop Anda (Cukup 1× Saja)

1. **Push kode terbaru** ke GitHub (`git` / `git push origin main`).
2. **Publish `firestore.rules` terbaru** (cukup sekali):
   - Jalankan di terminal laptop `firebase deploy --only firestore:rules`, **atau**
   - Salin isi file `firestore.rules` dan paste di **Firebase Console → Firestore Database → Rules → Publish**.
   - *(Ini wajib agar halaman `/admin/whatsapp-agent` di web bisa membaca/menulis daftar nomor WA karyawan & log AI.)*
3. **Salin file `.env.local` dari laptop** ke flashdisk / transfer aman (file ini berisi kunci Firebase Admin & `GEMINI_API_KEY` dan memang tidak ikut ke GitHub).

---

## Langkah 1 — Persiapan Komputer Kantor (Windows 8GB)

1. **Matikan Mode Sleep Windows** (agar WhatsApp tidak putus saat layar mati):
   - Buka **Settings → System → Power & battery → Screen and sleep**.
   - Set **When plugged in, put my device to sleep after** → **Never** (layar boleh mati setelah 10–15 menit).
2. **Install 3 Aplikasi Dasar di Komputer Kantor** (jika belum ada):
   - **Git for Windows**
   - **Node.js LTS** (versi 20 / 22 / 24)
   - **Docker Desktop for Windows** (aktifkan backend **WSL 2**, dan di Docker Settings → **General** centang **Start Docker Desktop when you sign in to your computer**).
3. **Siapkan 1 Nomor WhatsApp Khusus "Admin AI CCE"**:
   - Jangan pakai nomor pribadi Owner.
   - Pastikan nomor ini sudah aktif di HP dan pernah dipakai chat normal.

---

## Langkah 2 — Pasang Aplikasi CCE di `C:\cce_app` & Atur `.env.local`

Buka **PowerShell** di komputer kantor:

```powershell
git clone https://github.com/skypilot3129/c2-ms.git C:\cce_app
cd C:\cce_app
npm install
```

Lalu tempel file `.env.local` dari laptop ke **`C:\cce_app\.env.local`**, dan tambahkan baris berikut di bagian paling bawah:

```env
OPENWA_BASE_URL=http://localhost:2785
OPENWA_API_KEY=TEMPEL_API_KEY_DARI_OPENWA
OPENWA_SESSION_ID=cce-admin
OPENWA_WEBHOOK_SECRET=cce-rahasia-webhook-2026

# Isi dengan URL web CCE produksi Anda (mis. Vercel) agar link invoice di WA bisa dibuka dari HP:
NEXT_PUBLIC_APP_URL=https://domain-cce-anda.vercel.app
```

*(Biarkan `OPENWA_API_KEY` sementara sampai didapat di Langkah 5, lalu nanti diisi dan restart `start-kantor.bat`.)*

Build aplikasi CCE versi produksi (hemat RAM dibanding mode `dev`):

```powershell
cd C:\cce_app
npm run build
```

---

## Langkah 3 — Buka Izin Windows Firewall Port `3000` (Docker → Windows)

Di Windows, container Docker OpenWA menghubungi Next.js lewat `http://host.docker.internal:3000/api/whatsapp/webhook`. Agar **Windows Defender Firewall** tidak memblokir koneksi dari WSL2/Docker ini, buka **PowerShell sebagai Administrator** lalu jalankan **1× saja**:

```powershell
New-NetFirewallRule -DisplayName "CCE AI Agent Port 3000 (Docker Webhook)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## Langkah 4 — Jalankan OpenWA + CCE Server (Dan Auto-Start Saat Nyala)

1. Klik 2× file **`C:\cce_app\wa-agent\start-kantor.bat`**
   - Skrip ini otomatis menunggu Docker siap, menjalankan **OpenWA (`baileys`)** di port `2785`, lalu menjalankan server produksi **CCE** di `0.0.0.0:3000`.
2. *(Sangat disarankan)* **Aktifkan Auto-Start saat Windows Nyala / Mati Lampu**:
   - Tekan **`Win + R`**, ketik `shell:startup`, lalu tekan Enter.
   - Klik kanan `C:\cce_app\wa-agent\start-kantor.bat` → **Create shortcut** → pindahkan shortcut-nya ke folder `Startup` yang baru terbuka.
3. Tes di terminal / PowerShell komputer kantor bahwa webhook siap merespons:
   `Invoke-RestMethod http://localhost:3000/api/whatsapp/webhook`

---

## Langkah 5 — Hubungkan Nomor WA di Dashboard OpenWA & Aktifkan Whitelist

1. Di browser komputer kantor, buka **`http://localhost:2785`** (Dashboard OpenWA).
2. Pastikan Engine = **`baileys`**.
3. Buat **Session** dengan ID: **`cce-admin`** → klik **Connect / Show QR** → scan QR pakai WA khusus Admin AI CCE di HP.
4. Masuk menu **API Keys** di dashboard OpenWA → klik **Create API Key** → salin dan tempel ke **`OPENWA_API_KEY=`** di `C:\cce_app\.env.local`.
5. Masuk ke **Session `cce-admin` → Webhooks**, tambahkan webhook baru:
   - **Webhook URL**: `http://host.docker.internal:3000/api/whatsapp/webhook`
   - **Events**: centang **`message.received`**
   - **Secret**: isi sama persis dengan `OPENWA_WEBHOOK_SECRET` (mis. `cce-rahasia-webhook-2026`)
6. Tutup jendela terminal `start-kantor.bat` lalu klik 2× lagi **`start-kantor.bat`** supaya `OPENWA_API_KEY` yang baru diisi terbaca.
7. Buka **`http://localhost:3000/admin/whatsapp-agent`** (atau via domain Vercel Anda bila admin membuka dari HP):
   - Pastikan badge **OpenWA Server** dan **Gemini** berwarna hijau.
   - Aktifkan sakelar **Agent: AKTIF**.
   - Daftarkan nomor WA **Owner** dan **Admin kantor** di **Daftar Nomor WA Karyawan** (nomor di luar daftar akan otomatis diblokir).

---

## Langkah 6 — Cara Update Aplikasi Saat Ada Fitur Baru dari Laptop

Setiap kali Anda update kode di laptop dan `git push` ke GitHub:
1. Di komputer kantor, tutup jendela `start-kantor.bat` yang sedang berjalan.
2. Klik 2× **`C:\cce_app\wa-agent\update-kantor.bat`** (otomatis `git pull`, `npm install`, `npm run build`, dan update image OpenWA).
3. Jalankan lagi **`C:\cce_app\wa-agent\start-kantor.bat`**.

---

## Contoh Perintah di WhatsApp

- `"Cek resi 19787"`
- `"Cek STT milik BP Rahmat yang belum dibuat invoice"`
- `"Cek piutang belum lunas"`
- `"Ringkasan omzet kapal KM Dharma Kencana"`
- `"Input STT cabang Surabaya, pengirim DHS, penerima Toko Maju tujuan Makassar, 5 koli 120 kg, harga 2500 per kg, isi barang konveksi, pembayaran kredit"`
  → AI merangkum draft → balas **`YA`** untuk simpan (atau **`BATAL`**).
- `"Buatkan invoice untuk DHS dari STT yang belum ditagih"`
  → AI menghitung total & daftar STT → balas **`YA`** untuk menerbitkan invoice & mendapat link cetak A5/WA.
- Bisa juga kirim **Voice Note** atau **Foto Nota tulisan tangan** untuk diinput ke STT!
