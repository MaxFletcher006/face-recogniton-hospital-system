"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LoadingState = "idle" | "login" | "face" | "redirecting";

export default function LoginPage() {

  useEffect(() => {
    document.title = "Нэвтрэх | Эрүүл мэндийн төв эмнэлэг";
  }, []);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  console.log(API);

  const router = useRouter();
  const [form, setForm] = useState({ register: "", password: "" });
  const [error, setError] = useState("");
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [loadingMsg, setLoadingMsg] = useState("");

  const loading = loadingState !== "idle";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const onLogin = async () => {
    if (loading) return;
    setLoadingState("login");
    setLoadingMsg("Нэвтэрч байна...");
    setError("");

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ register: form.register, password: form.password }),
      });

      const data = await res.json();

      if (res.status === 200) {
        localStorage.setItem("kiosk_user", JSON.stringify({
          firstname: data.firstname,
          id: data.id,
          register: data.register,
        }));

        setLoadingMsg("Амжилттай! Шилжиж байна...");
        setLoadingState("redirecting");

        setTimeout(() => {
          if (!data.dan_status) {
            router.push("/dan-auth");
          } else {
            router.push("/home");
          }
        }, 800);
      } else if (res.status === 401) {
        setError("Нууц үг эсвэл Регистрийн дугаар буруу байна");
        setLoadingState("idle");
      } else if (res.status === 404) {
        setError("Хэрэглэгч олдсонгүй. Та бүртэл үүсгэн, систем рүү нэвтэрнэ үү");
        setLoadingState("idle");
      } else {
        setError("Нэвтрэхэд алдаа гарлаа. Та дахин оролдоно уу");
        setLoadingState("idle");
      }
    } catch {
      setError("Сервертэй холбогдоход алдаа гарлаа");
      setLoadingState("idle");
    }
  };

  const handleFaceScan = async () => {
    if (loading) return;
    setError("");

    type ScanState = "aligning" | "scanning" | "success" | "failed" | "notfound";

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(240, 238, 232, 0.92);
      display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #ffffff;
      border: 1.5px solid #d0cec8;
      border-radius: 20px; padding: 32px; width: 360px;
      text-align: center; font-family: 'DM Sans', 'Segoe UI', sans-serif;
      transition: border-color 0.4s;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    `;

    const label = document.createElement("p");
    label.style.cssText = `
      color: #8a8880; font-size: 13px;
      letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 16px;
    `;
    label.textContent = "Нүүр царайгаар нэвтрэх";

    const videoWrapper = document.createElement("div");
    videoWrapper.style.cssText = `
      position: relative; border-radius: 14px; overflow: hidden;
      background: #f5f3ee; aspect-ratio: 4/3;
    `;

    const video = document.createElement("video");
    video.playsInline = true;
    video.autoplay = true;
    video.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      display: block; transform: scaleX(-1);
    `;

    const flashEl = document.createElement("div");
    flashEl.style.cssText = `
      position: absolute; inset: 0; background: white;
      opacity: 0; pointer-events: none; transition: opacity 0.1s;
      border-radius: 14px;
    `;

    // Loading overlay inside video area
    const videoLoadingOverlay = document.createElement("div");
    videoLoadingOverlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(240,238,232,0.88);
      display: none; align-items: center; justify-content: center;
      flex-direction: column; gap: 12px; border-radius: 14px; z-index: 10;
    `;
    const videoSpinner = document.createElement("div");
    videoSpinner.style.cssText = `
      width: 36px; height: 36px;
      border: 3px solid rgba(90,120,200,0.2);
      border-top-color: #5a78c8;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    `;
    const videoSpinnerLabel = document.createElement("p");
    videoSpinnerLabel.style.cssText = `font-size: 13px; color: #5a78c8; margin: 0; font-family: inherit;`;
    videoSpinnerLabel.textContent = "Шалгаж байна...";
    videoLoadingOverlay.appendChild(videoSpinner);
    videoLoadingOverlay.appendChild(videoSpinnerLabel);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 320 240");
    svg.style.cssText = `
      position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;
    `;

    const ovalGuide = document.createElementNS(svgNS, "ellipse");
    ovalGuide.setAttribute("cx", "160"); ovalGuide.setAttribute("cy", "115");
    ovalGuide.setAttribute("rx", "82"); ovalGuide.setAttribute("ry", "97");
    ovalGuide.setAttribute("fill", "none");
    ovalGuide.setAttribute("stroke", "rgba(90,120,200,0.6)");
    ovalGuide.setAttribute("stroke-width", "2");
    ovalGuide.setAttribute("stroke-dasharray", "6 4");
    ovalGuide.style.transition = "stroke 0.4s";

    const scanLine = document.createElementNS(svgNS, "line");
    scanLine.setAttribute("x1", "78"); scanLine.setAttribute("x2", "242");
    scanLine.setAttribute("y1", "18"); scanLine.setAttribute("y2", "18");
    scanLine.setAttribute("stroke", "rgba(90,120,200,0.7)");
    scanLine.setAttribute("stroke-width", "1.5");
    scanLine.style.cssText = "display: none;";

    const bracketPositions = [
      { x: 78, y: 18, flipX: false, flipY: false },
      { x: 242, y: 18, flipX: true, flipY: false },
      { x: 78, y: 212, flipX: false, flipY: true },
      { x: 242, y: 212, flipX: true, flipY: true },
    ];
    bracketPositions.forEach(({ x, y, flipX, flipY }) => {
      const hBar = document.createElementNS(svgNS, "rect");
      hBar.setAttribute("x", String(flipX ? x - 28 : x));
      hBar.setAttribute("y", String(flipY ? y : y));
      hBar.setAttribute("width", "28"); hBar.setAttribute("height", "3");
      hBar.setAttribute("fill", "rgba(90,120,200,0.85)"); hBar.setAttribute("rx", "2");
      const vBar = document.createElementNS(svgNS, "rect");
      vBar.setAttribute("x", String(flipX ? x - 3 : x));
      vBar.setAttribute("y", String(flipY ? y - 28 : y));
      vBar.setAttribute("width", "3"); vBar.setAttribute("height", "28");
      vBar.setAttribute("fill", "rgba(90,120,200,0.85)"); vBar.setAttribute("rx", "2");
      svg.appendChild(hBar);
      svg.appendChild(vBar);
    });

    svg.appendChild(ovalGuide);
    svg.appendChild(scanLine);

    const hint = document.createElement("p");
    hint.style.cssText = `
      font-size: 14px; margin: 14px 0 20px; min-height: 40px;
      transition: color 0.3s; line-height: 1.5;
      color: #8a8880;
    `;
    hint.textContent = "Нүүрээ гурвалжингийн дотор байрлуулна уу";

    const progressWrap = document.createElement("div");
    progressWrap.style.cssText = `
      height: 3px; background: #e8e6e0;
      border-radius: 99px; overflow: hidden; margin-bottom: 20px;
    `;
    const progressBar = document.createElement("div");
    progressBar.style.cssText = `
      height: 100%; width: 0%; border-radius: 99px;
      background: linear-gradient(90deg, #5a78c8, #3cb89a);
      transition: width 0.4s ease;
    `;
    progressWrap.appendChild(progressBar);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 10px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Болих";
    cancelBtn.style.cssText = `
      flex: 1; padding: 12px;
      background: #f5f3ee;
      border: 1.5px solid #d0cec8;
      border-radius: 10px; color: #6b6962;
      font-size: 14px; cursor: pointer; font-family: inherit;
    `;

    const captureBtn = document.createElement("button");
    captureBtn.textContent = "Зураг авах";
    captureBtn.style.cssText = `
      flex: 1; padding: 12px;
      background: linear-gradient(135deg, #5a78c8, #3cb89a);
      border: none; border-radius: 10px; color: #fff;
      font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
      transition: opacity 0.2s;
    `;

    videoWrapper.appendChild(video);
    videoWrapper.appendChild(flashEl);
    videoWrapper.appendChild(videoLoadingOverlay);
    videoWrapper.appendChild(svg);
    modal.appendChild(label);
    modal.appendChild(videoWrapper);
    modal.appendChild(hint);
    modal.appendChild(progressWrap);
    modal.appendChild(btnRow);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(captureBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Inject keyframes for spinner inside modal
    if (!document.getElementById("face-scan-spin-style")) {
      const style = document.createElement("style");
      style.id = "face-scan-spin-style";
      style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    let scanY = 18;
    let scanDir = 1;
    let scanAnimId: number;

    const startScanAnim = () => {
      scanLine.style.display = "block";
      const animate = () => {
        scanY += scanDir * 2;
        if (scanY >= 212) scanDir = -1;
        if (scanY <= 18) scanDir = 1;
        scanLine.setAttribute("y1", String(scanY));
        scanLine.setAttribute("y2", String(scanY));
        scanAnimId = requestAnimationFrame(animate);
      };
      scanAnimId = requestAnimationFrame(animate);
    };

    const stopScanAnim = () => {
      cancelAnimationFrame(scanAnimId);
      scanLine.style.display = "none";
    };

    const setState = (state: ScanState) => {
      if (state === "aligning") {
        ovalGuide.setAttribute("stroke", "rgba(90,120,200,0.6)");
        modal.style.borderColor = "#d0cec8";
        hint.style.color = "#8a8880";
        hint.textContent = "Нүүрээ дэлгэцэн дээрх хүрээний дотор талд байршуулна уу";
        progressBar.style.width = "0%";
        captureBtn.style.display = "";
        cancelBtn.textContent = "Болих";
        videoLoadingOverlay.style.display = "none";
      } else if (state === "scanning") {
        ovalGuide.setAttribute("stroke", "rgba(90,120,200,1)");
        modal.style.borderColor = "rgba(90,120,200,0.5)";
        hint.style.color = "#5a78c8";
        hint.textContent = "Та гэрэлтэй газар хөдөлгөөнгүй зогсоно уу.";
        progressBar.style.width = "60%";
        captureBtn.style.display = "none";
        videoLoadingOverlay.style.display = "none";
        startScanAnim();
      } else if (state === "success") {
        stopScanAnim();
        videoLoadingOverlay.style.display = "none";
        ovalGuide.setAttribute("stroke", "rgba(60,184,154,1)");
        modal.style.borderColor = "rgba(60,184,154,0.7)";
        hint.style.color = "#3cb89a";
        hint.textContent = "Нүүр царайг амжилттай таньлаа!";
        progressBar.style.width = "100%";
        captureBtn.style.display = "none";
        cancelBtn.textContent = "Хаах";
      } else if (state === "failed") {
        stopScanAnim();
        videoLoadingOverlay.style.display = "none";
        ovalGuide.setAttribute("stroke", "rgba(200,60,60,0.8)");
        modal.style.borderColor = "rgba(200,60,60,0.4)";
        hint.style.color = "#c83c3c";
        hint.textContent = "Нүүр царайг таньсангүй. Дахин оролдоно уу.";
        progressBar.style.width = "0%";
        captureBtn.textContent = "Дахин оролдох";
        captureBtn.style.display = "";
      } else if (state === "notfound") {
        stopScanAnim();
        videoLoadingOverlay.style.display = "none";
        ovalGuide.setAttribute("stroke", "rgba(200,140,40,0.8)");
        modal.style.borderColor = "rgba(200,140,40,0.4)";
        hint.style.color = "#c88c28";
        hint.textContent = "Нүүр царай илрүүлсэнгүй. Гэрэлтэй газар зогсоно уу.";
        progressBar.style.width = "0%";
        captureBtn.textContent = "Дахин оролдох";
        captureBtn.style.display = "";
      }
    };

    let stream: MediaStream;

    const cleanup = () => {
      stopScanAnim();
      stream?.getTracks().forEach((t) => t.stop());
      document.body.removeChild(overlay);
    };

    cancelBtn.onclick = () => cleanup();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      video.srcObject = stream;
      await video.play();
      setState("aligning");
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Камерын зөвшөөрөл олгоно уу.");
      } else {
        setError("Камерт хандах боломжгүй байна.");
      }
      return;
    }

    let countdown = 3;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;

    const startCountdown = () => {
      setState("scanning");
      hint.textContent = `Хөдөлгөөнгүй зогсоорой... ${countdown}`;
      countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          hint.textContent = `Хөдөлгөөнгүй зогсоорой... ${countdown}`;
          progressBar.style.width = `${((3 - countdown) / 3) * 60 + 10}%`;
        } else {
          clearInterval(countdownInterval!);
          doCapture();
        }
      }, 1000);
    };

    const doCapture = async () => {
      flashEl.style.opacity = "0.7";
      setTimeout(() => { flashEl.style.opacity = "0"; }, 150);
      progressBar.style.width = "80%";

      // Show loading overlay on video area while fetching
      stopScanAnim();
      videoLoadingOverlay.style.display = "flex";
      hint.textContent = "Серверт илгээж байна...";
      captureBtn.style.display = "none";
      cancelBtn.style.pointerEvents = "none";
      cancelBtn.style.opacity = "0.4";

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      try {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg")
        );
        const formData = new FormData();
        formData.append("photo", blob, "scan.jpg");

        const res = await fetch(`${API}/face-auth`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        cancelBtn.style.pointerEvents = "";
        cancelBtn.style.opacity = "";

        if (!res.ok || !data.success) {
          if (data.detail?.toLowerCase().includes("not found") || data.detail?.toLowerCase().includes("илрүүлсэнгүй")) {
            setState("notfound");
          } else {
            setState("failed");
          }
          return;
        }

        setState("success");
        localStorage.setItem("kiosk_user", JSON.stringify({ firstname: data.firstname, id: data.id, register: data.register ?? "" }));
        setTimeout(() => {
          cleanup();
          router.push("/home");
        }, 1500);
      } catch {
        cancelBtn.style.pointerEvents = "";
        cancelBtn.style.opacity = "";
        setState("failed");
      }
    };

    captureBtn.onclick = () => {
      if (captureBtn.textContent === "Дахин оролдох") {
        countdown = 3;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }).then((s) => {
          stream = s;
          video.srcObject = stream;
          video.play();
          setState("aligning");
          captureBtn.textContent = "Зураг авах";
        });
      } else {
        startCountdown();
      }
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onLogin();
  };

  return (
    <main className="kiosk-root">
      <div className="grid-overlay" />

      {loading && (
        <div className="page-loading-overlay">
          <div className="page-loading-card">
            <div className="page-loading-spinner-wrap">
              <svg className="page-loading-ring" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="url(#ringGrad)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray="138" strokeDashoffset="100" />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5a78c8" />
                    <stop offset="100%" stopColor="#3cb89a" />
                  </linearGradient>
                </defs>
              </svg>
              {loadingState === "redirecting" && (
                <div className="page-loading-check">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
            </div>
            <p className="page-loading-msg">{loadingMsg}</p>
            <div className="page-loading-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}

      <div className="kiosk-card">
        <div className="brand-mark">
          <div className="brand-icon">
            <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
              <rect x="2" y="2" width="36" height="36" rx="8" fill="#1d4ed8"/>
              <rect x="7" y="17" width="26" height="6" rx="2" fill="white"/>
              <rect x="17" y="7" width="6" height="26" rx="2" fill="white"/>
            </svg>
          </div>
          <div style={{display:"flex",flexDirection:"column"}}>
            <span className="brand-name">ЭРҮҮЛ МЭНДИЙН ТӨВ ЭМНЭЛЭГ</span>
            <span style={{fontSize:"10px",color:"#94a3b8",fontWeight:500}}>EasyKiosk</span>
          </div>
        </div>

        <div className="page-header">
          <h1 className="page-title">Нэвтрэх</h1>
          <p className="page-sub">Нүүрсийн баталгаажуулалт эсвэл регистрээр нэвтэрнэ үү</p>
        </div>

        <div className="form-stack" onKeyDown={handleKeyDown}>
          <div className="field-group">
            <label className="field-label">Регистрийн дугаар</label>
            <input
              className="field-input"
              name="register"
              type="text"
              placeholder="AA00000000"
              value={form.register}
              onChange={handleChange}
              autoComplete="off"
              disabled={loading}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Нууц үг</label>
            <input
              className="field-input"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button
            className={`primary-btn ${loadingState === "login" || loadingState === "redirecting" ? "btn-loading" : ""}`}
            onClick={onLogin}
            disabled={loading}
          >
            {loadingState === "login" ? (
              <><span className="spinner" /><span>Нэвтэрч байна...</span></>
            ) : loadingState === "redirecting" ? (
              <><span className="spinner" /><span>Шилжиж байна...</span></>
            ) : (
              "Регистрээр нэвтрэх"
            )}
          </button>

          <button
            className={`primary-btn ${loadingState === "face" ? "btn-loading" : ""}`}
            onClick={handleFaceScan}
            disabled={loading}
          >
            {loading && loadingState === "face" ? (
              <span className="spinner" />
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span>Нүүр царайгаар нэвтрэх</span>
              </>
            )}
          </button>

          <Link href="/register" className="register-link">
            <button className="primary-btn" disabled={loading}>
              Бүртгүүлэх
            </button>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .kiosk-root {
          min-height: 100vh;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .grid-overlay {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          z-index: 0;
        }

        /* ── Page-level loading overlay ── */
        .page-loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(240, 238, 232, 0.75);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.25s ease both;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .page-loading-card {
          background: #ffffff;
          border: 1.5px solid #d8d5ce;
          border-radius: 20px;
          padding: 40px 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.1);
          animation: cardPop 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .page-loading-spinner-wrap {
          position: relative;
          width: 56px;
          height: 56px;
        }

        .page-loading-ring {
          width: 56px;
          height: 56px;
          animation: rotateSpin 1s linear infinite;
        }

        @keyframes rotateSpin {
          to { transform: rotate(360deg); }
        }

        .page-loading-check {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3cb89a;
          animation: checkPop 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }

        .page-loading-check svg {
          width: 22px;
          height: 22px;
        }

        @keyframes checkPop {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }

        .page-loading-msg {
          font-size: 16px;
          font-weight: 600;
          color: #3a3834;
          margin: 0;
          letter-spacing: 0.01em;
        }

        .page-loading-dots {
          display: flex;
          gap: 6px;
        }

        .page-loading-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5a78c8, #3cb89a);
          animation: dotBounce 1.2s ease-in-out infinite;
        }

        .page-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .page-loading-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }

        /* ── Card ── */
        .kiosk-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border: 1.5px solid #d8d5ce;
          border-radius: 24px;
          padding: 48px 44px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.9) inset;
          animation: cardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .brand-mark {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 40px;
        }

        .brand-icon { width: 36px; height: 36px; }

        .brand-name {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #1e293b;
        }

        .page-header { margin-bottom: 36px; }

        .page-title {
          font-size: 32px;
          font-weight: 700;
          color: #1a1916;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .page-sub {
          font-size: 18px;
          font-weight: 700;
          color: #8a8880;
          margin: 0;
        }

        .form-stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-label {
          font-size: 15px;
          font-weight: 700;
          color: #2563eb;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .field-input {
          background: #f7f5f0;
          border: 1.5px solid #d8d5ce;
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 16px;
          color: #1a1916;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          font-family: inherit;
        }

        .field-input::placeholder { color: #c0bdb6; }

        .field-input:focus {
          border-color: #2563eb;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }

        .field-input:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .error-banner {
          background: #fef0ee;
          border: 1.5px solid #f5c4b3;
          color: #993c1d;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          animation: shake 0.4s ease;
          text-align: center;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
        }

        .primary-btn {
          width: 100%;
          padding: 15px;
          background: #2563eb;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 54px;
          margin-bottom: 10px;
        }

        .primary-btn:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.35);
        }

        .primary-btn:active:not(:disabled) { transform: translateY(0); }
        .primary-btn:disabled { opacity: 0.6; cursor: default; }

        .btn-loading {
          opacity: 0.85 !important;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .register-link {
          display: block;
          text-decoration: none;
        }

        .register-link .primary-btn {
          background: #f1f5f9;
          border: 1.5px solid #e2e8f0;
          color: #475569;
          margin-bottom: 0;
        }

        .register-link .primary-btn:hover:not(:disabled) {
          background: #e2e8f0;
          border-color: #2563eb;
          color: #1d4ed8;
          box-shadow: none;
          transform: none;
        }
      `}</style>
    </main>
  );
}