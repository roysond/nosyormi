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
import NosyormiLogo from './components/NosyormiLogo';
import { UploadProvider } from './components/UploadContext';
import { BRAND_TEAL_BASE, BRAND_TEAL_EDGE } from './constants/palette';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#FFFFFF',
    gap: '20px',
    padding: '0',
  },
  sidebar: {
    height: 'calc(100vh - 20px)',
    margin: '10px 0 10px 10px',
    background: '#E4E9F0',
    border: '1px solid #C8D1DC',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '28px 12px',
    boxSizing: 'border-box' as const,
    flexShrink: 0,
    transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
    overflow: 'visible',
    position: 'relative' as const,
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  },
  brand: {
    padding: '0 8px 24px',
    marginBottom: '32px',
  },
  brandName: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#124346',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'Urbanist, sans-serif',
  },
  brandTagline: {
    fontSize: '10px',
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
    height: 'calc(100vh - 20px)',
    margin: '10px 10px 10px 0',
    borderRadius: '16px',
    overflow: 'auto',
    background: '#E4E9F0',
    minWidth: 0,
    border: '1px solid #C8D1DC',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    isolation: 'isolate' as const,
  },
  version: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '11px',
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
    fontSize: '15px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#124346' : '#94A3B8',
    border: 'none',
    transition: 'all 0.15s ease',
    position: 'relative' as const,
  };

  if (isHovered && !isActive) {
    return { ...base, color: '#475569', background: 'rgba(0,0,0,0.04)' };
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
              width: 4,
              height: 28,
              borderRadius: '0 3px 3px 0',
              background: 'linear-gradient(180deg, #1A5E5A 0%, #124346 100%)',
              boxShadow: '2px 0 8px rgba(18,67,70,0.4)',
            }} aria-hidden />
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
              color: isActive ? '#124346' : '#94A3B8',
              filter: isActive ? 'drop-shadow(0 1px 4px rgba(18,67,70,0.3))' : 'none',
              transition: 'color 0.15s ease',
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
    <UploadProvider>
    <div style={styles.app}>
      <style>{`
  .nosyormi-main {
    scrollbar-width: thin;
    scrollbar-color: #C8D1DC transparent;
  }
  .nosyormi-main::-webkit-scrollbar {
    width: 5px;
  }
  .nosyormi-main::-webkit-scrollbar-track {
    background: transparent;
    margin-top: 16px;
    margin-bottom: 16px;
  }
  .nosyormi-main::-webkit-scrollbar-thumb {
    background: #C8D1DC;
    border-radius: 999px;
  }
  .nosyormi-main::-webkit-scrollbar-thumb:hover {
    background: #A8B5C4;
  }
`}</style>
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
            top: '72px',
            right: '-17px',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: BRAND_TEAL_BASE,
            border: '2px solid #ECEEF1',
            color: 'rgba(255,255,255,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '18px',
            zIndex: 50,
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            fontWeight: 700,
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>

        <div style={{ ...styles.brand, display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <NosyormiLogo size={52} showWordmark={false} />
          {!collapsed && (
            <div style={styles.brandName}>
              NOSYOR<span style={{ color: '#D4A843' }}>.</span>
              M<span style={{ color: '#D4A843' }}>.</span>I
            </div>
          )}
        </div>

        <nav style={styles.nav}>
          <NavItem to="/" icon={<IconLayoutDashboard size={22} />} label="Dashboard" collapsed={collapsed} />
          <NavItem to="/transactions" icon={<IconArrowsExchange size={22} />} label="Transactions" collapsed={collapsed} />
          <NavItem to="/statements" icon={<IconFileText size={22} />} label="Statements" collapsed={collapsed} />
          <NavItem to="/chat" icon={<IconMessageCircle size={22} />} label="Let's Reflect" collapsed={collapsed} />
        </nav>

        {!collapsed && <StatementPill />}

        {!collapsed && (
          <div style={styles.version}>NOSYOR.M.I · v1.0</div>
        )}
      </aside>

      <main style={styles.main} className="nosyormi-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/statements" element={<StatementsPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </main>
    </div>
    </UploadProvider>
  );
}
