const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzw3QdvCMorTvdm-WtAAm-kOU-CfvjD_eXqNcpBKvkpkZz6zylpGKnFTeMLeqwsgBl3/exec";
const TEACHER_PANEL_PASSWORD = "ugur2026";
const DENEME_LIMIT = 12;

const form = document.getElementById("reportForm");
const teacherLock = document.getElementById("teacherLock");
const teacherLockForm = document.getElementById("teacherLockForm");
const teacherPassword = document.getElementById("teacherPassword");
const teacherLockError = document.getElementById("teacherLockError");
const statusBar = document.getElementById("statusBar");
const studentList = document.getElementById("studentList");
const studentCount = document.getElementById("studentCount");
const selectedLabel = document.getElementById("selectedLabel");
const saveInfo = document.getElementById("saveInfo");
const refreshButton = document.getElementById("refreshButton");
const teacherLogoutButton = document.getElementById("teacherLogoutButton");
const previewParentButton = document.getElementById("previewParentButton");
const sampleFillButton = document.getElementById("sampleFillButton");
const classTabs = document.getElementById("classTabs");
const bulkClassSelect = document.getElementById("bulkClassSelect");
const bulkBranchSelect = document.getElementById("bulkBranchSelect");
const displayBranchSelect = document.getElementById("displayBranchSelect");
const bulkStudentText = document.getElementById("bulkStudentText");
const bulkAddButton = document.getElementById("bulkAddButton");
const bulkSaveButton = document.getElementById("bulkSaveButton");
const bulkResult = document.getElementById("bulkResult");
const clearClassListButton = document.getElementById("clearClassListButton");
const listLabel = document.getElementById("listLabel");
const studentNoInput = document.getElementById("studentNoInput");
const nameInput = document.getElementById("nameInput");
const classInput = document.getElementById("classInput");
const branchInput = document.getElementById("branchInput");
const pinInput = document.getElementById("pinInput");
const firstNameInput = document.getElementById("firstNameInput");
const lastNameInput = document.getElementById("lastNameInput");
const mainViewedBadge = document.getElementById("mainViewedBadge");
const correctInput = document.getElementById("correctInput");
const wrongInput = document.getElementById("wrongInput");
const blankInput = document.getElementById("blankInput");
const netPreview = document.getElementById("netPreview");
const studentListButton = document.getElementById("studentListButton");
const studentPanelOverlay = document.getElementById("studentPanelOverlay");
const studentPanelClose = document.getElementById("studentPanelClose");
const homeworkDisplay = document.getElementById("homeworkDisplay");
const homeworkText = document.getElementById("homeworkText");
const homeworkArc = document.getElementById("homeworkArc");
const homeworkTip = document.getElementById("homeworkTip");
const participationArc = document.getElementById("participationArc");
const generalStatus = document.getElementById("generalStatus");
const trendChartCanvas = document.getElementById("trendChart");
const denemeNetInputs = document.getElementById("denemeNetInputs");
const examCountLabel = document.getElementById("examCountLabel");
const decreaseExamButton = document.getElementById("decreaseExamButton");
const increaseExamButton = document.getElementById("increaseExamButton");

let reports = [];
let activeStudentNo = "";
let denemeNetler = [11, 13, 14, 0];
let chartInst = null;
let activeClass = "5";
let activeBranch = "A";

function listen(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function unlockTeacherPanel() {
  teacherLock.classList.add("hidden");
  sessionStorage.setItem("teacherPanelUnlocked", "1");
}

if (sessionStorage.getItem("teacherPanelUnlocked") === "1") {
  unlockTeacherPanel();
}

teacherLockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (teacherPassword.value === TEACHER_PANEL_PASSWORD) {
    teacherLockError.textContent = "";
    unlockTeacherPanel();
    return;
  }

  teacherLockError.textContent = "Şifre hatalı.";
  teacherPassword.select();
});

function setStatus(message, isError = false) {
  if (!statusBar) return;
  statusBar.textContent = message;
  statusBar.classList.toggle("error", isError);
}

function applyStatusColor(select) {
  const value = String(select.value || "").toLocaleLowerCase("tr-TR");
  select.classList.remove("status-select-good", "status-select-mid", "status-select-low");

  if (value.includes("iyi")) {
    select.classList.add("status-select-good");
  } else if (value.includes("orta")) {
    select.classList.add("status-select-mid");
  } else if (value.includes("zayıf") || value.includes("zayif") || value.includes("geliştirilmeli")) {
    select.classList.add("status-select-low");
  }
}

function refreshStatusColors() {
  document.querySelectorAll(".durum-select, .kat-details select, #levelInput").forEach(applyStatusColor);
}

function openStudentPanel() {
  studentPanelOverlay.classList.remove("hidden");
}

function closeStudentPanel() {
  studentPanelOverlay.classList.add("hidden");
}

function logoutTeacherPanel() {
  sessionStorage.removeItem("teacherPanelUnlocked");
  teacherPassword.value = "";
  teacherLockError.textContent = "";
  teacherLock.classList.remove("hidden");
  teacherPassword.focus();
}

function getVisibleReports() {
  return reports.filter(report => {
    return String(report.sinif || "") === activeClass &&
      String(report.sube || "") === activeBranch;
  });
}

function callSheets(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `fgpCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(GOOGLE_APPS_SCRIPT_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("callback", callbackName);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value == null ? "" : String(value));
    });

    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Sheets yanıt vermedi."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timer);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Google Sheets bağlantısı kurulamadı."));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function generatePin(studentNo, fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  const firstInitial = parts[0] ? parts[0][0] : "";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${String(studentNo || "").trim()}${firstInitial}${lastInitial}`.toLocaleUpperCase("tr-TR");
}

function splitName(report = {}) {
  const explicitAd = String(report.ad || "").trim();
  const explicitSoyad = String(report.soyad || "").trim();

  if (explicitAd || explicitSoyad) {
    return { ad: explicitAd, soyad: explicitSoyad };
  }

  const parts = String(report.adSoyad || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { ad: parts[0] || "", soyad: "" };
  return { ad: parts.slice(0, -1).join(" "), soyad: parts[parts.length - 1] };
}

function fullName(report = {}) {
  const parts = splitName(report);
  return `${parts.ad} ${parts.soyad}`.trim();
}

function isValidStudent(report = {}) {
  return Boolean(String(report.studentNo || "").trim() && fullName(report));
}

function formatViewedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function reportDenemeNetleri(report = {}) {
  const values = [];

  for (let index = 1; index <= DENEME_LIMIT; index += 1) {
    const raw = report[`deneme${index}`];
    if (raw === undefined || raw === null || raw === "") continue;
    values.push(Math.round(Math.max(0, Math.min(20, asNumber(raw)))));
  }

  return values;
}

function currentNet() {
  return Math.round(Math.max(0, Math.min(20, asNumber(denemeNetler[denemeNetler.length - 1]))));
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function reportPath(studentNo) {
  if (String(studentNo) === "1002") return "reports/1002.html";
  if (String(studentNo) === "1003") return "reports/1003.html";
  return "reports/1001.html";
}

function collectForm() {
  syncDenemeInputsFromDom();
  updateComputedFields();
  const data = new FormData(form);
  const report = Object.fromEntries(data.entries());
  report.adSoyad = `${report.ad || ""} ${report.soyad || ""}`.trim();
  report.pin = generatePin(report.studentNo, report.adSoyad);
  report.odevYuzde = asNumber(report.odevYuzde);
  report.katilimYuzde = asNumber(report.katilimYuzde);
  report.dogru = asNumber(report.dogru);
  report.yanlis = asNumber(report.yanlis);
  report.bos = asNumber(report.bos);
  denemeNetler.slice(0, DENEME_LIMIT).forEach((net, index) => {
    report[`deneme${index + 1}`] = Math.round(Math.max(0, Math.min(20, asNumber(net))));
  });
  return report;
}

function syncDenemeInputsFromDom() {
  denemeNetInputs.querySelectorAll("input[data-deneme-index]").forEach(input => {
    const index = Number(input.dataset.denemeIndex);
    denemeNetler[index] = Math.round(Math.max(0, Math.min(20, asNumber(input.value))));
    input.value = String(denemeNetler[index]);
  });
}

function previewReportUrl(report) {
  const params = new URLSearchParams();
  params.set("veli", "1");
  params.set("preview", encodeURIComponent(JSON.stringify(report)));
  return `${reportPath(report.studentNo)}?${params.toString()}`;
}

function collectSharedReportFields() {
  const report = collectForm();
  const shared = {};
  const homework = asNumber(report.odevYuzde);
  const participation = asNumber(report.katilimYuzde);
  const correct = asNumber(report.dogru);
  const wrong = asNumber(report.yanlis);
  const blank = asNumber(report.bos);

  if (homework > 0) shared.odevYuzde = homework;
  if (participation > 0) shared.katilimYuzde = participation;
  if (String(report.islenenKonu || "").trim()) shared.islenenKonu = report.islenenKonu;
  if (String(report.anlamaDuzeyi || "").trim()) shared.anlamaDuzeyi = report.anlamaDuzeyi;
  if (String(report.evCalismasi || "").trim()) shared.evCalismasi = report.evCalismasi;
  if (correct > 0 || wrong > 0 || blank > 0) {
    shared.dogru = correct;
    shared.yanlis = wrong;
    shared.bos = blank;
  }
  denemeNetler.slice(0, DENEME_LIMIT).forEach((net, index) => {
    shared[`deneme${index + 1}`] = Math.round(Math.max(0, Math.min(20, asNumber(net))));
  });
  if (String(report.ogretmenNotu || "").trim()) shared.ogretmenNotu = report.ogretmenNotu;

  return shared;
}

function updateMainViewedBadge(report = {}) {
  if (!mainViewedBadge) return;

  const viewedAt = report.veliGordu || report.goruldu || "";
  const viewedTime = formatViewedAt(viewedAt);

  if (!viewedAt) {
    mainViewedBadge.textContent = "";
    mainViewedBadge.classList.add("hidden");
    return;
  }

  mainViewedBadge.textContent = viewedTime ? `✓ Görüldü ${viewedTime}` : "✓ Görüldü";
  mainViewedBadge.classList.remove("hidden");
}

function fillForm(report = {}) {
  const names = splitName(report);
  const displayName = fullName(report);
  const understandingLevel = report.anlamaDuzeyi === "Geliştirilmeli" ? "Zayıf" : report.anlamaDuzeyi;
  form.reset();
  activeStudentNo = String(report.studentNo || "");
  selectedLabel.textContent = displayName || "Yeni kayıt";

  form.elements.studentNo.value = report.studentNo || "";
  form.elements.ad.value = names.ad;
  form.elements.soyad.value = names.soyad;
  form.elements.adSoyad.value = displayName;
  form.elements.sinif.value = report.sinif || "";
  form.elements.sube.value = report.sube || "";
  form.elements.pin.value = report.pin || generatePin(report.studentNo, displayName);
  form.elements.odevYuzde.value = report.odevYuzde || 0;
  form.elements.katilimYuzde.value = report.katilimYuzde || 0;
  form.elements.islenenKonu.value = report.islenenKonu || "";
  form.elements.anlamaDuzeyi.value = understandingLevel || "";
  form.elements.evCalismasi.value = report.evCalismasi || "";
  form.elements.dogru.value = report.dogru || 0;
  form.elements.yanlis.value = report.yanlis || 0;
  form.elements.bos.value = report.bos || 0;
  form.elements.ogretmenNotu.value = report.ogretmenNotu || "";

  const savedDenemeler = reportDenemeNetleri(report);
  denemeNetler = savedDenemeler.length
    ? savedDenemeler
    : [11, 13, 14, 15];

  updateMainViewedBadge(report);
  updateComputedFields();
  renderStudents();
}

function updateComputedFields() {
  nameInput.value = `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`.trim();
  pinInput.value = generatePin(studentNoInput.value, nameInput.value);
  const homework = Math.max(0, Math.min(100, asNumber(document.getElementById("homeworkInput").value)));
  const participation = Math.max(0, Math.min(100, asNumber(document.getElementById("participationInput").value)));
  const net = currentNet();
  netPreview.textContent = String(net);

  homeworkDisplay.textContent = `%${homework}`;
  homeworkArc.setAttribute("stroke-dasharray", `${homework} ${100 - homework}`);
  participationArc.setAttribute("stroke-dasharray", `${participation} ${100 - participation}`);

  if (homework <= 0) {
    homeworkText.textContent = "Girilmedi";
    homeworkText.className = "homework-status";
    homeworkTip.innerHTML = "<span>✓</span><p>Ödev başarı yüzdesini girince veliye uygun kısa değerlendirme otomatik oluşur.</p>";
  } else if (homework >= 80) {
    homeworkText.textContent = "İyi";
    homeworkText.className = "homework-status status-select-good";
    homeworkTip.innerHTML = "<span>✓</span><p>Ödevlerini düzenli ve eksiksiz tamamlıyor. Bu çalışma disiplini başarıya olumlu yansıyor.</p>";
  } else if (homework >= 50) {
    homeworkText.textContent = "Orta";
    homeworkText.className = "homework-status status-select-mid";
    homeworkTip.innerHTML = "<span>✓</span><p>Ödev takibi genel olarak iyi. Eksik kalan çalışmalar tamamlandığında başarı daha hızlı artacaktır.</p>";
  } else {
    homeworkText.textContent = "Zayıf";
    homeworkText.className = "homework-status status-select-low";
    homeworkTip.innerHTML = "<span>✓</span><p>Ödev tamamlama oranı artırılmalı. Kısa ve düzenli tekrarlarla süreç güçlendirilebilir.</p>";
  }

  refreshStatusColors();
  renderTrend();
}

function denemeSayisiDegistir(delta) {
  const nextCount = denemeNetler.length + delta;
  if (nextCount < 1 || nextCount > DENEME_LIMIT) return;

  if (delta > 0) {
    denemeNetler.push(0);
  } else {
    denemeNetler.pop();
  }

  renderTrend();
}

function renderTrend() {
  if (!denemeNetInputs || !examCountLabel) return;

  if (!denemeNetler.length) denemeNetler = [0];

  examCountLabel.textContent = String(denemeNetler.length);
  netPreview.textContent = String(currentNet());

  if (trendChartCanvas && window.Chart) {
    const ctx = trendChartCanvas.getContext("2d");
    if (chartInst) chartInst.destroy();
    chartInst = new Chart(ctx, {
      type: "line",
      data: {
        labels: denemeNetler.map((_, index) => `${index + 1}. Deneme`),
        datasets: [{
          data: denemeNetler,
          borderColor: "#1D9E75",
          backgroundColor: "rgba(29,158,117,0.08)",
          pointBackgroundColor: denemeNetler.map((_, index) => index === denemeNetler.length - 1 ? "#EF9F27" : "#1D9E75"),
          pointBorderColor: denemeNetler.map((_, index) => index === denemeNetler.length - 1 ? "#1D9E75" : "#1D9E75"),
          pointRadius: denemeNetler.map((_, index) => index === denemeNetler.length - 1 ? 5 : 4),
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10, family: "Nunito Sans" }, color: "#6B7280" }
          },
          y: {
            min: 0,
            max: 20,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { stepSize: 4, font: { size: 10, family: "Nunito Sans" }, color: "#6B7280" }
          }
        },
        elements: {
          point: { borderWidth: 2 }
        }
      }
    });
  }

  denemeNetInputs.innerHTML = denemeNetler.map((net, index) => `
    <span>
      ${index + 1}. Deneme:
      <input type="text" inputmode="numeric" pattern="[0-9]*" value="${Math.round(asNumber(net))}"
        data-deneme-index="${index}">
    </span>
  `).join("");
}

function renderStudents() {
  const visibleReports = getVisibleReports();
  studentCount.textContent = `${reports.length}`;
  listLabel.textContent = `${activeClass}. Sınıf ${activeBranch} Şubesi — ${visibleReports.length} öğrenci`;

  classTabs.querySelectorAll(".panel-tab").forEach(tab => {
    const tabClass = tab.dataset.class;
    const count = reports.filter(report => String(report.sinif || "") === tabClass).length;
    tab.classList.toggle("active", tabClass === activeClass);
    tab.querySelector(".tab-count").textContent = String(count);
  });

  if (!visibleReports.length) {
    studentList.innerHTML = `<p class="empty-list">Bu sınıf ve şubede henüz öğrenci yok.</p>`;
    return;
  }

  studentList.innerHTML = visibleReports.map((report, index) => {
    const active = String(report.studentNo) === activeStudentNo ? " active" : "";
    const displayName = fullName(report);
    const pin = report.pin || generatePin(report.studentNo, displayName);
    const viewedAt = report.veliGordu || report.goruldu || "";
    const viewedTime = formatViewedAt(viewedAt);
    const viewedBadge = viewedAt
      ? `<span class="viewed-check" title="Veli gördü">${viewedTime ? `✓ ${escapeHtml(viewedTime)}` : "✓"}</span>`
      : "";
    return `
      <div class="student-item${active}" data-no="${escapeHtml(report.studentNo)}">
        <span class="student-order">${index + 1}</span>
        <span class="student-no">${escapeHtml(report.studentNo || "-")}</span>
        <span class="student-name">${escapeHtml(displayName || "İsimsiz öğrenci")}${viewedBadge}</span>
        <span class="pin-pill">${escapeHtml(pin)}</span>
        <button type="button" class="student-select-btn">Seç</button>
        <button type="button" class="student-delete-btn" title="Sil">×</button>
      </div>
    `;
  }).join("");
}

function parseStudentLine(line, fallbackIndex) {
  const clean = String(line || "").trim().replace(/\s+/g, " ");
  if (!clean) return null;

  const parts = clean.split(" ");
  const firstToken = parts[0];
  const hasNumber = /^\d+$/.test(firstToken);
  const studentNo = hasNumber
    ? firstToken
    : `${activeClass}${activeBranch}${String(fallbackIndex).padStart(3, "0")}`;
  const nameText = hasNumber ? parts.slice(1).join(" ") : clean;
  const names = splitName({ adSoyad: nameText });
  const adSoyad = `${names.ad} ${names.soyad}`.trim();

  if (!adSoyad) return null;

  return {
    ...collectSharedReportFields(),
    studentNo,
    ad: names.ad,
    soyad: names.soyad,
    adSoyad,
    sinif: bulkClassSelect.value,
    sube: bulkBranchSelect.value,
    pin: generatePin(studentNo, adSoyad)
  };
}

function addBulkStudents() {
  const lines = bulkStudentText.value.split(/\r?\n/);
  let added = 0;
  const targetClass = bulkClassSelect.value;
  const targetBranch = bulkBranchSelect.value;
  let fallbackIndex = reports.filter(report => String(report.sinif) === targetClass && String(report.sube) === targetBranch).length + 1;

  lines.forEach(line => {
    activeClass = targetClass;
    activeBranch = targetBranch;
    const report = parseStudentLine(line, fallbackIndex);
    if (!report) return;

    const existingIndex = reports.findIndex(item => String(item.studentNo) === String(report.studentNo));
    if (existingIndex >= 0) {
      reports[existingIndex] = { ...reports[existingIndex], ...report };
    } else {
      reports.push(report);
    }

    added++;
    fallbackIndex++;
  });

  displayBranchSelect.value = targetBranch;
  bulkResult.textContent = `${added} öğrenci ${targetClass}. Sınıf ${targetBranch} Şubesi listesine eklendi.`;
  bulkStudentText.value = "";
  renderStudents();
}

async function saveVisibleStudentsToSheets() {
  const visibleReports = getVisibleReports();
  const sharedFields = collectSharedReportFields();

  if (!visibleReports.length) {
    bulkResult.textContent = "Kaydedilecek öğrenci yok.";
    return;
  }

  bulkSaveButton.disabled = true;
  bulkResult.textContent = `${visibleReports.length} öğrenci Google Sheets'e kaydediliyor...`;

  try {
    let saved = 0;
    for (const report of visibleReports) {
      const result = await callSheets("saveReport", { ...report, ...sharedFields });
      if (!result.ok) throw new Error(result.error || "Kayıt yapılamadı.");
      saved++;
    }

    bulkResult.textContent = `${saved} öğrenci Google Sheets'e kaydedildi.`;
    setStatus(`${activeClass}. Sınıf ${activeBranch} Şubesi Google Sheets'e kaydedildi.`);
    await loadReports();
  } catch (error) {
    bulkResult.textContent = error.message;
    setStatus(error.message, true);
  } finally {
    bulkSaveButton.disabled = false;
  }
}

async function loadReports() {
  setStatus("Google Sheets'teki Raporlar sayfasından öğrenci listesi alınıyor...");

  try {
    const result = await callSheets("listReports");
    if (!result.ok) throw new Error(result.error || "Liste alınamadı.");

    reports = (result.reports || [])
      .map(report => ({
        ...report,
        pin: report.pin || generatePin(report.studentNo, fullName(report))
      }))
      .filter(isValidStudent);

    renderStudents();
    setStatus(`Hazır. ${reports.length} öğrenci Google Sheets'ten alındı. Öğrenci Listesi'nden kayıt seçebilirsin.`);

    if (!activeStudentNo && reports[0]) {
      fillForm(reports[0]);
    }
  } catch (error) {
    setStatus(`${error.message} Apps Script dağıtımını kontrol edin.`, true);
  }
}

listen(form, "input", (event) => {
  if (event.target.closest("#denemeNetInputs")) return;
  updateComputedFields();
});
listen(denemeNetInputs, "change", (event) => {
  const input = event.target.closest("input[data-deneme-index]");
  if (!input || input.readOnly) return;

  const index = Number(input.dataset.denemeIndex);
  denemeNetler[index] = Math.round(Math.max(0, Math.min(20, asNumber(input.value))));
  input.value = String(denemeNetler[index]);
  renderTrend();
});
listen(decreaseExamButton, "click", () => denemeSayisiDegistir(-1));
listen(increaseExamButton, "click", () => denemeSayisiDegistir(1));
listen(document, "change", (event) => {
  if (event.target.matches(".durum-select, .kat-details select, #levelInput")) {
    applyStatusColor(event.target);
  }
});

listen(form, "submit", async (event) => {
  event.preventDefault();
  const report = collectForm();

  if (!report.studentNo || !report.ad || !report.soyad) {
    setStatus("Öğrenci no, ad ve soyad zorunlu.", true);
    return;
  }

  setStatus("Bu rapor Google Sheets'e kaydediliyor...");

  try {
    const result = await callSheets("saveReport", report);
    if (!result.ok) throw new Error(result.error || "Kayıt yapılamadı.");

    const savedReport = result.report;
    const index = reports.findIndex(item => String(item.studentNo) === String(savedReport.studentNo));
    if (index >= 0) {
      reports[index] = savedReport;
    } else {
      reports.push(savedReport);
    }

    activeStudentNo = String(savedReport.studentNo);
    saveInfo.textContent = `Son kayıt: ${fullName(savedReport)}`;
    setStatus("Kayıt tamamlandı. Veli sitesi artık bu öğrencinin güncel raporunu okuyabilir.");
    fillForm(savedReport);
  } catch (error) {
    setStatus(error.message, true);
  }
});

listen(studentList, "click", (event) => {
  const item = event.target.closest(".student-item");
  if (!item) return;

  if (event.target.closest(".student-delete-btn")) {
    reports = reports.filter(entry => String(entry.studentNo) !== String(item.dataset.no));
    renderStudents();
    return;
  }

  if (!event.target.closest(".student-select-btn")) return;

  const report = reports.find(entry => String(entry.studentNo) === String(item.dataset.no));
  if (report) {
    fillForm(report);
    closeStudentPanel();
  }
});

listen(refreshButton, "click", loadReports);
listen(teacherLogoutButton, "click", logoutTeacherPanel);
listen(sampleFillButton, "click", () => {
  fillForm({
    studentNo: "1004",
    ad: "Zeynep",
    soyad: "Arslan",
    sinif: "6",
    sube: "A",
    odevYuzde: 92,
    katilimYuzde: 88,
    islenenKonu: "Hücre ve Organeller",
    anlamaDuzeyi: "İyi",
    evCalismasi: "Konu özeti tekrar edilecek. Ardından 30 soru çözümü yapılacak.",
    dogru: 17,
    yanlis: 2,
    bos: 1,
    deneme1: 11,
    deneme2: 13,
    deneme3: 14,
    deneme4: 15,
    deneme5: 16,
    deneme6: 17,
    ogretmenNotu: "Bu hafta hücre ve organeller konusunda başarılı bir ilerleme gösterdi. Kavramları doğru kullanıyor, yorum sorularında biraz daha dikkatli olursa netleri artacaktır."
  });
  saveInfo.textContent = "Örnek kayıt hazır. İstersen Google Sheets'e kaydedebilirsin.";
});
listen(studentListButton, "click", openStudentPanel);
listen(studentPanelClose, "click", closeStudentPanel);
listen(studentPanelOverlay, "click", (event) => {
  if (event.target === studentPanelOverlay) closeStudentPanel();
});
listen(classTabs, "click", (event) => {
  const tab = event.target.closest(".panel-tab");
  if (!tab) return;

  activeClass = tab.dataset.class;
  bulkClassSelect.value = activeClass;
  renderStudents();
});
listen(displayBranchSelect, "change", () => {
  activeBranch = displayBranchSelect.value;
  renderStudents();
});
listen(bulkClassSelect, "change", () => {
  activeClass = bulkClassSelect.value;
  renderStudents();
});
listen(bulkBranchSelect, "change", () => {
  activeBranch = bulkBranchSelect.value;
  displayBranchSelect.value = activeBranch;
  renderStudents();
});
listen(bulkAddButton, "click", addBulkStudents);
listen(bulkSaveButton, "click", saveVisibleStudentsToSheets);
listen(clearClassListButton, "click", () => {
  reports = reports.filter(report => {
    return !(String(report.sinif || "") === activeClass && String(report.sube || "") === activeBranch);
  });
  bulkResult.textContent = `${activeClass}. Sınıf ${activeBranch} Şubesi listesi temizlendi.`;
  renderStudents();
});

listen(previewParentButton, "click", () => {
  const report = collectForm();
  if (!report.studentNo) {
    setStatus("Veli önizleme için önce öğrenci no girin.", true);
    return;
  }

  sessionStorage.setItem("currentReport", JSON.stringify(report));
  window.open(previewReportUrl(report), "_blank", "noopener");
});

loadReports();
