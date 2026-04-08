/**
 * CrewOps yönetim arayüzü – ana layout ve rota yapısı.
 * Terminal ekranı değil; formlar ve listeler. "Başla" ile gömülü terminal açılır.
 */

import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { PmChat } from "./pages/PmChat";
import { PlanReview } from "./pages/PlanReview";
import { Orchestration } from "./pages/Orchestration";
import { Tasks } from "./pages/Tasks";
import { Roles } from "./pages/Roles";
import { Memory } from "./pages/Memory";
import { History } from "./pages/History";

import "./App.css";

// Sol menü navigasyonu – simgeli ve dikey liste
function Nav() {
  return (
    <nav className="nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">🏠</span>
        <span className="nav-label">Pano</span>
      </NavLink>
      <NavLink
        to="/projects"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">📁</span>
        <span className="nav-label">Projeler</span>
      </NavLink>
      <NavLink
        to="/pm-chat"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">💬</span>
        <span className="nav-label">PM Sohbet</span>
      </NavLink>
      <NavLink
        to="/plan"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">📋</span>
        <span className="nav-label">Plan</span>
      </NavLink>
      <NavLink
        to="/orchestration"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">⚡</span>
        <span className="nav-label">Orkestrasyon</span>
      </NavLink>
      <NavLink
        to="/tasks"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">✅</span>
        <span className="nav-label">Görevler</span>
      </NavLink>
      <NavLink
        to="/roles"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">🧩</span>
        <span className="nav-label">Roller / Agent’lar</span>
      </NavLink>
      <NavLink
        to="/memory"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">🧠</span>
        <span className="nav-label">Hafıza</span>
      </NavLink>
      <NavLink
        to="/history"
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <span className="nav-icon">📜</span>
        <span className="nav-label">Geçmiş</span>
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      {/* Üst navbar – proje / ortam bilgisi */}
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <div className="topbar-title">CrewOps Admin Panel</div>
            <div className="topbar-subtitle">
              Çok-ajanlı geliştirme akışlarını yöneten orkestrasyon arayüzü
            </div>
          </div>
          <div className="topbar-meta">
            <span className="topbar-badge">Ortam: Local</span>
            <span className="topbar-badge muted">PM mutabakat sonrası kodlama başlar</span>
          </div>
        </div>
      </header>

      <div className="layout">
        {/* Sol tarafta sabit bir yan menü; sağda içerik alanı */}
        <aside className="sidebar">
          <header className="header">
            <div className="logo-circle">CO</div>
            <div>
              <h1 className="app-title">CrewOps Orchestrator</h1>
              <p className="subtitle">
                Projeleri, görevleri ve rolleri buradan yönetin. Görev sayfasında{" "}
                <strong>&quot;Başla&quot;</strong> diyerek koşuları başlatın.
              </p>
            </div>
          </header>
          <Nav />
        </aside>
        <main className="main">
          <div className="main-inner">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/pm-chat" element={<PmChat />} />
              <Route path="/plan" element={<PlanReview />} />
              <Route path="/orchestration" element={<Orchestration />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/roles" element={<Roles />} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </div>
        </main>
      </div>

      <footer className="footer">
        <div className="footer-inner">
          <span>CrewOps · Agent Orchestrator</span>
          <span className="footer-sub">Projeler, görevler ve ajan ekipleri için yönetim paneli</span>
        </div>
      </footer>
    </div>
  );
}
