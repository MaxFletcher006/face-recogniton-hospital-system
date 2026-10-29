"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type UserInfo = { register: string; firstname: string; userID?: number };
type Hospital = { hospitalID: number; name: string };
type Doctor = { doctorID: number; firstname: string; lastname: string; field: string };
type Laboratory = { labID: number; type: string; hospitalID: number };
type LabTest = { testID: number; name: string; labID: number };
type Appointment = {
  appointmentID: number;
  appointmentDate: string;
  appointmentTime: string;
  doctorID: number;
  doctorFirstname: string;
  hospitalID: number;
  status: string;
};
type LabOrder = {
  orderID: number;
  testID: number;
  labID: number;
  labType: string;
  status: string;
};
type BookingSummary = {
  date: string;
  time: string;
  service: string;
  doctorName: string;
  doctorField: string;
  hospitalName: string;
};

type View =
  | "home"
  | "service-type"
  | "appt-hospital"
  | "appt-doctor"
  | "appt-calendar"
  | "appt-time"
  | "appt-confirm"
  | "booking-success"
  | "lab-lab"
  | "lab-test"
  | "lab-confirm"
  | "lab-success"
  | "my-appts"
  | "my-labs"
  | "change-appt";

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
];

const MONTH_MN = ["1-р","2-р","3-р","4-р","5-р","6-р","7-р","8-р","9-р","10-р","11-р","12-р"];
const DAY_MN   = ["Да","Мя","Лх","Пу","Ба","Бн","Ня"];
const DOW_MN   = ["Ням","Даваа","Мягмар","Лхагва","Пүрэв","Баасан","Бямба"];

function fmtDateFull(s: string) {
  const d = new Date(s + "T00:00:00");
  return `${s} (${DOW_MN[d.getDay()]})`;
}

function maskRegister(r: string) {
  if (r.length <= 4) return r;
  return r.slice(0, 4) + "*".repeat(r.length - 4);
}

function getStoredUser(): { id: number; firstname: string; register: string } | null {
  try {
    const raw = localStorage.getItem("kiosk_user");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const id = parseInt(String(obj.id ?? obj.userID), 10);
    if (!obj.firstname || isNaN(id)) return null;
    return { id, firstname: obj.firstname, register: obj.register ?? "" };
  } catch { return null; }
}

// ── Face-scan modal hook ───────────────────────────────────────────────────
function useFaceAuth() {
  return useCallback((): Promise<{ firstname: string; id: number } | null> => {
    return new Promise((resolve) => {
      type S = "aligning"|"scanning"|"success"|"failed"|"notfound";
      const overlay = document.createElement("div");
      overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);`;

      const modal = document.createElement("div");
      modal.style.cssText = `background:#fff;border-radius:20px;padding:28px;width:360px;text-align:center;font-family:inherit;box-shadow:0 24px 60px rgba(0,0,0,0.3);`;

      const topLabel = document.createElement("p");
      topLabel.style.cssText = `font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;margin:0 0 16px;`;
      topLabel.textContent = "Нүүр царайгаар баталгаажуулах";

      const videoWrapper = document.createElement("div");
      videoWrapper.style.cssText = `position:relative;border-radius:16px;overflow:hidden;background:#0f172a;aspect-ratio:4/3;`;

      const video = document.createElement("video");
      video.setAttribute("playsinline","true");
      video.autoplay = true;
      video.style.cssText = `width:100%;height:100%;object-fit:cover;transform:scaleX(-1);`;

      const flash = document.createElement("div");
      flash.style.cssText = `position:absolute;inset:0;background:white;opacity:0;pointer-events:none;transition:opacity 0.1s;z-index:2;`;

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS,"svg");
      svg.setAttribute("viewBox","0 0 320 240");
      svg.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;`;

      const oval = document.createElementNS(svgNS,"ellipse");
      oval.setAttribute("cx","160"); oval.setAttribute("cy","120");
      oval.setAttribute("rx","78"); oval.setAttribute("ry","102");
      oval.setAttribute("fill","none"); oval.setAttribute("stroke","rgba(37,99,235,0.7)");
      oval.setAttribute("stroke-width","2.5"); oval.setAttribute("stroke-dasharray","8 5");

      const scanLine = document.createElementNS(svgNS,"line");
      scanLine.setAttribute("x1","82"); scanLine.setAttribute("x2","238");
      scanLine.setAttribute("y1","18"); scanLine.setAttribute("y2","18");
      scanLine.setAttribute("stroke","rgba(37,99,235,0.9)"); scanLine.setAttribute("stroke-width","2");
      scanLine.style.display = "none";

      svg.append(oval, scanLine);
      videoWrapper.append(video, flash, svg);

      const hint = document.createElement("p");
      hint.style.cssText = `font-size:14px;margin:16px 0;min-height:40px;color:#475569;line-height:1.5;font-weight:500;`;

      const progWrap = document.createElement("div");
      progWrap.style.cssText = `height:4px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-bottom:20px;`;
      const progBar = document.createElement("div");
      progBar.style.cssText = `height:100%;width:0%;background:linear-gradient(90deg,#2563eb,#10b981);transition:width 0.4s ease;`;
      progWrap.appendChild(progBar);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:10px;";
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Болих";
      cancelBtn.style.cssText = `flex:1;padding:12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;color:#475569;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;`;
      const captureBtn = document.createElement("button");
      captureBtn.textContent = "Зураг авах";
      captureBtn.style.cssText = `flex:2;padding:12px;background:#2563eb;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;`;

      modal.append(topLabel, videoWrapper, hint, progWrap, btnRow);
      btnRow.append(cancelBtn, captureBtn);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      let scanY = 18, scanDir = 1, scanId: number;
      let stream: MediaStream | null = null;
      let countdown: ReturnType<typeof setInterval> | null = null;

      const stopScan = () => { cancelAnimationFrame(scanId); scanLine.style.display = "none"; };
      const startScan = () => {
        scanLine.style.display = "block";
        const anim = () => {
          scanY += scanDir * 2.5;
          if (scanY >= 222 || scanY <= 18) scanDir *= -1;
          scanLine.setAttribute("y1", String(scanY));
          scanLine.setAttribute("y2", String(scanY));
          scanId = requestAnimationFrame(anim);
        };
        scanId = requestAnimationFrame(anim);
      };

      const setState = (s: S) => {
        stopScan();
        switch(s) {
          case "aligning":
            oval.setAttribute("stroke","rgba(37,99,235,0.7)");
            hint.style.color = "#475569"; hint.textContent = "Нүүрээ хүрээний дотор байрлуулна уу";
            progBar.style.width = "0%"; captureBtn.style.display = ""; captureBtn.textContent = "Зураг авах";
            break;
          case "scanning":
            oval.setAttribute("stroke","rgba(37,99,235,1)");
            hint.style.color = "#2563eb"; progBar.style.width = "40%";
            captureBtn.style.display = "none"; startScan();
            break;
          case "success":
            oval.setAttribute("stroke","rgba(16,185,129,1)");
            hint.style.color = "#10b981"; hint.textContent = "Амжилттай баталгаажлаа!";
            progBar.style.width = "100%"; cancelBtn.textContent = "Хаах";
            break;
          case "failed":
          case "notfound":
            oval.setAttribute("stroke","rgba(239,68,68,0.8)");
            hint.style.color = "#ef4444";
            hint.textContent = s === "notfound" ? "Нүүр илрүүлсэнгүй. Дахин оролдоно уу." : "Таньсангүй. Дахин оролдоно уу.";
            progBar.style.width = "0%"; captureBtn.style.display = ""; captureBtn.textContent = "Дахин оролдох";
            break;
        }
      };

      const cleanup = (result: { firstname: string; id: number } | null) => {
        stopScan();
        if (countdown) clearInterval(countdown);
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        resolve(result);
      };

      const doCapture = async () => {
        flash.style.opacity = "0.8"; setTimeout(() => (flash.style.opacity = "0"), 150);
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0);
        try {
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.92));
          if (!blob) throw new Error("empty");
          hint.textContent = "Серверт шалгаж байна...";
          const fd = new FormData();
          fd.append("photo", blob, "face.jpg");
          const resp = await fetch(`${API}/face-auth`, { method: "POST", body: fd });
          const data = await resp.json();
          if (data.success) {
            setState("success");
            setTimeout(() => cleanup({ firstname: data.firstname, id: data.id }), 1400);
          } else {
            setState(data.detail?.includes("илрэсэнгүй") || data.detail?.includes("илрүүлсэнгүй") ? "notfound" : "failed");
          }
        } catch { setState("failed"); }
      };

      cancelBtn.onclick = () => cleanup(null);
      captureBtn.onclick = () => {
        if (captureBtn.textContent === "Дахин оролдох") {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }).then(s => {
            stream = s; video.srcObject = s; setState("aligning");
          });
          return;
        }
        let cnt = 3; setState("scanning");
        hint.textContent = `Хөдөлгөөнгүй зогсоно уу... ${cnt}`;
        countdown = setInterval(() => {
          cnt--;
          if (cnt > 0) {
            hint.textContent = `Хөдөлгөөнгүй зогсоно уу... ${cnt}`;
            progBar.style.width = `${40 + (3 - cnt) * 15}%`;
          } else {
            clearInterval(countdown!); countdown = null; doCapture();
          }
        }, 1000);
      };

      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
        .then(s => { stream = s; video.srcObject = s; setState("aligning"); })
        .catch(() => cleanup(null));
    });
  }, []);
}

// ── Calendar Component ─────────────────────────────────────────────────────
function CalendarPicker({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const today = new Date();
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());

  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7; // 0=Mon

  const pad = (n: number) => String(n).padStart(2, "0");
  const toStr = (day: number) => `${yr}-${pad(mo + 1)}-${pad(day)}`;

  const isPast = (day: number) => {
    const d = new Date(yr, mo, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d < t;
  };
  const isToday = (day: number) => day === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();

  const prevMo = () => { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); };
  const nextMo = () => { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); };

  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  return (
    <div className="cal-wrap">
      <div className="cal-nav-row">
        <button className="cal-nav-btn" onClick={prevMo}>‹</button>
        <span className="cal-title">{yr} оны {MONTH_MN[mo]} сар</span>
        <button className="cal-nav-btn" onClick={nextMo}>›</button>
      </div>
      <div className="cal-grid">
        {DAY_MN.map(d => <div key={d} className="cal-head">{d}</div>)}
        {cells.map((day, i) =>
          day === null
            ? <div key={`e${i}`} />
            : <button
                key={day}
                className={`cal-day${isToday(day) ? " today" : ""}${toStr(day) === selected ? " sel" : ""}${isPast(day) ? " past" : ""}`}
                onClick={() => !isPast(day) && onSelect(toStr(day))}
                disabled={isPast(day)}
              >{day}</button>
        )}
      </div>
      <style jsx>{`
        .cal-wrap { border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #fff; }
        .cal-nav-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .cal-title { font-size:15px; font-weight:700; color:#1e293b; }
        .cal-nav-btn { background:none; border:1px solid #e2e8f0; border-radius:8px; width:32px; height:32px; cursor:pointer; font-size:18px; color:#475569; display:flex; align-items:center; justify-content:center; }
        .cal-nav-btn:hover { background:#f1f5f9; }
        .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
        .cal-head { text-align:center; font-size:11px; font-weight:700; color:#94a3b8; padding:4px 0; }
        .cal-day {
          aspect-ratio:1; border-radius:50%; border:none; background:none;
          font-size:13px; font-weight:500; color:#1e293b; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:background 0.15s;
        }
        .cal-day:hover:not(:disabled) { background:#eff6ff; color:#2563eb; }
        .cal-day.today { font-weight:800; border:2px solid #2563eb; color:#2563eb; }
        .cal-day.sel { background:#2563eb; color:#fff; font-weight:700; }
        .cal-day.sel.today { border-color:#1d4ed8; }
        .cal-day.past { color:#cbd5e1; cursor:default; }
      `}</style>
    </div>
  );
}

// ── Time slot grid ─────────────────────────────────────────────────────────
function TimeSlotGrid({
  slots, takenSlots, selected, onSelect,
}: { slots: string[]; takenSlots: string[]; selected: string; onSelect: (t: string) => void }) {
  return (
    <>
      <div className="slot-legend">
        <span><span className="dot free" /> Сул цаг</span>
        <span><span className="dot taken" /> Захиалсан</span>
        <span><span className="dot sel" /> Хадгалсан</span>
      </div>
      <div className="slot-grid">
        {slots.map(t => {
          const isTaken = takenSlots.includes(t);
          const isSel = t === selected;
          return (
            <button
              key={t}
              className={`slot-btn${isTaken ? " taken" : ""}${isSel ? " sel" : ""}`}
              onClick={() => !isTaken && onSelect(t)}
              disabled={isTaken}
            >
              <span className="slot-t">{t}</span>
              {isTaken && <span className="slot-lbl">Захиалсан</span>}
              {isSel && <span className="slot-lbl">Хадгалсан</span>}
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .slot-legend { display:flex; gap:16px; margin-bottom:14px; flex-wrap:wrap; }
        .slot-legend span { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; font-weight:500; }
        .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
        .dot.free   { background:#fff; border:2px solid #2563eb; }
        .dot.taken  { background:#94a3b8; }
        .dot.sel    { background:#2563eb; }
        .slot-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .slot-btn {
          border:1.5px solid #e2e8f0; border-radius:12px; padding:12px 8px;
          background:#fff; cursor:pointer; text-align:center;
          display:flex; flex-direction:column; align-items:center; gap:3px;
          transition:all 0.15s; font-family:inherit;
        }
        .slot-btn:hover:not(:disabled) { border-color:#2563eb; background:#eff6ff; }
        .slot-btn.taken { background:#f8fafc; border-color:#e2e8f0; cursor:default; }
        .slot-btn.sel { background:#2563eb; border-color:#1d4ed8; }
        .slot-t { font-size:15px; font-weight:700; color:#1e293b; }
        .slot-btn.taken .slot-t { color:#94a3b8; }
        .slot-btn.sel .slot-t { color:#fff; }
        .slot-lbl { font-size:9px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; }
        .slot-btn.sel .slot-lbl { color:rgba(255,255,255,0.75); }
      `}</style>
    </>
  );
}

// ── Step header ─────────────────────────────────────────────────────────────
function StepHeader({ title, onBack, step, total }: { title: string; onBack: () => void; step?: number; total?: number }) {
  return (
    <div className="step-hdr">
      <button className="back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M15 18l-6-6 6-6"/></svg>
        <span>Буцах</span>
      </button>
      <h2 className="step-title">{title}</h2>
      {step && total && step > 0 && <span className="step-ind">{step}/{total}</span>}
      <style jsx>{`
        .step-hdr { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
        .back-btn {
          display:flex; align-items:center; gap:4px;
          border:1px solid #e2e8f0; border-radius:10px; background:#fff;
          padding:7px 12px; cursor:pointer; font-size:13px; font-weight:600; color:#475569;
          flex-shrink:0; font-family:inherit; transition:border-color 0.15s;
        }
        .back-btn:hover { border-color:#2563eb; color:#2563eb; }
        .step-title { font-size:18px; font-weight:700; color:#1e293b; margin:0; flex:1; }
        .step-ind { font-size:12px; color:#94a3b8; flex-shrink:0; }
      `}</style>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const doFaceScan = useFaceAuth();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<View>("home");

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [myAppts, setMyAppts] = useState<Appointment[]>([]);
  const [myOrders, setMyOrders] = useState<LabOrder[]>([]);

  const [selHospital, setSelHospital] = useState<Hospital | null>(null);
  const [selDoctor, setSelDoctor] = useState<Doctor | null>(null);
  const [selDate, setSelDate] = useState("");
  const [selTime, setSelTime] = useState("");
  const [selLab, setSelLab] = useState<Laboratory | null>(null);
  const [selTest, setSelTest] = useState<LabTest | null>(null);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);

  const [changeAppt, setChangeAppt] = useState<Appointment | null>(null);
  const [changeDate, setChangeDate] = useState("");
  const [changeTime, setChangeTime] = useState("");
  const [changeTakenSlots, setChangeTakenSlots] = useState<string[]>([]);

  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmError, setConfirmError] = useState("");

  const [hospitalMap, setHospitalMap] = useState<Record<number, string>>({});
  const [doctorMap, setDoctorMap] = useState<Record<number, string>>({});
  const [labMap, setLabMap] = useState<Record<number, string>>({});
  const [testMap, setTestMap] = useState<Record<number, string>>({});

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), ok ? 3000 : 6000);
  };

  useEffect(() => {
    document.title = "Кiosк | Эрүүл мэндийн төв эмнэлэг";
    const u = getStoredUser();
    if (!u) { router.push("/login"); return; }
    const norm = { ...u, id: u.id, userID: u.id };
    localStorage.setItem("kiosk_user", JSON.stringify(norm));
    setUser({ firstname: u.firstname, register: u.register, userID: u.id });
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    fetch(`${API}/hospitals`).then(r => r.json()).then((data: Hospital[]) => {
      setHospitals(data);
      const m: Record<number, string> = {};
      data.forEach(h => (m[h.hospitalID] = h.name));
      setHospitalMap(m);
    }).catch(() => {});
    fetch(`${API}/laboratories`).then(r => r.json()).then((data: Laboratory[]) => {
      setLabs(data);
      const m: Record<number, string> = {};
      data.forEach(l => (m[l.labID] = l.type));
      setLabMap(m);
    }).catch(() => {});
  }, []);

  const loadDoctors = (hospitalID: number) => {
    setLoading(true);
    fetch(`${API}/doctors?hospitalID=${hospitalID}`).then(r => r.json()).then((data: Doctor[]) => {
      setDoctors(data);
      const m: Record<number, string> = {};
      data.forEach(d => (m[d.doctorID] = `${d.firstname} ${d.lastname}`));
      setDoctorMap(prev => ({ ...prev, ...m }));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const loadLabTests = (labID: number) => {
    setLoading(true);
    fetch(`${API}/lab-tests?labID=${labID}`).then(r => r.json()).then((data: LabTest[]) => {
      setLabTests(data);
      const m: Record<number, string> = {};
      data.forEach(t => (m[t.testID] = t.name));
      setTestMap(prev => ({ ...prev, ...m }));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const loadTakenSlots = async (doctorID: number, date: string) => {
    try {
      const r = await fetch(`${API}/appointments/slots?doctorID=${doctorID}&date=${date}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  };

  const loadMyAppts = () => {
    const u = getStoredUser();
    if (!u) return;
    setPageLoading(true);
    fetch(`${API}/appointments?userID=${u.id}`)
      .then(r => r.json()).then((data: Appointment[]) => setMyAppts(Array.isArray(data) ? data : []))
      .catch(() => { showToast("Цаг ачаалахад алдаа гарлаа.", false); setMyAppts([]); })
      .finally(() => setPageLoading(false));
  };

  const loadMyOrders = () => {
    const u = getStoredUser();
    if (!u) return;
    setPageLoading(true);
    fetch(`${API}/lab-orders?userID=${u.id}`)
      .then(r => r.json()).then((data: LabOrder[]) => setMyOrders(Array.isArray(data) ? data : []))
      .catch(() => { showToast("Шинжилгээ ачаалахад алдаа гарлаа.", false); setMyOrders([]); })
      .finally(() => setPageLoading(false));
  };

  const handleLogout = () => { localStorage.removeItem("kiosk_user"); router.push("/login"); };

  // ── Appointment flow ───────────────────────────────────────────────────
  const onSelectHospital = (h: Hospital) => {
    setSelHospital(h); loadDoctors(h.hospitalID); setView("appt-doctor");
  };
  const onSelectDoctor = (d: Doctor) => {
    setSelDoctor(d); setSelDate(""); setSelTime(""); setView("appt-calendar");
  };
  const onSelectDate = async (date: string) => {
    setSelDate(date); setSelTime("");
    const taken = await loadTakenSlots(selDoctor!.doctorID, date);
    setTakenSlots(taken);
    setView("appt-time");
  };
  const onSelectTime = (t: string) => setSelTime(t);

  const onConfirmAppt = async () => {
    setConfirmError("");
    const result = await doFaceScan();
    if (!result) return;
    const u = getStoredUser();
    if (!u) { setConfirmError("Хэрэглэгчийн мэдээлэл олдсонгүй. Дахин нэвтэрнэ үү."); return; }
    if (!selDoctor || !selHospital || !selDate || !selTime) {
      setConfirmError("Захиалгын мэдээлэл дутуу байна. Буцаж дахин сонгоно уу."); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/appointments/make`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentDate: selDate,
          appointmentTime: selTime,
          doctorID: selDoctor.doctorID,
          doctorFirstname: selDoctor.firstname,
          userID: u.id,
          hospitalID: selHospital.hospitalID,
          status: "Pending",
        }),
      });
      if (res.ok) {
        setConfirmError("");
        setBookingSummary({
          date: selDate,
          time: selTime,
          service: "Эмчийн үзлэг",
          doctorName: `${selDoctor.lastname} ${selDoctor.firstname}`,
          doctorField: selDoctor.field,
          hospitalName: selHospital.name,
        });
        setView("booking-success");
      } else {
        const err = await res.json().catch(() => ({}));
        setConfirmError(err.detail || "Цаг захиалах үйлдэл амжилтгүй боллоо.");
      }
    } catch {
      setConfirmError("Серверт холбогдоход алдаа гарлаа.");
    }
    setLoading(false);
  };

  // ── Lab flow ───────────────────────────────────────────────────────────
  const onSelectLab = (l: Laboratory) => { setSelLab(l); loadLabTests(l.labID); setView("lab-test"); };
  const onSelectTest = (t: LabTest) => { setSelTest(t); setView("lab-confirm"); };

  const onConfirmLab = async () => {
    const result = await doFaceScan();
    if (!result) return;
    const u = getStoredUser();
    if (!u) { showToast("Хэрэглэгчийн мэдээлэл олдсонгүй.", false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/lab-order/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userID: u.id, labID: selLab!.labID, labType: selLab!.type, testID: selTest!.testID }),
      });
      if (res.ok) {
        setView("lab-success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Шинжилгээний захиалга амжилтгүй боллоо.", false);
      }
    } catch { showToast("Серверт алдаа гарлаа.", false); }
    setLoading(false);
  };

  // ── My appointments actions ────────────────────────────────────────────
  const cancelAppt = async (id: number) => {
    try {
      const res = await fetch(`${API}/appointments/cancel?appointmentID=${id}`, { method: "POST" });
      if (res.ok) { showToast("Цаг амжилттай цуцлагдлаа.", true); loadMyAppts(); }
      else showToast("Цаг цуцлахад алдаа гарлаа.", false);
    } catch { showToast("Алдаа гарлаа.", false); }
  };

  const cancelOrder = async (id: number) => {
    try {
      const res = await fetch(`${API}/lab-order/cancel?orderID=${id}`, { method: "POST" });
      if (res.ok) { showToast("Шинжилгээ цуцлагдлаа.", true); loadMyOrders(); }
      else showToast("Цуцлахад алдаа гарлаа.", false);
    } catch { showToast("Алдаа гарлаа.", false); }
  };

  const openChangeAppt = async (a: Appointment) => {
    setChangeAppt(a); setChangeDate(a.appointmentDate); setChangeTime(a.appointmentTime);
    const taken = await loadTakenSlots(a.doctorID, a.appointmentDate);
    setChangeTakenSlots(taken.filter(t => t !== a.appointmentTime));
    setView("change-appt");
  };

  const submitChangeAppt = async () => {
    if (!changeAppt || !changeDate || !changeTime) return;
    const result = await doFaceScan();
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/appointments/change`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...changeAppt, appointmentDate: changeDate, appointmentTime: changeTime }),
      });
      if (res.ok) { showToast("Цаг амжилттай өөрчлөгдлөө.", true); setView("my-appts"); loadMyAppts(); }
      else { const e = await res.json().catch(() => ({})); showToast(e.detail || "Өөрчлөлт амжилтгүй боллоо.", false); }
    } catch { showToast("Алдаа гарлаа.", false); }
    setLoading(false);
  };

  if (!authChecked || !user) return null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main className="root">
      {toast && <div className={`toast ${toast.ok ? "tok" : "terr"}`}>{toast.msg}</div>}

      {pageLoading && (
        <div className="pg-overlay">
          <div className="pg-card">
            <div className="pg-spin" />
            <p>Мэдээлэл ачааллаж байна...</p>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="hdr">
        <div className="hdr-brand">
          <div className="hosp-icon">
            <svg viewBox="0 0 40 40" fill="none" width="36" height="36">
              <rect x="2" y="2" width="36" height="36" rx="8" fill="#1d4ed8"/>
              <rect x="7" y="17" width="26" height="6" rx="2" fill="white"/>
              <rect x="17" y="7" width="6" height="26" rx="2" fill="white"/>
            </svg>
          </div>
          <div className="hdr-text">
            <span className="hdr-name">ЭРҮҮЛ МЭНДИЙН ТӨВ ЭМНЭЛЭГ</span>
            <span className="hdr-sub">EasyKiosk</span>
          </div>
        </div>
        <div className="hdr-right">
          <span className="hdr-mn">MN</span>
          {view === "home" ? (
            <button className="exit-btn" onClick={handleLogout}>Гарах</button>
          ) : null}
        </div>
      </header>

      <div className="content">

        {/* ── HOME ── */}
        {view === "home" && (
          <div className="fade-in">
            <div className="patient-card">
              <div className="patient-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
              <div className="patient-info">
                <p className="patient-greeting">Сайн байна уу,</p>
                <p className="patient-name">{user.firstname}</p>
                <p className="patient-reg">Регистр: {maskRegister(user.register)}</p>
              </div>
            </div>

            <div className="action-grid">
              <button className="ac-card blue" onClick={() => { setSelHospital(null); setSelDoctor(null); setSelDate(""); setSelTime(""); setView("service-type"); }}>
                <div className="ac-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                    <rect x="3" y="4" width="18" height="18" rx="3"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                    <path d="M8 15h2M8 18h5" strokeLinecap="round"/>
                    <path d="M15 15l1.5 1.5L19 13" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="ac-label">Цаг захиалах</span>
                <span className="ac-sub">Эмч · Шинжилгээ</span>
              </button>

              <button className="ac-card teal" onClick={() => { setView("my-appts"); loadMyAppts(); }}>
                <div className="ac-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                    <rect x="3" y="4" width="18" height="18" rx="3"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                    <path d="M7 14h4M7 17h6" strokeLinecap="round"/>
                    <circle cx="17" cy="17" r="2.8"/><path d="M17 15.8v1.2l.8.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="ac-label">Миний цаг</span>
                <span className="ac-sub">Харах · Өөрчлөх · Цуцлах</span>
              </button>

              <button className="ac-card indigo" onClick={() => { setView("my-labs"); loadMyOrders(); }}>
                <div className="ac-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                    <path d="M9 3h6v7l3 10H6L9 10V3z"/><path d="M6 17h12"/>
                  </svg>
                </div>
                <span className="ac-label">Миний шинжилгээ</span>
                <span className="ac-sub">Захиалга · Цуцлах</span>
              </button>
            </div>
          </div>
        )}

        {/* ── SERVICE TYPE ── */}
        {view === "service-type" && (
          <div className="fade-in">
            <StepHeader title="Үйлчилгээ сонгоно уу" onBack={() => setView("home")} />
            <div className="svc-grid">
              <button className="svc-card" onClick={() => setView("appt-hospital")}>
                <div className="svc-icon blue-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </div>
                <p className="svc-title">ЭМЧИЙН ҮЗЛЭГ</p>
                <p className="svc-desc">Бух тэрлийн үзлэг / оношилгоо</p>
              </button>
              <button className="svc-card" onClick={() => setView("lab-lab")}>
                <div className="svc-icon teal-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                    <path d="M9 3h6v7l3 10H6L9 10V3z"/><path d="M6 17h12"/>
                    <circle cx="10" cy="15" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="14" cy="18" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                </div>
                <p className="svc-title">ЛАБОРАТОРИЙН ШИНЖИЛГЭЭ</p>
                <p className="svc-desc">Цус, шээс, биохими гэх мэт</p>
              </button>
            </div>
          </div>
        )}

        {/* ── HOSPITAL SELECT ── */}
        {view === "appt-hospital" && (
          <div className="fade-in">
            <StepHeader title="Эмнэлэг сонгох" onBack={() => setView("service-type")} step={1} total={4}/>
            <div className="list-col">
              {hospitals.map(h => (
                <button key={h.hospitalID} className="list-row" onClick={() => onSelectHospital(h)}>
                  <div className="list-ico blue-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                      <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14"/>
                      <path d="M9 21v-6h6v6"/><path d="M12 7v4M10 9h4"/>
                    </svg>
                  </div>
                  <span className="list-lbl">{h.name}</span>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DOCTOR SELECT ── */}
        {view === "appt-doctor" && (
          <div className="fade-in">
            <StepHeader title={`Эмч сонгох — ${selHospital?.name}`} onBack={() => setView("appt-hospital")} step={2} total={4}/>
            {loading ? <Spinner/> : (
              <div className="list-col">
                {doctors.map(d => (
                  <button key={d.doctorID} className="list-row" onClick={() => onSelectDoctor(d)}>
                    <div className="list-ico teal-bg">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                      </svg>
                    </div>
                    <div style={{flex:1, textAlign:"left"}}>
                      <p style={{margin:0,fontWeight:700,fontSize:15,color:"#1e293b"}}>{d.firstname} {d.lastname}</p>
                      <p style={{margin:0,fontSize:13,color:"#64748b"}}>{d.field}</p>
                    </div>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR DATE SELECT ── */}
        {view === "appt-calendar" && (
          <div className="fade-in">
            <StepHeader title="Өдөр сонгоно уу" onBack={() => setView("appt-doctor")} step={3} total={4}/>
            <CalendarPicker selected={selDate} onSelect={onSelectDate}/>
            <p className="cal-hint">Огноог сонгосны дараа боломжит цагуудыг харуулна.</p>
          </div>
        )}

        {/* ── TIME SLOT SELECT ── */}
        {view === "appt-time" && (
          <div className="fade-in">
            <StepHeader title="Цаг сонгоно уу" onBack={() => setView("appt-calendar")} step={3} total={4}/>
            <div className="sel-date-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                <rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {selDate}
            </div>
            <TimeSlotGrid slots={TIME_SLOTS} takenSlots={takenSlots} selected={selTime} onSelect={onSelectTime}/>
            <button
              className={`confirm-btn${!selTime ? " dis" : ""}`}
              onClick={() => selTime && setView("appt-confirm")}
              disabled={!selTime}
            >Үргэлжлүүлэх</button>
          </div>
        )}

        {/* ── APPT CONFIRM ── */}
        {view === "appt-confirm" && (
          <div className="fade-in">
            <StepHeader title="Захиалга баталгаажуулах" onBack={() => { setConfirmError(""); setView("appt-time"); }} step={4} total={4}/>
            <div className="confirm-card">
              <div className="confirm-row">
                <span className="c-lbl">Эмнэлэг</span>
                <span className="c-val">{selHospital?.name}</span>
              </div>
              <div className="confirm-row">
                <span className="c-lbl">Эмч</span>
                <span className="c-val">{selDoctor?.lastname} {selDoctor?.firstname}</span>
              </div>
              <div className="confirm-row">
                <span className="c-lbl">Мэргэжил</span>
                <span className="c-val">{selDoctor?.field}</span>
              </div>
              <div className="confirm-row">
                <span className="c-lbl">Огноо</span>
                <span className="c-val">{fmtDateFull(selDate)}</span>
              </div>
              <div className="confirm-row last">
                <span className="c-lbl">Цаг</span>
                <span className="c-val time-val">{selTime}</span>
              </div>
            </div>
            <p className="face-hint">Нүүр царайгаар баталгаажуулна уу</p>
            {confirmError && <div className="inline-err">{confirmError}</div>}
            <button className="confirm-btn" onClick={onConfirmAppt} disabled={loading}>
              {loading ? <SmallSpin/> : <><FaceIco/>Царайгаар баталгаажуулах</>}
            </button>
          </div>
        )}

        {/* ── BOOKING SUCCESS ── */}
        {view === "booking-success" && bookingSummary && (
          <div className="fade-in success-page">
            <div className="success-check">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor" width="40" height="40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </div>
            <h2 className="success-title">Цаг амжилттай захиалагдлаа!</h2>
            <div className="confirm-card">
              <div className="confirm-row"><span className="c-lbl">Огноо</span><span className="c-val">{fmtDateFull(bookingSummary.date)}</span></div>
              <div className="confirm-row"><span className="c-lbl">Цаг</span><span className="c-val time-val">{bookingSummary.time}</span></div>
              <div className="confirm-row"><span className="c-lbl">Үйлчилгээ</span><span className="c-val">{bookingSummary.service}</span></div>
              <div className="confirm-row"><span className="c-lbl">Эмч</span><span className="c-val">{bookingSummary.doctorName}</span></div>
              <div className="confirm-row last"><span className="c-lbl">Тасаг</span><span className="c-val">{bookingSummary.doctorField}</span></div>
            </div>
            <div className="suc-btn-row">
              <button className="suc-btn home-btn" onClick={() => setView("home")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>
                Нүүр хуудас
              </button>
              <button className="suc-btn print-btn" onClick={() => window.print()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
                Баримт хэвлэх
              </button>
            </div>
          </div>
        )}

        {/* ── LAB SELECT ── */}
        {view === "lab-lab" && (
          <div className="fade-in">
            <StepHeader title="Лаборатори сонгох" onBack={() => setView("service-type")} step={1} total={3}/>
            <div className="list-col">
              {labs.map(l => (
                <button key={l.labID} className="list-row" onClick={() => onSelectLab(l)}>
                  <div className="list-ico teal-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                      <path d="M9 3h6v7l3 10H6L9 10V3z"/><path d="M6 17h12"/>
                    </svg>
                  </div>
                  <span className="list-lbl">{l.type}</span>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LAB TEST SELECT ── */}
        {view === "lab-test" && (
          <div className="fade-in">
            <StepHeader title={`Шинжилгээ сонгох — ${selLab?.type}`} onBack={() => setView("lab-lab")} step={2} total={3}/>
            {loading ? <Spinner/> : (
              <div className="list-col">
                {labTests.map(t => (
                  <button key={t.testID} className="list-row" onClick={() => onSelectTest(t)}>
                    <div className="list-ico blue-bg">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
                      </svg>
                    </div>
                    <span className="list-lbl">{t.name}</span>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LAB CONFIRM ── */}
        {view === "lab-confirm" && (
          <div className="fade-in">
            <StepHeader title="Захиалга баталгаажуулах" onBack={() => setView("lab-test")} step={3} total={3}/>
            <div className="confirm-card">
              <div className="confirm-row">
                <span className="c-lbl">Лаборатори</span>
                <span className="c-val">{selLab?.type}</span>
              </div>
              <div className="confirm-row last">
                <span className="c-lbl">Шинжилгээ</span>
                <span className="c-val">{selTest?.name}</span>
              </div>
            </div>
            <p className="face-hint">Нүүр царайгаар баталгаажуулна уу</p>
            <button className="confirm-btn" onClick={onConfirmLab} disabled={loading}>
              {loading ? <SmallSpin/> : <><FaceIco/>Царайгаар баталгаажуулах</>}
            </button>
          </div>
        )}

        {/* ── LAB SUCCESS ── */}
        {view === "lab-success" && (
          <div className="fade-in success-page">
            <div className="success-check">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor" width="40" height="40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </div>
            <h2 className="success-title">Шинжилгээ амжилттай захиалагдлаа!</h2>
            <div className="confirm-card">
              <div className="confirm-row"><span className="c-lbl">Лаборатори</span><span className="c-val">{selLab?.type}</span></div>
              <div className="confirm-row last"><span className="c-lbl">Шинжилгээ</span><span className="c-val">{selTest?.name}</span></div>
            </div>
            <div className="suc-btn-row">
              <button className="suc-btn home-btn" onClick={() => setView("home")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>
                Нүүр хуудас
              </button>
            </div>
          </div>
        )}

        {/* ── MY APPOINTMENTS ── */}
        {view === "my-appts" && (
          <div className="fade-in">
            <StepHeader title="Миний цаг" onBack={() => setView("home")}/>
            {pageLoading ? <Spinner/> : myAppts.length === 0 ? (
              <div className="empty">Захиалсан цаг байхгүй байна.</div>
            ) : (
              <div className="rec-list">
                {myAppts.map(a => (
                  <div key={a.appointmentID} className="rec-card">
                    <div className="rec-top">
                      <div>
                        <p className="rec-title">{hospitalMap[a.hospitalID] || "Эмнэлэг"}</p>
                        <p className="rec-sub">{doctorMap[a.doctorID] || a.doctorFirstname}</p>
                      </div>
                      <span className={`badge ${a.status === "Cancelled" ? "canc" : a.status === "Pending" ? "pend" : "done"}`}>{a.status}</span>
                    </div>
                    <p className="rec-dt">{fmtDateFull(a.appointmentDate)} · {a.appointmentTime}</p>
                    {a.status !== "Cancelled" && (
                      <div className="rec-actions">
                        <button className="rb edit" onClick={() => openChangeAppt(a)}>Өөрчлөх</button>
                        <button className="rb cancel" onClick={() => cancelAppt(a.appointmentID)}>Цуцлах</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MY LABS ── */}
        {view === "my-labs" && (
          <div className="fade-in">
            <StepHeader title="Миний шинжилгээ" onBack={() => setView("home")}/>
            {pageLoading ? <Spinner/> : myOrders.length === 0 ? (
              <div className="empty">Захиалсан шинжилгээ байхгүй байна.</div>
            ) : (
              <div className="rec-list">
                {myOrders.map(o => (
                  <div key={o.orderID} className="rec-card">
                    <div className="rec-top">
                      <div>
                        <p className="rec-title">{labMap[o.labID] || "Лаборатори"}</p>
                        <p className="rec-sub">{testMap[o.testID] || o.labType}</p>
                      </div>
                      <span className={`badge ${o.status === "Cancelled" ? "canc" : "pend"}`}>{o.status}</span>
                    </div>
                    {o.status !== "Cancelled" && (
                      <div className="rec-actions">
                        <button className="rb cancel" onClick={() => cancelOrder(o.orderID)}>Цуцлах</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHANGE APPT ── */}
        {view === "change-appt" && changeAppt && (
          <div className="fade-in">
            <StepHeader title="Цаг өөрчлөх" onBack={() => setView("my-appts")}/>
            <div className="confirm-card" style={{marginBottom:20}}>
              <div className="confirm-row"><span className="c-lbl">Эмнэлэг</span><span className="c-val">{hospitalMap[changeAppt.hospitalID]}</span></div>
              <div className="confirm-row last"><span className="c-lbl">Эмч</span><span className="c-val">{doctorMap[changeAppt.doctorID]}</span></div>
            </div>
            <CalendarPicker selected={changeDate} onSelect={async (d) => {
              setChangeDate(d); setChangeTime("");
              const taken = await loadTakenSlots(changeAppt.doctorID, d);
              setChangeTakenSlots(taken.filter(t => t !== changeAppt.appointmentTime));
            }}/>
            {changeDate && (
              <div style={{marginTop:20}}>
                <TimeSlotGrid slots={TIME_SLOTS} takenSlots={changeTakenSlots} selected={changeTime} onSelect={setChangeTime}/>
              </div>
            )}
            <button
              className={`confirm-btn${!changeDate || !changeTime ? " dis" : ""}`}
              style={{marginTop:20}}
              onClick={submitChangeAppt}
              disabled={!changeDate || !changeTime || loading}
            >
              {loading ? <SmallSpin/> : <><FaceIco/>Баталгаажуулаад хадгалах</>}
            </button>
          </div>
        )}

      </div>

      <style jsx>{`
        * { box-sizing:border-box; }
        .root { min-height:100vh; background:#f8fafc; font-family:'DM Sans','Segoe UI',sans-serif; color:#1e293b; }

        /* Header */
        .hdr {
          position:sticky; top:0; z-index:100;
          background:#fff; border-bottom:1px solid #e2e8f0;
          padding:12px 24px; display:flex; align-items:center; justify-content:space-between;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
        }
        .hdr-brand { display:flex; align-items:center; gap:12px; }
        .hosp-icon { flex-shrink:0; }
        .hdr-text { display:flex; flex-direction:column; }
        .hdr-name { font-size:13px; font-weight:800; letter-spacing:0.06em; color:#1e293b; }
        .hdr-sub { font-size:10px; color:#94a3b8; font-weight:500; }
        .hdr-right { display:flex; align-items:center; gap:12px; }
        .hdr-mn { font-size:12px; font-weight:700; color:#64748b; border:1px solid #e2e8f0; border-radius:4px; padding:2px 7px; }
        .exit-btn {
          background:#ef4444; border:none; border-radius:8px;
          color:#fff; font-size:13px; font-weight:700; padding:8px 16px;
          cursor:pointer; font-family:inherit; transition:background 0.15s;
        }
        .exit-btn:hover { background:#dc2626; }

        /* Content */
        .content { max-width:580px; margin:0 auto; padding:28px 20px 60px; }
        .fade-in { animation:fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

        /* Patient card */
        .patient-card {
          display:flex; align-items:center; gap:16px;
          background:#fff; border:1px solid #e2e8f0; border-radius:16px;
          padding:20px; margin-bottom:20px;
          box-shadow:0 2px 8px rgba(0,0,0,0.05);
        }
        .patient-avatar {
          width:56px; height:56px; border-radius:50%;
          background:linear-gradient(135deg,#dbeafe,#bfdbfe);
          display:flex; align-items:center; justify-content:center;
          color:#1d4ed8; flex-shrink:0;
        }
        .patient-info { flex:1; }
        .patient-greeting { font-size:12px; color:#94a3b8; margin:0 0 2px; }
        .patient-name { font-size:22px; font-weight:800; color:#1e293b; margin:0 0 4px; }
        .patient-reg { font-size:12px; color:#64748b; margin:0; font-weight:500; }

        /* Action grid */
        .action-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
        .ac-card {
          border:none; border-radius:16px; padding:20px 16px;
          text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:8px;
          font-family:inherit; transition:transform 0.15s, box-shadow 0.15s;
        }
        .ac-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.12); }
        .ac-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
        .ac-label { font-size:14px; font-weight:700; }
        .ac-sub { font-size:11px; opacity:0.7; }
        .blue  { background:linear-gradient(135deg,#dbeafe,#bfdbfe); color:#1d4ed8; }
        .blue .ac-icon { background:rgba(29,78,216,0.15); }
        .teal  { background:linear-gradient(135deg,#d1fae5,#a7f3d0); color:#047857; }
        .teal .ac-icon { background:rgba(4,120,87,0.12); }
        .indigo{ background:linear-gradient(135deg,#e0e7ff,#c7d2fe); color:#3730a3; }
        .indigo .ac-icon { background:rgba(55,48,163,0.12); }
        .slate { background:linear-gradient(135deg,#f1f5f9,#e2e8f0); color:#475569; }
        .slate .ac-icon { background:rgba(71,85,105,0.1); }

        /* Service cards */
        .svc-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .svc-card {
          border:1.5px solid #e2e8f0; border-radius:20px; padding:28px 20px;
          background:#fff; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:16px;
          font-family:inherit; transition:border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        }
        .svc-card:hover { border-color:#2563eb; box-shadow:0 8px 24px rgba(37,99,235,0.12); transform:translateY(-2px); }
        .svc-icon {
          width:80px; height:80px; border-radius:20px;
          display:flex; align-items:center; justify-content:center;
        }
        .blue-bg { background:#dbeafe; color:#1d4ed8; }
        .teal-bg { background:#d1fae5; color:#047857; }
        .svc-title { font-size:13px; font-weight:800; color:#1e293b; text-align:center; letter-spacing:0.03em; }
        .svc-desc { font-size:12px; color:#64748b; text-align:center; line-height:1.5; }

        /* List rows */
        .list-col { display:flex; flex-direction:column; gap:8px; }
        .list-row {
          display:flex; align-items:center; gap:12px;
          border:1px solid #e2e8f0; border-radius:14px; padding:14px 16px;
          background:#fff; cursor:pointer; font-family:inherit;
          transition:border-color 0.15s, box-shadow 0.15s;
        }
        .list-row:hover { border-color:#2563eb; box-shadow:0 4px 12px rgba(37,99,235,0.1); }
        .list-ico {
          width:38px; height:38px; border-radius:10px;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .list-lbl { flex:1; font-size:15px; font-weight:600; color:#1e293b; text-align:left; }
        .chev { width:18px; height:18px; color:#cbd5e1; flex-shrink:0; }

        /* Calendar hint */
        .cal-hint { font-size:12px; color:#94a3b8; text-align:center; margin:12px 0 0; }

        /* Selected date chip */
        .sel-date-chip {
          display:inline-flex; align-items:center; gap:6px;
          background:#dbeafe; color:#1d4ed8; border-radius:99px;
          padding:6px 14px; font-size:13px; font-weight:600; margin-bottom:16px;
        }

        /* Confirm card */
        .confirm-card {
          border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;
          background:#fff; margin-bottom:20px;
        }
        .confirm-row {
          display:flex; align-items:center; padding:14px 18px;
          border-bottom:1px solid #f1f5f9;
        }
        .confirm-row.last { border-bottom:none; }
        .c-lbl { width:90px; font-size:12px; color:#94a3b8; font-weight:600; flex-shrink:0; }
        .c-val { font-size:14px; font-weight:700; color:#1e293b; }
        .time-val { font-size:20px; color:#2563eb; }

        .face-hint { text-align:center; font-size:13px; color:#94a3b8; margin:0 0 12px; line-height:1.6; }
        .inline-err {
          background:#fee2e2; border:1px solid #fecaca; border-radius:10px;
          color:#dc2626; font-size:13px; font-weight:600;
          padding:11px 16px; margin-bottom:12px; text-align:center;
        }

        .confirm-btn {
          width:100%; padding:15px; background:#2563eb;
          border:none; border-radius:14px; color:#fff; font-size:15px; font-weight:700;
          cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:10px;
          transition:background 0.15s, transform 0.1s;
        }
        .confirm-btn:hover:not(:disabled) { background:#1d4ed8; transform:translateY(-1px); }
        .confirm-btn.dis, .confirm-btn:disabled { background:#94a3b8; cursor:default; transform:none; }

        /* Success screen */
        .success-page { display:flex; flex-direction:column; align-items:center; padding-top:20px; }
        .success-check {
          width:80px; height:80px; border-radius:50%; background:#10b981;
          display:flex; align-items:center; justify-content:center;
          color:#fff; margin-bottom:20px;
          box-shadow:0 8px 24px rgba(16,185,129,0.4);
          animation:popIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes popIn { from{transform:scale(0)} to{transform:scale(1)} }
        .success-title { font-size:20px; font-weight:800; color:#1e293b; margin:0 0 24px; text-align:center; }
        .suc-btn-row { display:flex; gap:12px; width:100%; margin-top:20px; }
        .suc-btn {
          flex:1; padding:14px; border-radius:12px; font-size:14px; font-weight:700;
          cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px;
          transition:opacity 0.15s;
        }
        .suc-btn:hover { opacity:0.85; }
        .home-btn { background:#f1f5f9; border:1.5px solid #e2e8f0; color:#475569; }
        .print-btn { background:#2563eb; border:none; color:#fff; }

        /* Records */
        .rec-list { display:flex; flex-direction:column; gap:10px; }
        .rec-card { border:1px solid #e2e8f0; border-radius:14px; padding:16px; background:#fff; }
        .rec-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:8px; }
        .rec-title { font-size:15px; font-weight:700; margin:0 0 3px; }
        .rec-sub { font-size:13px; color:#64748b; margin:0; }
        .rec-dt { font-size:13px; color:#475569; font-weight:600; margin:0 0 12px; }
        .badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; flex-shrink:0; }
        .pend { background:#fef9c3; color:#854d0e; }
        .done { background:#d1fae5; color:#065f46; }
        .canc { background:#fee2e2; color:#991b1b; }
        .rec-actions { display:flex; gap:8px; }
        .rb { flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
        .rb.edit   { background:#eff6ff; border:1.5px solid #bfdbfe; color:#1d4ed8; }
        .rb.cancel { background:#fee2e2; border:1.5px solid #fecaca; color:#dc2626; }

        .empty { text-align:center; padding:60px 0; color:#94a3b8; font-size:15px; }

        /* Loading overlay */
        .pg-overlay {
          position:fixed; inset:0; z-index:200;
          background:rgba(255,255,255,0.85); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
        }
        .pg-card {
          background:#fff; border:1px solid #e2e8f0; border-radius:20px;
          padding:36px 48px; display:flex; flex-direction:column; align-items:center; gap:16px;
          box-shadow:0 8px 32px rgba(0,0,0,0.1);
        }
        .pg-card p { font-size:14px; font-weight:600; color:#475569; margin:0; }
        .pg-spin { width:36px; height:36px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin 0.75s linear infinite; }

        /* Toast */
        .toast {
          position:fixed; bottom:32px; left:50%; transform:translateX(-50%);
          padding:13px 24px; border-radius:12px; font-size:14px; font-weight:600;
          z-index:9999; animation:slideUp 0.3s ease; white-space:nowrap;
          box-shadow:0 4px 20px rgba(0,0,0,0.15);
        }
        .tok  { background:#1e293b; color:#fff; }
        .terr { background:#dc2626; color:#fff; }
        @keyframes slideUp { from{opacity:0;transform:translate(-50%,12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </main>
  );
}

function Spinner() {
  return (
    <div style={{display:"flex",justifyContent:"center",padding:"48px 0"}}>
      <div style={{width:32,height:32,border:"3px solid #e2e8f0",borderTopColor:"#2563eb",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
    </div>
  );
}

function SmallSpin() {
  return <div style={{width:18,height:18,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>;
}

function FaceIco() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
      <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316Z"/>
      <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/>
    </svg>
  );
}
