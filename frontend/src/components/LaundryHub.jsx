import React, { useState, useEffect } from 'react';
import { Droplet } from 'lucide-react';

export default function LaundryHub({ apiHost, username, stats, onStatsChange }) {
  const [laundry, setLaundry] = useState({ clean_count: 0, dirty_count: 0, dirty_items: [] });
  const [washing, setWashing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLaundry();
  }, [stats, username]);

  const fetchLaundry = async () => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/laundry?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLaundry(data);
      }
    } catch (e) {
      console.error("Error loading laundry:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunLaundry = async () => {
    setWashing(true);
    setTimeout(async () => {
      try {
        const res = await fetch(`${apiHost}/api/laundry/wash?username=${encodeURIComponent(username)}`, { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
        });
        if (res.ok) {
          fetchLaundry();
          if (onStatsChange) onStatsChange();
        }
      } catch (e) {
        console.error("Error washing clothes:", e);
      } finally {
        setWashing(false);
      }
    }, 2000);
  };

  const total = laundry.clean_count + laundry.dirty_count;
  const cleanPercentage = total > 0 ? Math.round((laundry.clean_count / total) * 100) : 100;

  return (
    <div className="animate-fade-up" style={{ padding: '10px 0', position: 'relative' }}>
      
      {/* Washing Animation Overlay */}
      {washing && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(10, 9, 14, 0.95)', borderRadius: '16px', zIndex: 10,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '16px' }}>
            <div className="bubble-water" style={{
              width: '100%', height: '100%', border: '4px solid var(--accent)',
              borderRadius: '50%', animation: 'spin 1.5s linear infinite'
            }} />
            <span style={{ position: 'absolute', top: '35%', left: '38%', fontSize: '1.5rem' }}>🧼</span>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>Washing Clothes...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Updating rotation indices</p>
        </div>
      )}

      {/* Main Layout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>Laundry & Rotation</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Keep track of clean pool sizes and send worn garments to wash
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Status Circular Indicator */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Clean Ratio</h3>
          
          <div style={{ position: 'relative', width: '130px', height: '130px' }}>
            <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              <circle 
                cx="65" cy="65" r="50" 
                stroke="var(--border-color)" strokeWidth="6" fill="transparent" 
              />
              <circle 
                cx="65" cy="65" r="50" 
                stroke="var(--accent)" strokeWidth="6" fill="transparent" 
                strokeDasharray="314.16"
                strokeDashoffset={314.16 - (314.16 * cleanPercentage) / 100}
                style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
              />
            </svg>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
            }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{cleanPercentage}%</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Clean Pool</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', width: '100%', marginTop: '4px' }}>
            <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-primary)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 700, color: '#10b981' }}>{laundry.clean_count}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Clean Items</span>
            </div>
            <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-primary)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 700, color: '#ef4444' }}>{laundry.dirty_count}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>In Wash</span>
            </div>
          </div>

          {laundry.dirty_count > 0 && (
            <button 
              className="btn-primary" 
              onClick={handleRunLaundry} 
              style={{ width: '100%', marginTop: '6px', background: 'var(--accent)', color: 'white' }}
            >
              <Droplet size={14} /> Run Laundry Cycle
            </button>
          )}
        </div>

        {/* Dirty Queue list */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Washing Queue</h3>
          
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {laundry.dirty_items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>🍃</div>
                <p style={{ fontSize: '0.8rem' }}>No clothes in wash bucket! All clothes are clean.</p>
              </div>
            ) : (
              laundry.dirty_items.map(item => (
                <div key={item.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</h4>
                    <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 4px', marginTop: '2px' }}>
                      {item.category === 'footwear' ? 'shoes' : item.category}
                    </span>
                  </div>
                  <span className="chip" style={{ fontSize: '0.6rem', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>Dirty</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
