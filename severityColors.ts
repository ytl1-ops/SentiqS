@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }
  body {
    background-color: #eef2f7;
    color: #1a2d4a;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ===== DARK MODE — Salle de Crise ===== */
  html.dark body {
    background-color: #0a0e14;
    color: #e2e8f0;
  }

  html.dark .bg-white { background-color: #111827; }
  html.dark .bg-sentiqs-gray-bg { background-color: #0f1724; }
  html.dark .bg-gray-50 { background-color: #1a2232; }
  html.dark .bg-gray-50\/50 { background-color: rgba(26, 34, 50, 0.5); }
  html.dark .bg-gray-50\/70 { background-color: rgba(26, 34, 50, 0.7); }
  html.dark .bg-gray-100 { background-color: #1e293b; }
  html.dark .bg-gray-100\/70 { background-color: rgba(30, 41, 59, 0.7); }
  html.dark .bg-emerald-50 { background-color: #022c22; }
  html.dark .bg-red-50 { background-color: #2d0a0a; }
  html.dark .bg-orange-50 { background-color: #2d1a0a; }
  html.dark .bg-yellow-50 { background-color: #2d2a0a; }
  html.dark .bg-blue-50 { background-color: #0a1a2d; }
  html.dark .bg-amber-50 { background-color: #2d200a; }
  html.dark .bg-purple-50 { background-color: #1a0a2d; }
  html.dark .bg-white\/10 { background-color: rgba(255, 255, 255, 0.05); }
  html.dark .bg-white\/70 { background-color: rgba(30, 41, 59, 0.7); }
  html.dark .bg-white\/80 { background-color: rgba(30, 41, 59, 0.8); }

  html.dark .text-sentiqs-navy { color: #e2e8f0; }
  html.dark .text-sentiqs-gray-text { color: #94a3b8; }
  html.dark .text-gray-400 { color: #64748b; }
  html.dark .text-gray-500 { color: #94a3b8; }
  html.dark .text-gray-600 { color: #cbd5e1; }
  html.dark .text-gray-700 { color: #e2e8f0; }
  html.dark .text-gray-800 { color: #f1f5f9; }
  html.dark .text-gray-900 { color: #f8fafc; }

  html.dark .border-gray-100 { border-color: #1e293b; }
  html.dark .border-gray-200 { border-color: #273449; }
  html.dark .border-gray-50 { border-color: #1a2232; }
  html.dark .border-gray-200\/60 { border-color: rgba(39, 52, 73, 0.6); }
  html.dark .border-red-200 { border-color: #5c1a1a; }
  html.dark .border-orange-200 { border-color: #5c301a; }
  html.dark .border-yellow-200 { border-color: #5c501a; }
  html.dark .border-emerald-200 { border-color: #1a5c3a; }

  html.dark .hover\:bg-gray-50:hover { background-color: #1a2232; }
  html.dark .hover\:bg-gray-100:hover { background-color: #1e293b; }
  html.dark .hover\:bg-gray-100\/70:hover { background-color: rgba(30, 41, 59, 0.7); }
  html.dark .hover\:text-gray-700:hover { color: #e2e8f0; }
  html.dark .hover\:border-gray-300:hover { border-color: #475569; }

  html.dark .from-red-50\/30 { --tw-gradient-from: rgba(45, 10, 10, 0.3); }
  html.dark .bg-sentiqs-navy { background-color: #0f1a2e; }

  /* Dark mode box shadows */
  html.dark .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.4); }

  /* Divider colors in dark */
  html.dark .border-t { border-top-color: #1e293b; }
  html.dark .border-b { border-bottom-color: #1e293b; }
}

@layer utilities {
  .globe-rings {
    position: relative;
    width: 500px;
    height: 500px;
  }

  .globe-ring {
    position: absolute;
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .globe-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    background: rgba(37, 99, 235, 0.5);
    border-radius: 50%;
  }

  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .animate-marquee {
    animation: marquee 30s linear infinite;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slide-in-from-bottom-4 {
    from { opacity: 0; transform: translateY(1rem); }
    to { opacity: 1; transform: translateY(0); }
  }

  .animate-in {
    animation-fill-mode: both;
  }

  .fade-in {
    animation-name: fade-in;
  }

  .slide-in-from-bottom-4 {
    animation-name: slide-in-from-bottom-4;
  }

  .duration-300 {
    animation-duration: 300ms;
  }

  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fade-in-down {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fade-in-right {
    from { opacity: 0; transform: translateX(-12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes fade-in-scale {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes fade-in-width {
    from { opacity: 0; width: 0; }
    to { opacity: 1; }
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
  }

  @keyframes pulse-glow-orange {
    0%, 100% { box-shadow: 0 0 8px rgba(249, 115, 22, 0.4); }
    50% { box-shadow: 0 0 16px rgba(249, 115, 22, 0.6); }
  }

  .anim-pulse-red {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .anim-pulse-orange {
    animation: pulse-glow-orange 2.5s ease-in-out infinite;
  }

  .anim-entry-up {
    animation: fade-in-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .anim-entry-down {
    animation: fade-in-down 400ms ease-out both;
  }

  .anim-entry-right {
    animation: fade-in-right 400ms ease-out both;
  }

  .anim-entry-scale {
    animation: fade-in-scale 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .anim-stagger > * {
    opacity: 0;
    animation: fade-in-up 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .dashboard-page-transition {
    min-height: 100%;
  }

  .dashboard-page-transition.page-enter {
    animation: page-slide-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .dashboard-page-transition.page-active {
    animation: none;
  }

  @keyframes page-slide-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.985);
      filter: blur(1px);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
  }

  @keyframes page-exit-fade {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.98);
    }
  }
}