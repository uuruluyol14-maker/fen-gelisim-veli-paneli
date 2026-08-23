const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzw3QdvCMorTvdm-WtAAm-kOU-CfvjD_eXqNcpBKvkpkZz6zylpGKnFTeMLeqwsgBl3/exec";

const demoStudents = {
  1001: {
    studentNo: "1001",
    adSoyad: "Ali Yılmaz",
    sinif: "5",
    sube: "A",
    pin: "1001AY",
    report: "reports/1001.html"
  },
  1002: {
    studentNo: "1002",
    adSoyad: "Ayşe Kaya",
    sinif: "6",
    sube: "B",
    pin: "1002AK",
    report: "reports/1002.html"
  },
  1003: {
    studentNo: "1003",
    adSoyad: "Mehmet Demir",
    sinif: "8",
    sube: "LGS",
    pin: "1003MD",
    report: "reports/1003.html"
  }
};

const loginScreen = document.getElementById("loginScreen");
const reportScreen = document.getElementById("reportScreen");
const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const reportFrame = document.getElementById("reportFrame");
const reportTitle = document.getElementById("reportTitle");
const logoutButton = document.getElementById("logoutButton");

function reportPath(studentNo) {
  if (studentNo === "1002") return "reports/1002.html";
  if (studentNo === "1003") return "reports/1003.html";
  return "reports/1001.html";
}

function fullName(report = {}) {
  return `${report.ad || ""} ${report.soyad || ""}`.trim() || report.adSoyad || "";
}

function callSheets(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `veliCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

function getReportFromSheets(studentNo, pin) {
  return callSheets("getReport", { studentNo, pin });
}

async function getReportFromSheetsWithFetch(studentNo, pin) {
  const url = new URL(GOOGLE_APPS_SCRIPT_URL);
  url.searchParams.set("action", "getReport");
  url.searchParams.set("studentNo", studentNo);
  url.searchParams.set("pin", pin);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error("Google Sheets bağlantısı yanıt vermedi.");
  return response.json();
}

function getDemoReport(studentNo, pin) {
  const student = demoStudents[studentNo];
  if (!student || student.pin !== pin.toLocaleUpperCase("tr-TR")) {
    return { ok: false, error: "Öğrenci numarası veya PIN hatalı." };
  }
  return { ok: true, report: student };
}

function openReport(report) {
  const studentNo = String(report.studentNo || "").trim();
  const url = `${reportPath(studentNo)}?veli=1`;
  const title = fullName(report) || studentNo;

  sessionStorage.setItem("currentReport", JSON.stringify(report));
  reportTitle.textContent = `${title} raporu`;
  reportFrame.src = url;
  loginScreen.classList.add("hidden");
  reportScreen.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const studentNo = String(formData.get("studentNo")).trim();
  const studentPin = String(formData.get("studentPin")).trim().toLocaleUpperCase("tr-TR");

  errorMessage.textContent = "Kontrol ediliyor...";

  try {
    let result;
    try {
      result = await getReportFromSheetsWithFetch(studentNo, studentPin);
    } catch (fetchError) {
      result = await getReportFromSheets(studentNo, studentPin);
    }

    if (!result.ok) {
      errorMessage.textContent = result.error || "Öğrenci numarası veya PIN hatalı.";
      return;
    }

    errorMessage.textContent = "";
    openReport(result.report);
  } catch (error) {
    const fallback = getDemoReport(studentNo, studentPin);
    if (!fallback.ok) {
      errorMessage.textContent = "Google Sheets bağlantısı kurulamadı veya giriş bilgileri hatalı.";
      return;
    }

    errorMessage.textContent = "";
    openReport(fallback.report);
  }
});

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("currentReport");
  reportFrame.src = "about:blank";
  loginForm.reset();
  reportScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  document.getElementById("studentNo").focus();
});
