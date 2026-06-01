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
import StatementPill from './components/StatementPill';
import { BRAND_TEAL_BASE, BRAND_TEAL_EDGE } from './constants/palette';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#ECEEF1',
  },
  sidebar: {
    height: 'calc(100vh - 20px)',
    margin: '10px',
    background: '#FFFFFF',
    border: '0.5px solid #E6E6E6',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '20px 12px',
    boxSizing: 'border-box' as const,
    flexShrink: 0,
    transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
    overflow: 'visible',
    position: 'relative' as const,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  },
  brand: {
    padding: '0 8px 20px',
    marginBottom: '8px',
  },
  brandName: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#124346',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap' as const,
  },
  brandTagline: {
    fontSize: '10px',
    color: '#B8B8B8',
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
    background: '#F4F7F9',
    minWidth: 0,
  },
  version: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '9px',
    color: '#CDCDCD',
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
    fontSize: '14.5px',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? '#111111' : '#B0B0B0',
    border: 'none',
    transition: 'all 0.15s ease',
    position: 'relative' as const,
  };

  if (isHovered && !isActive) {
    return { ...base, color: '#555555', background: 'rgba(0,0,0,0.03)' };
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
        padding: collapsed ? '10px 0' : '10px 14px',
        width: collapsed ? '100%' : undefined,
        position: 'relative',
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span style={{
              position: 'absolute',
              left: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 18,
              borderRadius: '0 3px 3px 0',
              background: 'linear-gradient(180deg, #1A5E5A, #124346)',
            }} aria-hidden />
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
              color: isActive ? '#124346' : '#CACACA',
              filter: 'none',
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
                background: BRAND_TEAL_EDGE,
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
            top: '28px',
            right: '-16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: BRAND_TEAL_BASE,
            border: '2px solid #ECEEF1',
            color: 'rgba(255,255,255,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '13px',
            zIndex: 50,
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            fontWeight: 700,
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>

        {collapsed ? (
          <div style={{ ...styles.brand, visibility: 'hidden' }} aria-hidden>
            <div style={styles.brandName}>NOSYOR.M.I</div>
            <div style={styles.brandTagline}>Your money, reflected.</div>
          </div>
        ) : (
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
        </Routes>
      </main>
    </div>
  );
}
