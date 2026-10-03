const STORAGE_KEY = "suiviLitresEntries";
const LITRES_PAR_CM = 16;

let entries = loadEntries();
let editingId = null;

const body = document.getElementById("entriesBody");
const tableEmpty = document.getElementById("tableEmpty");
const latestLitres = document.getElementById("latestLitres");
const latestCm = document.getElementById("latestCm");
const annualSummary = document.getElementById("annualSummary");

const modal = document.getElementById("modal");
const form = document.getElementById("entryForm");
const dateInput = document.getElementById("dateInput");
const cmInput = document.getElementById("cmInput");
const modalTitle = document.getElementById("modalTitle");

document.getElementById("addBtn").addEventListener("click", () => openModal());
document.getElementById("addTopBtn").addEventListener("click", () => openModal());
document.getElementById("closeModalBtn").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
document.getElementById("exportBtn").addEventListener("click", exportExcel);
document.getElementById("importInput").addEventListener("change", importExcel);

form.addEventListener("submit", saveEntry);

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

window.addEventListener("scroll", () => {
  document.getElementById("scrollTopBtn")
    .classList.toggle("visible", window.scrollY > 300);
});

document.getElementById("scrollTopBtn").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();

function loadEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.map(normalizeEntry).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function normalizeEntry(item) {
  if (!item) return null;

  const date = normalizeDate(item.date ?? item.Date);
  const cm = Number(item.cm ?? item.Cm ?? item.valeur ?? item.Valeur);

  if (!date || !Number.isFinite(cm)) return null;

  return {
    id: String(item.id || crypto.randomUUID()),
    date,
    cm
  };
}

function normalizeDate(value) {
  if (!value) return "";

  if (typeof value === "string") {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    // DD/MM/YYYY
    const match = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (match) {
      const [, d, m, y] = match;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return toLocalISODate(parsed);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toLocalISODate(value);
  }

  return "";
}

function toLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function sortEntries() {
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function calculateRows() {
  sortEntries();

  return entries.map((entry, index) => {
    if (index === 0) {
      return { ...entry, litresPerDay: 0, litresConsumed: 0, days: 0 };
    }

    const previous = entries[index - 1];
    const days = daysBetween(previous.date, entry.date);

    // Consommation = baisse du niveau × 16 L/cm.
    // Une remontée produit donc une valeur négative.
    const litresConsumed = (previous.cm - entry.cm) * LITRES_PAR_CM;
    const litresPerDay = days > 0 ? litresConsumed / days : 0;

    return {
      ...entry,
      litresPerDay,
      litresConsumed,
      days
    };
  });
}

function daysBetween(dateA, dateB) {
  const [y1, m1, d1] = dateA.split("-").map(Number);
  const [y2, m2, d2] = dateB.split("-").map(Number);

  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);

  return Math.round((b - a) / 86400000);
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatNumber(value, decimals = 1) {
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return rounded.toLocaleString("fr-BE", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : decimals,
    maximumFractionDigits: decimals
  });
}

function formatLitres(value) {
  return `${formatNumber(value)} L`;
}

function render() {
  const rows = calculateRows();
  renderLatest();
  renderAnnual(rows);
  renderTable(rows);
  saveToStorage();
}

function renderLatest() {
  if (!entries.length) {
    latestLitres.textContent = "0 L";
    latestCm.textContent = "0 cm";
    return;
  }

  const latest = entries[entries.length - 1];
  latestLitres.textContent = formatLitres(latest.cm * LITRES_PAR_CM);
  latestCm.textContent = `${formatNumber(latest.cm, 2)} cm`;
}

function renderAnnual(rows) {
  if (!rows.length) {
    annualSummary.innerHTML = '<div class="empty-state">Aucune donnée</div>';
    return;
  }

  const totals = {};

  for (const row of rows) {
    const year = row.date.slice(0, 4);
    totals[year] = (totals[year] || 0) + row.litresConsumed;
  }

  annualSummary.innerHTML = Object.keys(totals)
    .sort((a, b) => b.localeCompare(a))
    .map(year => `
      <div class="annual-row">
        <span class="annual-year">${year}</span>
        <span class="annual-total">${formatLitres(totals[year])}</span>
      </div>
    `)
    .join("");
}

function renderTable(rows) {
  body.innerHTML = "";

  if (!rows.length) {
    tableEmpty.style.display = "block";
    return;
  }

  tableEmpty.style.display = "none";

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatDate(row.date)}</td>
      <td>${formatNumber(row.cm, 2)} cm</td>
      <td>${index === 0 ? "0 L/j" : `${formatNumber(row.litresPerDay)} L/j`}</td>
      <td>
        <div class="row-actions">
          <button class="small-btn" data-action="edit" data-id="${row.id}" aria-label="Modifier">✎</button>
          <button class="small-btn delete" data-action="delete" data-id="${row.id}" aria-label="Supprimer">×</button>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });

  body.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (button.dataset.action === "edit") editEntry(id);
      if (button.dataset.action === "delete") deleteEntry(id);
    });
  });
}

function openModal(id = null) {
  editingId = id;
  modal.classList.remove("hidden");

  if (id) {
    const entry = entries.find(item => item.id === id);
    if (!entry) return;

    modalTitle.textContent = "Modifier la mesure";
    dateInput.value = entry.date;
    cmInput.value = entry.cm;
  } else {
    modalTitle.textContent = "Ajouter une mesure";
    form.reset();
    dateInput.value = toLocalISODate(new Date());
  }

  setTimeout(() => cmInput.focus(), 50);
}

function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
  form.reset();
}

function saveEntry(event) {
  event.preventDefault();

  const date = dateInput.value;
  const cm = Number(cmInput.value);

  if (!date || !Number.isFinite(cm) || cm < 0) {
    alert("Merci d'indiquer une date et une valeur en cm valide.");
    return;
  }

  if (editingId) {
    const index = entries.findIndex(item => item.id === editingId);
    if (index !== -1) entries[index] = { ...entries[index], date, cm };
  } else {
    entries.push({
      id: crypto.randomUUID(),
      date,
      cm
    });
  }

  sortEntries();
  saveToStorage();
  closeModal();
  render();
}

function editEntry(id) {
  openModal(id);
}

function deleteEntry(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;

  if (!confirm(`Supprimer la mesure du ${formatDate(entry.date)} ?`)) return;

  entries = entries.filter(item => item.id !== id);
  saveToStorage();
  render();
}

function exportExcel() {
  if (typeof XLSX === "undefined") {
    alert("La bibliothèque Excel n'est pas disponible. Vérifie ta connexion internet.");
    return;
  }

  const rows = calculateRows();

  const data = rows.map((row, index) => ({
    "Date": formatDate(row.date),
    "Valeur (cm)": row.cm,
    "Consommation (L/j)": index === 0 ? 0 : Number(row.litresPerDay.toFixed(4)),
    "Litres consommés sur la période": index === 0 ? 0 : Number(row.litresConsumed.toFixed(4)),
    "Jours écoulés": row.days
  }));

  const annual = {};
  rows.forEach(row => {
    const year = row.date.slice(0, 4);
    annual[year] = (annual[year] || 0) + row.litresConsumed;
  });

  const annualData = Object.keys(annual)
    .sort()
    .map(year => ({
      "Année": Number(year),
      "Total consommé (L)": Number(annual[year].toFixed(4))
    }));

  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 21 },
    { wch: 31 },
    { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Suivi");

  const annualWs = XLSX.utils.json_to_sheet(annualData);
  annualWs["!cols"] = [{ wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, annualWs, "Totaux annuels");

  XLSX.writeFile(wb, "suivi-consommation.xlsx");
}

function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (typeof XLSX === "undefined") {
    alert("La bibliothèque Excel n'est pas disponible. Vérifie ta connexion internet.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const workbook = XLSX.read(e.target.result, { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      const imported = raw.map(row => {
        const dateValue =
          row["Date"] ??
          row["date"] ??
          row["DATE"];

        const cmValue =
          row["Valeur (cm)"] ??
          row["Valeur"] ??
          row["cm"] ??
          row["CM"];

        const date = normalizeDate(dateValue);
        const cm = Number(
          typeof cmValue === "string"
            ? cmValue.replace(",", ".").replace(/[^\d.-]/g, "")
            : cmValue
        );

        if (!date || !Number.isFinite(cm)) return null;

        return {
          id: crypto.randomUUID(),
          date,
          cm
        };
      }).filter(Boolean);

      if (!imported.length) {
        alert("Aucune mesure exploitable n'a été trouvée dans le fichier.");
        return;
      }

      const replace = confirm(
        `${imported.length} mesure(s) trouvée(s).\n\nOK = remplacer les données actuelles\nAnnuler = ne rien importer`
      );

      if (!replace) return;

      entries = imported;
      sortEntries();
      saveToStorage();
      render();
      alert("Import terminé.");
    } catch (error) {
      console.error(error);
      alert("Impossible de lire ce fichier Excel.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsArrayBuffer(file);
}
