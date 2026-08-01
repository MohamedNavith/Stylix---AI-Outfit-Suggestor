import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, X, ThumbsUp, ThumbsDown, Shuffle, RefreshCw, Calendar, ArrowRight, ArrowLeft, Cpu, Sparkles 
} from 'lucide-react';
import MannequinPreview from './MannequinPreview';

export default function RoutinePlan({ apiHost, username, wardrobeItems, onStatsChange }) {
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [swappingDay, setSwappingDay] = useState(null);
  const [swapCategory, setSwapCategory] = useState('');
  const [cleanItems, setCleanItems] = useState([]);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [userGender, setUserGender] = useState('male');
  const [zoomImage, setZoomImage] = useState(null);

  // Occasion Outfit Generator State
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [suggestionsOccasion, setSuggestionsOccasion] = useState('');
  const [occasionSuggestions, setOccasionSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const scrollRef = useRef(null);

  useEffect(() => {
    fetchPlan(false);
    fetchUserProfile();
    setOccasionSuggestions([]);
    setSelectedOccasion('');
  }, [username]);

  const fetchUserProfile = async () => {
    if (!username) return;
    try {
      const cachedGender = localStorage.getItem('stylix_gender') || 'male';
      setUserGender(cachedGender);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlan = async (isSilent = false) => {
    if (!username) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/plan?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      }
    } catch (e) {
      console.error("Error fetching plan:", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const generatePlan = async () => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/plan/generate?username=${encodeURIComponent(username)}`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
        },
        body: JSON.stringify({ day_index: dayIndex, rating })
      });
      if (res.ok) {
        fetchPlan(true);
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
        },
        body: JSON.stringify({ day_index: dayIndex })
      });
      if (res.ok) {
        fetchPlan(true);
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
      const res = await fetch(`${apiHost}/api/wardrobe?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
        },
        body: JSON.stringify({ day_index: swappingDay, item_ids: newItemIds })
      });
      if (res.ok) {
        setSwappingDay(null);
        setSwapCategory('');
        fetchPlan(true);
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error swapping item:", e);
    }
  };

  const fetchOccasionSuggestions = async (occ) => {
    setSelectedOccasion(occ);
    if (!occ) {
      setOccasionSuggestions([]);
      return;
    }
    setSuggestLoading(true);
    setSuggestionsOccasion(occ);
    try {
      const res = await fetch(`${apiHost}/api/plan/suggest-by-occasion?username=${encodeURIComponent(username)}&occasion=${encodeURIComponent(occ)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('stylix_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOccasionSuggestions(data);
      }
    } catch (e) {
      console.error("Error fetching occasion suggestions:", e);
    } finally {
      setSuggestLoading(false);
    }
  };

  const applySuggestedCombo = async (combo) => {
    if (!activeDay) return;
    const newItemIds = combo.map(item => item.id);
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/plan/swap?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('stylix_token')}`
        },
        body: JSON.stringify({ day_index: activeDay.day_index, item_ids: newItemIds })
      });
      if (res.ok) {
        fetchPlan(true);
        setOccasionSuggestions([]);
        setSelectedOccasion('');
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error applying combo suggestion:", e);
    } finally {
      setLoading(false);
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
            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-sans)', marginTop: '4px', color: 'var(--text-primary)' }}>
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
              background: 'var(--accent)', 
              color: 'white',
              boxShadow: '0 4px 15px var(--accent-glow)',
              fontSize: '0.85rem'
            }}
          >
            <Shuffle size={14} />
            {loading ? 'Orchestrating...' : 'Shuffle Outfits'}
          </button>
        </div>

        {/* Wardrobe health status bar widget */}
        {wardrobeItems && wardrobeItems.length > 0 && (() => {
          const totalCount = wardrobeItems.length;
          const cleanCount = wardrobeItems.filter(i => i.is_clean).length;
          const dirtyCount = totalCount - cleanCount;
          const cleanPercentage = totalCount > 0 ? Math.round((cleanCount / totalCount) * 100) : 0;
          return (
            <div className="glass-panel animate-fade-in" style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              marginTop: '4px',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🧺 Wardrobe Readiness
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{cleanPercentage}% Ready</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    ({cleanCount} clean & free to wear / {dirtyCount} in wash rotation)
                  </span>
                </div>
              </div>
              <div style={{ flex: 1, maxWidth: '160px', background: 'var(--border-color)', height: '6px', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ 
                  background: 'var(--success)', 
                  width: `${cleanPercentage}%`, 
                  height: '100%', 
                  borderRadius: '3px', 
                  transition: 'width 0.5s ease-out' 
                }} />
              </div>
            </div>
          );
        })()}

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
                  background: isActive ? 'var(--accent-glow)' : 'var(--bg-secondary)',
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
        <div className="glass-panel" style={{ 
          padding: '20px', 
          background: 'var(--bg-secondary)', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '350px',
          border: '1px solid var(--border-color)',
          position: 'relative',
          borderRadius: '16px'
        }}>
          {activeOutfit && activeOutfit.length > 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                  3D Visualizer
                </span>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                  Active Day Combo
                </h4>
              </div>
              <div style={{ width: '100%', height: '350px' }}>
                <MannequinPreview outfit={activeOutfit} gender={userGender} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', padding: '24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-accent)',
                animation: 'pulse 3s infinite'
              }}>
                <Cpu size={32} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  3D Mannequin
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  Dress the Model
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '260px', lineHeight: '1.4' }}>
                No outfit generated for this day yet. Click <strong>"Shuffle Outfits"</strong> above or add garments to catalog to see them rendered in 3D!
              </p>
            </div>
          )}
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
                background: 'var(--bg-secondary)',
                minHeight: '350px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
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
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {item.image_data ? (
                              <img 
                                src={item.image_data} 
                                alt={item.name} 
                                onClick={() => setZoomImage(item.image_data)}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s'
                                }}
                                className="hover:scale-110"
                              />
                            ) : (
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                background: 'var(--bg-secondary)',
                                fontSize: '0.9rem'
                              }}>
                                👕
                              </div>
                            )}
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
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {item.name}
                              </span>
                            </div>
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

                {activeDay.verdict && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: 'rgba(183, 148, 244, 0.04)',
                    border: '1px dashed rgba(183, 148, 244, 0.15)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#B794F4',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <Sparkles size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#B794F4' }} />
                    <span><strong>AI Style Verdict:</strong> {activeDay.verdict}</span>
                  </div>
                )}

                {/* Occasion Combination Assistant */}
                <div style={{
                  marginTop: '14px',
                  padding: '16px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      💡 Occasion Combination Assistant
                    </span>
                    <select
                      value={selectedOccasion}
                      onChange={(e) => fetchOccasionSuggestions(e.target.value)}
                      className="form-input"
                      style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                    >
                      <option value="">-- Choose Occasion --</option>
                      <option value="Casual Day">Casual Day</option>
                      <option value="Office Day">Office Day</option>
                      <option value="Client Lunch">Client Lunch</option>
                      <option value="Casual Friday">Casual Friday</option>
                      <option value="Weekend Outing">Weekend Outing</option>
                      <option value="Party Night">Party Night</option>
                      <option value="Date Night">Date Night</option>
                      <option value="Gym Work">Gym Work</option>
                    </select>
                  </div>

                  {suggestLoading && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                      Finding best combinations...
                    </div>
                  )}

                  {!suggestLoading && occasionSuggestions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Suggestions for "{suggestionsOccasion}":</span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                        {occasionSuggestions.map((combo, comboIdx) => (
                          <div 
                            key={comboIdx} 
                            style={{ 
                              padding: '10px', 
                              background: 'var(--bg-secondary)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              position: 'relative'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                              {combo.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}>
                                  <span title={item.category} style={{ fontSize: '0.8rem' }}>
                                    {item.category === 'top' ? '👕' : item.category === 'bottom' ? '👖' : '👟'}
                                  </span>
                                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={item.name}>
                                    {item.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => applySuggestedCombo(combo)}
                              className="btn-primary animate-fade-in"
                              style={{ padding: '6px 8px', fontSize: '0.65rem', width: '100%', marginTop: '4px', cursor: 'pointer' }}
                            >
                              Choose Combo
                            </button>
                          </div>
                        ))}
                      </div>
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

      {/* Dynamic Fullscreen Image Zoom Overlay */}
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
    </div>
  );
}
