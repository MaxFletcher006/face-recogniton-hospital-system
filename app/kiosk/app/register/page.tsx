"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {

  useEffect(() => {
    document.title = "Бүртгүүлэх | Эрүүл мэндийн төв эмнэлэг";
  }, []);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  const router = useRouter();
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    phone_number: "",
    register: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async () => {
    if (!form.firstname || !form.lastname || !form.phone_number || !form.register || !form.password) {
      setError("Бүх талбарыг бөглөнө үү.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: form.firstname,
          lastname: form.lastname,
          phone_number: form.phone_number,
          register: form.register,
          password: form.password,
          dan_status: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Бүртгэл амжилтгүй боллоо.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch {
      setError("Серверт холбогдох боломжгүй байна.");
      setLoading(false);
    }
  };

  return (
    <main className="kiosk-root">
      <div className="grid-overlay" />

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
          <h1 className="page-title">Бүртгүүлэх хэсэг</h1>
          <p className="page-sub">Системд нэвтрэхийн тулд бүртгэл үүсгэнэ үү</p>
        </div>

        <div className="form-stack">
          <div className="field-group">
            <label className="field-label">Овог</label>
            <input
              className="field-input"
              name="lastname"
              type="text"
              placeholder="Овог нэр"
              value={form.lastname}
              onChange={handleChange}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Нэр</label>
            <input
              className="field-input"
              name="firstname"
              type="text"
              placeholder="Өөрийн нэр"
              value={form.firstname}
              onChange={handleChange}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Утасны дугаар</label>
            <input
              className="field-input"
              name="phone_number"
              type="text"
              placeholder="99xxxxxx"
              value={form.phone_number}
              onChange={handleChange}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Регистрийн дугаар</label>
            <input
              className="field-input"
              name="register"
              type="text"
              placeholder="АА00000000"
              value={form.register}
              onChange={handleChange}
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
            />
          </div>

          {error && <div className="error-banner">{error}</div>}
          {success && (
            <div className="success-banner">
              Амжилттай бүртгэгдлээ! Нэвтрэх хуудас руу шилжиж байна...
            </div>
          )}

          <button
            className={`primary-btn ${loading ? "loading" : ""} ${success ? "done" : ""}`}
            onClick={handleSubmit}
            disabled={loading || success}
          >
            {loading ? <span className="spinner" /> : success ? "Амжилттай ✓" : "Бүртгүүлэх"}
          </button>
        </div>

        <div className="footer-link">
          Данстай юу?{" "}
          <Link href="/login" className="link">Нэвтрэх</Link>
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
          padding: 40px 16px;
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

        .kiosk-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          background: #ffffff;
          border: 1.5px solid #d8d5ce;
          border-radius: 24px;
          padding: 48px 44px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
          animation: cardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
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
          font-size: 30px;
          font-weight: 700;
          color: #1a1916;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .page-sub {
          font-size: 15px;
          color: #8a8880;
          margin: 0;
        }

        .form-stack {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          letter-spacing: 0.08em;
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
          border-color: #3cb89a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(60,184,154,0.12);
        }

        .error-banner {
          background: #fef0ee;
          border: 1.5px solid #f5c4b3;
          color: #993c1d;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
        }

        .success-banner {
          background: #e4f4ef;
          border: 1.5px solid #9fdece;
          color: #0f6e56;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
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
          min-height: 54px;
        }

        .primary-btn:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.35);
        }

        .primary-btn:active:not(:disabled) { transform: translateY(0); }
        .primary-btn:disabled { opacity: 0.6; cursor: default; }

        .primary-btn.done {
          background: #10b981;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .footer-link {
          margin-top: 28px;
          text-align: center;
          font-size: 14px;
          color: #8a8880;
        }

        .link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.2s;
        }

        .link:hover { opacity: 0.75; }
      `}</style>
    </main>
  );
}