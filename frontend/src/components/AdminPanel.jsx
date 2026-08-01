import React, { useState, useEffect } from 'react';
import { Shield, Users, FileText, Search, RefreshCw, Eye } from 'lucide-react';

export default function AdminPanel({ apiHost, username, onInspectUser }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiHost}/api/admin/stats?username=${encodeURIComponent(username)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [apiHost, username, refreshTrigger]);

  const filteredUsers = stats?.users?.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <div className="animate-fade-up" style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Admin Control Center</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            System logs, user registries, and real-time agent audit pipelines.
          </p>
        </div>
        <button 
          onClick={() => setRefreshTrigger(p => p + 1)}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Stats
        </button>
      </div>

      {loading && !stats ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading administrative data...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)' }}>
              <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '12px', borderRadius: '12px' }}>
                <Users size={24} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Users</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats?.total_users || 0}</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)' }}>
              <div style={{ background: 'rgba(14, 140, 127, 0.1)', color: '#0E8C7F', padding: '12px', borderRadius: '12px' }}>
                <Shield size={24} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Agents</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0E8C7F' }}>3 / 3</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobileQuery() ? '1fr' : '1fr 1fr', gap: '20px', alignItems: 'start' }}>
            {/* User Registry */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-secondary)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>User Registry</h3>
              
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 36px', fontSize: '0.8rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No users found.
                  </div>
                ) : (
                  filteredUsers.map((u, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        padding: '12px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', 
                        borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.name || u.username}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          @{u.username} | {u.gender}
                        </span>
                      </div>
                      
                      {/* Wardrobe stats */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', marginRight: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.total_items || 0} items
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                          ({u.clean_items || 0} clean / {u.dirty_items || 0} dirty)
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`chip ${u.role === 'admin' ? 'chip-accent' : ''}`} style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px' }}>
                          {u.role ? u.role.toUpperCase() : 'USER'}
                        </span>
                        
                        {u.role !== 'admin' && onInspectUser && (
                          <button
                            onClick={() => onInspectUser(u.username)}
                            className="btn-secondary animate-fade-in"
                            style={{ 
                              padding: '6px 10px', 
                              fontSize: '0.7rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              border: '1px solid var(--accent)',
                              background: 'var(--accent-glow)',
                              color: 'var(--accent)',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={12} /> Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* System Events Logs */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Event Logs</h3>
              </div>

              <div 
                style={{ 
                  maxHeight: '450px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)',
                  lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px'
                }}
              >
                {stats?.logs?.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    No system event logs recorded yet.
                  </div>
                ) : (
                  stats?.logs?.map((log, idx) => (
                    <div key={idx} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', wordBreak: 'break-all' }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple helper to check mobile layout
function isMobileQuery() {
  return window.innerWidth <= 768;
}
