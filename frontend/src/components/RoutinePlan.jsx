import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, X, ThumbsUp, ThumbsDown, Shuffle, RefreshCw, Calendar, ArrowRight, ArrowLeft 
} from 'lucide-react';
import MannequinPreview from './MannequinPreview';

export default function RoutinePlan({ apiHost, username, onStatsChange }) {
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [swappingDay, setSwappingDay] = useState(null);
  const [swapCategory, setSwapCategory] = useState('');
  const [cleanItems, setCleanItems] = useState([]);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [userGender, setUserGender] = useState('male');

  const scrollRef = useRef(null);

  useEffect(() => {
    fetchPlan();
    fetchUserProfile();
  }, [username]);

  const fetchUserProfile = async () => {
    if (!username) return;
    try {
      const res = await fetch(`${apiHost}/api/profile/update?username=${encodeURIComponent(username)}`); // settings check
      // Or simply fetch profile directly
      const profileRes = await fetch(`${apiHost}/api/auth/login`); // Fallback or mock endpoint
      // We will read user data from local settings update endpoint or similar:
      const resVal = await fetch(`${apiHost}/api/laundry?username=${encodeURIComponent(username)}`);
      // Since backend login endpoints return user gender, let's load it from local storage
      const cachedGender = localStorage.getItem('stylix_gender') || 'male';
      setUserGender(cachedGender);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlan = async () => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/plan?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      }
    } catch (e) {
      console.error("Error fetching plan:", e);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/plan/generate?username=${encodeURIComponent(username)}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error generating plan:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmWorn = async (dayIndex, rating) => {
    try {
      const res = await fetch(`${apiHost}/api/plan/confirm?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_index: dayIndex, rating })
      });
      if (res.ok) {
        fetchPlan();
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error confirming worn:", e);
    }
  };

  const handleSkip = async (dayIndex) => {
    try {
      const res = await fetch(`${apiHost}/api/plan/skip?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_index: dayIndex })
      });
      if (res.ok) {
        fetchPlan();
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error skipping outfit:", e);
    }
  };

  const openSwapModal = async (dayIndex, category) => {
    setSwappingDay(dayIndex);
    setSwapCategory(category);
    try {
      const res = await fetch(`${apiHost}/api/wardrobe?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter(item => item.category === category && item.is_clean);
        setCleanItems(filtered);
      }
    } catch (e) {
      console.error("Error loading swap items:", e);
    }
  };

  const handleSwapItem = async (targetItem) => {
    const day = plan.find(d => d.day_index === swappingDay);
    if (!day) return;

    const newItemIds = day.assigned_outfit.map(item => 
      item.category === swapCategory ? targetItem.id : item.id
    );

    try {
      const res = await fetch(`${apiHost}/api/plan/swap?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_index: swappingDay, item_ids: newItemIds })
      });
      if (res.ok) {
        setSwappingDay(null);
        setSwapCategory('');
        fetchPlan();
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error swapping item:", e);
    }
  };

  const scrollToDay = (idx) => {
    setActiveDayIdx(idx);
    if (scrollRef.current) {
      const cardWidth = 330; 
      scrollRef.current.scrollTo({
        left: idx * cardWidth,
        behavior: 'smooth'
      });
    }
  };

  const activeDay = plan.find(d => d.day_index === activeDayIdx) || plan[0];
  const activeOutfit = activeDay ? activeDay.assigned_outfit || [] : [];

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* 1. STAGGERED FIXED TOP SECTION */}
      <div style={{ flexShrink: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              Timeline Planner
            </span>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-sans)', marginTop: '4px', color: '#FFF' }}>
              Coordinated Planner
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
              AI-curated weekly outfit timeline mapped onto moveable 3D mannequin
            </p>
          </div>
          
          <button 
            className="btn-primary" 
            onClick={generatePlan} 
            disabled={loading}
            style={{ 
              background: 'linear-gradient(135deg, #B794F4 0%, #805AD5 100%)', 
              color: 'white',
              boxShadow: '0 4px 15px rgba(128, 90, 213, 0.3)',
              fontSize: '0.85rem'
            }}
          >
            <Shuffle size={14} />
            {loading ? 'Orchestrating...' : 'Shuffle Outfits'}
          </button>
        </div>

        {/* Calendar Day selector tabs */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '4px 0' }}>
          {plan.map((day, idx) => {
            const isActive = activeDayIdx === idx;
            return (
              <button
                key={day.day_index}
                onClick={() => scrollToDay(idx)}
                style={{
                  flex: '0 0 76px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                  background: isActive ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'var(--transition-smooth)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}>{day.day_name}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{day.date_label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* 3D MANNEQUIN & TIMELINE CARDS SPLIT SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
        
        {/* Left: 3D Moveable Toy/Mannequin */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(19, 17, 28, 0.95)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', fontFamily: 'var(--font-mono)' }}>
            3D Mannequin Combination Preview
          </h3>
          <MannequinPreview outfit={activeOutfit} gender={userGender} />
        </div>

        {/* Right: Selected Day Timeline Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading && plan.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--accent)' }} />
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Scaffolding planner...</p>
            </div>
          ) : (
            activeDay && (
              <div className="glass-panel" style={{ 
                padding: '20px', 
                background: 'rgba(19, 17, 28, 0.95)',
                minHeight: '350px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFF' }}>
                      {activeDay.day_name} • {activeDay.date_label}
                    </span>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      color: 'var(--accent)', 
                      fontWeight: 700, 
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      marginTop: '3px'
                    }}>
                      {activeDay.occasion}
                    </span>
                  </div>
                  <span className={`chip ${activeDay.status === 'Worn' || activeDay.status === 'Swapped' ? 'chip-clean' : activeDay.status === 'Skipped' ? 'chip-dirty' : ''}`} style={{ fontSize: '0.65rem' }}>
                    {activeDay.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                  {activeDay.assigned_outfit && activeDay.assigned_outfit.length > 0 ? (
                    activeDay.assigned_outfit.map((item) => {
                      let label = item.category.toUpperCase();
                      if (label === 'FOOTWEAR') label = 'SHOES';
                      
                      return (
                        <div 
                          key={item.id} 
                          style={{ 
                            background: '#13111C', 
                            border: '1px solid rgba(255,255,255,0.03)', 
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ 
                              display: 'block', 
                              fontSize: '0.6rem', 
                              color: '#9F7AEA', 
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              marginBottom: '2px'
                            }}>
                              {label}
                            </span>
                            <span style={{ fontSize: '0.9rem', color: '#E2E8F0', fontWeight: 500 }}>
                              {item.name}
                            </span>
                          </div>
                          
                          {activeDay.status === 'Planned' && (
                            <button 
                              onClick={() => openSwapModal(activeDay.day_index, item.category)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              className="hover:text-accent"
                            >
                              <RefreshCw size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No outfits generated. Click shuffle above to plan.
                    </div>
                  )}
                </div>

                {activeDay.status === 'Planned' && activeDay.assigned_outfit && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleConfirmWorn(activeDay.day_index, 'thumbsup')}
                      style={{ padding: '8px 10px', fontSize: '0.75rem', gap: '4px' }}
                    >
                      <RefreshCw size={12} /> WORN
                    </button>
                    
                    <button 
                      onClick={() => handleConfirmWorn(activeDay.day_index, 'thumbsup')}
                      style={{ 
                        background: 'rgba(16, 185, 129, 0.05)', 
                        border: '1px solid rgba(16, 185, 129, 0.2)', 
                        color: '#10B981', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ThumbsUp size={14} />
                    </button>
                    
                    <button 
                      onClick={() => handleSkip(activeDay.day_index)}
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.05)', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', 
                        color: '#EF4444', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}

                {(activeDay.status === 'Worn' || activeDay.status === 'Swapped') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent)', justifyContent: 'center', marginTop: 'auto', paddingTop: '10px' }}>
                    <Check size={12} />
                    <span>Outfit worn. Items sent to wash rotation</span>
                  </div>
                )}

                {activeDay.status === 'Skipped' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#EF4444', justifyContent: 'center', marginTop: 'auto', paddingTop: '10px' }}>
                    <X size={12} />
                    <span>Skipped. Adjusted style preferences.</span>
                  </div>
                )}
              </div>
            )
          )}
        </div>

      </div>

      {/* Item Swap Modal */}
      {swappingDay !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel animate-scale" style={{ width: '90%', maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Swap {swapCategory === 'footwear' ? 'Shoes' : swapCategory.toUpperCase()}</h3>
              <button 
                onClick={() => { setSwappingDay(null); setSwapCategory(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cleanItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No clean alternative {swapCategory === 'footwear' ? 'shoes' : swapCategory} available.
                </div>
              ) : (
                cleanItems.map(item => (
                  <div 
                    key={item.id} 
                    className="glass-card" 
                    onClick={() => handleSwapItem(item)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '10px' }}
                  >
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</h4>
                      <span className="chip" style={{ fontSize: '0.6rem', padding: '1px 5px', marginTop: '2px' }}>{item.color}</span>
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>Select</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
