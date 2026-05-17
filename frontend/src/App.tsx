import type { CSSProperties } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ChatPage from './pages/ChatPage';

const colors = {
  background: '#070d1a',
  sidebar: '#0d1526',
  text: '#e8ecf4',
  teal: '#00637C',
  sidebarBorder: 'rgba(255,255,255,0.07)',
};

const styles = {
  app: {
    display: 'flex',
    minHeight: '100vh',
    background: colors.background,
    color: colors.text,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  sidebar: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: 220,
    height: '100vh',
    background: colors.sidebar,
    borderRight: `1px solid ${colors.sidebarBorder}`,
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '28px 0 24px',
  },
  brand: {
    fontWeight: 700,
    fontSize: '1.15rem',
    color: colors.teal,
    padding: '0 20px',
    marginBottom: 6,
    letterSpacing: '0.02em',
  },
  tagline: {
    margin: 0,
    padding: '0 20px 28px',
    fontSize: '0.8rem',
    fontStyle: 'italic',
    color: 'rgba(232, 236, 244, 0.55)',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    padding: '0 12px',
  },
  main: {
    marginLeft: 220,
    flex: 1,
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
  },
};

function navLinkStyle(isActive: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 20px',
    borderRadius: 8,
    color: colors.text,
    textDecoration: 'none',
    fontSize: '0.95rem',
    borderLeft: `3px solid ${isActive ? colors.teal : 'transparent'}`,
    background: isActive ? 'rgba(0, 99, 124, 0.25)' : 'transparent',
    transition: 'background 0.15s ease',
  };
}

function SidebarNavLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: string;
  label: string;
}) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <span
          style={navLinkStyle(isActive)}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'rgba(0, 99, 124, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span aria-hidden>{icon}</span>
          {label}
        </span>
      )}
    </NavLink>
  );
}

export default function App() {
  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>NOSYOR.M.I</div>
        <p style={styles.tagline}>Your money, reflected.</p>
        <nav style={styles.nav}>
          <SidebarNavLink to="/" icon="📊" label="Dashboard" />
          <SidebarNavLink to="/upload" icon="⬆️" label="Upload" />
          <SidebarNavLink to="/chat" icon="💬" label="Chat" />
        </nav>
      </aside>

      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </main>
    </div>
  );
}
