import { useState } from 'react';
import type { CSSProperties } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import StatementsPage from './pages/StatementsPage';
import ChatPage from './pages/ChatPage';
import StatementDetailPage from './pages/StatementDetailPage';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#F8FAFC',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    maxWidth: '220px',
    height: '100vh',
    background: '#F1F5F9',
    borderRight: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px 12px',
    boxSizing: 'border-box' as const,
    flexShrink: 0,
  },
  brand: {
    padding: '0 12px 28px',
    borderBottom: '1px solid #E2E8F0',
    marginBottom: '16px',
  },
  brandName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#00637C',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap' as const,
  },
  brandTagline: {
    fontSize: '11px',
    color: '#94A3B8',
    fontStyle: 'italic' as const,
    marginTop: '2px',
    whiteSpace: 'nowrap' as const,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
  },
  main: {
    flex: 1,
    height: '100vh',
    overflow: 'auto',
    background: '#F8FAFC',
    minWidth: 0,
  },
  version: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10px',
    color: '#CBD5E1',
    padding: '0 12px',
    marginTop: 'auto',
  },
};

function navItemStyle(isActive: boolean, isHovered: boolean): CSSProperties {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: isActive ? '10px 14px 10px 11px' : '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '13.5px',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? '#00637C' : '#475569',
    border: isActive ? '1px solid rgba(0,99,124,0.2)' : '1px solid transparent',
    borderLeft: isActive ? '3px solid #00637C' : '1px solid transparent',
    transition: 'all 0.15s ease',
  };

  if (isActive) {
    return {
      ...base,
      background: 'rgba(0,99,124,0.08)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow:
        '0 1px 8px rgba(0,99,124,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
    };
  }

  if (isHovered) {
    return {
      ...base,
      background: 'rgba(0,99,124,0.06)',
      color: '#00637C',
    };
  }

  return base;
}

function NavItem({
  icon,
  label,
  to,
}: {
  icon: string;
  label: string;
  to: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <NavLink
      to={to}
      end={to === '/'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={({ isActive }) => navItemStyle(isActive, isHovered)}
    >
      <span
        style={{
          fontSize: '16px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        aria-hidden
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

export default function App() {
  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandName}>NOSYOR.M.I</div>
          <div style={styles.brandTagline}>Your money, reflected.</div>
        </div>

        <nav style={styles.nav}>
          <NavItem to="/" icon="⌂" label="Dashboard" />
          <NavItem to="/transactions" icon="▤" label="Transactions" />
          <NavItem to="/statements" icon="📁" label="Statements" />
          <NavItem to="/chat" icon="◉" label="NOSYOR.M.I Chat" />
        </nav>

        <div style={styles.version}>NOSYOR.M.I · v1.0</div>
      </aside>

      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/statements" element={<StatementsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/dashboard/:id" element={<StatementDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
