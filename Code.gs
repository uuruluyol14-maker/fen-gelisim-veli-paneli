const SHEET_NAME = 'Raporlar';
const HEADERS = [
  'studentNo',
  'ad',
  'soyad',
  'sinif',
  'sube',
  'pin',
  'genelDurum',
  'odevYuzde',
  'katilimYuzde',
  'derseKatilim',
  'soruSorma',
  'derseHazirlik',
  'dikkatIlgi',
  'islenenKonu',
  'anlamaDuzeyi',
  'evCalismasi',
  'ogretmenNotu',
  'deneme1',
  'deneme2',
  'deneme3',
  'deneme4',
  'deneme5',
  'deneme6',
  'deneme7',
  'deneme8',
  'deneme9',
  'deneme10',
  'deneme11',
  'deneme12',
  'sonGuncelleme',
  'veliGordu'
];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = (params.action || '').trim();
  const callback = params.callback;

  if (action === 'getReport') {
    return jsonResponse(getReport_(params.studentNo, params.pin), callback);
  }

  if (action === 'listReports') {
    return jsonResponse({ ok: true, reports: readRows_() }, callback);
  }

  if (action === 'saveReport') {
    return jsonResponse(saveReport_(params), callback);
  }

  if (action === 'headers') {
    ensureSheet_();
    return jsonResponse({ ok: true, headers: HEADERS }, callback);
  }

  if (action === 'setup') {
    return jsonResponse(setupSheet_(), callback);
  }

  if (action === 'generatePins') {
    return jsonResponse(generatePinsForAllRows_(), callback);
  }

  return jsonResponse({ ok: false, error: 'Bilinmeyen istek.' }, callback);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');

  if (body.action === 'saveReport') {
    return jsonResponse(saveReport_(body.report));
  }

  if (body.action === 'bulkUpsertStudents') {
    return jsonResponse(bulkUpsertStudents_(body.students || []));
  }

  return jsonResponse({ ok: false, error: 'Bilinmeyen kayıt isteği.' });
}

function setupSheet() {
  return setupSheet_().message;
}

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const headerMap = getHeaderMap_(sheet);
  const watchedColumns = [
    headerMap.studentNo,
    headerMap.ad,
    headerMap.soyad
  ].filter(Boolean);

  const editStart = e.range.getColumn();
  const editEnd = editStart + e.range.getNumColumns() - 1;
  const affectsStudentInfo = watchedColumns.some(column => column >= editStart && column <= editEnd);

  if (!affectsStudentInfo) return;

  const startRow = Math.max(e.range.getRow(), 2);
  const endRow = e.range.getRow() + e.range.getNumRows() - 1;

  for (let row = startRow; row <= endRow; row++) {
    writePinForRow_(sheet, headerMap, row);
  }
}

function setupSheet_() {
  const sheet = ensureSheet_();
  applySheetFormats_(sheet);
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([
      '1001',
      'Ali',
      'Yılmaz',
      '5',
      'A',
      generatePin_('1001', 'Ali Yılmaz'),
      90,
      85,
      'Hücre Bölünmesi',
      'Orta',
      'Konu özeti + 30 soru',
      11,
      13,
      14,
      15,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Konu kavrama iyi, yorum sorularında tekrar gerekli.',
      new Date()
    ]);
  }
  generatePinsForAllRows_();
  fixDenemeDateValues_(sheet);
  applySheetFormats_(sheet);
  return { ok: true, message: 'Raporlar sayfası hazırlandı ve eksik PIN alanları tamamlandı.' };
}

function getReport_(studentNo, pin) {
  const normalizedNo = String(studentNo || '').trim();
  const normalizedPin = String(pin || '').trim().toLocaleUpperCase('tr-TR');

  if (!normalizedNo || !normalizedPin) {
    return { ok: false, error: 'Öğrenci numarası ve PIN gerekli.' };
  }

  const rows = readRows_();
  const found = rows.find(row => {
    return String(row.studentNo) === normalizedNo &&
      String(row.pin).toLocaleUpperCase('tr-TR') === normalizedPin;
  });

  if (!found) {
    return { ok: false, error: 'Öğrenci numarası veya PIN hatalı.' };
  }

  const rowIndex = findRowByStudentNo_(normalizedNo);
  const viewedAt = markReportViewed_(rowIndex);
  if (viewedAt) found.veliGordu = viewedAt;

  return { ok: true, report: found };
}

function saveReport_(report) {
  const fullName = buildFullName_(report);
  if (!report || !report.studentNo || !fullName) {
    return { ok: false, error: 'studentNo, ad ve soyad zorunlu.' };
  }

  const sheet = ensureSheet_();
  const rowIndex = findRowByStudentNo_(String(report.studentNo));
  const cleanReport = normalizeReport_(report);
  const headerMap = getHeaderMap_(sheet);

  if (rowIndex > 0 && !cleanReport.veliGordu && headerMap.veliGordu) {
    cleanReport.veliGordu = sheet.getRange(rowIndex, headerMap.veliGordu).getValue();
  }

  const values = HEADERS.map(header => cleanReport[header] ?? '');

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  applySheetFormats_(sheet);
  return { ok: true, report: cleanReport };
}

function bulkUpsertStudents_(students) {
  let saved = 0;
  students.forEach(student => {
    if (!student.studentNo || !buildFullName_(student)) return;
    const result = saveReport_(student);
    if (result.ok) saved++;
  });
  return { ok: true, saved };
}

function normalizeReport_(report) {
  const studentNo = String(report.studentNo || '').trim();
  const nameParts = splitName_(report);
  const adSoyad = `${nameParts.ad} ${nameParts.soyad}`.trim();

  const cleanReport = {
    studentNo,
    ad: nameParts.ad,
    soyad: nameParts.soyad,
    adSoyad,
    sinif: String(report.sinif || '').trim(),
    sube: String(report.sube || '').trim(),
    pin: String(report.pin || generatePin_(studentNo, adSoyad)).toLocaleUpperCase('tr-TR'),
    genelDurum: normalizeLevel_(report.genelDurum),
    derseKatilim: normalizeLevel_(report.derseKatilim),
    soruSorma: normalizeLevel_(report.soruSorma),
    derseHazirlik: normalizeLevel_(report.derseHazirlik),
    dikkatIlgi: normalizeLevel_(report.dikkatIlgi),
    odevYuzde: Number(report.odevYuzde || 0),
    katilimYuzde: Number(report.katilimYuzde || 0),
    islenenKonu: String(report.islenenKonu || '').trim(),
    anlamaDuzeyi: normalizeLevel_(report.anlamaDuzeyi),
    evCalismasi: String(report.evCalismasi || '').trim(),
    ogretmenNotu: String(report.ogretmenNotu || '').trim(),
    sonGuncelleme: new Date(),
    veliGordu: report.veliGordu || ''
  };

  for (let index = 1; index <= 12; index++) {
    const key = `deneme${index}`;
    const value = report[key];
    cleanReport[key] = normalizeDenemeValue_(value);
  }

  return cleanReport;
}

function normalizeLevel_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const lower = text.toLocaleLowerCase('tr-TR');
  if (lower === 'çok iyi' || lower === 'cok iyi') return 'Çok İyi';
  if (lower === 'iyi') return 'İyi';
  if (lower === 'orta') return 'Orta';
  if (
    lower === 'zayıf' ||
    lower === 'zayif' ||
    lower === 'kötü' ||
    lower === 'kotu' ||
    lower === 'geliştirilmeli' ||
    lower === 'gelistirilmeli'
  ) return 'Zayıf';
  return text;
}

function markReportViewed_(rowIndex) {
  if (rowIndex < 2) return '';

  const sheet = ensureSheet_();
  const headerMap = getHeaderMap_(sheet);
  if (!headerMap.veliGordu) return '';

  const viewedAt = new Date();
  sheet.getRange(rowIndex, headerMap.veliGordu).setValue(viewedAt);
  return viewedAt;
}

function buildFullName_(report) {
  if (!report) return '';
  if (report.ad || report.soyad) {
    return `${String(report.ad || '').trim()} ${String(report.soyad || '').trim()}`.trim();
  }
  return String(report.adSoyad || '').trim();
}

function splitName_(report) {
  const explicitAd = String(report.ad || '').trim();
  const explicitSoyad = String(report.soyad || '').trim();

  if (explicitAd || explicitSoyad) {
    return { ad: explicitAd, soyad: explicitSoyad };
  }

  const parts = String(report.adSoyad || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { ad: parts[0] || '', soyad: '' };
  }

  return {
    ad: parts.slice(0, -1).join(' '),
    soyad: parts[parts.length - 1]
  };
}

function generatePin_(studentNo, adSoyad) {
  const parts = String(adSoyad || '').trim().split(/\s+/);
  const firstInitial = parts[0] ? parts[0][0] : '';
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${studentNo}${firstInitial}${lastInitial}`.toLocaleUpperCase('tr-TR');
}

function ensureSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (needsHeaders) {
    const oldHeaders = currentHeaders.map(header => canonicalHeader_(header));
    const lastRow = sheet.getLastRow();
    let existingReports = [];

    if (lastRow >= 2 && oldHeaders.some(Boolean)) {
      const oldValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
      existingReports = oldValues.map(row => {
        const item = {};
        oldHeaders.forEach((header, index) => {
          if (header) item[header] = row[index];
        });
        return normalizeReport_(item);
      }).filter(report => report.studentNo);
    }

    sheet.clearContents();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);

    if (existingReports.length) {
      const values = existingReports.map(report => HEADERS.map(header => report[header] ?? ''));
      sheet.getRange(2, 1, values.length, HEADERS.length).setValues(values);
    }
  }

  applySheetFormats_(sheet);
  return sheet;
}

function applySheetFormats_(sheet) {
  const headerMap = getHeaderMap_(sheet);
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);

  for (let index = 1; index <= 12; index++) {
    const column = headerMap[`deneme${index}`];
    if (column) sheet.getRange(2, column, maxRows, 1).setNumberFormat('0');
  }

  ['odevYuzde', 'katilimYuzde'].forEach(header => {
    const column = headerMap[header];
    if (column) sheet.getRange(2, column, maxRows, 1).setNumberFormat('0');
  });

  ['sonGuncelleme', 'veliGordu'].forEach(header => {
    const column = headerMap[header];
    if (column) sheet.getRange(2, column, maxRows, 1).setNumberFormat('dd.mm.yyyy hh:mm:ss');
  });
}

function normalizeDenemeValue_(value) {
  if (value === undefined || value === null || value === '') return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    if (year <= 1901) {
      return Math.round(Math.max(0, Math.min(20, value.getDate())));
    }
    return '';
  }

  const number = Number(String(value).replace(',', '.'));
  if (isNaN(number)) return '';
  return Math.round(Math.max(0, Math.min(20, number)));
}

function fixDenemeDateValues_(sheet) {
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (let index = 1; index <= 12; index++) {
    const column = headerMap[`deneme${index}`];
    if (!column) continue;

    const range = sheet.getRange(2, column, lastRow - 1, 1);
    const values = range.getValues().map(row => [normalizeDenemeValue_(row[0])]);
    range.setValues(values);
  }
}

function generatePinsForAllRows_() {
  const sheet = ensureSheet_();
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { ok: true, updated: 0 };
  }

  let updated = 0;
  for (let row = 2; row <= lastRow; row++) {
    if (writePinForRow_(sheet, headerMap, row)) updated++;
  }

  return { ok: true, updated };
}

function writePinForRow_(sheet, headerMap, row) {
  if (!headerMap.studentNo || !headerMap.ad || !headerMap.soyad || !headerMap.pin) return false;

  const studentNo = String(sheet.getRange(row, headerMap.studentNo).getValue() || '').trim();
  const ad = String(sheet.getRange(row, headerMap.ad).getValue() || '').trim();
  const soyad = String(sheet.getRange(row, headerMap.soyad).getValue() || '').trim();

  if (!studentNo || !ad || !soyad) return false;

  const pin = generatePin_(studentNo, `${ad} ${soyad}`);
  sheet.getRange(row, headerMap.pin).setValue(pin);
  return true;
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    const key = canonicalHeader_(header);
    if (key) map[key] = index + 1;
  });
  return map;
}

function canonicalHeader_(header) {
  const raw = String(header || '').trim();
  if (!raw) return '';
  if (HEADERS.indexOf(raw) !== -1) return raw;

  const key = raw
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]/g, '');

  const aliases = {
    ogrencino: 'studentNo',
    ogrencinumara: 'studentNo',
    ogrencinumarasi: 'studentNo',
    numara: 'studentNo',
    no: 'studentNo',
    adsoyad: 'adSoyad',
    adisoyadi: 'adSoyad',
    ogrenciadi: 'ad',
    adi: 'ad',
    ad: 'ad',
    soyadi: 'soyad',
    soyad: 'soyad',
    sinif: 'sinif',
    sube: 'sube',
    sifre: 'pin',
    pin: 'pin',
    odevyuzde: 'odevYuzde',
    odevyuzdesi: 'odevYuzde',
    odevbasari: 'odevYuzde',
    katilimyuzde: 'katilimYuzde',
    katilimyuzdesi: 'katilimYuzde',
    islenenkonu: 'islenenKonu',
    islenenkonular: 'islenenKonu',
    konu: 'islenenKonu',
    anlamaduzeyi: 'anlamaDuzeyi',
    evcalismasi: 'evCalismasi',
    evcalisma: 'evCalismasi',
    ogretmennotu: 'ogretmenNotu',
    songuncelleme: 'sonGuncelleme',
    veligordu: 'veliGordu',
    geneldurum: 'genelDurum',
    dersekatilim: 'derseKatilim',
    sorusorma: 'soruSorma',
    dersehazirlik: 'derseHazirlik',
    dikkatilgi: 'dikkatIlgi',
    dikkatveilgi: 'dikkatIlgi'
  };

  if (aliases[key]) return aliases[key];
  const denemeMatch = key.match(/^deneme(\d+)$/);
  if (denemeMatch) return `deneme${denemeMatch[1]}`;
  return raw;
}

function readRows_() {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const headerMap = getHeaderMap_(sheet);
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.map(row => {
    const item = {};
    HEADERS.forEach(header => {
      const column = headerMap[header];
      item[header] = column ? row[column - 1] : '';
    });
    for (let index = 1; index <= 12; index++) {
      const key = `deneme${index}`;
      item[key] = normalizeDenemeValue_(item[key]);
    }
    const nameParts = splitName_(item);
    const adSoyad = `${nameParts.ad} ${nameParts.soyad}`.trim();
    return {
      ...item,
      ad: nameParts.ad,
      soyad: nameParts.soyad,
      adSoyad,
      pin: item.pin || generatePin_(item.studentNo, adSoyad)
    };
  }).filter(item => String(item.studentNo || '').trim() && String(item.adSoyad || '').trim());
}

function findRowByStudentNo_(studentNo) {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return -1;

  const headerMap = getHeaderMap_(sheet);
  const studentNoColumn = headerMap.studentNo || 1;
  const values = sheet.getRange(2, studentNoColumn, lastRow - 1, 1).getValues();
  const foundIndex = values.findIndex(row => String(row[0]) === studentNo);

  return foundIndex === -1 ? -1 : foundIndex + 2;
}

function jsonResponse(payload, callback) {
  const text = callback
    ? `${callback}(${JSON.stringify(payload)});`
    : JSON.stringify(payload);
  const mimeType = callback
    ? ContentService.MimeType.JAVASCRIPT
    : ContentService.MimeType.JSON;

  return ContentService
    .createTextOutput(text)
    .setMimeType(mimeType);
}
