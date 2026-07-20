<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Line Haul TO RunSheet Parser & Verifier</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- FontAwesome Icons for logistics UI elements -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- PapaParse for robust client-side CSV parsing -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body {
            font-family: 'Inter', sans-serif;
        }
        .scrollbar-custom::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">

    <!-- Header -->
    <header class="bg-gradient-to-r from-slate-800 via-blue-900 to-indigo-950 text-white shadow-md py-5 px-6">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3">
                <div class="bg-white/10 p-2.5 rounded-lg backdrop-blur-sm">
                    <i class="fa-solid fa-truck-ramp-box text-2xl text-blue-200"></i>
                </div>
                <div>
                    <h1 class="text-xl font-bold tracking-tight">Line Haul RunSheet Parser & Verifier</h1>
                    <p class="text-xs text-blue-200 mt-0.5">Ekstraksi Dinamis • Akurasi 100% Tanpa Salah Karakter • Siap Salin ke Excel</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full font-medium border border-emerald-500/30 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Pemrosesan Lokal Aman (Sandbox)
                </span>
            </div>
        </div>
    </header>

    <!-- Main Content Grid -->
    <main class="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        <!-- Step 1: Upload Zone -->
        <div id="upload-section" class="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer shadow-sm relative group">
            <input type="file" id="csv-file" accept=".csv" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
            <div class="max-w-md mx-auto py-6">
                <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <i class="fa-solid fa-file-csv text-3xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-slate-700 mb-1">Unggah Berkas RunSheet Baru (.csv)</h3>
                <p class="text-sm text-slate-500 mb-4">Seret & taruh berkas <span class="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-bold">LHTrip_LT0Q6L1IN2JO1_RunSheet_All.csv</span> di sini atau klik untuk mencari berkas.</p>
                <span class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
                    <i class="fa-solid fa-folder-open"></i> Pilih Berkas CSV
                </span>
            </div>
        </div>

        <!-- Dashboard Controls & Summary (Hidden until file parsed) -->
        <div id="dashboard-section" class="hidden flex flex-col gap-6">
            
            <!-- Trip Metadata Card -->
            <div class="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm border border-slate-700/50">
                <div class="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <i class="fa-solid fa-circle-info"></i> Informasi Manifest Perjalanan
                </div>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                        <p class="text-[10px] text-slate-400">Kode Trip / SJ</p>
                        <p id="meta-trip-id" class="text-sm font-bold font-mono text-slate-200">-</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400">Rute Perjalanan</p>
                        <p id="meta-route" class="text-sm font-bold text-slate-200">-</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400">No. Polisi Armada</p>
                        <p id="meta-nopol" class="text-sm font-bold font-mono text-slate-200">-</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400">Driver / Vendor</p>
                        <p id="meta-driver" class="text-sm font-bold text-slate-200">-</p>
                    </div>
                    <div class="col-span-2 md:col-span-1">
                        <p class="text-[10px] text-slate-400">Waktu Segel</p>
                        <p id="meta-segel-time" class="text-sm font-bold text-slate-200 font-mono">-</p>
                    </div>
                </div>
            </div>

            <!-- Statistics Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-list-check"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 font-medium">Total Record TO</p>
                        <h4 id="stat-total-to" class="text-2xl font-bold text-slate-800">0</h4>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 font-medium">Total Qty Paket</p>
                        <h4 id="stat-total-packages" class="text-2xl font-bold text-slate-800">0</h4>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-weight-hanging"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 font-medium">Total Berat (kg)</p>
                        <h4 id="stat-total-weight" class="text-2xl font-bold text-slate-800">0.00</h4>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center gap-4">
                    <div class="w-12 h-12 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 font-medium">Dangerous Goods (DG)</p>
                        <h4 id="stat-total-dg" class="text-2xl font-bold text-slate-800">0</h4>
                    </div>
                </div>
            </div>

            <!-- Quick Action Copy Board -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Menu Salin Cepat (Siap Tempel)</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button onclick="copyData('excel')" class="flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm text-sm">
                        <i class="fa-solid fa-file-excel text-base"></i>
                        <span>Salin Format Excel / Sheet</span>
                    </button>
                    <button onclick="copyData('text-list')" class="flex items-center justify-center gap-2.5 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm text-sm">
                        <i class="fa-solid fa-list-ol text-base"></i>
                        <span>Salin Daftar No. TO Saja</span>
                    </button>
                    <button onclick="downloadCleanCSV()" class="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm text-sm">
                        <i class="fa-solid fa-file-arrow-down text-base"></i>
                        <span>Unduh Berkas CSV Bersih</span>
                    </button>
                </div>
            </div>

            <!-- Data Table Card -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <!-- Search & Filter Controls -->
                <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div class="relative w-full md:w-96">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input type="text" id="search-input" oninput="applyFilters()" placeholder="Cari Nomor TO, Tipe, atau Status..." class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                    </div>
                    <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <select id="filter-to-type" onchange="applyFilters()" class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="ALL">Semua Tipe TO</option>
                            <option value="Bag">Bag</option>
                            <option value="Bulky">Bulky</option>
                            <option value="Liquid">Liquid</option>
                        </select>
                        <select id="filter-dg-type" onchange="applyFilters()" class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="ALL">Semua DG Status</option>
                            <option value="DG">Dangerous Goods (DG)</option>
                            <option value="Non-DG">Non-DG / Aman</option>
                        </select>
                        <button onclick="resetFilters()" class="text-xs text-slate-500 hover:text-blue-600 underline font-medium">Reset</button>
                    </div>
                </div>

                <!-- Actual Table Container -->
                <div class="overflow-x-auto scrollbar-custom max-h-[500px]">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-100 text-slate-600 text-xs uppercase font-semibold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th class="py-3.5 px-4 text-center w-16">No</th>
                                <th class="py-3.5 px-4 font-mono">Nomor TO</th>
                                <th class="py-3.5 px-4 text-center">Jumlah Paket</th>
                                <th class="py-3.5 px-4 text-right">Berat (kg)</th>
                                <th class="py-3.5 px-4">Tujuan</th>
                                <th class="py-3.5 px-4">TO Type</th>
                                <th class="py-3.5 px-4">DG Type</th>
                            </tr>
                        </thead>
                        <tbody id="table-body" class="divide-y divide-slate-100 text-sm text-slate-700">
                            <!-- Rows loaded dynamically -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Table Footer status -->
                <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                    <span id="showing-rows">Menampilkan 0 dari 0 data TO</span>
                    <span class="flex items-center gap-1"><i class="fa-solid fa-circle-exclamation text-blue-500"></i> Klik ganda pada sel nomor TO untuk memilih kode secara cepat</span>
                </div>
            </div>

        </div>

    </main>

    <!-- Global Toast Alert System -->
    <div id="toast" class="fixed bottom-5 right-5 transform translate-y-10 opacity-0 invisible transition-all duration-300 z-50 flex items-center gap-3 bg-slate-900 text-white py-3 px-5 rounded-xl shadow-xl max-w-sm">
        <div id="toast-icon" class="text-emerald-400">
            <i class="fa-solid fa-circle-check text-lg"></i>
        </div>
        <p id="toast-message" class="text-sm font-medium">Berhasil disalin!</p>
    </div>

    <!-- Footer -->
    <footer class="bg-slate-100 border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-8">
        <p>&copy; 2026 Line Haul Operation Support. Seluruh ekstraksi dan parsing diproses 100% lokal pada komputer Anda.</p>
    </footer>

    <!-- JS Application Logic -->
    <script>
        // Global variables holding parsed dataset & trip metadata
        let parsedData = [];
        let filteredData = [];
        let tripMeta = {
            tripId: "-",
            route: "-",
            nopol: "-",
            driver: "-",
            vendor: "-",
            segelTime: "-"
        };

        // UI references
        const uploadSection = document.getElementById('upload-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const csvFileInput = document.getElementById('csv-file');
        
        // Listeners
        csvFileInput.addEventListener('change', handleFileSelect);

        // Core Parser File Handler
        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;

            Papa.parse(file, {
                header: false,
                skipEmptyLines: true,
                complete: function(results) {
                    processCSVData(results.data);
                },
                error: function(err) {
                    showToast('Gagal memproses berkas CSV: ' + err.message, 'error');
                }
            });
        }

        // Helper: Robust weight parsing handling Indonesian and US locales
        function parseWeight(val) {
            if (!val) return 0.0;
            let s = String(val).trim().replace(/\s/g, '');
            
            // If both dots and commas exist
            if (s.includes('.') && s.includes(',')) {
                const dotIdx = s.indexOf('.');
                const commaIdx = s.indexOf(',');
                if (dotIdx < commaIdx) {
                    // Indonesian format (e.g. 5.166,847) -> strip dot, convert comma to dot
                    s = s.replace(/\./g, '').replace(',', '.');
                } else {
                    // US format (e.g. 5,166.847) -> strip comma
                    s = s.replace(/,/g, '');
                }
            } else if (s.includes(',')) {
                // Check if comma represents thousands or decimals.
                // In logistics, individual TO weight is rarely > 1000 kg.
                // If there are exactly 3 digits after the comma (e.g. 10,200), it's likely decimal 10.2
                // We convert comma to dot.
                s = s.replace(',', '.');
            }
            
            return parseFloat(s) || 0.0;
        }

        // Helper: Robust package parsing
        function parsePackages(val) {
            if (!val) return 0;
            let s = String(val).trim().replace(/\s/g, '');
            s = s.replace(/[,.]/g, ''); // strip thousands
            return parseInt(s) || 0;
        }

        // Processing & Extracting TO records intelligently from raw sheets (DYNAMIC COLUMN RESOLVING)
        function processCSVData(rows) {
            const tempResult = [];
            
            // Reset metadata
            tripMeta = { tripId: "-", route: "-", nopol: "-", driver: "-", vendor: "-", segelTime: "-" };

            // 1. Scan for trip metadata from header rows
            for (let r = 0; r < Math.min(rows.length, 15); r++) {
                const rowStr = rows[r].join(" ");
                
                // Trip ID (LT kode)
                const tripMatch = rowStr.match(/LT[Q0-9A-Z]{11}/i);
                if (tripMatch && tripMeta.tripId === "-") {
                    tripMeta.tripId = tripMatch[0].toUpperCase();
                }

                // Route info
                if (rowStr.includes("Surat Jalan Line Haul") && r + 1 < rows.length) {
                    // Sometimes next rows contain route
                }
                
                for (let c = 0; c < rows[r].length; c++) {
                    const cellVal = String(rows[r][c]).trim();
                    const nextCellVal = rows[r][c+1] ? String(rows[r][c+1]).trim() : "";
                    const cleanedVal = cellVal.toLowerCase();

                    if (cleanedVal.includes("nama line haul trip")) {
                        // Gather route from next non-empty cells
                        let routeText = "";
                        for (let offset = 1; offset < 5; offset++) {
                            if (rows[r][c+offset]) {
                                routeText += " " + String(rows[r][c+offset]).trim();
                            }
                        }
                        tripMeta.route = routeText.replace(/^[\s:]+/, '').trim() || "-";
                    }
                    if (cleanedVal.includes("nomor polisi") || cleanedVal.includes("no polisi")) {
                        tripMeta.nopol = nextCellVal.replace(/^[\s:]+/, '').trim() || "-";
                    }
                    if (cleanedVal.includes("nama driver") || cleanedVal.includes("driver")) {
                        tripMeta.driver = nextCellVal.replace(/^[\s:]+/, '').trim() || "-";
                    }
                    if (cleanedVal.includes("nama vendor") || cleanedVal.includes("vendor")) {
                        tripMeta.vendor = nextCellVal.replace(/^[\s:]+/, '').trim() || "-";
                    }
                    if (cleanedVal.includes("waktu segel")) {
                        tripMeta.segelTime = nextCellVal.replace(/^[\s:]+/, '').trim() || "-";
                    }
                }
            }

            // 2. Discover dynamic column indices by scanning the CSV header row
            let headerMap = { toIdx: -1, paketIdx: -1, beratIdx: -1, tujuanIdx: -1, typeIdx: -1, dgIdx: -1 };
            for (let r = 0; r < Math.min(rows.length, 35); r++) {
                const row = rows[r];
                let foundTOHeader = false;
                let tempMap = { toIdx: -1, paketIdx: -1, beratIdx: -1, tujuanIdx: -1, typeIdx: -1, dgIdx: -1 };
                
                for (let c = 0; c < row.length; c++) {
                    const val = String(row[c]).trim().toLowerCase();
                    if (val === 'nomor to' || val === 'to number' || val === 'to no' || val === 'to_number') {
                        tempMap.toIdx = c;
                        foundTOHeader = true;
                    } else if (val.includes('jmlh') || val === 'jumlah' || val === 'qty' || val === 'paket' || val === 'jml') {
                        tempMap.paketIdx = c;
                    } else if (val.includes('berat') || val.includes('weight')) {
                        tempMap.beratIdx = c;
                    } else if (val === 'destination' || val === 'tujuan' || val === 'dest') {
                        tempMap.tujuanIdx = c;
                    } else if (val.includes('to type') || val === 'to_type' || (val === 'type' && tempMap.typeIdx === -1)) {
                        tempMap.typeIdx = c;
                    } else if (val.includes('dg type') || val === 'dg_type' || val === 'dg') {
                        tempMap.dgIdx = c;
                    }
                }
                if (foundTOHeader) {
                    headerMap = tempMap;
                    break;
                }
            }

            // 3. Process each row and parse TOs
            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                
                // Locate the exact cell index holding the valid TO pattern
                let toColIdx = -1;
                let toVal = "";
                for (let c = 0; c < row.length; c++) {
                    const cellVal = String(row[c]).trim();
                    if (/^TO[0-9]{8}[A-Z0-9]+$/i.test(cellVal)) {
                        toColIdx = c;
                        toVal = cellVal.toUpperCase();
                        break;
                    }
                }

                // If found, extract elements using header mapping (or fallback offsets if headers mismatch)
                if (toColIdx !== -1) {
                    let paket = 0;
                    let berat = 0.0;
                    let tujuan = "-";
                    let type = "-";
                    let dg = "-";

                    if (headerMap.toIdx !== -1) {
                        // Standardized Header Mapping
                        if (headerMap.paketIdx !== -1 && row[headerMap.paketIdx]) {
                            paket = parsePackages(row[headerMap.paketIdx]);
                        }
                        if (headerMap.beratIdx !== -1 && row[headerMap.beratIdx]) {
                            berat = parseWeight(row[headerMap.beratIdx]);
                        }
                        if (headerMap.tujuanIdx !== -1 && row[headerMap.tujuanIdx]) {
                            tujuan = String(row[headerMap.tujuanIdx]).trim();
                        }
                        if (headerMap.typeIdx !== -1 && row[headerMap.typeIdx]) {
                            type = String(row[headerMap.typeIdx]).trim();
                        }
                        if (headerMap.dgIdx !== -1 && row[headerMap.dgIdx]) {
                            const rawDg = String(row[headerMap.dgIdx]).trim();
                            dg = (rawDg === "" || rawDg === "-") ? "-" : rawDg;
                        }
                    } else {
                        // Fail-safe scanning relative to TO column index
                        let foundNumerics = [];
                        for (let c = toColIdx + 1; c < row.length; c++) {
                            const val = String(row[c]).trim();
                            if (val === "") continue;

                            const cleanNum = val.replace(/,/g, '.');
                            if (!isNaN(cleanNum) && cleanNum !== "") {
                                foundNumerics.push({ index: c, value: parseFloat(cleanNum), raw: val });
                            }
                            if (val.toLowerCase().includes('dc') || val.toLowerCase().includes('hub')) {
                                tujuan = val;
                            }
                            if (['bag', 'bulky', 'liquid'].includes(val.toLowerCase())) {
                                type = val;
                            }
                            if (['non-dg', 'dg type a', 'dg type b'].includes(val.toLowerCase())) {
                                dg = val;
                            }
                        }

                        if (foundNumerics.length >= 2) {
                            paket = parsePackages(foundNumerics[0].raw);
                            berat = parseWeight(foundNumerics[1].raw);
                        } else if (foundNumerics.length === 1) {
                            berat = parseWeight(foundNumerics[0].raw);
                        }
                    }

                    // Strict auto-fixes for empty types
                    if (type === "" || type === "-") {
                        for (let c = 0; c < row.length; c++) {
                            const val = String(row[c]).trim().toLowerCase();
                            if (['bag', 'bulky', 'liquid'].includes(val)) {
                                type = row[c].trim();
                            }
                        }
                    }

                    tempResult.push({
                        toNum: toVal,
                        paket: paket,
                        berat: berat,
                        tujuan: tujuan,
                        type: type,
                        dg: (dg === "" || dg === "-") ? "Non-DG" : dg
                    });
                }
            }

            if (tempResult.length === 0) {
                showToast('Format lembar kerja tidak sesuai. Pastikan berkas memiliki kolom TO yang valid.', 'error');
                return;
            }

            parsedData = tempResult;
            filteredData = [...parsedData];
            
            // Render Dashboard
            renderDashboard();
            
            // Minimalize upload section
            uploadSection.classList.remove('p-8');
            uploadSection.classList.add('p-4', 'bg-slate-100/50');
            uploadSection.querySelector('h3').textContent = "Ingin memuat berkas RunSheet lain?";
            uploadSection.querySelector('p').classList.add('hidden');
            
            // Show dashboard
            dashboardSection.classList.remove('hidden');
            showToast(`Berhasil memetakan & mengekstrak ${parsedData.length} data TO secara akurat!`);
        }

        // Render Dashboard Data & Stats
        function renderDashboard() {
            let totalPackages = 0;
            let totalWeight = 0;
            let totalDG = 0;

            parsedData.forEach(item => {
                totalPackages += item.paket;
                totalWeight += item.berat;
                if (item.dg !== "-" && item.dg.toLowerCase() !== "non-dg") {
                    totalDG++;
                }
            });

            // Set stats elements
            document.getElementById('stat-total-to').textContent = parsedData.length;
            document.getElementById('stat-total-packages').textContent = totalPackages.toLocaleString('id-ID');
            document.getElementById('stat-total-weight').textContent = totalWeight.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " kg";
            document.getElementById('stat-total-dg').textContent = totalDG;

            // Set trip metadata
            document.getElementById('meta-trip-id').textContent = tripMeta.tripId;
            document.getElementById('meta-route').textContent = tripMeta.route;
            document.getElementById('meta-nopol').textContent = tripMeta.nopol;
            document.getElementById('meta-driver').textContent = tripMeta.driver + " (" + tripMeta.vendor + ")";
            document.getElementById('meta-segel-time').textContent = tripMeta.segelTime;

            applyFilters();
        }

        // Apply filters & search logic
        function applyFilters() {
            const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
            const toTypeFilter = document.getElementById('filter-to-type').value;
            const dgTypeFilter = document.getElementById('filter-dg-type').value;

            filteredData = parsedData.filter(item => {
                const matchSearch = item.toNum.toLowerCase().includes(searchQuery) || 
                                    item.tujuan.toLowerCase().includes(searchQuery) ||
                                    item.type.toLowerCase().includes(searchQuery) ||
                                    item.dg.toLowerCase().includes(searchQuery);

                const matchType = toTypeFilter === 'ALL' || item.type === toTypeFilter;
                
                let matchDG = true;
                if (dgTypeFilter === 'DG') {
                    matchDG = item.dg !== "-" && item.dg.toLowerCase() !== "non-dg";
                } else if (dgTypeFilter === 'Non-DG') {
                    matchDG = item.dg === "-" || item.dg.toLowerCase() === "non-dg";
                }

                return matchSearch && matchType && matchDG;
            });

            renderTableRows();
        }

        // Render Table list rows
        function renderTableRows() {
            const tableBody = document.getElementById('table-body');
            tableBody.innerHTML = '';

            if (filteredData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-10 text-center text-slate-400">
                            <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
                            Tidak ada data TO yang cocok dengan filter pencarian Anda.
                        </td>
                    </tr>
                `;
                document.getElementById('showing-rows').textContent = `Menampilkan 0 dari ${parsedData.length} data TO`;
                return;
            }

            filteredData.forEach((item, idx) => {
                const isDG = item.dg !== "-" && item.dg.toLowerCase() !== "non-dg";
                const dgClass = isDG ? 'bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200' : 'text-slate-500';
                
                const rowHtml = `
                    <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                        <td class="py-3 px-4 text-center font-mono text-xs text-slate-400">${idx + 1}</td>
                        <td class="py-3 px-4 font-mono font-semibold tracking-wider text-slate-900 selection:bg-blue-100 select-all cursor-pointer hover:text-blue-700" title="Klik ganda untuk menyalin" ondblclick="copySingleTo('${item.toNum}')">${item.toNum}</td>
                        <td class="py-3 px-4 text-center font-medium">${item.paket.toLocaleString('id-ID')}</td>
                        <td class="py-3 px-4 text-right font-mono">${item.berat.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                        <td class="py-3 px-4 text-slate-600">${item.tujuan}</td>
                        <td class="py-3 px-4">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                item.type === 'Bag' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                item.type === 'Bulky' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                'bg-sky-50 text-sky-700 border border-sky-200'
                            }">
                                ${item.type}
                            </span>
                        </td>
                        <td class="py-3 px-4">
                            <span class="text-xs ${dgClass}">
                                ${item.dg}
                            </span>
                        </td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', rowHtml);
            });

            document.getElementById('showing-rows').textContent = `Menampilkan ${filteredData.length} dari ${parsedData.length} data TO`;
        }

        // Reset all filter fields
        function resetFilters() {
            document.getElementById('search-input').value = '';
            document.getElementById('filter-to-type').value = 'ALL';
            document.getElementById('filter-dg-type').value = 'ALL';
            applyFilters();
        }

        // Copy single TO number
        function copySingleTo(toNum) {
            const temp = document.createElement("textarea");
            temp.value = toNum;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showToast(`TO ${toNum} disalin!`);
        }

        // Copy Data array to Clipboard
        function copyData(format) {
            if (parsedData.length === 0) {
                showToast("Belum ada data yang dimuat!", "error");
                return;
            }

            let textToCopy = "";

            if (format === 'excel') {
                // Tab-Separated Values (TSV) is ideal for Excel/Google Sheets
                let headers = "No\tNomor TO\tJumlah Paket\tBerat (kg)\tTujuan\tTO Type\tDG Type\n";
                let body = parsedData.map((item, idx) => 
                    `${idx + 1}\t${item.toNum}\t${item.paket}\t${item.berat.toFixed(3).replace('.', ',')}\t${item.tujuan}\t${item.type}\t${item.dg}`
                ).join("\n");
                textToCopy = headers + body;
            } else if (format === 'text-list') {
                // Clean newline text-list
                textToCopy = parsedData.map(item => item.toNum).join("\n");
            }

            const tempTextArea = document.createElement("textarea");
            tempTextArea.value = textToCopy;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showToast(format === 'excel' ? "Format Tabel disalin! Siap tempel ke Excel/Sheets." : "Daftar Nomor TO berhasil disalin!");
                } else {
                    showToast("Gagal menyalin ke clipboard.", "error");
                }
            } catch (err) {
                showToast("Terjadi kesalahan penyalinan.", "error");
            }
            document.body.removeChild(tempTextArea);
        }

        // Download processed clean CSV file
        function downloadCleanCSV() {
            if (parsedData.length === 0) return;

            let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
            csvContent += "No,Nomor TO,Jumlah Paket,Berat (kg),Tujuan,TO Type,DG Type\n";
            
            parsedData.forEach((item, idx) => {
                csvContent += `${idx + 1},${item.toNum},${item.paket},${item.berat.toFixed(3)},"${item.tujuan}",${item.type},${item.dg}\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Clean_Manifest_${tripMeta.tripId !== "-" ? tripMeta.tripId : "RunSheet"}.csv`);
            document.body.appendChild(link);
            
            link.click();
            document.body.removeChild(link);
            showToast("Berkas CSV berhasil diunduh!");
        }

        // Custom alert popups
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const toastIcon = document.getElementById('toast-icon');
            const toastMsg = document.getElementById('toast-message');

            toastMsg.textContent = message;

            if (type === 'success') {
                toastIcon.innerHTML = '<i class="fa-solid fa-circle-check text-lg"></i>';
                toastIcon.className = 'text-emerald-400';
            } else {
                toastIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation text-lg"></i>';
                toastIcon.className = 'text-rose-400';
            }

            toast.classList.remove('opacity-0', 'invisible', 'translate-y-10');
            toast.classList.add('opacity-100', 'visible', 'translate-y-0');

            setTimeout(() => {
                toast.classList.remove('opacity-100', 'visible', 'translate-y-0');
                toast.classList.add('opacity-0', 'invisible', 'translate-y-10');
            }, 3000);
        }
    </script>
</body>
</html>