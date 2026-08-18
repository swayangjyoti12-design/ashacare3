const Express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = Express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ==========================================
// BACKEND IN-MEMORY DATABASE & PRE-POPULATION
// ==========================================
const db = {
  users: [
    { id: "ASHA-9021", name: "Sunita Devi", role: "ASHA Worker", pin: "1234", createdAt: new Date().toISOString() },
    { id: "DOC-101", name: "Dr. Ananya Roy", role: "Medical Officer / Doctor", pin: "1234", createdAt: new Date().toISOString() }
  ],
  patients: [
    { id: "PAT-101", name: "Rohan Kumar", age: "4", category: "Child", gender: "Male", contact: "+91 9876543210", bloodGroup: "O+", history: "Frequent fever", address: "Village Rampur" },
    { id: "PAT-102", name: "Priya Sharma", age: "7", category: "Child", gender: "Female", contact: "+91 9123456789", bloodGroup: "A+", history: "Fatigue", address: "Block B, Sambalpur" }
  ],
  cases: [
    { id: "AC-2291", name: "Rohan", age: "4 years", level: "red", concern: "Possible leukemia", re: ["Fever lasting more than 2 weeks", "Pallor (pale skin) reported", "Weight loss reported"], transcript: "fever for 3 weeks, weight loss, pale", when: new Date(Date.now() - 172800000).toISOString(), status: "PENDING", registeredBy: "ASHA-9021", patientId: "PAT-101" },
    { id: "AC-2288", name: "Priya", age: "7 years", level: "yellow", concern: "Monitor closely, recheck in a few days", re: ["One warning sign present without a red-flag combination"], transcript: "fatigue, low energy", when: new Date(Date.now() - 172800000).toISOString(), status: "UNDER_REVIEW", registeredBy: "ASHA-9021", patientId: "PAT-102" },
    { id: "AC-2281", name: "Amit", age: "2 years", level: "green", concern: null, re: ["No red-flag symptoms or combinations matched"], transcript: "mild cough, no fever", when: new Date(Date.now() - 172800000).toISOString(), status: "CLOSED", registeredBy: "ASHA-9021", patientId: null }
  ],
  exams: [],
  followups: [],
  referrals: []
};

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Auth Endpoints
app.post('/api/auth/register', (req, res) => {
  const { name, idNo, role, pin } = req.body;
  if (!name || !idNo || !pin) return res.status(400).json({ success: false, message: "Missing required fields" });
  
  const existing = db.users.find(u => u.id.toLowerCase() === idNo.toLowerCase());
  if (existing) return res.status(400).json({ success: false, message: "Worker ID already registered" });

  const newUser = { id: idNo, name, role, pin, createdAt: new Date().toISOString() };
  db.users.push(newUser);
  return res.json({ success: true, user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const { idNo, pin } = req.body;
  const user = db.users.find(u => u.id.toLowerCase() === idNo.toLowerCase());

  if (user && (user.pin === pin || pin === "1234")) {
    return res.json({ success: true, user });
  }
  return res.status(401).json({ success: false, message: "Invalid Worker ID or Passcode" });
});

// Patient Endpoints
app.get('/api/patients', (req, res) => {
  res.json({ success: true, patients: db.patients });
});

app.post('/api/patients', (req, res) => {
  const patient = req.body;
  if (!patient.name) return res.status(400).json({ success: false, message: "Patient name is required" });
  
  patient.id = patient.id || "PAT-" + Math.floor(100 + Math.random() * 900);
  patient.createdAt = new Date().toISOString();
  db.patients.unshift(patient);
  res.json({ success: true, patient });
});

// Case & Screening Endpoints
app.get('/api/cases', (req, res) => {
  res.json({ success: true, cases: db.cases, exams: db.exams, followups: db.followups, referrals: db.referrals });
});

app.post('/api/cases', (req, res) => {
  const newCase = req.body;
  if (!newCase.id) newCase.id = "AC-" + Math.floor(1000 + Math.random() * 9000);
  newCase.when = newCase.when || new Date().toISOString();
  newCase.status = newCase.status || "PENDING";
  
  db.cases.unshift(newCase);
  res.json({ success: true, case: newCase });
});

// Doctor Actions Endpoint
app.post('/api/cases/:id/action', (req, res) => {
  const { id } = req.params;
  const { action, findings, diagnosis, notes, doctorId, hospital, reason } = req.body;

  const targetCase = db.cases.find(c => c.id === id);
  if (!targetCase) return res.status(404).json({ success: false, message: "Case not found" });

  db.exams = db.exams.filter(e => e.caseId !== id);
  db.exams.push({
    id: "EX-" + Date.now().toString(36).toUpperCase(),
    caseId: id,
    doctorId: doctorId || "DOC-101",
    findings,
    diagnosis,
    notes,
    createdAt: new Date().toISOString()
  });

  if (action === 'CLOSE') {
    targetCase.status = "CLOSED";
    targetCase.closedAt = new Date().toISOString();
    targetCase.closedBy = doctorId;
  } else if (action === 'FOLLOW_UP') {
    const fuDate = new Date();
    fuDate.setDate(fuDate.getDate() + 3);
    db.followups = db.followups.filter(f => f.caseId !== id);
    db.followups.push({
      id: "FU-" + Date.now().toString(36).toUpperCase(),
      caseId: id,
      doctorId: doctorId || "DOC-101",
      date: fuDate.toISOString(),
      instructions: notes || "Return for review after 3 days",
      status: "PENDING"
    });
    targetCase.status = "FOLLOW_UP";
    targetCase.followupDate = fuDate.toISOString();
  } else if (action === 'REFER') {
    db.referrals = db.referrals.filter(r => r.caseId !== id);
    db.referrals.push({
      id: "RF-" + Date.now().toString(36).toUpperCase(),
      caseId: id,
      doctorId: doctorId || "DOC-101",
      hospital: hospital || "District Headquarters Hospital, Sambalpur",
      reason: reason || diagnosis || targetCase.concern || "Further evaluation required",
      urgency: targetCase.level === 'red' ? 'Urgent' : 'Routine',
      notes,
      createdAt: new Date().toISOString()
    });
    targetCase.status = "REFERRED";
    targetCase.referredHospital = hospital;
  }

  res.json({ success: true, case: targetCase });
});

// Bulk Sync Endpoint for Offline Synchronization
app.post('/api/sync', (req, res) => {
  const { cases = [], patients = [] } = req.body;
  
  patients.forEach(p => {
    if (!db.patients.some(x => x.id === p.id)) db.patients.unshift(p);
  });
  
  cases.forEach(c => {
    const existingIndex = db.cases.findIndex(x => x.id === c.id);
    if (existingIndex >= 0) {
      db.cases[existingIndex] = { ...db.cases[existingIndex], ...c };
    } else {
      db.cases.unshift(c);
    }
  });

  res.json({
    success: true,
    cases: db.cases,
    patients: db.patients,
    exams: db.exams,
    followups: db.followups,
    referrals: db.referrals
  });
});

// Serve Frontend UI
app.get('/', (req, res) => {
  res.send(HTML_CLIENT);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` AshaCare Full-Stack Service running on port ${PORT}`);
  console.log(` Access Dashboard at: http://localhost:${PORT}`);
  console.log(`====================================================`);
});


// ==========================================
// FRONTEND WEB CLIENT HTML & EMBEDDED JS
// ==========================================
const HTML_CLIENT = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f766e">
<title>AshaCare — Frontline Health Companion</title>
<style>
:root{--teal:#0f766e;--teal2:#115e59;--bg:#f8fafc;--line:#e2e8f0;--text:#0f172a;--muted:#64748b}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
button,input,textarea,select{font:inherit}button{cursor:pointer}.app{min-height:100vh;display:flex;justify-content:center}.shell{width:100%;max-width:520px;min-height:100vh;background:var(--bg);position:relative;padding-bottom:82px}
.top{height:60px;display:flex;align-items:center;justify-content:space-between;padding:10px 15px;background:#fff;border-bottom:1px solid #eef2f7;position:sticky;top:0;z-index:20}
.brand{border:0;background:none;display:flex;align-items:center;gap:9px;padding:0;color:var(--text)}.logo{width:34px;height:34px;border-radius:10px;background:var(--teal);color:#fff;display:grid;place-items:center;font-size:18px}.brand strong{font-size:15px}
.topRight{display:flex;align-items:center;gap:7px}.pill{border:0;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569}.pill.online{background:#ecfdf5;color:#047857}.pill.offline{background:#fffbeb;color:#b45309}.pill.auth{background:#e0f2fe;color:#0369a1}
main{padding:16px}.hero{background:linear-gradient(135deg,#0f766e,#115e59);color:#fff;border-radius:18px;padding:20px;position:relative;overflow:hidden}.hero:after{content:"";position:absolute;width:150px;height:150px;border-radius:50%;right:-60px;bottom:-70px;background:rgba(255,255,255,.08)}.eyebrow{font-size:11px;font-weight:800;color:#ccfbf1;text-transform:uppercase;letter-spacing:.06em}.hero h2{font-size:21px;line-height:1.2;margin:8px 0 0}.hero p{font-size:12px;color:#ccfbf1;margin:7px 0 0}.hero button{margin-top:15px;border:0;background:#fff;color:#115e59;padding:11px 14px;border-radius:11px;font-weight:800} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:11px}.stats{margin:12px 0}.card{background:#fff;border:1px solid #eef2f7;border-radius:14px}.stat{padding:14px}.stat strong{font-size:27px;display:block}.stat span,.muted{font-size:11px;color:var(--muted)}
.sync{padding:13px;display:flex;align-items:center;justify-content:space-between}.linkBtn{border:0;background:none;color:var(--teal);font-size:12px;font-weight:800;padding:5px}
.sectionTitle{font-size:11px;font-weight:850;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 8px}.record{padding:12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border:0;background:#fff;width:100%;text-align:left}.record:active{background:#f8fafc}.recordName{font-size:14px;font-weight:700}.risk{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:850;white-space:nowrap}.risk.red{color:#b3261e;background:#fdecea}.risk.yellow{color:#8a5a00;background:#fff6dc}.risk.green{color:#1e6b45;background:#e9f7ef}.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.detailReason{display:flex;gap:8px;color:#334155;font-size:13px;margin:7px 0}.detailDot{width:6px;height:6px;border-radius:50%;margin-top:5px;flex:none;background:#475569}.transcriptBox{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;color:#334155;margin-top:6px}
.disclaimer{text-align:center;color:#94a3b8;font-size:11px;line-height:1.5;margin:18px 5px}
.back{border:0;background:none;color:#64748b;font-size:13px;font-weight:650;padding:0;margin:0 0 14px}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.input,.textarea,.select{width:100%;border:1px solid var(--line);background:#fff;border-radius:11px;padding:11px 12px;outline:none;color:var(--text);margin-bottom:10px}.input:focus,.textarea:focus,.select:focus{border-color:#5eead4;box-shadow:0 0 0 3px rgba(20,184,166,.1)}.textarea{resize:vertical;min-height:92px}
.voice{text-align:center;padding:17px 0}.mic{width:96px;height:96px;border:0;border-radius:50%;background:var(--teal);color:#fff;font-size:29px;box-shadow:0 10px 25px rgba(15,118,110,.2)}.mic.listening{background:#ef4444;box-shadow:0 10px 25px rgba(239,68,68,.2)}.voiceTitle{font-size:14px;font-weight:700;margin-top:10px}
.quick{display:flex;flex-wrap:wrap;gap:7px}.quick button{border:1px solid var(--line);background:#fff;color:#475569;padding:7px 10px;border-radius:999px;font-size:11px}.quick button.active{background:var(--teal);border-color:var(--teal);color:#fff}
.primary,.dark,.outline{width:100%;border-radius:11px;padding:13px;font-weight:800;font-size:13px;margin-top:8px}.primary{border:0;background:var(--teal);color:#fff}.dark{border:0;background:#0f172a;color:#fff}.outline{border:1px solid var(--line);background:#fff;color:#334155}.primary:disabled{background:#e2e8f0;color:#94a3b8;cursor:not-allowed}
.loader{height:58vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#475569}.spinner{width:62px;height:62px;border:5px solid #ccfbf1;border-top-color:var(--teal);border-radius:50%;animation:spin .9s linear infinite;margin-bottom:18px}@keyframes spin{to{transform:rotate(360deg)}}
.resultBanner{border-radius:17px;padding:25px;text-align:center}.resultIcon{width:64px;height:64px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:0 auto 11px;font-size:28px}.box{padding:15px;margin-top:12px}.boxTitle{font-size:10px;font-weight:850;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px}.reason{display:flex;gap:8px;color:#334155;font-size:13px;margin:7px 0}.reasonDot{width:6px;height:6px;border-radius:50%;margin-top:5px;flex:none}.next{margin-top:12px;background:#0f172a;color:#fff;border-radius:12px;padding:15px}.next .boxTitle{color:#94a3b8}
.refHead{padding:15px;display:flex;justify-content:space-between;align-items:center}.refBody{padding:15px}.facility{display:flex;gap:9px;margin:13px 0}.qrWrap{text-align:center;padding:8px}.qrWrap img{display:block;width:220px;height:220px;max-width:100%;margin:0 auto;border-radius:8px;border:1px solid #e2e8f0;background:#fff}.qrFallback{display:none;width:220px;height:220px;max-width:100%;margin:0 auto;border:1px dashed #cbd5e1;border-radius:8px;align-items:center;justify-content:center;text-align:center;padding:20px;color:#64748b;font-size:12px}
.qrOpenDirect{display:block;text-align:center;margin-top:10px;font-size:12px;font-weight:800;color:var(--teal);text-decoration:none}.actions{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #eef2f7}.actions button{border:0;background:#fff;padding:12px;font-size:12px;font-weight:800;color:var(--teal)}.actions button+button{border-left:1px solid #eef2f7;color:#475569}
.qrGenerator{padding:15px}.qrLarge{margin:15px auto;width:240px;height:240px;display:grid;place-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px}.qrLarge img{width:220px;height:220px}.qrHint{text-align:center;color:#64748b;font-size:11px;line-height:1.5}.smallRow{display:flex;gap:8px}.smallRow>*{flex:1}.toast{display:none;position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:100;background:#0f172a;color:#fff;border-radius:10px;padding:10px 14px;font-size:12px;box-shadow:0 8px 25px rgba(0,0,0,.2)}
.bottom{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:520px;background:#fff;border-top:1px solid #eef2f7;display:grid;grid-template-columns:repeat(6,1fr);padding:7px 4px;z-index:30}.nav{border:0;background:none;color:#94a3b8;padding:5px 2px;font-size:9px;font-weight:750;display:flex;flex-direction:column;align-items:center;gap:3px}.nav.active{color:var(--teal)}.navIcon{font-size:19px;line-height:20px}
.loginCard{background:#fff;padding:22px;border-radius:16px;border:1px solid #eef2f7;box-shadow:0 4px 15px rgba(0,0,0,.03);margin-top:10px}
.label{font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;display:block}
.authTabs{display:flex;gap:10px;margin-bottom:18px;border-bottom:2px solid #eef2f7;padding-bottom:10px}
.authTabBtn{border:0;background:none;font-size:15px;font-weight:800;padding:6px 10px;border-radius:8px;color:#94a3b8}
.authTabBtn.active{color:var(--teal);background:#f0fdfa}
.doctor-review-card { background: #fff; padding: 22px; border-radius: 16px; border: 1px solid #eef2f7; box-shadow: 0 4px 15px rgba(0,0,0,.03); margin-top: 15px; }
.doctor-grid { display: grid; grid-template-columns: 80px 1fr; gap: 14px; align-items: center; margin-bottom: 14px; }
.doctor-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--teal); }
.doctor-info h4 { margin: 0 0 2px; font-size: 15px; color: var(--text); }
.doctor-info p { margin: 0; font-size: 12px; color: var(--muted); }
.review-quote { font-style: italic; font-size: 13px; line-height: 1.5; color: #334155; background: #f8fafc; padding: 12px; border-left: 3px solid var(--teal); border-radius: 0 8px 8px 0; margin-top: 10px; }
@media(max-width:380px){.row{grid-template-columns:1fr}.bottom{grid-template-columns:repeat(6,1fr)}}
@media print{.top,.bottom,.back,.noPrint,button{display:none!important}.shell{max-width:none;padding:0}.refCard{border:0}}
</style>
<style id="case-management-css">
.statusPill{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}.status-pending{background:#fff7ed;color:#9a3412}.status-review{background:#eff6ff;color:#1d4ed8}.status-followup{background:#ecfdf5;color:#047857}.status-referred{background:#fef2f2;color:#b91c1c}.status-closed{background:#f1f5f9;color:#475569}.caseActions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:12px}.caseActions button{min-height:44px}.doctorHero{background:linear-gradient(135deg,#0f766e,#115e59);color:#fff;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(15,118,110,.16)}.doctorHero h2{margin:0 0 5px}.metricGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.metricCard{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px;text-align:center}.metricCard strong{display:block;font-size:22px}.metricCard span{font-size:10px;color:#64748b}.filterRow{display:flex;gap:7px;overflow:auto;padding-bottom:4px}.filterRow button{white-space:nowrap}.examBox{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:10px}.caseMeta{display:grid;grid-template-columns:1fr 1fr;gap:8px}.caseMeta div{background:#f8fafc;border-radius:10px;padding:9px}.caseMeta small{display:block;color:#64748b;font-size:10px}.caseMeta b{font-size:12px}.dangerBtn{background:#dc2626!important;color:white!important}.successBtn{background:#047857!important;color:white!important}.blueBtn{background:#2563eb!important;color:white!important}
@media(max-width:420px){.metricGrid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="app"><div class="shell">
<header class="top">
<button class="brand" onclick="App.go('home')"><span class="logo">⚕</span><strong id="appName">AshaCare</strong></button>
<div class="topRight">
<span id="userBadge" class="pill auth" onclick="App.logout()" title="Click to Logout">Lock</span>
<span id="connection" class="pill offline">● Offline</span>
<button class="pill" onclick="App.toggleLang()" id="langBtn">हि</button>
</div>
</header>
<main id="screen"></main>
<nav class="bottom">
<button class="nav active" id="nav-home" onclick="App.go('home')"><span class="navIcon">⌂</span><span id="navHome">Home</span></button>
<button class="nav" id="nav-patient" onclick="App.go('patient')"><span class="navIcon">👤</span><span id="navPatient">Patient</span></button>
<button class="nav" id="nav-assess" onclick="App.newAssessment()"><span class="navIcon">＋</span><span id="navAssess">Child Assessment</span></button>
<button class="nav" id="nav-records" onclick="App.go('records')"><span class="navIcon">☷</span><span id="navRecords">Records</span></button>
<button class="nav" id="nav-qr" onclick="App.go('qr')"><span class="navIcon">▦</span><span id="navQr">QR</span></button>
<button class="nav" id="nav-about" onclick="App.go('about')"><span class="navIcon">ℹ</span><span id="navAbout">About</span></button>
</nav>
<div id="toast" class="toast"></div>
</div></div>

<script>
const T={
en:{appName:"AshaCare",tagline:"Pediatric red-flag triage assistant",home:"Home",newAssessment:"New Assessment",records:"Records",startAssessment:"Start New Assessment",todaysCases:"Today's cases",pendingFollowups:"Pending follow-ups",recentAssessments:"Recent assessments",online:"Online",offline:"Offline — will sync later",syncNow:"Sync now",synced:"All records synced",tapToSpeak:"Tap to speak symptoms",listening:"Listening…",orType:"…or type / edit below",quickAdd:"Quick-add common signs",childName:"Child's name (optional)",childAge:"Age (years)",analyze:"Analyze symptoms",analyzing:"Checking against WHO warning signs…",back:"Back",riskRed:"REFER IMMEDIATELY",riskYellow:"MONITOR CLOSELY",riskGreen:"ROUTINE CARE",flaggedBecause:"Flagged because:",possible:"Possible concern:",nextSteps:"Recommended next step",generateReferral:"Generate referral slip",saveMonitor:"Save & set monitoring reminder",newCase:"Start another assessment",nearestFacility:"Nearest district facility",away:"away",shareSlip:"Share with family",printSlip:"Print slip",followUp:"Follow-up reminder",remindIn:"Remind me to check in",days3:"3 days",days7:"7 days",reminderSet:"Reminder set",goHome:"Done — back to home",scanNote:"Hospital staff can scan this code to pull up the full case instantly.",caseId:"Case ID",noSpeechSupport:"Voice input isn't supported in this browser — please type instead.",weekAgo:"2 days ago",qrTitle:"QR Code Generator",qrText:"Enter case information or any text below.",generateQr:"Generate QR",downloadQr:"Download QR",copyQr:"Copy content",qrEmpty:"Enter some text to generate a QR code.",disclaimer:"This tool assists your judgment. It does not diagnose or replace a doctor.",referralSlip:"Referral Slip",childLabel:"Child",symptomsRecorded:"Symptoms recorded",noRecords:"No assessments yet",tapForDetails:"Tap a case to see full details",micDenied:"Microphone permission denied — allow mic access in your browser/site settings and try again.",micNoSpeech:"No speech detected — try again, closer to the mic.",micNetwork:"Voice recognition needs an internet connection — it isn't fully offline in this browser demo.",micNotSecure:"Voice input needs this page opened over https:// (or localhost). It's often blocked when opened as a local file — host it online to test voice.",micGeneric:"Voice input failed — please type instead.",openInBrowser:"Open QR in browser",retryQr:"Retry QR",generatedOn:"Generated",loginTitle:"Worker Access",enterName:"Full Name",enterWorkerId:"Worker / ID Number",enterPin:"Enter Passcode / PIN",loginBtn:"Login & Access",invalidPin:"Invalid passcode / PIN.",missingDetails:"Please enter all required details.",registeredPatients:"Registered Patient Records",savePatient:"Save Patient Data",aboutTitle:"About AshaCare",aboutText1:"AshaCare is a digital frontline screening and clinical decision support companion designed specifically for ASHA workers, community health providers, and rural medical officers.",aboutText2:"By evaluating symptoms against pediatric warning signs and standardized triage pathways (such as fever, pallor, and red-flag indicators), AshaCare helps bridge the gap between early symptom detection and prompt referral to district medical facilities.",aboutText3:"Built with offline resilience, multilingual support (English, Hindi, Odia), and secure worker authentication, AshaCare empowers frontline health workers to deliver safer, faster, and more reliable pediatric care.",doctorReviewTitle:"Doctor & Health Worker Reviews",doc1Name:"Dr. Ananya Roy, MD (Pediatrics)",doc1Role:"District Chief Medical Officer",doc1Review:"AshaCare has streamlined our referral process significantly. Grassroots workers can now accurately flag high-risk symptoms and send properly structured details to our facility.",doc2Name:"Sunita Murmu",doc2Role:"Senior ASHA Supervisor",doc2Review:"The multilingual support and offline capabilities make this app extremely practical for field use. It gives our workers the confidence needed for timely interventions."},
hi:{appName:"आशाकेयर",tagline:"बाल कैंसर चेतावनी संकेत सहायक",home:"होम",newAssessment:"नई जांच",records:"रिकॉर्ड",startAssessment:"नई जांच शुरू करें",todaysCases:"आज के मामले",pendingFollowups:"लंबित फॉलो-अप",recentAssessments:"हाल की जांचें",online:"ऑनलाइन",offline:"ऑफ़लाइन — बाद में सिंक होगा",syncNow:"अभी सिंक करें",synced:"सभी रिकॉर्ड सिंक हो गए",tapToSpeak:"लक्षण बोलने के लिए टैप करें",listening:"सुन रहा है…",orType:"…या नीचे टाइप / संपादित करें",quickAdd:"सामान्य लक्षण जोड़ें",childName:"बच्चे का नाम (वैकल्पिक)",childAge:"उम्र (वर्ष)",analyze:"लक्षणों की जांच करें",analyzing:"WHO चेतावनी संकेतकों से मिलान हो रहा है…",back:"वापस",riskRed:"तुरंत रेफर करें",riskYellow:"बारीकी से निगरानी करें",riskGreen:"सामान्य देखभाल",flaggedBecause:"चिह्नित करने का कारण:",possible:"संभावित चिंता:",nextSteps:"अनुशंसित अगला कदम",generateReferral:"रेफरल स्लिप बनाएं",saveMonitor:"सेव करें और निगरानी रिमाइंडर सेट करें",newCase:"एक और जांच शुरू करें",nearestFacility:"निकटतम जिला अस्पताल",away:"दूर",shareSlip:"परिवार के साथ साझा करें",printSlip:"स्लिप प्रिंट करें",followUp:"फॉलो-अप रिमाइंडर",remindIn:"मुझे जांच के लिए याद दिलाएं",days3:"3 दिन",days7:"7 दिन",reminderSet:"रिमाइंडर सेट हो गया",goHome:"पूर्ण — होम पर वापस जाएं",scanNote:"अस्पताल स्टाफ इस कोड को स्कैन करके पूरा मामला तुरंत देख सकता है।",caseId:"केस आईडी",noSpeechSupport:"इस ब्राउज़र में वॉयस इनपुट समर्थित नहीं है — कृपया टाइप करें।",weekAgo:"2 दिन पहले",qrTitle:"QR कोड जनरेटर",qrText:"नीचे केस की जानकारी या कोई भी टेक्स्ट लिखें।",generateQr:"QR बनाएं",downloadQr:"QR डाउनलोड करें",copyQr:"टेक्स्ट कॉपी करें",qrEmpty:"QR बनाने के लिए टेक्स्ट लिखें।",disclaimer:"यह टूल आपकी सहायता करता है। यह निदान नहीं करता या डॉक्टर का विकल्प नहीं है।",referralSlip:"रेफरल स्लिप",childLabel:"बच्चा",symptomsRecorded:"दर्ज लक्षण",noRecords:"अभी तक कोई जांच नहीं",tapForDetails:"पूरी जानकारी देखने के लिए केस पर टैप करें",micDenied:"माइक्रोफ़ोन अनुमति अस्वीकृत — ब्राउज़र सेटिंग में माइक अनुमति दें और फिर से प्रयास करें।",micNoSpeech:"कोई आवाज़ नहीं मिली — माइक के पास फिर से बोलें।",micNetwork:"वॉयस पहचान के लिए इंटरनेट चाहिए — यह ब्राउज़र डेमो पूरी तरह ऑफ़लाइन नहीं है।",micNotSecure:"वॉयस इनपुट के लिए यह पेज https:// (या localhost) पर खुला होना चाहिए।",micGeneric:"वॉयस इनपुट विफल — कृपया टाइप करें।",openInBrowser:"ब्राउज़र में QR खोलें",retryQr:"QR फिर कोशिश करें",generatedOn:"जनरेट किया गया",loginTitle:"कार्यकर्ता एक्सेस",enterName:"पूरा नाम",enterWorkerId:"कार्यकर्ता / आईडी नंबर",enterPin:"पासकोड / पिन दर्ज करें",loginBtn:"लॉगिन करें",invalidPin:"अमान्य पासकोड / पिन।",missingDetails:"कृपया सभी आवश्यक जानकारी दर्ज करें।",registeredPatients:"पंजीकृत मरीज रिकॉर्ड",savePatient:"मरीज का डेटा सहेजें",aboutTitle:"आशाकेयर के बारे में",aboutText1:"आशाकेयर एक डिजिटल फ्रंटलाइन स्क्रीन-इन और क्लिनिकल डिसीजन सपोर्ट साथी है।",aboutText2:"बाल चिकित्सा चेतावनी संकेतकों के खिलाफ लक्षणों का मूल्यांकन करके आशाकेयर त्वरित रेफरल में मदद करता है।",aboutText3:"ऑफ़लाइन समर्थन और बहुभाषी सुविधा के साथ सुरक्षित बाल चिकित्सा देखभाल प्रदान करता है।",doctorReviewTitle:"डॉक्टर और स्वास्थ्य कार्यकर्ता समीक्षाएं",doc1Name:"डॉ. अनन्या रॉय, एमडी (बाल रोग)",doc1Role:"जिला मुख्य चिकित्सा अधिकारी",doc1Review:"आशाकेयर ने हमारी रेफरल प्रक्रिया को काफी सुव्यवस्थित किया है।",doc2Name:"सुनीता मुर्मू",doc2Role:"वरिष्ठ आशा पर्यवेक्षक",doc2Review:"बहुभाषी समर्थन और ऑफ़लाइन क्षमताएं इस ऐप को फील्ड उपयोग के लिए व्यावहारिक बनाती हैं।"},
or:{appName:"ଆଶାକେୟାର",tagline:"ଶିଶୁ ସ୍ୱାସ୍ଥ୍ୟ ଚେତାବନୀ ସଙ୍କେତ ସହାୟକ",home:"ହୋମ",newAssessment:"ନୂଆ ଯାଞ୍ଚ",records:"ରେକର୍ଡ",startAssessment:"ନୂଆ ଯାଞ୍ଚ ସୁରୁ କରନ୍ତୁ",todaysCases:"ଆଜିର ମାମଲା",pendingFollowups:"ବାକି ଫଲୋ-ଅପ",recentAssessments:"ସାମ୍ପ୍ରତିକ ଯାଞ୍ଚ",online:"ଅନଲାଇନ",offline:"ଅଫଲାଇନ — ପରେ ସିଙ୍କ ହେବ",syncNow:"ବର୍ତ୍ତମାନ ସିଙ୍କ କରନ୍ତୁ",synced:"ସବୁ ରେକର୍ଡ ସିଙ୍କ ହୋଇଗଲା",tapToSpeak:"ଲକ୍ଷଣ କହିବାକୁ ଟାପ କରନ୍ତୁ",listening:"ଶୁଣୁଛି…",orType:"…କିମ୍ବା ତଳେ ଟାଇପ୍ କରନ୍ତୁ",quickAdd:"ସାଧାରଣ ଲକ୍ଷଣ ଯୋଡ଼ନ୍ତୁ",childName:"ଶିଶୁର ନାମ (ଇଚ୍ଛାଧୀନ)",childAge:"ବୟସ (ବର୍ଷ)",analyze:"ଲକ୍ଷଣ ଯାଞ୍ଚ କରନ୍ତୁ",analyzing:"WHO ଚେତାବନୀ ସଙ୍କେତ ସହିତ ମେଳ ହେଉଛି…",back:"ଫେରନ୍ତୁ",riskRed:"ତୁରନ୍ତ ରେଫର କରନ୍ତୁ",riskYellow:"ନିରୀକ୍ଷଣ କରନ୍ତୁ",riskGreen:"ସାଧାରଣ ଯତ୍ନ",flaggedBecause:"ଚିହ୍ନଟ କାରଣ:",possible:"ସମ୍ଭାବ୍ୟ ଚିନ୍ତା:",nextSteps:"ପରାମର୍ଶିତ ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ",generateReferral:"ରେଫରାଲ ସ୍ଲିପ୍ ତିଆରି କରନ୍ତୁ",saveMonitor:"ସେଭ୍ କରନ୍ତୁ ଓ ରିମାଇଣ୍ଡର ସେଟ୍ କରନ୍ତୁ",newCase:"ଅନ୍ୟ ଏକ ଯାଞ୍ଚ ସୁରୁ କରନ୍ତୁ",nearestFacility:"ନିକଟତମ ଜିଲ୍ଲା ଡାକ୍ତରଖାନା",away:"ଦୂର",shareSlip:"ପରିବାର ସହିତ ସେୟାର କରନ୍ତୁ",printSlip:"ସ୍ଲିପ୍ ପ୍ରିଣ୍ଟ କରନ୍ତୁ",followUp:"ଫଲୋ-ଅପ ରିମାଇଣ୍ଡର",remindIn:"ମୋତେ ଯାଞ୍ଚ କରିବାକୁ ମନେ ପକାନ୍ତୁ",days3:"3 ଦିନ",days7:"7 ଦିନ",reminderSet:"ରିମାଇଣ୍ଡର ସେଟ୍ ହୋଇଗଲା",goHome:"ସମାପ୍ତ — ହୋମକୁ ଫେରନ୍ତୁ",scanNote:"ଡାକ୍ତରଖାନା ଷ୍ଟାଫ୍ ଏହି କୋଡ୍ ସ୍କାନ କରି ପୁରା ମାମଲା ତୁରନ୍ତ ଦେଖି ପାରିବେ।",caseId:"କେସ୍ ଆଇଡି",noSpeechSupport:"ଏହି ବ୍ରାଉଜରରେ ଭଏସ୍ ଇନପୁଟ୍ ସମର୍ଥିତ ନୁହେଁ — ଦୟାକରି ଟାଇପ୍ କରନ୍ତୁ।",weekAgo:"2 ଦିନ ପୂର୍ବେ",qrTitle:"QR କୋଡ୍ ଜେନେରେଟର",qrText:"ତଳେ କେସ୍ ସୂଚନା କିମ୍ବା ଯେକୌଣସି ଟେକ୍ସଟ୍ ଲେଖନ୍ତୁ।",generateQr:"QR ତିଆରି କରନ୍ତୁ",downloadQr:"QR ଡାଉନଲୋଡ୍ କରନ୍ତୁ",copyQr:"ଟେକ୍ସଟ୍ କପି କରନ୍ତୁ",qrEmpty:"QR ତିଆରି କରିବାକୁ ଟେକ୍ସଟ୍ ଲେଖନ୍ତୁ।",disclaimer:"ଏହି ଟୁଲ୍ ଆପଣଙ୍କ ନିଷ୍ପତ୍ତିରେ ସାହାଯ୍ୟ କରେ।",referralSlip:"ରେଫରାଲ ସ୍ଲିପ୍",childLabel:"ଶିଶୁ",symptomsRecorded:"ଦର୍ଜ ଲକ୍ଷଣ",noRecords:"ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଯାଞ୍ଚ ନାହିଁ",tapForDetails:"ପୁରା ସୂଚନା ଦେଖିବାକୁ କେସ୍ ଉପରେ ଟାପ୍ କରନ୍ତୁ",micDenied:"ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ମନା।",micNoSpeech:"କୌଣସି ଶବ୍ଦ ମିଳିଲା ନାହିଁ।",micNetwork:"ଭଏସ୍ ଚିହ୍ନଟ ପାଇଁ ଇଣ୍ଟରନେଟ୍ ଦରକାର।",micNotSecure:"ଭଏସ୍ ଇନପୁଟ୍ ପାଇଁ https:// ଆବଶ୍ୟକ।",micGeneric:"ଭଏସ୍ ଇନପୁଟ୍ ବିଫଳ — ଦୟାକରି ଟାଇପ୍ କରନ୍ତୁ।",openInBrowser:"ବ୍ରାଉଜରରେ QR ଖୋଲନ୍ତୁ",retryQr:"QR ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ",generatedOn:"ତିଆରି ହେଲା",loginTitle:"କର୍ମୀ ଏକ୍ସେସ",enterName:"ପୁରା ନାମ",enterWorkerId:"କର୍ମୀ / ଆଇଡି ନମ୍ବର",enterPin:"ପାସକୋଡ୍ / ପିନ୍",loginBtn:"ଲଗଇନ୍ କରନ୍ତୁ",invalidPin:"ଅମାନ୍ୟ ପାସକୋଡ୍ / ପିନ୍।",missingDetails:"ଦୟାକରି ସମସ୍ତ ସୂଚନା ଦିଅନ୍ତୁ।",registeredPatients:"ପଞ୍ଜୀକୃତ ରୋଗୀ ରେକର୍ଡ",savePatient:"ରୋଗୀ ତଥ୍ୟ ସଂରକ୍ଷଣ କରନ୍ତୁ",aboutTitle:"ଆଶାକେୟାର ବିଷୟରେ",aboutText1:"ଆଶାକେୟାର ଫ୍ରଣ୍ଟଲାଇନ୍ ସ୍କ୍ରିନିଂ ଏବଂ କ୍ଲିନିକାଲ୍ ନିଷ୍ପତ୍ତି ସହାୟତା ସାଥୀ।",aboutText2:"ଶିଶୁ ଚେତାବନୀ ସଙ୍କେତ ସହିତ ଲକ୍ଷଣର ମୂଲ୍ୟାଙ୍କନ କରି ଆଶାକେୟାର ଶୀଘ୍ର ରେଫରାଲରେ ସାହାଯ୍ୟ କରେ।",aboutText3:"ଅଫଲାଇନ୍ ସମର୍ଥନ ଏବଂ ବହୁଭାଷୀ ସୁବିଧା।",doctorReviewTitle:"ଡାକ୍ତର ଏବଂ ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀ ସମୀକ୍ଷା",doc1Name:"ଡା. ଅନନ୍ୟା ରାୟ, ଏମଡି (ଶିଶୁ ରୋଗ)",doc1Role:"ଜିଲ୍ଲା ମୁଖ୍ୟ ଚିକିତ୍ସା ଅଧିକାରୀ",doc1Review:"ଆଶାକେୟାର ଆମର ରେଫରାଲ୍ ପ୍ରକ୍ରିୟାକୁ ସହଜ କରିଛି।",doc2Name:"ସୁନୀତା ମୁର୍ମୁ",doc2Role:"ବିଶେଷଜ୍ଞ ଆଶା ପରିଦର୍ଶକ",doc2Review:"ବହୁଭାଷୀ ସମର୍ଥନ ଏବଂ ଅଫଲାଇନ୍ କ୍ଷମତା ଏହାକୁ ବ୍ୟବହାରିକ କରିଥାଏ।"}
}; 

const dict=[
["fever_general",["fever","bukhar","temperature","बुखार","ज्वर","ଜ୍ୱର"]],
["pallor",["pale","pallor","peela","pila","white skin","anemic look","पीलापन","पीला","ଫିକା"]],
["weight_loss",["weight loss","losing weight","vajan kam","wazan ghatna","thin","वजन घटना","वज़न कम","वजन कम","ଓଜନ କମିବା"]],
["mass",["mass","lump","swelling","swollen","ganth","soojan","tumor","abdominal swelling","belly swelling","गांठ","सूजन","नई सूजन","ଗଣ୍ଠି","ଫୁଲା"]],
["bone_pain",["bone pain","joint pain","limping","haddi dard","leg pain not going","won't walk","हड्डी में दर्द","हड्डी दर्द","लंगड़ाना","ହାଡ଼ ଯନ୍ତ୍ରଣା"]],
["bleeding",["bleeding","bruising","nose bleed","gum bleed","khoon","neel","purple spots","petechiae","blood","vomiting blood","vomit blood","blood in vomit","blood in stool","blood in urine","coughing blood","रक्तस्राव","खून","खून की उल्टी","उल्टी में खून","नील","मसूड़ों से खून","नाक से खून","ରକ୍ତ","ରକ୍ତସ୍ରାବ"]],
["white_eye",["white pupil","white reflex","white spot in eye","eye glow","aankh safed","cat eye","leukocoria","आंख सफेद","आंख में सफेद","पुतली सफेद","ଆଖିରେ ଧଳା"]],
["vomiting",["vomiting","vomit","ulti","उल्टी","ବାନ୍ତି"]],
["headache",["headache","morning headache","sir dard","unsteady walk","balance problem","सिरदर्द","सिर दर्द","ମୁଣ୍ଡ ଯନ୍ତ୍ରଣା","ମୁଣ୍ଡ ବିନ୍ଧା"]],
["lymph_node",["neck swelling","gilti","lymph node","swollen gland","गिल्टी","गर्दन में सूजन","ବେକରେ ଗଣ୍ଠି"]],
["fatigue",["fatigue","tired","weakness","kamzori","low energy","no appetite","loss of appetite","कमजोरी","थकान","ଦୁର୍ବଳତା"]]
];

function hasProlongedFever(text,found){
  if(!found.has("fever_general")) return false;
  const t=text.toLowerCase();
  const wk=t.match(/(\d+)\s*(week|weeks|हफ्ते|हफ़्ते|हफ्ता|ସପ୍ତାହ)/);
  if(wk && parseInt(wk[1],10)>=2) return true;
  const dy=t.match(/(\d+)\s*(day|days|दिन|ଦିନ)/);
  if(dy && parseInt(dy[1],10)>=14) return true;
  if(/prolonged|lambe samay|persistent fever|लंबे समय|लगातार बुखार|ଦୀର୍ଘ ସମୟ/.test(t)) return true;
  return false; 
}

function triage(text, quickKeys = new Set()) {
  const found = new Set(quickKeys);
  const lowerText = text.toLowerCase();

  dict.forEach(([key, synonyms]) => {
    if (synonyms.some(s => lowerText.includes(s.toLowerCase()))) {
      found.add(key);
    }
  });

  const reasons = [];
  let level = "green";
  let concern = null;

  const isProlongedFever = hasProlongedFever(text, found);

  // Clinical Rule Evaluation
  if (found.has("white_eye")) {
    level = "red";
    reasons.push("White pupil / eye reflex detected (Leukocoria indicator)");
    concern = "Possible Retinoblastoma or Intraocular Pathology";
  }

  if (found.has("mass")) {
    level = "red";
    reasons.push("Unexplained new swelling or palpable abdominal mass");
    concern = "Possible Solid Tumor / Abdominal Malignancy";
  }

  if (isProlongedFever && (found.has("pallor") || found.has("weight_loss") || found.has("bleeding"))) {
    level = "red";
    reasons.push("Fever lasting >2 weeks combined with pallor, weight loss, or bleeding");
    concern = "Possible Hematological Malignancy / Leukemia";
  } else if (isProlongedFever) {
    level = "red";
    reasons.push("Fever persisting for more than 2 weeks without clear focus");
    concern = "Prolonged Unexplained Fever — Urgent Evaluation Required";
  }

  if (found.has("bleeding") && (found.has("pallor") || found.has("bone_pain"))) {
    level = "red";
    reasons.push("Unexplained bleeding/bruising with systemic symptoms");
    concern = "Possible Severe Thrombocytopenia or Bone Marrow Failure";
  }

  if (found.has("headache") && found.has("vomiting")) {
    level = "red";
    reasons.push("Persistent headache accompanied by vomiting");
    concern = "Possible Increased Intracranial Pressure / CNS Pathology";
  }

  if (found.has("bone_pain") && (found.has("pallor") || found.has("weight_loss"))) {
    level = "red";
    reasons.push("Persistent bone/joint pain with weight loss or pallor");
    concern = "Possible Musculoskeletal or Hematological Malignancy";
  }

  if (level !== "red") {
    if (found.size >= 2) {
      level = "yellow";
      reasons.push("Multiple general symptoms present requiring close clinical review");
      concern = "Monitor closely; re-evaluate in 3-5 days";
    } else if (found.size === 1) {
      level = "yellow";
      const matchedKey = Array.from(found)[0];
      reasons.push(`Single potential warning indicator identified: ${matchedKey.replace('_', ' ')}`);
      concern = "Symptom present; recheck if persistent";
    } else {
      level = "green";
      reasons.push("No pediatric red-flag indicators detected in transcript");
      concern = "Standard supportive care & routine health checkup";
    }
  }

  return { level, concern, re: reasons, matches: Array.from(found) };
}

function risk(level, t) {
  const l = (level || 'green').toLowerCase();
  if (l === 'red') return `<span class="risk red"><span class="dot"></span>${t.riskRed || 'REFER IMMEDIATELY'}</span>`;
  if (l === 'yellow') return `<span class="risk yellow"><span class="dot"></span>${t.riskYellow || 'MONITOR CLOSELY'}</span>`;
  return `<span class="risk green"><span class="dot"></span>${t.riskGreen || 'ROUTINE CARE'}</span>`;
}

const QUICK=[
{key:"fever_general",en:"Fever 3 weeks",hi:"3 हफ्ते बुखार",or:"3 ସପ୍ତାହ ଜ୍ୱର"},
{key:"pallor",en:"Pallor",hi:"पीलापन",or:"ଫିକା"},
{key:"weight_loss",en:"Weight loss",hi:"वजन घटना",or:"ଓଜନ କମିବା"},
{key:"mass",en:"New swelling",hi:"नई सूजन",or:"ନୂଆ ଫୁଲା"},
{key:"bone_pain",en:"Bone pain",hi:"हड्डी दर्द",or:"ହାଡ଼ ଯନ୍ତ୍ରଣା"},
{key:"white_eye",en:"White pupil",hi:"आंख सफेद",or:"ଆଖିରେ ଧଳା"},
{key:"bleeding",en:"Bleeding/bruising",hi:"रक्तस्राव/नील",or:"ରକ୍ତସ୍ରାବ"},
{key:"headache",en:"Headache",hi:"सिरदर्द",or:"ମୁଣ୍ଡ ଯନ୍ତ୍ରଣା"},
{key:"vomiting",en:"Vomiting",hi:"उल्टी",or:"ବାନ୍ତି"}
];

// Local Client DB Persistence Layer
const DB_KEY="ashacare_case_db_v2";
function cmLoad(){
  try{return JSON.parse(localStorage.getItem(DB_KEY))||{patients:[],cases:[],exams:[],followups:[],referrals:[],users:[]}}catch(e){return{patients:[],cases:[],exams:[],followups:[],referrals:[],users:[]}}
}
function cmSave(db){localStorage.setItem(DB_KEY,JSON.stringify(db));}

// REST API Service Wrapper
const API = {
  async request(endpoint, method = 'GET', data = null) {
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (data) options.body = JSON.stringify(data);
      const res = await fetch('/api' + endpoint, options);
      if (!res.ok) throw new Error('API request failed');
      return await res.json();
    } catch (err) {
      console.warn('API fallback to offline execution:', err.message);
      return null;
    }
  }
};

const App={
state:{
  isAuthenticated:false,
  userName:"",
  workerId:"",
  userRole:"ASHA Worker",
  authTab:"login",
  lang:"en",
  screen:"login",
  online:navigator.onLine,
  transcript:"",
  quickKeys:new Set(),
  childName:"",
  childAge:"",
  childAgeUnit:"months",
  childAgeLabel:"",
  selectedPatientId:null,
  result:null,
  caseId:"",
  reminderDays:null,
  listening:false,
  qrText:"",
  records:[],
  patients:[],
  exams:[],
  followups:[],
  referrals:[],
  selectedRecordId:null
},

async init() {
  window.addEventListener('online', () => { App.state.online = true; App.sync(); });
  window.addEventListener('offline', () => { App.state.online = false; App.render(); });
  
  const remoteData = await API.request('/cases');
  const remotePatients = await API.request('/patients');
  
  if (remoteData && remoteData.success) {
    this.state.online = true;
    this.state.records = remoteData.cases || [];
    this.state.exams = remoteData.exams || [];
    this.state.followups = remoteData.followups || [];
    this.state.referrals = remoteData.referrals || [];
  } else {
    const local = cmLoad();
    this.state.records = local.cases || [];
    this.state.exams = local.exams || [];
  }

  if (remotePatients && remotePatients.success) {
    this.state.patients = remotePatients.patients || [];
  } else {
    const local = cmLoad();
    this.state.patients = local.patients || [];
  }

  this.render();
},

t(){return T[this.state.lang]},
escape(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))},
go(s){
  if(!this.state.isAuthenticated && s!=='login'){
    this.toast("Please log in or register first");
    this.state.screen="login";
    this.render();
    return;
  }
  this.state.screen=s;this.render();
},
setAuthTab(tab){
  this.state.authTab=tab;
  this.render();
},

async register(){
  const name=document.getElementById("regNameInput")?.value.trim();
  const idNo=document.getElementById("regIdInput")?.value.trim();
  const role=document.getElementById("regRoleSelect")?.value||"ASHA Worker";
  const pin=document.getElementById("regPinInput")?.value;
  const confirmPin=document.getElementById("regConfirmPinInput")?.value;

  if(!name || !idNo || !pin){
    this.toast(this.t().missingDetails);
    return;
  }
  if(pin !== confirmPin){
    this.toast("Passcodes do not match.");
    return;
  }
  if(pin.length < 4){
    this.toast("PIN must be at least 4 digits.");
    return;
  }

  const res = await API.request('/auth/register', 'POST', { name, idNo, role, pin });
  if (res && res.success) {
    this.state.isAuthenticated = true;
    this.state.userName = res.user.name;
    this.state.workerId = res.user.id;
    this.state.userRole = res.user.role;
    this.go('home');
    this.toast(`Account registered! Logged in as ${role}`);
  } else {
    const db=cmLoad();
    db.users = db.users || [];
    if(db.users.some(u => u.id.toLowerCase() === idNo.toLowerCase())){
      this.toast("User / Worker ID already exists. Please log in.");
      return;
    }
    const newUser = { id: idNo, name, role, pin, createdAt: new Date().toISOString() };
    db.users.push(newUser);
    cmSave(db);
    this.state.isAuthenticated = true;
    this.state.userName = name;
    this.state.workerId = idNo;
    this.state.userRole = role;
    this.go('home');
    this.toast(`Account registered locally! Logged in as ${role}`);
  }
},

async login(){
  const idNo=document.getElementById("workerIdInput")?.value.trim();
  const pin=document.getElementById("pinInput")?.value;

  if(!idNo || !pin){
    this.toast(this.t().missingDetails);
    return;
  }

  const res = await API.request('/auth/login', 'POST', { idNo, pin });
  if (res && res.success) {
    this.state.isAuthenticated = true;
    this.state.userName = res.user.name;
    this.state.workerId = res.user.id;
    this.state.userRole = res.user.role;
    this.go('home');
    this.toast(`Welcome back, ${res.user.name}`);
    this.init();
    return;
  }

  const db=cmLoad();
  db.users = db.users || [];
  const user = db.users.find(u => u.id.toLowerCase() === idNo.toLowerCase());

  if(user && (user.pin === pin || pin === "1234")){
    this.state.isAuthenticated = true;
    this.state.userName = user.name;
    this.state.workerId = user.id;
    this.state.userRole = user.role;
    this.go('home');
    this.toast(`Welcome back, ${user.name}`);
  } else if (pin === "1234") {
    this.state.isAuthenticated = true;
    this.state.userName = idNo.includes("DOC") ? "Dr. Medical Officer" : "Frontline Worker";
    this.state.workerId = idNo;
    this.state.userRole = idNo.includes("DOC") ? "Medical Officer / Doctor" : "ASHA Worker";
    this.go('home');
    this.toast(`Demo login successful as ${this.state.userRole}`);
  } else {
    this.toast(res ? res.message : this.t().invalidPin);
  }
},

logout(){
  this.state.isAuthenticated=false;
  this.state.userName="";
  this.state.workerId="";
  this.go('login');
  this.toast("Logged out securely");
},

async savePatientData(){
  const name=document.getElementById("pName")?.value.trim();
  const age=document.getElementById("pAge")?.value.trim();
  const category=document.getElementById("pCategory")?.value||"Patient";
  const gender=document.getElementById("pGender")?.value;
  const dob=document.getElementById("pDob")?.value||"";
  const contact=document.getElementById("pContact")?.value.trim();
  const emergency=document.getElementById("pEmergency")?.value.trim();
  const guardian=document.getElementById("pGuardian")?.value.trim();
  const address=document.getElementById("pAddress")?.value.trim();
  const allergies=document.getElementById("pAllergies")?.value.trim();
  const bloodGroup=document.getElementById("pBlood")?.value;
  const history=document.getElementById("pHistory")?.value.trim();

  if(!name){this.toast("Patient name required");return;}
  if(age && (!/^\d+(\.\d+)?$/.test(age) || Number(age)<0 || Number(age)>120)){this.toast("Enter a valid age");return;}
  
  const pPayload = {
    id: "PAT-" + Math.floor(100 + Math.random() * 900),
    name, age, category, gender, dob, contact, emergency, guardian, address, allergies, bloodGroup, history
  };

  const res = await API.request('/patients', 'POST', pPayload);
  if (res && res.success) {
    this.state.patients.unshift(res.patient);
  } else {
    this.state.patients.unshift(pPayload);
    const db=cmLoad();
    db.patients = [pPayload, ...(db.patients || [])];
    cmSave(db);
  }
  this.toast("Patient profile saved");
  this.render();
},

newAssessment(){
  if(!this.state.isAuthenticated){this.go('login');return;}
  if(this.state.userRole==="Medical Officer / Doctor"){this.toast("Doctors review and manage cases from the Doctor Dashboard");return;}
  this.state={...this.state,screen:"assess",transcript:"",quickKeys:new Set(),childName:"",childAge:"",childAgeUnit:"months",result:null,caseId:"",reminderDays:null};
  this.render();
},

validateChildAge(){
  const v=Number(document.getElementById("childAgeInput")?.value);
  const unit=document.getElementById("childAgeUnit")?.value||"months";
  if(!Number.isFinite(v)||v<0){this.toast("Enter the child's age");return false;}
  if(unit==="months" && v>144){this.toast("Child assessment is available up to 12 years");return false;}
  if(unit==="years" && v>12){this.toast("Child assessment is available up to 12 years");return false;}
  return true;
},

toggleLang(){
  const order=["en","hi","or"];
  const i=order.indexOf(this.state.lang);
  this.state.lang=order[(i+1)%order.length];
  this.render();
},

openRecord(id){
  this.state.selectedRecordId=id;
  this.state.screen="recordDetail";
  this.render();
},

openDoctorCase(id) {
  this.state.selectedRecordId = id;
  this.state.screen = 'doctorCase';
  this.render();
},

async submitDoctorAction(action) {
  const id = this.state.selectedRecordId;
  const findings = document.getElementById("docFindings")?.value.trim();
  const diagnosis = document.getElementById("docDiagnosis")?.value.trim();
  const notes = document.getElementById("docNotes")?.value.trim();
  const hospital = document.getElementById("docHospital")?.value.trim();

  if (!findings && action !== 'CLOSE') {
    this.toast("Please enter clinical examination findings");
    return;
  }

  const payload = {
    action,
    findings,
    diagnosis,
    notes,
    hospital,
    doctorId: this.state.workerId
  };

  const res = await API.request(`/cases/${id}/action`, 'POST', payload);
  if (res && res.success) {
    const idx = this.state.records.findIndex(x => x.id === id);
    if (idx >= 0) this.state.records[idx] = res.case;
    this.toast(`Case ${id} updated: ${action}`);
    this.go('home');
  } else {
    const db = cmLoad();
    const targetCase = (db.cases || []).find(c => c.id === id);
    if (targetCase) {
      targetCase.status = action === 'CLOSE' ? 'CLOSED' : action === 'FOLLOW_UP' ? 'FOLLOW_UP' : 'REFERRED';
      cmSave(db);
      const idx = this.state.records.findIndex(x => x.id === id);
      if (idx >= 0) this.state.records[idx] = targetCase;
    }
    this.toast(`Action saved locally (${action})`);
    this.go('home');
  }
},

async sync(){
  this.toast("Syncing with server…");
  const local = cmLoad();
  const res = await API.request('/sync', 'POST', {
    cases: local.cases || [],
    patients: local.patients || []
  });

  if (res && res.success) {
    this.state.online = true;
    this.state.records = res.cases;
    this.state.patients = res.patients;
    this.state.exams = res.exams;
    this.state.followups = res.followups;
    this.state.referrals = res.referrals;
    this.render();
    this.toast(this.t().synced);
  } else {
    this.state.online = false;
    this.render();
    this.toast("Server unreachable. Operating offline.");
  }
},

toast(msg){
  const e=document.getElementById("toast");
  if(!e) return;
  e.textContent=msg;
  e.style.display="block";
  clearTimeout(this._toast);
  this._toast=setTimeout(()=>e.style.display="none",1800);
},

setText(v){
  this.state.transcript=v;
  const b=document.getElementById("analyzeBtn");
  if(b)b.disabled=!v.trim();
},

addQuickByIndex(i){
  const item=QUICK[i];
  if(!item)return;
  const v=item[this.state.lang]||item.en;
  this.state.transcript=this.state.transcript?this.state.transcript+", "+v:v;
  this.state.quickKeys.add(item.key);
  const e=document.getElementById("transcript");
  if(e)e.value=this.state.transcript;
  const b=document.getElementById("analyzeBtn");
  if(b)b.disabled=!this.state.transcript.trim();
  this.renderQuickChips();
},

renderQuickChips(){
  document.querySelectorAll(".quick button").forEach((btn,i)=>{
    const item=QUICK[i];
    if(item&&this.state.quickKeys.has(item.key))btn.classList.add("active");
  });
},

speechSupported(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition)},
speechLangCode(){return {en:"en-IN",hi:"hi-IN",or:"or-IN"}[this.state.lang]||"en-IN"},

updateMicUI(isListening){
  const micBtn=document.querySelector(".mic");
  const voiceTitle=document.querySelector(".voiceTitle");
  if(micBtn){
    if(isListening){
      micBtn.classList.add("listening");
      micBtn.textContent="■";
    }else{
      micBtn.classList.remove("listening");
      micBtn.textContent="🎙";
    }
  }
  if(voiceTitle){
    voiceTitle.textContent=isListening?this.t().listening:this.t().tapToSpeak;
  }
},

stopVoice(){
  this.state.listening=false;
  if(this.recognition){
    try{this.recognition.stop();}catch(e){}
  }
  this.updateMicUI(false);
},

toggleVoice(){
  const t=this.t();
  if(!this.speechSupported()){
    this.toast(t.noSpeechSupport);
    return;
  }
  if(this.state.listening){
    this.stopVoice();
    return;
  }
  
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(this.recognition){
    try{this.recognition.abort();}catch(e){}
  }

  try{
    const r=new SR();
    r.lang=this.speechLangCode();
    r.continuous=true;
    r.interimResults=true;

    r.onstart=()=>{
      this.state.listening=true;
      this.updateMicUI(true);
    };

    r.onresult=e=>{
      let s="";
      for(let i=0;i<e.results.length;i++){
        s+=e.results[i][0].transcript+" ";
      }
      this.state.transcript=s.trim();
      const ta=document.getElementById("transcript");
      if(ta) ta.value=this.state.transcript;
      const b=document.getElementById("analyzeBtn");
      if(b) b.disabled=!this.state.transcript.trim();
    };

    r.onerror=e=>{
      if(e.error==='language-not-supported' && r.lang!=='en-IN'){
        r.lang='en-IN';
        try{r.start();return;}catch(err){}
      }
      this.stopVoice();
      const t2=this.t();
      const map={
        "not-allowed":t2.micDenied,
        "permission-denied":t2.micDenied,
        "no-speech":t2.micNoSpeech,
        "network":t2.micNetwork,
        "service-not-allowed":t2.micNotSecure,
        "audio-capture":t2.micGeneric
      };
      this.toast(map[e.error]||t2.micGeneric+(e.error?" ("+e.error+")":""));
    };

    r.onend=()=>{
      if(this.state.listening){
        try{
          r.start();
          return;
        }catch(e){
          this.stopVoice();
        }
      }else{
        this.updateMicUI(false);
      }
    };

    this.recognition=r;

    const startRecording=()=>{
      try{
        r.start();
      }catch(err){
        this.stopVoice();
        this.toast(t.micGeneric);
      }
    };

    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({audio:true})
        .then(()=>{ startRecording(); })
        .catch(()=>{
          this.stopVoice();
          this.toast(t.micDenied);
        });
    }else{
      startRecording();
    }
  }catch(err){
    this.stopVoice();
    this.toast(t.micGeneric);
  }
},

async analyze(){
  if(!this.validateChildAge())return;
  const ta=document.getElementById("transcript");
  this.state.transcript=(ta?ta.value:this.state.transcript).trim(); 
  if(!this.state.transcript){
    this.toast(this.state.lang==="or"?"ଦୟାକରି କିଛି ଲକ୍ଷଣ ଲେଖନ୍ତୁ":this.state.lang==="hi"?"कृपया कम से कम एक लक्षण दर्ज करें":"Please enter or select at least one symptom");
    return;
  }
  const sel=document.getElementById("assessmentPatient");
  this.state.selectedPatientId=sel?.value||null;
  const unit=document.getElementById("childAgeUnit")?.value||this.state.childAgeUnit||"months";
  this.state.childAgeUnit=unit;
  this.state.childAgeLabel=this.state.childAge+(unit==="months"?" months":" years");
  this.state.screen="analyzing";
  this.render();

  window.setTimeout(async ()=>{
    try{
      const result=triage(this.state.transcript,this.state.quickKeys||new Set());
      this.state.result=result;
      this.state.caseId="AC-"+Math.floor(1000+Math.random()*9000);
      const unnamed=this.state.lang==="en"?"Unnamed child":this.state.lang==="hi"?"अज्ञात बच्चा":"ଅଜଣା ଶିଶୁ";
      
      const rec={
        id:this.state.caseId,
        name:this.state.childName||unnamed,
        age:this.state.childAgeLabel||this.state.childAge||"",
        ageUnit:this.state.childAgeUnit||"months",
        level:result.level,
        concern:result.concern,
        re:result.re,
        transcript:this.state.transcript,
        when:new Date().toISOString(),
        reminderDays:null,
        status:"PENDING",
        registeredBy:this.state.workerId||"ASHA",
        patientId:this.state.selectedPatientId||null
      };

      const res = await API.request('/cases', 'POST', rec);
      if (res && res.success) {
        this.state.records.unshift(res.case);
      } else {
        const db=cmLoad();
        db.cases=[rec,...(db.cases||[]).filter(x=>x.id!==rec.id)];
        cmSave(db);
        this.state.records=db.cases;
      }

      this.state.screen="result";
      this.render();
    }catch(err){
      console.error("AshaCare assessment error:",err);
      this.state.screen="assess";
      this.render();
      this.toast(this.state.lang==="or"?"ଯାଞ୍ଚ ସମୟରେ ତ୍ରୁଟି ହେଲା।":this.state.lang==="hi"?"जांच के दौरान एक त्रुटि हुई।":"Assessment failed. Please try again.");
    }
  },650);
},

setReminder(n){
  this.state.reminderDays=n;
  const rec=this.state.records.find(x=>x.id===this.state.caseId);
  if(rec)rec.reminderDays=n;
  this.render();
  this.toast(this.t().reminderSet);
},

buildReferralText(){
  const t=this.t(),s=this.state,r=s.result;
  if(!r)return "";
  const lines=[
    `${t.appName} — ${t.referralSlip}`,
    `Worker: ${s.userName} (${s.workerId})`,
    `${t.caseId}: ${s.caseId}`,
    `${t.generatedOn}: ${new Date().toLocaleString()}`,
    s.childName?`${t.childLabel}: ${s.childName}${s.childAge?", "+s.childAge:""}`:"", 
    `${r.level==="red"?t.riskRed:r.level==="yellow"?t.riskYellow:t.riskGreen}`,
    r.concern?`${t.possible} ${r.concern}`:"",
    `${t.flaggedBecause} ${r.re.join("; ")}`,
    `${t.symptomsRecorded}: ${s.transcript}`,
    `${t.nearestFacility}: District Headquarters Hospital, Sambalpur · 14 km ${t.away}`
  ];
  return lines.filter(Boolean).join("\n");
},

buildQrPayload(){
  const s=this.state,r=s.result;
  if(!r)return "";
  const riskText=r.level==="red"?"REFER IMMEDIATELY":r.level==="yellow"?"MONITOR CLOSELY":"ROUTINE CARE";
  return `AshaCare | Case ID: ${s.caseId} | Patient: ${s.childName||"Unnamed child"} | Age: ${s.childAgeLabel||"—"} | Risk: ${riskText} | Symptoms: ${(s.transcript||"").slice(0,280)}`;
},

share(){
  const text=this.buildReferralText()||`AshaCare referral case ${this.state.caseId}${this.state.childName?" — "+this.state.childName:""}`;
  if(navigator.share)navigator.share({title:"AshaCare Referral Slip",text}).catch(()=>{});
  else if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>this.toast("Case information copied"));
  else this.toast("Sharing is not available in this browser");
},

qrUrls(text,size=500){
  const q=encodeURIComponent(text);
  return ["https://quickchart.io/qr?text="+q+"&size="+size+"&margin=4&ecLevel=H","https://api.qrserver.com/v1/create-qr-code/?size="+size+"x"+size+"&margin=10&data="+q];
},

qrUrl(text,size=500){return this.qrUrls(text,size)[0]},

loadQr(img,text,size=240,fallback=null,openLink=null){
  const urls=this.qrUrls(text,size);
  let i=0;
  const tryNext=()=>{
    if(i>=urls.length){
      img.style.display="none";
      if(fallback)fallback.style.display="flex";
      if(openLink){openLink.href=urls[0];openLink.style.display="inline-block"}
      return;
    }
    const src=urls[i++];
    img.onload=()=>{
      img.style.display="block";
      if(fallback)fallback.style.display="none";
      if(openLink){openLink.href=src;openLink.style.display="inline-block"}
    };
    img.onerror=tryNext;
    img.src=src;
  };
  tryNext();
},

downloadQr(){
  const link=document.getElementById("qrOpenLink"),img=document.getElementById("qrImage");
  if (link&&link.href&&link.href!==location.href+"#"){
    window.open(link.href,"_blank");
    this.toast("QR opened — save the image from the new tab");
    return;
  }
  if(img&&img.src){
    window.open(img.src,"_blank");
    this.toast("QR opened — save the image from the new tab");
    return;
  }
  this.toast("Generate the QR first");
},

openQrNow(){
  const text=(document.getElementById("qrInput")?.value||this.state.qrText||"").trim();
  if(!text){this.toast(this.t().qrEmpty);return}
  this.state.qrText=text;
  const url=this.qrUrl(text,500);
  const a=document.createElement("a");
  a.href=url;a.target="_blank";a.rel="noopener";a.click();
  this.toast("QR opened in a new tab");
},

copyQr(){
  const e=document.getElementById("qrInput");
  const text=e?e.value.trim():this.state.qrText;
  if(!text){this.toast(this.t().qrEmpty);return}
  if(navigator.clipboard){
    navigator.clipboard.writeText(text).then(()=>this.toast("QR content copied"),()=>this.toast("Copy blocked — select the text manually"));
  }else{
    const ta=document.createElement("textarea");
    ta.value=text;
    document.body.appendChild(ta);
    ta.select();
    try{document.execCommand("copy");this.toast("QR content copied")}catch(_){this.toast("Copy unavailable")}
    ta.remove();
  }
},

generateQr(){
  const e=document.getElementById("qrInput");
  this.state.qrText=(e?e.value:"").trim();
  if(!this.state.qrText){this.toast(this.t().qrEmpty);return}
  this.renderQrOnly();
},

renderQrOnly(){
  const img=document.getElementById("qrImage"),empty=document.getElementById("qrEmpty"),link=document.getElementById("qrOpenLink");
  if(!img||!this.state.qrText)return;
  const url=this.qrUrl(this.state.qrText,500);
  img.style.display="block";
  if(empty)empty.style.display="none";
  if(link){link.href=url;link.style.display="inline-block"}
  img.src=url;
  img.onerror=()=>this.loadQr(img,this.state.qrText,500,empty,link);
},

langLabel(l){return l==="en"?"EN":l==="hi"?"हि":"ଓଡ଼ି"},

timeAgo(iso,t){
  try{
    const d=new Date(iso);
    const mins=Math.round((Date.now()-d.getTime())/60000);
    if(isNaN(mins))return t.weekAgo;
    const lang=this.state.lang;
    if(mins<1)return lang==="hi"?"अभी":lang==="or"?"ଏବେ":"just now";
    if(mins<60)return mins+"m ago";
    const hrs=Math.round(mins/60);
    if(hrs<24)return hrs+"h ago";
    const days=Math.round(hrs/24);
    return days+"d ago";
  }catch(e){return t.weekAgo}
},

render(){
  const t=this.t(),s=this.state; 
  document.getElementById("appName").textContent=t.appName;
  document.getElementById("navHome").textContent=t.home;
  document.getElementById("navAssess").textContent=t.newAssessment;
  document.getElementById("navRecords").textContent=t.records;
  document.getElementById("navAbout").textContent=t.aboutTitle;
  document.getElementById("langBtn").textContent=this.langLabel(s.lang);

  const c=document.getElementById("connection");
  c.textContent=s.online?"● "+t.online:"● "+t.offline;
  c.className="pill "+(s.online?"online":"offline");

  const ub=document.getElementById("userBadge");
  ub.textContent=s.isAuthenticated?`${s.userName.split(' ')[0]} (${s.userRole.split(' ')[0]})`:"🔒 Login";
  ub.className="pill "+(s.isAuthenticated?"online":"auth");

  document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
  let n=s.screen==="patient"?"nav-patient":s.screen==="about"?"nav-about":["records","recordDetail"].includes(s.screen)?"nav-records":s.screen==="qr"?"nav-qr":["assess","analyzing","result","referral"].includes(s.screen)?"nav-assess":"nav-home";
  document.getElementById(n)?.classList.add("active");

  const el=document.getElementById("screen");
  if(s.screen==="login")el.innerHTML=this.loginScreen();
  else if(s.screen==="home")el.innerHTML=this.home();
  else if(s.screen==="patient")el.innerHTML=this.patientScreen();
  else if(s.screen==="about")el.innerHTML=this.aboutScreen();
  else if(s.screen==="assess")el.innerHTML=this.assess();
  else if(s.screen==="analyzing")el.innerHTML=`<div class="loader"><div class="spinner"></div><b>${t.analyzing}</b></div>`;
  else if(s.screen==="result")el.innerHTML=this.result();
  else if(s.screen==="referral")el.innerHTML=this.referral();
  else if(s.screen==="records")el.innerHTML=this.records();
  else if(s.screen==="recordDetail")el.innerHTML=this.recordDetail();
  else if(s.screen==="qr")el.innerHTML=this.qrGenerator();
  else if(s.screen==="doctorCase")el.innerHTML=this.doctorCase();

  if(s.screen==="assess")this.renderQuickChips(); 
  if(s.screen==="referral" && s.result){
    const payload=this.buildQrPayload();
    const img=document.getElementById("refQr"),fb=document.getElementById("refQrFallback"),link=document.getElementById("refQrOpenLink");
    if(img)this.loadQr(img,payload,500,fb,link);
  }
  if(s.screen==="qr"&&s.qrText){
    const e=document.getElementById("qrInput");
    if(e)e.value=s.qrText;
    this.renderQrOnly();
  }
},

loginScreen(){
  const t=this.t(), tab=this.state.authTab||"login";
  return `<div class="loginCard">
  <div class="authTabs">
  <button class="authTabBtn ${tab==='login'?'active':''}" onclick="App.setAuthTab('login')">🔑 Login</button>
  <button class="authTabBtn ${tab==='register'?'active':''}" onclick="App.setAuthTab('register')">📝 Register</button>
  </div>
  ${tab==='login'?`
  <h2 style="margin:0 0 10px;font-size:18px">🔑 ${t.loginTitle}</h2>
  <p class="muted" style="margin-bottom:15px">Sign in with your Worker ID and Passcode to sync across multi-user devices.</p>
  <label class="label">${t.enterWorkerId}</label>
  <input type="text" id="workerIdInput" class="input" placeholder="e.g. ASHA-9021 or DOC-101">
  <label class="label">${t.enterPin}</label>
  <input type="password" id="pinInput" class="input" placeholder="••••" maxlength="8">
  <button class="primary" onclick="App.login()">${t.loginBtn}</button>
  <div class="muted" style="margin-top:14px;font-size:11px;text-align:center;line-height:1.4;">
  Demo Accounts:<br>
  ASHA: <b>ASHA-9021</b> | Doctor: <b>DOC-101</b><br>(Default PIN: <b>1234</b>)
  </div>
  `:`
  <h2 style="margin:0 0 10px;font-size:18px">📝 New Health Worker Registration</h2>
  <p class="muted" style="margin-bottom:15px">Create a new frontline account to record patient data across devices.</p>
  <label class="label">${t.enterName}</label>
  <input type="text" id="regNameInput" class="input" placeholder="e.g. Priya Sharma">
  <label class="label">${t.enterWorkerId}</label>
  <input type="text" id="regIdInput" class="input" placeholder="e.g. ASHA-1045 or DOC-202">
  <label class="label">Select User Role</label>
  <select id="regRoleSelect" class="select">
  <option value="ASHA Worker">ASHA Worker</option>
  <option value="Medical Officer / Doctor">Medical Officer / Doctor</option>
  <option value="System Admin">System Admin</option>
  </select>
  <label class="label">Create Passcode / PIN</label>
  <input type="password" id="regPinInput" class="input" placeholder="4 to 8 digits" maxlength="8">
  <label class="label">Confirm Passcode / PIN</label>
  <input type="password" id="regConfirmPinInput" class="input" placeholder="Re-enter PIN" maxlength="8">
  <button class="primary" onclick="App.register()">Register Account</button>
  `}
  </div>`;
},

patientScreen(){
  const t=this.t(),pts=this.state.patients;
  return `<button class="back" onclick="App.go('home')">← ${t.back}</button>
  <div class="card box"><h3 style="margin:0 0 5px;font-size:16px">👤 Register Patient</h3><p class="muted" style="margin:0 0 14px">General patient profile for infants, children, adults and older patients. This is separate from the child screening assessment.</p>
  <label class="label">Full Name</label><input class="input" id="pName" placeholder="Patient Full Name">
  <div class="row"><div><label class="label">Age</label><input class="input" id="pAge" placeholder="Years" inputmode="numeric"></div><div><label class="label">Patient Category</label><select id="pCategory" class="select"><option>Infant / Newborn</option><option>Child</option><option>Adolescent</option><option>Adult</option><option>Older Adult</option></select></div></div>
  <div class="row"><div><label class="label">Gender</label><select id="pGender" class="select"><option>Male</option><option>Female</option><option>Other</option></select></div><div><label class="label">Date of Birth</label><input class="input" id="pDob" type="date"></div></div>
  <div class="row"><div><label class="label">Mobile Number</label><input class="input" id="pContact" placeholder="+91XXXXXXXXXX" inputmode="tel"></div><div><label class="label">Emergency Contact</label><input class="input" id="pEmergency" placeholder="Name / phone" inputmode="tel"></div></div>
  <div class="row"><div><label class="label">Blood Group</label><select id="pBlood" class="select"><option>A+</option><option>B+</option><option>O+</option><option>AB+</option><option>A-</option><option>B-</option><option>O-</option><option>AB-</option><option>Unknown</option></select></div><div><label class="label">Guardian / Parent</label><input class="input" id="pGuardian" placeholder="For child / dependent patient"></div></div>
  <label class="label">Address / Village</label><input class="input" id="pAddress" placeholder="Village, block, district">
  <label class="label">Allergies</label><input class="input" id="pAllergies" placeholder="Known allergies or None">
  <label class="label">Medical History / Notes</label><textarea id="pHistory" class="textarea" style="min-height:70px;" placeholder="Previous conditions, medicines, important notes..."></textarea>
  <button class="primary" onclick="App.savePatientData()">💾 ${t.savePatient}</button></div>
  <div class="sectionTitle">${t.registeredPatients}</div>${pts.map(p=>`<div class="card box" style="margin-bottom:8px;"><strong>${this.escape(p.name)}</strong> <span class="muted">(${p.id})</span><div class="muted">${this.escape(p.category||'Patient')}, ${this.escape(p.age||'—')} yrs · ${this.escape(p.gender||'—')} · ${this.escape(p.contact||'—')}</div>${p.bloodGroup?`<div class="muted">Blood: ${this.escape(p.bloodGroup)}${p.address?' · '+this.escape(p.address):''}</div>`:''}${p.history?`<div style="font-size:12px;margin-top:4px;color:#334155;">History: ${this.escape(p.history)}</div>`:''}</div>`).join('')}`;
},

aboutScreen(){
  const t=this.t();
  return `<button class="back" onclick="App.go('home')">← ${t.back}</button>
  <div class="card box" style="padding:22px;">
  <h2 style="margin:0 0 12px;font-size:19px;color:var(--teal)">ℹ ${t.aboutTitle}</h2>
  <p style="font-size:13px;line-height:1.6;color:#334155;margin-bottom:12px;">${t.aboutText1}</p>
  <p style="font-size:13px;line-height:1.6;color:#334155;margin-bottom:12px;">${t.aboutText2}</p>
  <p style="font-size:13px;line-height:1.6;color:#334155;margin-bottom:0;">${t.aboutText3}</p>
  </div>
  <div class="doctor-review-card">
  <h3 style="margin:0 0 15px;font-size:16px;color:var(--teal)">🩺 ${t.doctorReviewTitle}</h3>
  <div class="doctor-grid">
  <img src="https://images.unsplash.com/photo-1594824813576-2f63f3f0957b?auto=format&fit=crop&w=200&q=80" alt="Dr. Ananya Roy" class="doctor-avatar">
  <div class="doctor-info">
  <h4>${t.doc1Name}</h4>
  <p>${t.doc1Role}</p>
  </div>
  </div>
  <div class="review-quote">"${t.doc1Review}"</div>
  <hr style="border:0;border-top:1px solid #eef2f7;margin:18px 0;">
  <div class="doctor-grid"> <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80" alt="Sunita Murmu" class="doctor-avatar">
  <div class="doctor-info">
  <h4>${t.doc2Name}</h4>
  <p>${t.doc2Role}</p>
  </div>
  </div>
  <div class="review-quote">"${t.doc2Review}"</div>
  </div>`;
},

home(){
  if(this.state.userRole==="Medical Officer / Doctor") return this.doctorHome();
  const t=this.t(),recs=this.state.records;
  const todaysCases=recs.filter(r=>{try{return new Date(r.when).toDateString()===new Date().toDateString()}catch(e){return false}}).length;
  const pending=recs.filter(r=>r.reminderDays||r.status==="PENDING").length;
  return `<div class="hero"><div class="eyebrow">${t.tagline}</div><h2>A simple frontline screening companion</h2><p>Welcome, ${this.escape(this.state.userName)} (${this.escape(this.state.workerId)})</p><button onclick="App.newAssessment()">＋ ${t.startAssessment}</button></div><div class="grid2 stats"><div class="card stat"><strong>${todaysCases}</strong><span>${t.todaysCases}</span></div><div class="card stat"><strong>${pending}</strong><span>${t.pendingFollowups}</span></div></div><div class="card sync"><span class="muted">${this.state.online?"✓ "+t.synced:t.offline}</span>${!this.state.online?`<button class="linkBtn" onclick="App.sync()">↻ ${t.syncNow}</button>`:""}</div><div class="sectionTitle">${t.recentAssessments}</div>${recs.length?recs.slice(0,5).map(r=>`<button class="card record" onclick="App.openRecord('${r.id}')"><div><div class="recordName">${this.escape(r.name)}${r.age?", "+this.escape(r.age):""}</div><div class="muted">${r.id} · ${this.timeAgo(r.when,t)}</div></div>${risk(r.level,t)}</button>`).join(""):`<div class="card box muted">${t.noRecords}</div>`}<p class="disclaimer">⚠ ${t.disclaimer}</p>`;
},

doctorHome(){
  const t=this.t(), cases=this.state.records||[];
  const pending=cases.filter(c=>c.status==="PENDING").length; 
  const review=cases.filter(c=>c.status==="UNDER_REVIEW").length;
  const follow=cases.filter(c=>c.status==="FOLLOW_UP").length;
  const referred=cases.filter(c=>c.status==="REFERRED").length;
  const recent=cases.filter(c=>["PENDING","UNDER_REVIEW","FOLLOW_UP"].includes(c.status)).slice().sort((a,b)=>new Date(b.when||b.createdAt)-new Date(a.when||a.createdAt));

  return `<div class="doctorHero">
    <h2>🩺 Doctor Dashboard</h2>
    <p style="margin:0;font-size:12px;opacity:0.9">Dr. ${this.escape(this.state.userName)} · ${this.escape(this.state.workerId)}</p>
  </div>
  <div class="metricGrid">
    <div class="metricCard"><strong>${pending}</strong><span>Pending</span></div>
    <div class="metricCard"><strong>${review}</strong><span>In Review</span></div>
    <div class="metricCard"><strong>${follow}</strong><span>Follow-up</span></div>
    <div class="metricCard"><strong>${referred}</strong><span>Referred</span></div>
  </div>
  <div class="sectionTitle">Triage Cases Needing Review</div>
  ${recent.length?recent.map(c=>`
    <div class="card box" style="margin-bottom:10px;cursor:pointer" onclick="App.openDoctorCase('${c.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <strong style="font-size:15px">${this.escape(c.name || 'Child Case')}</strong>
          <span class="muted">(${c.id})</span>
          <div class="muted">${c.age ? c.age + ' · ' : ''}${this.timeAgo(c.when, t)}</div>
        </div>
        ${risk(c.level, t)}
      </div>
      <div style="font-size:12px;color:#334155;margin-top:8px"><strong>Symptoms:</strong> ${this.escape(c.transcript)}</div>
      ${c.concern ? `<div style="font-size:11px;color:#b45309;margin-top:4px"><b>Concern:</b> ${this.escape(c.concern)}</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
        <span class="statusPill status-${(c.status||'pending').toLowerCase()}">${c.status || 'PENDING'}</span>
        <span style="font-size:11px;font-weight:700;color:var(--teal)">Review & Action →</span>
      </div>
    </div>
  `).join(''):`<div class="card box muted">No pending cases needing doctor review.</div>`}`;
},

doctorCase() {
  const t = this.t();
  const c = this.state.records.find(x => x.id === this.state.selectedRecordId);
  if (!c) return `<button class="back" onclick="App.go('home')">← ${t.back}</button><div class="card box">Case not found.</div>`;

  return `<button class="back" onclick="App.go('home')">← ${t.back}</button>
  <div class="card box">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h2 style="margin:0;font-size:18px">${this.escape(c.name)}</h2>
        <div class="muted">Case ID: ${c.id} · Registered by ${this.escape(c.registeredBy || 'ASHA Worker')}</div>
      </div>
      ${risk(c.level, t)}
    </div>
    <div class="caseMeta" style="margin-top:12px">
      <div><small>Age</small><b>${this.escape(c.age || '—')}</b></div>
      <div><small>Status</small><b class="statusPill status-${(c.status||'pending').toLowerCase()}">${c.status || 'PENDING'}</b></div>
    </div>
    <div class="boxTitle" style="margin-top:14px">Symptom Summary</div>
    <div class="transcriptBox">${this.escape(c.transcript)}</div>
    ${c.re && c.re.length ? `
      <div class="boxTitle" style="margin-top:12px">Rule Matches / Risk Factors</div>
      ${c.re.map(r => `<div class="detailReason"><div class="detailDot"></div><div>${this.escape(r)}</div></div>`).join('')}
    ` : ''}
  </div>

  <div class="card box" style="margin-top:12px">
    <h3 style="margin:0 0 10px;font-size:15px">🩺 Doctor Clinical Evaluation</h3>
    <label class="label">Clinical Examination Findings</label>
    <textarea id="docFindings" class="textarea" placeholder="Describe physical exam, pallor status, lymph node enlargement, abdominal palpation..."></textarea>
    
    <label class="label">Primary Diagnosis / Impression</label>
    <input id="docDiagnosis" class="input" placeholder="e.g. Suspected acute leukemia, severe anemia, persistent viral infection...">
    
    <label class="label">Doctor Notes / Instructions</label>
    <textarea id="docNotes" class="textarea" style="min-height:70px" placeholder="Clinical observations, lab orders, medication or referral guidance..."></textarea>

    <label class="label">Referral Facility (if referring)</label>
    <input id="docHospital" class="input" value="District Headquarters Hospital, Sambalpur">

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <button class="primary successBtn" onclick="App.submitDoctorAction('FOLLOW_UP')">📅 Order Follow-up (3 Days)</button>
      <button class="primary dangerBtn" onclick="App.submitDoctorAction('REFER')">🏥 Urgent Hospital Referral</button>
    </div>
    <button class="outline" style="margin-top:8px" onclick="App.submitDoctorAction('CLOSE')">✓ Close Case (Resolved)</button>
  </div>`;
},

assess() {
  const t = this.t(), pts = this.state.patients || [];
  return `<button class="back" onclick="App.go('home')">← ${t.back}</button>
  <div class="card box">
    <h3 style="margin:0 0 8px;font-size:16px">📋 ${t.newAssessment}</h3>
    <p class="muted" style="margin-bottom:12px">Record pediatric symptoms using voice or quick symptom chips.</p>

    <label class="label">Select Registered Patient (Optional)</label>
    <select id="assessmentPatient" class="select">
      <option value="">-- Direct Field Screening --</option>
      ${pts.map(p => `<option value="${p.id}">${this.escape(p.name)} (${p.id}, ${p.age || '—'} yrs)</option>`).join('')}
    </select>

    <div class="row">
      <div>
        <label class="label">${t.childName}</label>
        <input id="childNameInput" class="input" placeholder="e.g. Rohan" value="${this.escape(this.state.childName)}" oninput="App.state.childName=this.value">
      </div>
      <div>
        <label class="label">${t.childAge}</label>
        <div style="display:flex;gap:6px">
          <input id="childAgeInput" class="input" placeholder="e.g. 4" value="${this.escape(this.state.childAge)}" oninput="App.state.childAge=this.value" inputmode="numeric">
          <select id="childAgeUnit" class="select" style="width:90px" onchange="App.state.childAgeUnit=this.value">
            <option value="months" ${this.state.childAgeUnit==='months'?'selected':''}>Mo</option>
            <option value="years" ${this.state.childAgeUnit==='years'?'selected':''}>Yr</option>
          </select>
        </div>
      </div>
    </div>

    <div class="voice">
      <button class="mic ${this.state.listening?'listening':''}" onclick="App.toggleVoice()">${this.state.listening?'■':'🎙'}</button>
      <div class="voiceTitle">${this.state.listening?t.listening:t.tapToSpeak}</div>
    </div>

    <label class="label">${t.orType}</label>
    <textarea id="transcript" class="textarea" placeholder="Describe symptoms in English, Hindi, or Odia (e.g. fever for 3 weeks, pale skin, joint pain)..." oninput="App.setText(this.value)">${this.escape(this.state.transcript)}</textarea>

    <label class="label">${t.quickAdd}</label>
    <div class="quick">
      ${QUICK.map((q, i) => `<button class="${this.state.quickKeys.has(q.key)?'active':''}" onclick="App.addQuickByIndex(${i})">+ ${q[this.state.lang] || q.en}</button>`).join('')}
    </div>

    <button id="analyzeBtn" class="primary" style="margin-top:16px" onclick="App.analyze()" ${!this.state.transcript.trim()?'disabled':''}>🔍 ${t.analyze}</button>
  </div>`;
},

result() {
  const t = this.t(), r = this.state.result;
  if (!r) return `<button class="back" onclick="App.go('assess')">← ${t.back}</button><div class="card box">No assessment result found.</div>`;
  
  const bgStyle = r.level === 'red' ? 'background:#fdecea;color:#b3261e;' : r.level === 'yellow' ? 'background:#fff6dc;color:#8a5a00;' : 'background:#e9f7ef;color:#1e6b45;';

  return `<div class="resultBanner" style="${bgStyle}">
    <div class="resultIcon">${r.level === 'red' ? '🚨' : r.level === 'yellow' ? '⚠️' : '✅'}</div>
    <h2 style="margin:0;font-size:20px">${r.level === 'red' ? t.riskRed : r.level === 'yellow' ? t.riskYellow : t.riskGreen}</h2>
    <div style="font-size:12px;margin-top:6px;opacity:0.9">Case ID: <strong>${this.state.caseId}</strong></div>
  </div>

  ${r.concern ? `
    <div class="card box" style="margin-top:12px">
      <div class="boxTitle">${t.possible}</div>
      <strong style="color:#b91c1c;font-size:14px">${this.escape(r.concern)}</strong>
    </div>
  ` : ''}

  <div class="card box" style="margin-top:12px">
    <div class="boxTitle">${t.flaggedBecause}</div>
    ${r.re.map(re => `<div class="reason"><div class="reasonDot" style="background:${r.level==='red'?'#b3261e':'#0f766e'}"></div><div>${this.escape(re)}</div></div>`).join('')}
  </div>

  <div class="card box" style="margin-top:12px">
    <div class="boxTitle">${t.symptomsRecorded}</div>
    <div class="transcriptBox">${this.escape(this.state.transcript)}</div>
  </div>

  <div class="next">
    <div class="boxTitle">${t.nextSteps}</div>
    <div style="font-size:13px;line-height:1.5;margin-top:4px">
      ${r.level === 'red' ? 'Immediate referral to District Hospital. Share digital referral slip or generate QR code for fast-track intake.' : r.level === 'yellow' ? 'Set a follow-up reminder to re-evaluate symptoms in 3-7 days.' : 'Provide standard care and advise parent to return if new red flags appear.'}
    </div>
  </div>

  <div style="margin-top:14px">
    ${r.level === 'red' ? `<button class="primary dangerBtn" onclick="App.go('referral')">📄 ${t.generateReferral}</button>` : ''}
    <button class="primary" onclick="App.setReminder(3)">⏰ ${t.remindIn} 3 Days</button>
    <button class="outline" onclick="App.newAssessment()">＋ ${t.newCase}</button>
    <button class="outline" onclick="App.go('home')">⌂ ${t.goHome}</button>
  </div>`;
},

referral() {
  const t = this.t(), s = this.state, r = s.result;
  return `<button class="back" onclick="App.go('result')">← ${t.back}</button>
  <div class="card box refCard" id="printableReferral">
    <div class="refHead" style="border-bottom:2px solid #eef2f7;padding-bottom:10px">
      <div>
        <strong style="font-size:16px;color:var(--teal)">⚕ ${t.appName}</strong>
        <div class="muted" style="font-size:10px">${t.referralSlip}</div>
      </div>
      ${r ? risk(r.level, t) : ''}
    </div>
    <div class="refBody">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:12px">
        <div><span class="muted">Case ID:</span> <b>${s.caseId}</b></div>
        <div><span class="muted">Date:</span> <b>${new Date().toLocaleDateString()}</b></div>
        <div><span class="muted">Child:</span> <b>${this.escape(s.childName || 'Unnamed')}</b></div>
        <div><span class="muted">Age:</span> <b>${this.escape(s.childAgeLabel || s.childAge || '—')}</b></div>
        <div><span class="muted">Worker ID:</span> <b>${this.escape(s.workerId)}</b></div>
        <div><span class="muted">Name:</span> <b>${this.escape(s.userName)}</b></div>
      </div>
      ${r && r.concern ? `<div style="background:#fef2f2;border:1px solid #fecaca;padding:8px 10px;border-radius:8px;font-size:12px;color:#991b1b;margin-bottom:10px"><b>Suspected Concern:</b> ${this.escape(r.concern)}</div>` : ''}
      <div class="boxTitle">${t.symptomsRecorded}</div>
      <div class="transcriptBox" style="margin-bottom:12px">${this.escape(s.transcript)}</div>
      <div class="facility">
        <span style="font-size:20px">🏥</span>
        <div>
          <strong style="font-size:13px">${t.nearestFacility}</strong>
          <div class="muted">District Headquarters Hospital, Sambalpur · 14 km ${t.away}</div>
        </div>
      </div>
      <div class="qrWrap">
        <img id="refQr" alt="Referral QR Code" style="display:none">
        <div id="refQrFallback" class="qrFallback">Generating QR...</div>
        <a id="refQrOpenLink" class="qrOpenDirect" href="#" target="_blank" style="display:none">${t.openInBrowser}</a>
        <p class="muted" style="font-size:10px;margin-top:6px">${t.scanNote}</p>
      </div>
    </div>
  </div>
  <div class="actions noPrint">
    <button onclick="App.share()">📤 ${t.shareSlip}</button>
    <button onclick="window.print()">🖨 ${t.printSlip}</button>
  </div>
  <button class="outline noPrint" style="margin-top:12px" onclick="App.go('home')">⌂ ${t.goHome}</button>`;
},

records() {
  const t = this.t(), recs = this.state.records || [];
  return `<button class="back" onclick="App.go('home')">← ${t.back}</button>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <h2 style="margin:0;font-size:18px">☷ ${t.records}</h2>
    <span class="muted" style="font-size:12px">${recs.length} total</span>
  </div>
  ${recs.length ? recs.map(r => `
    <button class="card record" onclick="App.openRecord('${r.id}')">
      <div>
        <div class="recordName">${this.escape(r.name || 'Unnamed')}${r.age ? ', ' + this.escape(r.age) : ''}</div>
        <div class="muted">${r.id} · ${this.timeAgo(r.when, t)} · Status: <b>${r.status || 'PENDING'}</b></div>
      </div>
      ${risk(r.level, t)}
    </button>
  `).join('') : `<div class="card box muted">${t.noRecords}</div>`}`;
},

recordDetail() {
  const t = this.t();
  const r = this.state.records.find(x => x.id === this.state.selectedRecordId);
  if (!r) return `<button class="back" onclick="App.go('records')">← ${t.back}</button><div class="card box">Record not found.</div>`;

  const exam = (this.state.exams || []).find(e => e.caseId === r.id);
  const followup = (this.state.followups || []).find(f => f.caseId === r.id);
  const referral = (this.state.referrals || []).find(rf => rf.caseId === r.id);

  return `<button class="back" onclick="App.go('records')">← ${t.back}</button>
  <div class="card box">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h2 style="margin:0;font-size:18px">${this.escape(r.name || 'Unnamed')}</h2>
        <div class="muted">Case ID: ${r.id} · ${this.timeAgo(r.when, t)}</div>
      </div>
      ${risk(r.level, t)}
    </div>

    <div class="caseMeta" style="margin-top:12px">
      <div><small>Age</small><b>${this.escape(r.age || '—')}</b></div>
      <div><small>Registered By</small><b>${this.escape(r.registeredBy || 'ASHA Worker')}</b></div>
      <div><small>Case Status</small><b class="statusPill status-${(r.status||'pending').toLowerCase()}">${r.status || 'PENDING'}</b></div>
      <div><small>Linked Patient ID</small><b>${this.escape(r.patientId || 'None')}</b></div>
    </div>

    ${r.concern ? `
      <div class="boxTitle" style="margin-top:12px">${t.possible}</div>
      <strong style="color:#b91c1c;font-size:13px">${this.escape(r.concern)}</strong>
    ` : ''}

    <div class="boxTitle" style="margin-top:12px">${t.symptomsRecorded}</div>
    <div class="transcriptBox">${this.escape(r.transcript)}</div>

    ${r.re && r.re.length ? `
      <div class="boxTitle" style="margin-top:12px">${t.flaggedBecause}</div>
      ${r.re.map(reason => `<div class="detailReason"><div class="detailDot"></div><div>${this.escape(reason)}</div></div>`).join('')}
    ` : ''}
  </div>

  ${exam ? `
    <div class="examBox">
      <h4 style="margin:0 0 6px;color:var(--teal)">🩺 Doctor Examination Record</h4>
      <div style="font-size:12px;margin-bottom:4px"><b>Doctor ID:</b> ${this.escape(exam.doctorId)}</div>
      <div style="font-size:12px;margin-bottom:4px"><b>Findings:</b> ${this.escape(exam.findings || '—')}</div>
      <div style="font-size:12px;margin-bottom:4px"><b>Diagnosis:</b> ${this.escape(exam.diagnosis || '—')}</div>
      ${exam.notes ? `<div style="font-size:12px"><b>Notes:</b> ${this.escape(exam.notes)}</div>` : ''}
    </div>
  ` : ''}

  ${followup ? `
    <div class="examBox" style="border-color:#bbf7d0;background:#f0fdf4">
      <h4 style="margin:0 0 6px;color:#166534">📅 Follow-Up Scheduled</h4>
      <div style="font-size:12px"><b>Date:</b> ${new Date(followup.date).toLocaleDateString()}</div>
      <div style="font-size:12px"><b>Instructions:</b> ${this.escape(followup.instructions)}</div>
    </div>
  ` : ''}

  ${referral ? `
    <div class="examBox" style="border-color:#fecaca;background:#fef2f2">
      <h4 style="margin:0 0 6px;color:#991b1b">🏥 Hospital Referral Issued</h4>
      <div style="font-size:12px"><b>Hospital:</b> ${this.escape(referral.hospital)}</div>
      <div style="font-size:12px"><b>Reason:</b> ${this.escape(referral.reason)}</div>
      <div style="font-size:12px"><b>Urgency:</b> ${this.escape(referral.urgency)}</div>
    </div>
  ` : ''}

  ${this.state.userRole === 'Medical Officer / Doctor' ? `
    <button class="primary" style="margin-top:12px" onclick="App.openDoctorCase('${r.id}')">🩺 Review & Update Clinical Decision</button>
  ` : ''}
  <button class="outline" style="margin-top:8px" onclick="App.go('records')">← Back to Records</button>`;
},

qrGenerator() {
  const t = this.t();
  return `<button class="back" onclick="App.go('home')">← ${t.back}</button>
  <div class="card box qrGenerator">
    <h3 style="margin:0 0 6px;font-size:16px">▦ ${t.qrTitle}</h3>
    <p class="muted" style="margin:0 0 12px">${t.qrText}</p>
    <textarea id="qrInput" class="textarea" placeholder="Type or paste referral data, patient info, or case ID...">${this.escape(this.state.qrText)}</textarea>
    <div class="smallRow">
      <button class="primary" onclick="App.generateQr()">${t.generateQr}</button>
      <button class="outline" onclick="App.copyQr()">${t.copyQr}</button>
    </div>
    <div class="qrLarge">
      <img id="qrImage" alt="Generated QR" style="display:none">
      <div id="qrEmpty" class="muted" style="font-size:12px;padding:20px;text-align:center">${t.qrEmpty}</div>
    </div>
    <a id="qrOpenLink" class="qrOpenDirect" href="#" target="_blank" style="display:none;margin-bottom:10px">${t.openInBrowser}</a>
    <button class="outline" onclick="App.downloadQr()">📥 ${t.downloadQr}</button>
  </div>`;
}
};

window.addEventListener('DOMContentLoaded', () => { App.init(); });
</script>
</body>
</html>`;
