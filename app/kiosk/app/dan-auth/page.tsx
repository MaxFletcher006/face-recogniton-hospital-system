"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Step = "camera" | "done";

export default function DANAuthPage() {

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>("camera");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const getUser = () => {
    const raw = localStorage.getItem("kiosk_user");
    return raw ? JSON.parse(raw) : null;
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("Камерт хандах боломжгүй байна.");
    }
  }, []);

  useEffect(() => {
    document.title = "ДАН Баталгаажуулалт | EasyKiosk"
    if (step === "camera") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg"));
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  }

  const handleUpload = async () => {
    const user = getUser();
    console.log("Upload товч дарагдлаа!");
    console.log("User data:", user); 
    console.log("Captured Image state:", capturedImage);

      if (!user || !capturedImage) return;
      setLoading(true);
      setError("");

      try {
        const blob = await fetch(capturedImage).then((r) => r.blob());
        const formData = new FormData();
        formData.append("register", user.register);
        formData.append("photo", blob, `${user.register}.jpg`);

        console.log("Request илгээж байна...");

        const res = await fetch(`${API}/auth-and-upload/`, {
          method: "POST",
          body: formData,
          // Content-Type-ийг бүү бич! Browser автоматаар хийнэ.
        });

        console.log("Response хүлээн авлаа:", res); // Хэрэв хүсэлт очсон бол энд хэвлэгдэнэ
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Сервер алдаа гаргалаа");
        }

        setStep("done");
      } catch (err) {
        console.error("Fetch Error:", err);
        setError("Серверт холбогдох боломжгүй байна.");
      }
      setLoading(false);
  };

  return (
    <main className="root">
      <div className="grid" />

      <div className="card">
        {/* Brand */}
        <div className="brand">
          <svg viewBox="0 0 40 40" fill="none" width="36" height="36">
            <circle cx="20" cy="20" r="18" stroke="url(#g)" strokeWidth="1.5" />
            <path d="M20 8 L28 20 L20 32 L12 20 Z" stroke="url(#g)" strokeWidth="1.5" fill="none" />
            <circle cx="20" cy="20" r="4" fill="url(#g)" />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#5a78c8" />
                <stop offset="1" stopColor="#3cb89a" />
              </linearGradient>
            </defs>
          </svg>
          <span className="brand-name">EasyKiosk</span>
        </div>

        {/* Step indicator */}
        <div className="steps">
          {["Зураг авах", "Дууссан"].map((label, i) => {
            const stepKeys: Step[] = ["camera", "done"];
            const active = step === stepKeys[i];
            const done = i === 0 && step === "done";
            return (
              <div key={i} className={`step ${active ? "active" : ""} ${done ? "done" : ""}`}>
                <div className="step-dot">{done ? "✓" : i + 1}</div>
                <span className="step-label">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Camera capture step */}
        {step === "camera" && (
          <div className="section">
            <h1 className="title">Зураг авах</h1>
            <p className="sub">Камерт шууд харж байрлана уу.</p>

            <div className="camera-wrap">
              {!capturedImage ? (
                <video ref={videoRef} autoPlay playsInline className="video" />
              ) : (
                <img src={capturedImage} alt="captured" className="video" />
              )}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            {error && <div className="error">{error}</div>}

            <div className="btn-row">
              {!capturedImage ? (
                <button className="btn" onClick={handleCapture}>
                  Зураг авах
                </button>
              ) : (
                <>
                  <button className="btn btn-outline" onClick={handleRetake} disabled={loading}>
                    Дахин авах
                  </button>
                  <button className="btn" onClick={handleUpload} disabled={loading}>
                    {loading ? <span className="spinner" /> : "Илгээх"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Done step */}
        {step === "done" && (
          <div className="section center">
            <div className="success-icon">
              <svg viewBox="0 0 60 60" fill="none" width="60" height="60">
                <circle cx="30" cy="30" r="28" stroke="url(#gs)" strokeWidth="1.5" />
                <path
                  d="M18 30 L26 38 L42 22"
                  stroke="url(#gs)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="gs" x1="0" y1="0" x2="60" y2="60">
                    <stop stopColor="#5a78c8" />
                    <stop offset="1" stopColor="#3cb89a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="title">Амжилттай</h1>
            <p className="sub">DAN баталгаажуулалт дууслаа. Та системд нэвтэрч болно.</p>
            <button className="btn" onClick={() => router.push("/login")}>
              Үргэлжлүүлэх
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .root {
          min-height: 100vh;
          background: #f0ede6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .grid {
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(90,120,200,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(90,120,200,0.06) 1px, transparent 1px);
          background-size: 60px 60px;
          z-index: 0;
        }

        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 480px;
          background: #ffffff;
          border: 1.5px solid #d8d5ce;
          border-radius: 24px;
          padding: 44px 44px 40px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
          animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .brand {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 32px;
        }

        .brand-name {
          font-size: 18px; font-weight: 700; letter-spacing: 0.15em;
          background: linear-gradient(90deg,#5a78c8,#3cb89a);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .steps {
          display: flex; gap: 0; margin-bottom: 36px;
          border-bottom: 1.5px solid #e8e5de;
          padding-bottom: 24px;
        }

        .step {
          display: flex; align-items: center; gap: 8px;
          flex: 1; opacity: 0.3; transition: opacity 0.3s;
        }

        .step.active { opacity: 1; }
        .step.done { opacity: 0.6; }

        .step-dot {
          width: 24px; height: 24px; border-radius: 50%;
          background: #eef1fb;
          border: 1.5px solid #c5cfef;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; color: #5a78c8;
          flex-shrink: 0;
        }

        .step.active .step-dot {
          background: #eef1fb;
          border-color: #5a78c8;
          color: #5a78c8;
        }

        .step.done .step-dot {
          background: #e4f4ef;
          border-color: #3cb89a;
          color: #3cb89a;
        }

        .step-label { font-size: 12px; color: #8a8880; }

        .section { display: flex; flex-direction: column; gap: 18px; }
        .section.center { align-items: center; text-align: center; }

        .title {
          font-size: 28px; font-weight: 700; color: #1a1916;
          margin: 0; letter-spacing: -0.5px;
        }

        .sub { font-size: 14px; color: #8a8880; margin: 0; line-height: 1.6; }

        .camera-wrap {
          border-radius: 14px; overflow: hidden;
          border: 1.5px solid #d8d5ce;
          background: #f5f3ee;
        }

        .video {
          width: 100%; display: block;
          max-height: 260px; object-fit: cover;
          transform: scaleX(-1);
        }

        .error {
          background: #fef0ee;
          border: 1.5px solid #f5c4b3;
          color: #993c1d;
          padding: 12px 16px; border-radius: 10px;
          font-size: 14px;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
        }

        .btn-row { display: flex; gap: 12px; }

        .btn {
          flex: 1; padding: 15px;
          background: linear-gradient(135deg,#5a78c8,#3cb89a);
          border: none; border-radius: 12px;
          color: #fff; font-size: 15px; font-weight: 600;
          cursor: pointer; transition: transform 0.15s, box-shadow 0.2s;
          font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          min-height: 52px;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(90,120,200,0.3);
        }

        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.6; cursor: default; }

        .btn-outline {
          background: #ffffff;
          border: 1.5px solid #d8d5ce;
          color: #3a3834;
        }

        .btn-outline:hover:not(:disabled) {
          background: #f7f5f0;
          border-color: #5a78c8;
          box-shadow: none;
        }

        .spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .success-icon { margin-bottom: 8px; }
      `}</style>
    </main>
  );
}