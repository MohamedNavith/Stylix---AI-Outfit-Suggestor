import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Layers, Droplet, Send, Sparkles, LogOut, 
  Settings, User, Check, X, Shield, RefreshCw, Cpu
} from 'lucide-react';
import RoutinePlan from './components/RoutinePlan';
import WardrobeCatalog from './components/WardrobeCatalog';
import LaundryHub from './components/LaundryHub';

const API_HOST = "http://127.0.0.1:8000";

function StylixLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M 70 6 C 70 -4, 56 -4, 52 6 C 48 16, 58 24, 70 24 C 92 24, 92 52, 70 52 C 40 52, 12 52, 12 78 C 12 100, 34 112, 70 112 C 106 112, 128 100, 128 78" 
        stroke="var(--accent)" 
        strokeWidth="10" 
        strokeLinecap="round" 
      />
      <circle cx="52" cy="8" r="8" fill="var(--text-primary)" />
    </svg>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('stylix_user') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('stylix_role') || '');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('stylix_theme') || 'classic');
  const [laundryStatsTrigger, setLaundryStatsTrigger] = useState(0);
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsMobile, setSettingsMobile] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Chatbot State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      // Re-apply theme configuration saved
      changeTheme(theme);
    }
  }, [currentUser]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Load chat history from backend on chat drawer open
  useEffect(() => {
    if (showChat && currentUser) {
      fetchChatHistory();
    }
  }, [showChat, currentUser]);

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`${API_HOST}/api/chat/history?username=${encodeURIComponent(currentUser)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setChatMessages(data);
        } else {
          setChatMessages([
            { sender: 'assistant', text: `Welcome back, @${currentUser}! I'm your Stylix AI coach. Ask me what clean clothes you have or get outfit recommendations!` }
          ]);
        }
      }
    } catch (e) {
      console.error("Error loading chat history:", e);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) {
      setAuthError("Please fill in all fields.");
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    
    try {
      const res = await fetch(`${API_HOST}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      
      const data = await res.json();
      if (res.ok) {
        if (isLogin) {
          localStorage.setItem('stylix_user', data.username);
          localStorage.setItem('stylix_role', data.role);
          localStorage.setItem('stylix_theme', data.theme || 'classic');
          setCurrentUser(data.username);
          setUserRole(data.role);
          setTheme(data.theme || 'classic');
          setSettingsEmail(data.email || '');
          setSettingsMobile(data.mobile || '');
          setWhatsappLinked(data.whatsapp_linked || false);
          setTelegramLinked(data.telegram_linked || false);
        } else {
          alert("Account created! Please sign in.");
          setIsLogin(true);
          setUsernameInput(data.username || usernameInput);
          setPasswordInput('');
        }
      } else {
        setAuthError(data.detail || "Authentication failed.");
      }
    } catch (err) {
      console.error(err);
      setAuthError("Could not reach Stylix server. Is the backend running?");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stylix_user');
    localStorage.removeItem('stylix_role');
    localStorage.removeItem('stylix_theme');
    setCurrentUser('');
    setUserRole('');
    setShowSettings(false);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const updates = {
        email: settingsEmail,
        mobile: settingsMobile,
        theme: theme,
        whatsapp_linked: whatsappLinked,
        telegram_linked: telegramLinked
      };
      if (settingsPassword) {
        updates.password = settingsPassword;
      }
      
      const res = await fetch(`${API_HOST}/api/profile/update?username=${encodeURIComponent(currentUser)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        alert("Settings saved successfully!");
        setSettingsPassword('');
        setShowSettings(false);
      } else {
        alert("Failed to save settings.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, message: userMsg })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { sender: 'assistant', text: "Sorry, I encountered an error linking to my style database." }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { sender: 'assistant', text: "Network error. Make sure the Stylix backend server is running." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('stylix_theme', newTheme);
    if (newTheme === 'classic') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  const quickFillAdmin = () => {
    setUsernameInput('admin');
    setPasswordInput('admin123');
    setIsLogin(true);
  };

  // Auth Screen
  if (!currentUser) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden', padding: '20px'
      }}>
        <div className="app-bg-overlay" />
        <div className="glowing-blob" />

        <div className="glass-panel animate-scale" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', marginBottom: '12px' }}>
              <StylixLogo size={48} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-sans)', color: '#FFF' }}>Stylix</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
              Real-time multi-agent wardrobe planning
            </p>
          </div>

          {authError && (
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '8px',
              color: '#EF4444', fontSize: '0.85rem', marginBottom: '20px'
            }}>
              <X size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                disabled={authLoading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                disabled={authLoading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '8px', background: 'linear-gradient(135deg, #B794F4 0%, #805AD5 100%)', color: 'white' }}>
              {authLoading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span 
              onClick={() => { setIsLogin(!isLogin); setAuthError(''); }}
              style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isLogin ? "Need a new account? Sign Up" : "Already have an account? Sign In"}
            </span>
          </div>

          <div style={{ 
            marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', 
            textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' 
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Super Admin Account</span>
            <button 
              onClick={quickFillAdmin} 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.75rem', justifyContent: 'center' }}
            >
              Fill Admin Credentials
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      
      {/* 1. PC SIDEBAR NAVIGATION & SYSTEM HEARTBEAT */}
      <div className="pc-sidebar" style={{
        width: '280px', 
        borderRight: '1px solid var(--border-color)', 
        background: 'var(--bg-secondary)', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '24px', 
        gap: '24px',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 80
      }}>
        {/* App Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StylixLogo size={36} />
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFF' }}>Stylix</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Real-time Coordinated</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="btn-secondary"
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'dashboard' ? 'var(--accent-glow)' : 'transparent',
              borderColor: activeTab === 'dashboard' ? 'var(--border-accent)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--accent)' : 'var(--text-primary)'
            }}
          >
            <Calendar size={16} /> Planner
          </button>
          <button 
            onClick={() => setActiveTab('catalog')}
            className="btn-secondary"
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'catalog' ? 'var(--accent-glow)' : 'transparent',
              borderColor: activeTab === 'catalog' ? 'var(--border-accent)' : 'transparent',
              color: activeTab === 'catalog' ? 'var(--accent)' : 'var(--text-primary)'
            }}
          >
            <Layers size={16} /> Wardrobe
          </button>
          <button 
            onClick={() => setActiveTab('laundry')}
            className="btn-secondary"
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'laundry' ? 'var(--accent-glow)' : 'transparent',
              borderColor: activeTab === 'laundry' ? 'var(--border-accent)' : 'transparent',
              color: activeTab === 'laundry' ? 'var(--accent)' : 'var(--text-primary)'
            }}
          >
            <Droplet size={16} /> Laundry Pool
          </button>
        </nav>

        {/* AI AGENT MONITORING SYSTEM HEARTBEAT */}
        <div style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              System Heartbeat
            </span>
          </div>

          {/* Central Pulsing Heart (Orchestrator) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px' }}>
            <div className="heartbeat-container" style={{ animation: 'pulsate 1.2s infinite ease-in-out' }}>
              ❤️
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#FFF' }}>Coordinator Agent</span>
              <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 600 }}>Active Orchestrating</span>
            </div>
          </div>

          {/* Breathing dots for secondary agents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.7rem' }}>
            {[
              "Context Agent", "Style Agent", "Cataloging Agent", 
              "Outfit Matcher", "Feedback Agent", "Laundry Agent"
            ].map(agent => (
              <div key={agent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{agent}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="breathing-dot" style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: '#10B981',
                    boxShadow: '0 0 8px #10B981', animation: 'breath 2s infinite ease-in-out'
                  }} />
                  <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.6rem' }}>Standby</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC CONTENT AREA */}
      <div style={{
        marginLeft: '280px',
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: 'calc(100% - 280px)'
      }} className="content-frame">
        
        {/* Top Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 70,
          background: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-color)',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Real-time Stylix Cloud Engine</h2>
          </div>

          {/* Profile Details Trigger (Top Right) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div 
              onClick={() => setShowSettings(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
              className="hover:opacity-80"
            >
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
              }}>
                <User size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFF' }}>@{currentUser}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Settings</span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              style={{ 
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', 
                borderRadius: '8px', width: '32px', height: '32px', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', color: '#EF4444', cursor: 'pointer' 
              }}
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Content body */}
        <main style={{ flexGrow: 1, padding: '24px 32px 40px 32px', maxWidth: '1000px', width: '100%', alignSelf: 'center' }}>
          {activeTab === 'dashboard' && <RoutinePlan apiHost={API_HOST} username={currentUser} onStatsChange={() => setLaundryStatsTrigger(prev => prev + 1)} />}
          {activeTab === 'catalog' && <WardrobeCatalog apiHost={API_HOST} username={currentUser} onStatsChange={() => setLaundryStatsTrigger(prev => prev + 1)} />}
          {activeTab === 'laundry' && <LaundryHub apiHost={API_HOST} username={currentUser} stats={laundryStatsTrigger} onStatsChange={() => setLaundryStatsTrigger(prev => prev + 1)} />}
        </main>
      </div>

      {/* 3. AI CHATBOT SPARKLE BUTTON */}
      <div className="chat-fab" onClick={() => setShowChat(!showChat)} style={{ bottom: '24px' }}>
        {showChat ? <X size={22} /> : <Sparkles size={22} />}
      </div>

      {/* 4. CHAT BOT DRAWER */}
      {showChat && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', width: '90%', maxWidth: '360px',
          height: '460px', borderRadius: '16px', display: 'flex', flexDirection: 'column',
          backgroundColor: '#13111C', border: '1px solid var(--border-accent)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', zIndex: 110, overflow: 'hidden'
        }} className="animate-fade-up">
          <div style={{ 
            padding: '14px 16px', borderBottom: '1px solid var(--border-color)', 
            background: 'linear-gradient(135deg, #805AD5 0%, #553C9A 100%)', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#FFF' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Stylix AI Stylist</span>
            </div>
            <button onClick={() => setShowChat(false)} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages body */}
          <div style={{ flexGrow: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatMessages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              return (
                <div 
                  key={index} 
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    backgroundColor: isUser ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                    color: isUser ? 'var(--bg-primary)' : 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.4
                  }}
                >
                  {msg.text}
                </div>
              );
            })}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '12px 12px 12px 0', backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Stylix AI is typing...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChatMessage} style={{ display: 'flex', padding: '10px', borderTop: '1px solid var(--border-color)', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Ask Stylix AI..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
              style={{
                flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: '8px', 
                padding: '8px 12px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', color: '#FFF', outline: 'none'
              }}
            />
            <button 
              type="submit" 
              style={{
                width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent)', 
                color: 'var(--bg-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
              disabled={chatLoading}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* 5. USER SETTINGS & PROFILE MODAL (SLIDEOUT PANEL) */}
      {showSettings && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'flex-end',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <form 
            onSubmit={handleSaveSettings}
            className="glass-panel" 
            style={{ 
              width: '90%', maxWidth: '420px', height: '100%', borderRadius: 0, 
              padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
              overflowY: 'auto', background: '#0F0E17', animation: 'fadeInUp 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF' }}>Settings</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Account Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Profile</span>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@domain.com"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mobile Number (WhatsApp Link)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. +919876543210"
                  value={settingsMobile}
                  onChange={(e) => setSettingsMobile(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Change Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter new password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Messaging Link Integration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Messaging integrations</span>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '12px' }}>
                <div style={{ flexGrow: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#FFF' }}>WhatsApp Link</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Chat with wardrobe via WhatsApp</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={whatsappLinked} 
                  onChange={(e) => setWhatsappLinked(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyBetween: 'space-between', gap: '12px', marginTop: '6px' }}>
                <div style={{ flexGrow: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#FFF' }}>Telegram Link</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sync wardrobe queries with Telegram Bot</span>
                  {telegramLinked && (
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--accent)', marginTop: '4px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      Instructions: Message <code>/start {currentUser}</code> to <code>@StylixStylistBot</code> to link bot.
                    </span>
                  )}
                </div>
                <input 
                  type="checkbox" 
                  checked={telegramLinked} 
                  onChange={(e) => setTelegramLinked(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '3px' }}
                />
              </div>
            </div>

            {/* Custom Theme Switcher */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Theme Customizer</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button type="button" onClick={() => changeTheme('classic')} style={{ background: '#0b0f19', border: theme === 'classic' ? '2px solid #B794F4' : '1px solid var(--border-color)', borderRadius: '8px', height: '32px', color: '#FFF', fontSize: '0.75rem', cursor: 'pointer' }}>Classic Dark</button>
                <button type="button" onClick={() => changeTheme('cyber')} style={{ background: '#080C14', border: theme === 'cyber' ? '2px solid #10B981' : '1px solid var(--border-color)', borderRadius: '8px', height: '32px', color: '#FFF', fontSize: '0.75rem', cursor: 'pointer' }}>Cyber Green</button>
                <button type="button" onClick={() => changeTheme('gold')} style={{ background: '#0E0B09', border: theme === 'gold' ? '2px solid #D97706' : '1px solid var(--border-color)', borderRadius: '8px', height: '32px', color: '#FFF', fontSize: '0.75rem', cursor: 'pointer' }}>Sunrise Gold</button>
                <button type="button" onClick={() => changeTheme('light-minimal')} style={{ background: '#f8fafc', border: theme === 'light-minimal' ? '2px solid #2563eb' : '1px solid var(--border-color)', borderRadius: '8px', height: '32px', color: '#000', fontSize: '0.75rem', cursor: 'pointer' }}>Light Minimal</button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', marginTop: 'auto', background: 'linear-gradient(135deg, #B794F4 0%, #805AD5 100%)', color: 'white' }}
              disabled={settingsSaving}
            >
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* 6. STYLE CUSTOM CSS WRAPPERS FOR PULSATING/BREATHING SYMBOLS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulsate {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.4)); }
          100% { transform: scale(1); }
        }
        @keyframes breath {
          0% { opacity: 0.4; }
          50% { opacity: 1; filter: drop-shadow(0 0 4px #10B981); }
          100% { opacity: 0.4; }
        }
        @media (max-width: 768px) {
          .pc-sidebar { display: none !important; }
          .content-frame { margin-left: 0 !important; width: 100% !important; }
        }
      `}} />

    </div>
  );
}
