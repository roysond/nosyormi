import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconArrowsExchange,
  IconFileText,
  IconMessageCircle,
} from '@tabler/icons-react';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import StatementsPage from './pages/StatementsPage';
import ChatPage from './pages/ChatPage';
import StatementDetailPage from './pages/StatementDetailPage';
import StatementPill from './components/StatementPill';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#CCE8EC',
  },
  sidebar: {
    height: '100vh',
    background: '#071A1E',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px 12px',
    boxSizing: 'border-box' as const,
    flexShrink: 0,
    transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  brand: {
    padding: '0 12px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    marginBottom: '16px',
  },
  brandName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#E8C96A',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap' as const,
  },
  brandTagline: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.3)',
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
    background: '#CCE8EC',
    minWidth: 0,
  },
  version: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.18)',
    padding: '0 12px',
    marginTop: 'auto',
  },
};

function navItemStyle(isActive: boolean, isHovered: boolean): CSSProperties {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '13.5px',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? '#E8C96A' : 'rgba(255,255,255,0.38)',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
    textShadow: isActive
      ? '0 0 10px rgba(232,201,106,0.55), 0 0 22px rgba(232,201,106,0.15)'
      : 'none',
  };

  if (isActive) {
    return {
      ...base,
      background: 'linear-gradient(90deg, rgba(0,99,124,0.45) 0%, rgba(201,168,76,0.07) 100%)',
    };
  }

  if (isHovered) {
    return {
      ...base,
      background: 'rgba(255,255,255,0.05)',
      color: 'rgba(255,255,255,0.65)',
    };
  }

  return base;
}

function NavItem({
  icon,
  label,
  to,
  collapsed,
}: {
  icon: ReactNode;
  label: string;
  to: string;
  collapsed: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <NavLink
      to={to}
      end={to === '/'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={({ isActive }) => ({
        ...navItemStyle(isActive, isHovered),
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px' : '10px 14px',
        position: 'relative',
      })}
    >
      {({ isActive }) => (
        <>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
              color: isActive ? '#34D399' : 'rgba(255,255,255,0.38)',
              filter: isActive
                ? 'drop-shadow(0 0 5px rgba(52,211,153,0.9)) drop-shadow(0 0 12px rgba(52,211,153,0.4))'
                : 'none',
              transition: 'color 0.15s ease, filter 0.15s ease',
            }}
            aria-hidden
          >
            {icon}
          </span>
          {!collapsed && (
            <span style={{ flex: 1 }}>{label}</span>
          )}
          {collapsed && isHovered && (
            <span
              style={{
                position: 'fixed',
                left: '76px',
                background: '#0F2D33',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '12px',
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                animation: 'tooltipFadeIn 0.15s ease forwards',
                zIndex: 100,
              }}
            >
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={styles.app}>
      <aside
        style={{
          ...styles.sidebar,
          width: collapsed ? '64px' : '220px',
          minWidth: collapsed ? '64px' : '220px',
          maxWidth: collapsed ? '64px' : '220px',
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            position: 'absolute',
            top: '24px',
            right: '-12px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#1A3A42',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '11px',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(52,211,153,0.15)',
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>

        {!collapsed && (
          <div style={styles.brand}>
            <div style={styles.brandName}>NOSYOR.M.I</div>
            <div style={styles.brandTagline}>Your money, reflected.</div>
          </div>
        )}

        <nav style={styles.nav}>
          <NavItem to="/" icon={<IconLayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} />
          <NavItem to="/transactions" icon={<IconArrowsExchange size={18} />} label="Transactions" collapsed={collapsed} />
          <NavItem to="/statements" icon={<IconFileText size={18} />} label="Statements" collapsed={collapsed} />
          <NavItem to="/chat" icon={<IconMessageCircle size={18} />} label="NOSYOR.M.I Chat" collapsed={collapsed} />
        </nav>

        {!collapsed && <StatementPill />}

        {!collapsed && (
          <div style={styles.version}>NOSYOR.M.I · v1.0</div>
        )}
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
