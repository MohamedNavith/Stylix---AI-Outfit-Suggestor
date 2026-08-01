import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Layers, Droplet, Send, Sparkles, LogOut, 
  Settings, User, Check, X, Shield, RefreshCw, Cpu, Cake,
  Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import RoutinePlan from './components/RoutinePlan';
import WardrobeCatalog from './components/WardrobeCatalog';
import LaundryHub from './components/LaundryHub';
import AdminPanel from './components/AdminPanel';
import { BUILD_ID } from './version';

let API_HOST = import.meta.env.VITE_API_URL;
if (!API_HOST) {
  if (window.location.hostname.includes("vercel.app")) {
    const parts = window.location.hostname.split("-");
    if (parts.length > 0) {
      API_HOST = `${parts[0]}-backend.vercel.app`;
    }
  } else if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    if (window.Capacitor || window.location.protocol === 'capacitor:' || !window.location.port) {
      API_HOST = "https://stylix-backend.vercel.app";
    } else {
      API_HOST = "http://127.0.0.1:8000";
    }
  } else {
    API_HOST = "https://stylix-backend.vercel.app";
  }
}
if (API_HOST && !API_HOST.startsWith("http://") && !API_HOST.startsWith("https://")) {
  API_HOST = `https://${API_HOST}`;
}

function StylixLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="115" fill="#0B0D12"/>
      <path 
        d="M256 140 C270 140 280 152 280 168 C280 185 260 195 240 205 L200 220 C180 230 170 250 170 270 C170 305 205 320 256 320 C307 320 342 305 342 270" 
        stroke="#E6CA65" 
        strokeWidth="20" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
};

const removeCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

const parseBirthdayInput = (val) => {
  if (!val) return "2000-01-01";
  const clean = val.trim();
  const matchDMY = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`;
  }
  const matchYMD = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2]}-${matchYMD[3]}`;
  }
  return clean;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('stylix_user') || getCookie('stylix_user') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('stylix_role') || getCookie('stylix_role') || '');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('stylix_theme') || getCookie('stylix_theme') || 'classic');
  const [laundryStatsTrigger, setLaundryStatsTrigger] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  
  // Voice Synthesis and Speech Recognition states
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('stylix_voice_enabled') === 'true' || getCookie('stylix_voice_enabled') === 'true');
  
  // Onboarding / Sign up attributes
  const [nameInput, setNameInput] = useState('');
  const [birthdayInput, setBirthdayInput] = useState('');
  const [genderInput, setGenderInput] = useState('male');
  
  // Birthday Alert Notification
  const [birthdayAlert, setBirthdayAlert] = useState(null);

  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsBirthday, setSettingsBirthday] = useState('');
  const [settingsGender, setSettingsGender] = useState('male');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsMobile, setSettingsMobile] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // App Update State
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersionId, setLatestVersionId] = useState('');

  // Admin Inspect Mode State
  const [inspectUser, setInspectUser] = useState(null);

  // Chatbot State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const fetchAppWardrobe = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_HOST}/api/wardrobe?username=${encodeURIComponent(currentUser)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWardrobeItems(data);
      }
    } catch (e) {
      console.error("Error loading wardrobe items for chatbot scanning:", e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAppWardrobe();
    }
  }, [currentUser, laundryStatsTrigger]);

  const formatChatMessage = (text) => {
    if (!text) return "";
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      let content = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      let parts = [];
      let lastIndex = 0;
      let match;
      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }
      
      const trimmed = content.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        return (
          <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '8px', margin: '4px 0', alignItems: 'flex-start' }}>
            <span>•</span>
            <div>{parts.length > 0 ? parts : trimmed.substring(2)}</div>
          </div>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        return (
          <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '8px', margin: '4px 0', alignItems: 'flex-start' }}>
            <span>{numMatch[1]}.</span>
            <div>{numMatch[2]}</div>
          </div>
        );
      }
      
      return <p key={idx} style={{ margin: '4px 0', minHeight: '1em' }}>{parts.length > 0 ? parts : content}</p>;
    });
  };

  useEffect(() => {
    if (currentUser) {
      changeTheme(theme);
      checkBirthdayAlert();
    }
  }, [currentUser]);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        let originUrl = window.location.origin;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'capacitor:') {
          if (API_HOST.includes('-backend.vercel.app')) {
            originUrl = API_HOST.replace('-backend.vercel.app', '.vercel.app');
          } else {
            originUrl = 'https://stylix-ai-outfit-suggestor.vercel.app';
          }
        }

        const res = await fetch(`${originUrl}/version.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version !== BUILD_ID) {
            setUpdateAvailable(true);
            setLatestVersionId(data.version);
          }
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    };

    checkUpdates();
    const interval = setInterval(checkUpdates, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  useEffect(() => {
    if (showChat && currentUser) {
      fetchChatHistory();
    }
  }, [showChat, currentUser]);

  const checkBirthdayAlert = async () => {
    try {
      const res = await fetch(`${API_HOST}/api/notifications/birthday?username=${encodeURIComponent(currentUser)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.is_birthday) {
          setBirthdayAlert(data.message);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`${API_HOST}/api/chat/history?username=${encodeURIComponent(currentUser)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setChatMessages(data);
        } else {
          setChatMessages([
            { sender: 'assistant', text: `Welcome back, ${localStorage.getItem('stylix_name') || currentUser}! I'm your StylixAi coach. Ask me what clean clothes you have or get outfit recommendations!` }
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
    const payload = isLogin 
      ? { username: usernameInput, password: passwordInput }
      : { 
          username: usernameInput, 
          password: passwordInput,
          name: nameInput || usernameInput,
          birthday: parseBirthdayInput(birthdayInput),
          gender: genderInput
        };
    
    try {
      const res = await fetch(`${API_HOST}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        if (isLogin) {
          localStorage.setItem('stylix_user', data.username);
          localStorage.setItem('stylix_role', data.role);
          localStorage.setItem('stylix_theme', data.theme || 'classic');
          localStorage.setItem('stylix_gender', data.gender || 'male');
          localStorage.setItem('stylix_name', data.name || data.username);
          localStorage.setItem('stylix_birthday', data.birthday || '2000-01-01');
          localStorage.setItem('stylix_token', data.token);

          setCookie('stylix_user', data.username);
          setCookie('stylix_role', data.role);
          setCookie('stylix_theme', data.theme || 'classic');
          setCookie('stylix_gender', data.gender || 'male');
          setCookie('stylix_name', data.name || data.username);
          setCookie('stylix_birthday', data.birthday || '2000-01-01');
          setCookie('stylix_token', data.token);

          setCurrentUser(data.username);
          setUserRole(data.role);
          setTheme(data.theme || 'classic');
          setSettingsName(data.name || data.username);
          setSettingsBirthday(data.birthday || '2000-01-01');
          setSettingsGender(data.gender || 'male');
          setSettingsEmail(data.email || '');
          setSettingsMobile(data.mobile || '');
          setWhatsappLinked(data.whatsapp_linked || false);
          setTelegramLinked(data.telegram_linked || false);
        } else {
          alert("Account created! Please sign in.");
          setIsLogin(true);
          setUsernameInput(usernameInput);
          setPasswordInput('');
        }
      } else {
        setAuthError(data.detail || "Authentication failed.");
      }
    } catch (err) {
      console.error(err);
      setAuthError("Could not reach StylixAi server. Is the backend running?");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stylix_user');
    localStorage.removeItem('stylix_role');
    localStorage.removeItem('stylix_theme');
    localStorage.removeItem('stylix_gender');
    localStorage.removeItem('stylix_name');
    localStorage.removeItem('stylix_birthday');
    
    removeCookie('stylix_user');
    removeCookie('stylix_role');
    removeCookie('stylix_theme');
    removeCookie('stylix_gender');
    removeCookie('stylix_name');
    removeCookie('stylix_birthday');
    removeCookie('stylix_voice_enabled');

    setCurrentUser('');
    setUserRole('');
    setBirthdayAlert(null);
    setShowSettings(false);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const parsedBday = parseBirthdayInput(settingsBirthday);
      const updates = {
        name: settingsName,
        birthday: parsedBday,
        gender: settingsGender,
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        localStorage.setItem('stylix_name', settingsName);
        localStorage.setItem('stylix_gender', settingsGender);
        localStorage.setItem('stylix_birthday', parsedBday);
        
        setCookie('stylix_name', settingsName);
        setCookie('stylix_gender', settingsGender);
        setCookie('stylix_birthday', parsedBday);

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

  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported on this browser or webview. Try Google Chrome!");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    // Auto-resolve locale, support dynamic multilingual voice
    recognition.lang = localStorage.getItem('stylix_lang') || navigator.language || 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  const toggleVoicePlayback = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    localStorage.setItem('stylix_voice_enabled', nextVal ? 'true' : 'false');
    setCookie('stylix_voice_enabled', nextVal ? 'true' : 'false');
    if (!nextVal && window.speechSynthesis) {
      window.speechSynthesis.cancel();
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
        },
        body: JSON.stringify({ username: currentUser, message: userMsg })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
        
        // Dynamic Speech Synthesis (speak responses aloud if enabled)
        if (voiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const cleanText = data.response
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/[*#`_\-]/g, "")
            .replace(/•/g, "");
          const utterance = new SpeechSynthesisUtterance(cleanText);
          window.speechSynthesis.speak(utterance);
        }
      } else {
        setChatMessages(prev => [...prev, { sender: 'assistant', text: "Sorry, I encountered an error linking to my style database." }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { sender: 'assistant', text: "Network error. Make sure the StylixAi backend server is running." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const changeTheme = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('stylix_theme', newTheme);
    setCookie('stylix_theme', newTheme);
    if (newTheme === 'classic') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    if (currentUser) {
      try {
        await fetch(`${API_HOST}/api/profile/update?username=${encodeURIComponent(currentUser)}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
          },
          body: JSON.stringify({ theme: newTheme })
        });
      } catch (err) {
        console.error("Theme sync failed:", err);
      }
    }
  };



  // Auth Screen
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', width: '100%', background: 'var(--bg-primary)' }}>
        {updateAvailable && (
          <div style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
            color: '#FFF',
            padding: '10px 20px',
            textAlign: 'center',
            zIndex: 9999,
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span>🔔 A new version of StylixAi is available! Your code changes are live.</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => window.location.reload(true)} 
                style={{
                  background: '#FFF',
                  color: '#059669',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} /> Update Web
              </button>
              <a 
                href="/stylix.apk" 
                download="stylix.apk"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#FFF',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Cpu size={12} /> Download Updated APK
              </a>
            </div>
          </div>
        )}
        <div style={{
          flexGrow: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'center', alignItems: 'center', gap: isMobile ? '24px' : '48px',
          position: 'relative', overflow: 'hidden', padding: isMobile ? '24px 16px' : '48px',
          maxWidth: '1100px', margin: '0 auto', width: '100%'
        }}>
          <div className="app-bg-overlay" />
          <div className="glowing-blob" />

          {/* Left Panel: Value Proposition */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', textAlign: isMobile ? 'center' : 'left',
            maxWidth: '500px', color: 'var(--text-primary)', padding: '8px'
          }}>
            <div style={{ display: 'inline-flex', justifyContent: isMobile ? 'center' : 'flex-start', marginBottom: '16px' }}>
              <StylixLogo size={56} />
            </div>
            <h1 style={{
              fontSize: isMobile ? '1.8rem' : '2.4rem', fontWeight: 700,
              color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '16px'
            }}>
              Your AI stylist — turn one item into a full outfit in seconds
            </h1>
            <p style={{
              fontSize: '1rem', color: 'var(--text-secondary)',
              lineHeight: 1.5, marginBottom: '24px'
            }}>
              Get personalized wardrobe suggestions, manage laundry cycles, and look your best every single day. Digitized, organized, and styled by AI.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <Sparkles size={16} />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>AI-driven daily outfit planners</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <Layers size={16} />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>Smart wardrobe cataloging</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <Droplet size={16} />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>Automatic laundry and rotation tracking</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Login Card */}
          <div className="glass-panel animate-scale" style={{ width: '100%', maxWidth: '400px', padding: '32px', zIndex: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                {isLogin ? "Sign in to access your wardrobe" : "Fill out details to get started"}
              </p>
            </div>

            {authError && (
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(214, 69, 69, 0.1)',
                border: '1px solid rgba(214, 69, 69, 0.2)', padding: '10px 14px', borderRadius: '8px',
                color: 'var(--error)', fontSize: '0.85rem', marginBottom: '20px'
              }}>
                <X size={16} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isLogin && (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter full name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      disabled={authLoading}
                      style={{ marginTop: '4px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Birthday</label>
                    <input 
                      type="text" 
                      placeholder="DD-MM-YYYY or YYYY-MM-DD"
                      className="form-input" 
                      value={birthdayInput}
                      onChange={(e) => setBirthdayInput(e.target.value)}
                      disabled={authLoading}
                      style={{ marginTop: '4px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Gender</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <input 
                          type="radio" 
                          name="gender" 
                          value="male" 
                          checked={genderInput === 'male'} 
                          onChange={() => setGenderInput('male')}
                          style={{ accentColor: 'var(--accent)' }}
                        /> Male
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <input 
                          type="radio" 
                          name="gender" 
                          value="female" 
                          checked={genderInput === 'female'} 
                          onChange={() => setGenderInput('female')}
                          style={{ accentColor: 'var(--accent)' }}
                        /> Female
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  disabled={authLoading}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  disabled={authLoading}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '8px', background: 'var(--accent)', color: 'white', padding: '12px 24px', fontSize: '0.95rem' }}>
                {authLoading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Complete Registration'}
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

            {isLogin && (
              <div style={{ 
                marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', 
                textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' 
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Mobile App</span>
                  <a 
                    href="/stylix.apk" 
                    download="stylix.apk"
                    className="btn-primary" 
                    style={{ 
                      padding: '10px 16px', 
                      fontSize: '0.85rem', 
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: 'white',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    <Cpu size={14} /> Download Android App (APK)
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {updateAvailable && (
        <div style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
          color: '#FFF',
          padding: '10px 20px',
          textAlign: 'center',
          zIndex: 9999,
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '15px',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span>🔔 A new version of StylixAi is available! Your code changes are live.</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => window.location.reload(true)} 
              style={{
                background: '#FFF',
                color: '#059669',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} /> Update Web
            </button>
            <a 
              href="/stylix.apk" 
              download="stylix.apk"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#FFF',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Cpu size={12} /> Download Updated APK
            </a>
          </div>
        </div>
      )}      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      
      {/* 1. PC SIDEBAR NAVIGATION & SYSTEM HEARTBEAT */}
      {!isMobile && (
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
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, fontFamily: "Georgia, serif", color: 'var(--text-primary)' }}>StylixAi</h1>
              <span style={{ fontSize: '0.55rem', color: '#cca43b', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>Dress. Wear. Repeat Never.</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button 
              onClick={() => { setActiveTab('dashboard'); setShowChat(false); }}
              className="btn-secondary"
              style={{ 
                justifyContent: 'flex-start', 
                background: activeTab === 'dashboard' && !showChat ? 'var(--accent-glow)' : 'transparent',
                borderColor: activeTab === 'dashboard' && !showChat ? 'var(--border-accent)' : 'transparent',
                color: activeTab === 'dashboard' && !showChat ? 'var(--accent)' : 'var(--text-primary)'
              }}
            >
              <Calendar size={16} /> Planner
            </button>
            <button 
              onClick={() => { setActiveTab('catalog'); setShowChat(false); }}
              className="btn-secondary"
              style={{ 
                justifyContent: 'flex-start', 
                background: activeTab === 'catalog' && !showChat ? 'var(--accent-glow)' : 'transparent',
                borderColor: activeTab === 'catalog' && !showChat ? 'var(--border-accent)' : 'transparent',
                color: activeTab === 'catalog' && !showChat ? 'var(--accent)' : 'var(--text-primary)'
              }}
            >
              <Layers size={16} /> Wardrobe
            </button>
            <button 
              onClick={() => { setActiveTab('laundry'); setShowChat(false); }}
              className="btn-secondary"
              style={{ 
                justifyContent: 'flex-start', 
                background: activeTab === 'laundry' && !showChat ? 'var(--accent-glow)' : 'transparent',
                borderColor: activeTab === 'laundry' && !showChat ? 'var(--border-accent)' : 'transparent',
                color: activeTab === 'laundry' && !showChat ? 'var(--accent)' : 'var(--text-primary)'
              }}
            >
              <Droplet size={16} /> Laundry Pool
            </button>
            {userRole === 'admin' && (
              <button 
                onClick={() => { setActiveTab('admin'); setShowChat(false); }}
                className="btn-secondary"
                style={{ 
                  justifyContent: 'flex-start', 
                  background: activeTab === 'admin' ? 'var(--accent-glow)' : 'transparent',
                  borderColor: activeTab === 'admin' ? 'var(--border-accent)' : 'transparent',
                  color: activeTab === 'admin' ? 'var(--accent)' : 'var(--text-primary)'
                }}
              >
                <Shield size={16} /> Admin Panel
              </button>
            )}
            <a 
              href={`https://t.me/stylixAi_Bot?start=${currentUser}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start', 
                gap: '8px',
                background: 'transparent',
                borderColor: 'transparent',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.85rem'
              }}
            >
              <Send size={16} style={{ color: '#0088cc' }} /> <span>Telegram Bot</span>
            </a>
          </nav>

          {/* Consolidated Agent Heartbeats */}
          <div style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#cca43b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
              🤖 System Agents Network
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
              {[
                "Coordinator Agent", "Stylist Agent", "Wardrobe Agent"
              ].map(agent => (
                <button 
                  key={agent}
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px', padding: '8px 10px', color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  className="hover:border-accent"
                >
                  <span style={{ fontWeight: 600 }}>{agent}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div className="breathing-dot" style={{
                      width: '5px', height: '5px', borderRadius: '50%', background: '#10B981',
                      boxShadow: '0 0 6px #10B981'
                    }} />
                    <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.65rem' }}>ACTIVE</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. DYNAMIC CONTENT AREA */}
      <div style={{
        marginLeft: isMobile ? '0' : '280px',
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
        width: isMobile ? '100%' : 'calc(100% - 280px)',
        paddingBottom: isMobile ? '85px' : '0'
      }} className="content-frame">
        
        {/* Top Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 70,
          background: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-color)',
          padding: isMobile ? '12px 16px' : '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StylixLogo size={32} />
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: "Georgia, serif", color: 'var(--text-primary)', margin: 0 }}>StylixAi</h1>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>StylixAi 24/7 Wardrobe Orchestrator</h2>
            </div>
          )}

          {/* Profile Details Trigger (Top Right) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {!isMobile && (
              <a 
                href={`https://t.me/stylixAi_Bot?start=${currentUser}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0088cc 0%, #0077b5 100%)',
                  color: '#FFF',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(0, 136, 204, 0.2)',
                  transition: 'transform 0.2s, opacity 0.2s',
                  marginRight: '6px'
                }}
                className="hover-scale"
              >
                <Send size={14} />
                <span>Telegram Bot</span>
              </a>
            )}
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
              {!isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{localStorage.getItem('stylix_name') || currentUser}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Settings</span>
                </div>
              )}
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
          
          {/* Birthday celebration card banner */}
          {birthdayAlert && (
            <div className="glass-panel animate-scale" style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(183, 148, 244, 0.2) 0%, rgba(128, 90, 213, 0.05) 100%)',
              border: '1px solid var(--border-accent)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'var(--accent)', color: 'var(--bg-primary)', padding: '8px', borderRadius: '50%'
                }}>
                  <Cake size={20} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, color: '#FFF', fontSize: '0.95rem' }}>It's Your Special Day!</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>{birthdayAlert}</p>
                </div>
              </div>
              <button
                onClick={() => setBirthdayAlert(null)}
                style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {inspectUser && (
            <div style={{
              background: 'linear-gradient(90deg, #F5820D 0%, #D97706 100%)',
              color: '#FFF',
              padding: '12px 20px',
              textAlign: 'center',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <span>🕵️ Admin Mode: Viewing wardrobe and planner for user <strong>@{inspectUser}</strong></span>
              <button 
                onClick={() => setInspectUser(null)} 
                style={{
                  background: '#FFF',
                  color: '#D97706',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Exit Inspect Mode
              </button>
            </div>
          )}

          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <RoutinePlan apiHost={API_HOST} username={inspectUser || currentUser} wardrobeItems={wardrobeItems} onStatsChange={() => { setLaundryStatsTrigger(prev => prev + 1); fetchAppWardrobe(); }} />
          </div>
          <div style={{ display: activeTab === 'catalog' ? 'block' : 'none' }}>
            <WardrobeCatalog apiHost={API_HOST} username={inspectUser || currentUser} wardrobeItems={wardrobeItems} onStatsChange={() => { setLaundryStatsTrigger(prev => prev + 1); fetchAppWardrobe(); }} />
          </div>
          <div style={{ display: activeTab === 'laundry' ? 'block' : 'none' }}>
            <LaundryHub apiHost={API_HOST} username={inspectUser || currentUser} stats={laundryStatsTrigger} onStatsChange={() => { setLaundryStatsTrigger(prev => prev + 1); fetchAppWardrobe(); }} />
          </div>
          {activeTab === 'admin' && userRole === 'admin' && (
            <AdminPanel 
              apiHost={API_HOST} 
              username={currentUser} 
              onInspectUser={(targetUser) => {
                setInspectUser(targetUser);
                setActiveTab('dashboard');
              }}
            />
          )}
        </main>
      </div>
            {/* 3. AI CHATBOT SPARKLE BUTTON (PC ONLY) */}
      {!isMobile && (
        <div className="chat-fab" onClick={() => setShowChat(!showChat)} style={{ bottom: '24px' }}>
          {showChat ? <X size={22} /> : <Sparkles size={22} />}
        </div>
      )}

      {/* 4. CHAT BOT DRAWER */}
      {showChat && (
        <div style={{
          position: 'fixed', 
          bottom: isMobile ? '80px' : '90px', 
          right: isMobile ? '10px' : '24px', 
          width: isMobile ? 'calc(100% - 20px)' : '90%', 
          maxWidth: isMobile ? 'none' : '360px',
          height: isMobile ? 'calc(100vh - 170px)' : '460px', 
          borderRadius: '16px', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border-accent)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', 
          zIndex: 110, 
          overflow: 'hidden'
        }} className="animate-fade-up">
          <div style={{ 
            padding: '14px 16px', borderBottom: '1px solid var(--border-color)', 
            background: 'linear-gradient(135deg, #805AD5 0%, #553C9A 100%)', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#FFF' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>StylixAi Stylist</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                type="button"
                onClick={toggleVoicePlayback} 
                title={voiceEnabled ? "Mute Voice Responses" : "Unmute Voice Responses"}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#FFF', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  opacity: voiceEnabled ? 1 : 0.6
                }}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              {!isMobile && (
                <a 
                  href={`https://t.me/stylixAi_Bot?start=${currentUser}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="Chat with Stylix on Telegram"
                  style={{ 
                    background: 'rgba(255,255,255,0.15)', 
                    border: 'none', 
                    color: '#FFF', 
                    borderRadius: '50%', 
                    width: '26px', 
                    height: '26px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  <Send size={12} />
                </a>
              )}
              <button onClick={() => { setShowChat(false); }} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ flexGrow: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatMessages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              let mentionedItems = [];
              if (!isUser && msg.text && wardrobeItems.length > 0) {
                mentionedItems = wardrobeItems.filter(item => 
                  msg.text.toLowerCase().includes(item.name.toLowerCase())
                );
              }
              return (
                <div 
                  key={index} 
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div 
                    style={{
                      padding: '10px 14px',
                      borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
                      backgroundColor: isUser ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                      color: isUser ? 'var(--bg-primary)' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      lineHeight: 1.45
                    }}
                  >
                    {isUser ? msg.text : formatChatMessage(msg.text)}
                  </div>
                  {mentionedItems.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '8px', marginBottom: '4px' }}>
                      {mentionedItems.map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => {
                            if (item.image_data) {
                              setZoomImage(item.image_data);
                            }
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: item.image_data ? 'pointer' : 'default',
                            transition: 'transform 0.2s'
                          }}
                          className="hover:scale-105"
                        >
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            position: 'relative'
                          }}>
                            {item.image_data ? (
                              <img 
                                src={item.image_data} 
                                alt={item.name} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                👕
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', maxWidth: '42px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '12px 12px 12px 0', backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                StylixAi is typing...
              </div>
            )}
            
            {chatMessages.length <= 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 4px', marginTop: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Prompts:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    "Suggest a formal outfit",
                    "What should I wear today?",
                    "Do I have clean shirts?",
                    "Give me a casual styling tip"
                  ].map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setChatInput(prompt)}
                      className="btn-secondary"
                      style={{ 
                        fontSize: '0.75rem', 
                        padding: '6px 12px', 
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.02)',
                        borderColor: 'var(--border-color)',
                        cursor: 'pointer'
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChatMessage} style={{ display: 'flex', padding: '10px', borderTop: '1px solid var(--border-color)', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder={isListening ? "Listening..." : "Ask StylixAi..."} 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
              style={{
                flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: '8px', 
                padding: '8px 12px', fontSize: '0.85rem', background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.2)', 
                color: '#FFF', outline: 'none', borderColor: isListening ? '#EF4444' : 'var(--border-color)',
                transition: 'all 0.3s'
              }}
            />
            <button
              type="button"
              onClick={startSpeechRecognition}
              title={isListening ? "Stop listening" : "Start voice access"}
              style={{
                width: '36px', height: '36px', borderRadius: '8px', 
                background: isListening ? '#EF4444' : 'rgba(255,255,255,0.05)', 
                color: isListening ? '#FFF' : 'var(--text-primary)', 
                border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
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

      {/* 5. MOBILE BOTTOM TAB BAR */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: '15px',
          left: '15px',
          right: '15px',
          height: '65px',
          backgroundColor: 'rgba(19, 17, 28, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100
        }}>
          <button
            onClick={() => { setActiveTab('dashboard'); setShowChat(false); }}
            style={{
              background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              color: activeTab === 'dashboard' && !showChat ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            <Calendar size={20} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Planner</span>
          </button>
          <button
            onClick={() => { setActiveTab('catalog'); setShowChat(false); }}
            style={{
              background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              color: activeTab === 'catalog' && !showChat ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            <Layers size={20} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Wardrobe</span>
          </button>
          <button
            onClick={() => { setActiveTab('laundry'); setShowChat(false); }}
            style={{
              background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              color: activeTab === 'laundry' && !showChat ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            <Droplet size={20} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Laundry</span>
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => { setActiveTab('admin'); setShowChat(false); }}
              style={{
                background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                color: activeTab === 'admin' && !showChat ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
              }}
            >
              <Shield size={20} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Admin</span>
            </button>
          )}
          <button
            onClick={() => { setShowChat(!showChat); }}
            style={{
              background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              color: showChat ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            <Sparkles size={20} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Chat</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              color: showSettings ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            <Settings size={20} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Settings</span>
          </button>
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
              overflowY: 'auto', background: 'var(--bg-secondary)', animation: 'fadeInUp 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Profile</span>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Birthday</label>
                <input 
                  type="text" 
                  placeholder="DD-MM-YYYY or YYYY-MM-DD"
                  className="form-input" 
                  value={settingsBirthday}
                  onChange={(e) => setSettingsBirthday(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Gender</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="settingsGender" 
                      value="male" 
                      checked={settingsGender === 'male'} 
                      onChange={() => setSettingsGender('male')}
                    /> Male
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="settingsGender" 
                      value="female" 
                      checked={settingsGender === 'female'} 
                      onChange={() => setSettingsGender('female')}
                    /> Female
                  </label>
                </div>
              </div>

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Messaging integrations</span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flexGrow: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    WhatsApp Link
                    <span style={{ fontSize: '0.6rem', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-accent)', fontWeight: 'bold' }}>COMING SOON</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Chat with wardrobe via WhatsApp</span>
                </div>
                <input 
                  type="checkbox" 
                  disabled
                  checked={false} 
                  style={{ width: '18px', height: '18px', cursor: 'not-allowed', opacity: 0.5 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flexGrow: 1 }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Telegram Link</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sync wardrobe queries with Telegram Bot</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={telegramLinked} 
                    onChange={(e) => setTelegramLinked(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '3px' }}
                  />
                </div>
                {telegramLinked && (
                  <div style={{ 
                    marginTop: '4px', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    background: 'rgba(0, 136, 204, 0.08)', 
                    border: '1px solid rgba(0, 136, 204, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                      To complete the sync, open our bot and click <strong>Start</strong> (it will automatically link username <strong>{currentUser}</strong>):
                    </span>
                    <a 
                      href={`https://t.me/stylixAi_Bot?start=${currentUser}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px', 
                        padding: '6px 12px', 
                        fontSize: '0.75rem', 
                        background: '#0088cc', 
                        color: '#FFF', 
                        textDecoration: 'none', 
                        borderRadius: '6px',
                        fontWeight: 600,
                        textAlign: 'center',
                        transition: 'opacity 0.2s'
                      }}
                      className="hover:opacity-90"
                    >
                      <Send size={12} />
                      Open Telegram Bot
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile App Download */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mobile Application</span>
              <a 
                href="/stylix.apk" 
                download="stylix.apk"
                className="btn-secondary" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '8px 12px', 
                  fontSize: '0.8rem', 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                  color: '#10B981', 
                  textDecoration: 'none', 
                  borderRadius: '8px',
                  fontWeight: 600
                }}
              >
                <Cpu size={14} /> Download StylixAi APK
              </a>
            </div>

            {/* Custom Theme Switcher */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Theme Customizer</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => changeTheme('classic')} 
                  style={{ 
                    background: '#0b0f19', 
                    border: theme === 'classic' ? '2px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '10px', 
                    height: '38px', 
                    color: '#FFF', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: theme === 'classic' ? '0 0 10px rgba(183, 148, 244, 0.4)' : 'none'
                  }}
                  className="hover:scale-105"
                >
                  Classic Dark
                </button>
                <button 
                  type="button" 
                  onClick={() => changeTheme('cyber')} 
                  style={{ 
                    background: '#080C14', 
                    border: theme === 'cyber' ? '2px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '10px', 
                    height: '38px', 
                    color: '#FFF', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: theme === 'cyber' ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
                  }}
                  className="hover:scale-105"
                >
                  Cyber Green
                </button>
                <button 
                  type="button" 
                  onClick={() => changeTheme('gold')} 
                  style={{ 
                    background: '#0E0B09', 
                    border: theme === 'gold' ? '2px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '10px', 
                    height: '38px', 
                    color: '#FFF', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: theme === 'gold' ? '0 0 10px rgba(217, 119, 6, 0.4)' : 'none'
                  }}
                  className="hover:scale-105"
                >
                  Sunrise Gold
                </button>
                <button 
                  type="button" 
                  onClick={() => changeTheme('light-minimal')} 
                  style={{ 
                    background: '#f8fafc', 
                    border: theme === 'light-minimal' ? '2px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '10px', 
                    height: '38px', 
                    color: '#000', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: theme === 'light-minimal' ? '0 0 10px rgba(37, 99, 235, 0.4)' : 'none'
                  }}
                  className="hover:scale-105"
                >
                  Light Minimal
                </button>
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

      {/* Dynamic Agent Purpose Modal */}
      {selectedAgent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 10000, backdropFilter: 'blur(6px)'
        }}>
          <div className="glass-panel animate-scale" style={{ width: '90%', maxWidth: '400px', padding: '24px', position: 'relative', border: '1px solid var(--border-accent)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px' }}>{selectedAgent}</h3>
            <p style={{ fontSize: '0.9rem', color: '#E2E8F0', lineHeight: 1.5, marginBottom: '20px' }}>
              {selectedAgent === 'Coordinator Agent' && "The Coordinated Planner orchestrates your weekly rotation planner, updates worn/skip feedback loops, and sends dirty items to the laundry pool automatically."}
              {selectedAgent === 'Stylist Agent' && "The AI Fashion Stylist uses the Groq LLaMA model to evaluate color harmony, occasion matching score, dynamic theme personalization, and handles user chatbot chats."}
              {selectedAgent === 'Wardrobe Agent' && "The Wardrobe Catalog Manager catalogs uploaded clothes or OpenCV videos of garments on a hanger, extracts visual details, and auto-tags attributes via Groq Vision."}
            </p>
            <button onClick={() => setSelectedAgent(null)} className="btn-primary" style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* Dynamic Image Zoom Modal */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 20000, cursor: 'zoom-out', backdropFilter: 'blur(8px)'
          }}
        >
          <img 
            src={zoomImage} 
            alt="Zoomed garment" 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '85vh', 
              borderRadius: '16px', 
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              border: '2px solid rgba(255,255,255,0.1)',
              objectFit: 'contain'
            }} 
          />
          <div style={{ position: 'absolute', bottom: '30px', color: '#FFF', fontSize: '0.85rem', fontWeight: 600 }}>
            Tap anywhere to close
          </div>
        </div>
      )}

      {/* Dynamic Splash Screen */}
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#0B0D12',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          opacity: showSplash ? 1 : 0,
          visibility: showSplash ? 'visible' : 'hidden',
          transition: 'opacity 0.6s ease-in-out, visibility 0.6s'
        }}
      >
        <div style={{ transform: 'scale(1.2)', animation: 'pulsate 2s infinite ease-in-out' }}>
          <StylixLogo size={100} />
        </div>
        <h1 style={{ 
          fontFamily: 'Georgia, serif', 
          fontSize: '2.5rem', 
          color: '#FFF', 
          marginTop: '24px', 
          fontWeight: 700,
          letterSpacing: '3px'
        }}>
          StylixAi
        </h1>
        <span style={{ 
          fontSize: '0.65rem', 
          color: '#cca43b', 
          textTransform: 'uppercase', 
          letterSpacing: '4px', 
          fontWeight: 'bold',
          marginTop: '8px'
        }}>
          Dress. Wear. Repeat Never.
        </span>
      </div>

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
    </>
  );
}
