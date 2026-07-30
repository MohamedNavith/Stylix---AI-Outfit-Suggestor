import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Sparkles, Filter, Plus, Search, Video, FileText } from 'lucide-react';

export default function WardrobeCatalog({ apiHost, username, onStatsChange }) {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [activeUploadTab, setActiveUploadTab] = useState('photo'); // 'photo' or 'video'
  const [videoStep, setVideoStep] = useState(0); // 0: idle, 1: extracting, 2: scanning, 3: rendering, 4: fitting
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterClean, setFilterClean] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    fetchCatalog();
  }, [username]);

  const fetchCatalog = async () => {
    if (!username) return;
    try {
      const res = await fetch(`${apiHost}/api/wardrobe?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error("Error fetching wardrobe:", e);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadFile(file);
  };

  const uploadFile = (file) => {
    if (!username) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      try {
        const res = await fetch(`${apiHost}/api/wardrobe?username=${encodeURIComponent(username)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customName || null,
            image_data: base64Data,
            file_name: file.name
          })
        });
        if (res.ok) {
          setCustomName('');
          fetchCatalog();
          if (onStatsChange) onStatsChange();
        }
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadVideo(file);
  };

  const uploadVideo = (file) => {
    if (!username) return;
    setUploading(true);
    setVideoStep(1); // [Extracting Frames]

    // Simulate OpenCV keyframe processing sequence (takes about 3.5 seconds)
    const runStep = (step, nextFn) => {
      setTimeout(() => {
        setVideoStep(step);
        if (nextFn) nextFn();
      }, 1000);
    };

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      
      runStep(2, () => { // [Gemini Vision Scanning]
        runStep(3, () => { // [Reconstructing 3D Mesh]
          runStep(4, async () => { // [Fitting Mannequin]
            try {
              const res = await fetch(`${apiHost}/api/wardrobe/upload-video?username=${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: customName || null,
                  video_data: base64Data,
                  file_name: file.name
                })
              });
              if (res.ok) {
                setCustomName('');
                fetchCatalog();
                if (onStatsChange) onStatsChange();
              }
            } catch (err) {
              console.error("Video Upload error:", err);
            } finally {
              setUploading(false);
              setVideoStep(0);
            }
          });
        });
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(`${apiHost}/api/wardrobe/${itemId}?username=${encodeURIComponent(username)}`, { 
        method: 'DELETE' 
      });
      if (res.ok) {
        fetchCatalog();
        if (onStatsChange) onStatsChange();
      }
    } catch (e) {
      console.error("Error deleting item:", e);
    }
  };

  const userGender = localStorage.getItem('stylix_gender') || 'male';

  const filteredItems = items.filter(item => {
    const categoryMatch = filterCategory === 'all' || item.category === filterCategory;
    const cleanMatch = filterClean === 'all' || 
                       (filterClean === 'clean' && item.is_clean) || 
                       (filterClean === 'dirty' && !item.is_clean);
                       
    // Smart keyword search matching categories, pattern synonyms, fabric, color, name
    const searchMatch = (() => {
      if (searchQuery === '') return true;
      const query = searchQuery.toLowerCase().trim();
      
      const matchesCategory = (q, cat) => {
        if (q === 'shirt' || q === 'shirts' || q === 'tshirt' || q === 't-shirt' || q === 'tshirts' || q === 'jibba' || q === 'jibbas') {
          return cat === 'top';
        }
        if (q === 'pant' || q === 'pants' || q === 'trouser' || q === 'trousers' || q === 'jeans' || q === 'denim') {
          return cat === 'bottom';
        }
        if (q === 'shoe' || q === 'shoes' || q === 'footwear') {
          return cat === 'footwear';
        }
        return false;
      };
      
      const matchesPattern = (q, pat) => {
        const p = (pat || '').toLowerCase();
        if (q === 'checked' || q === 'checks' || q === 'check') {
          return p.includes('check');
        }
        if (q === 'plain' || q === 'solid') {
          return p.includes('solid') || p.includes('plain') || p === '';
        }
        if (q === 'designed' || q === 'patterned' || q === 'pattern') {
          return p.includes('pattern') || p.includes('design') || p.includes('stripe') || p.includes('print') || p.includes('floral');
        }
        if (q === 'striped' || q === 'stripes' || q === 'stripe') {
          return p.includes('stripe');
        }
        if (q === 'printed' || q === 'prints' || q === 'print') {
          return p.includes('print') || p.includes('floral');
        }
        return p.includes(q);
      };

      const name = (item.name || '').toLowerCase();
      const color = (item.color || '').toLowerCase();
      const style_tag = (item.style_tag || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const fabric = (item.fabric || '').toLowerCase();
      const pattern = (item.pattern || '').toLowerCase();
      const formality = (item.formality || '').toLowerCase();
      
      return name.includes(query) ||
             color.includes(query) ||
             style_tag.includes(query) ||
             fabric.includes(query) ||
             formality.includes(query) ||
             matchesCategory(query, category) ||
             matchesPattern(query, pattern);
    })();

    return categoryMatch && cleanMatch && searchMatch;
  });

  return (
    <div className="animate-fade-up" style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF' }}>Wardrobe Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Catalog clothing photos & 360° videos on a hanger to auto-tag via Gemini Vision
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(19, 17, 28, 0.95)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add Garment
          </h3>

          {/* Upload method selection tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setActiveUploadTab('photo')}
              disabled={uploading}
              style={{
                flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: activeUploadTab === 'photo' ? 'var(--accent)' : 'transparent',
                color: activeUploadTab === 'photo' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                transition: 'var(--transition-smooth)'
              }}
            >
              <FileText size={12} style={{ marginRight: '4px', display: 'inline' }} /> Photo Scan
            </button>
            <button
              onClick={() => setActiveUploadTab('video')}
              disabled={uploading}
              style={{
                flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: activeUploadTab === 'video' ? 'var(--accent)' : 'transparent',
                color: activeUploadTab === 'video' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                transition: 'var(--transition-smooth)'
              }}
            >
              <Video size={12} style={{ marginRight: '4px', display: 'inline' }} /> 3D Video Scan (10s)
            </button>
          </div>
          
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Garment Label (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Classic White Linen Shirt" 
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={uploading}
            />
          </div>

          {activeUploadTab === 'photo' ? (
            <div style={{
              border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '24px 16px', 
              textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(0,0,0,0.1)',
              transition: 'var(--transition-smooth)', position: 'relative'
            }}>
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={24} className="animate-pulse" style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>Scanning with Gemini Vision...</span>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'block' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    style={{ display: 'none' }} 
                  />
                  <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '10px' }} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click to Upload Photo</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Gemini Vision automatically classifies fabric, tags and formality profile
                  </p>
                </label>
              )}
            </div>
          ) : (
            <div style={{
              border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '24px 16px', 
              textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(0,0,0,0.1)',
              transition: 'var(--transition-smooth)', position: 'relative'
            }}>
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={24} className="animate-pulse" style={{ color: 'var(--accent)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#FFF' }}>
                    <span style={{ fontWeight: videoStep === 1 ? '700' : '400', color: videoStep === 1 ? 'var(--accent)' : 'var(--text-muted)' }}>[1/4] Extracting Keyframes...</span>
                    <span style={{ fontWeight: videoStep === 2 ? '700' : '400', color: videoStep === 2 ? 'var(--accent)' : 'var(--text-muted)' }}>[2/4] Gemini Vision Scanning...</span>
                    <span style={{ fontWeight: videoStep === 3 ? '700' : '400', color: videoStep === 3 ? 'var(--accent)' : 'var(--text-muted)' }}>[3/4] Reconstructing 3D Mesh...</span>
                    <span style={{ fontWeight: videoStep === 4 ? '700' : '400', color: videoStep === 4 ? 'var(--accent)' : 'var(--text-muted)' }}>[4/4] Fitting to Mannequin...</span>
                  </div>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'block' }}>
                  <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleVideoUpload} 
                    style={{ display: 'none' }} 
                  />
                  <Video size={24} style={{ color: 'var(--text-secondary)', marginBottom: '10px' }} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Upload 10s hanger video</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    360° rotation video allows frame-by-frame 3D model reconstruction
                  </p>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Catalog Items Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: 'rgba(19, 17, 28, 0.95)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 180px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
              <Search size={14} style={{ color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Search color, fabric..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.8rem' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '6px' }}>
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className="form-input"
                style={{ width: 'auto', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem' }}
              >
                <option value="all">All</option>
                <option value="top">Tops</option>
                <option value="bottom">Bottoms</option>
                <option value="outerwear">Outerwear</option>
                <option value="footwear">Shoes</option>
              </select>

              <select 
                value={filterClean} 
                onChange={(e) => setFilterClean(e.target.value)}
                className="form-input"
                style={{ width: 'auto', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem' }}
              >
                <option value="all">All Status</option>
                <option value="clean">Clean Only</option>
                <option value="dirty">Dirty Only</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {filteredItems.length === 0 ? (
              <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No clothes found matching the filters.
              </div>
            ) : (
              filteredItems.map(item => (
                <div key={item.id} className="glass-panel glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px', background: 'rgba(19, 17, 28, 0.95)' }}>
                  
                  {/* Image Placeholder */}
                  <div style={{ 
                    height: '90px', 
                    borderRadius: '8px', 
                    background: '#13111C', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    overflow: 'hidden', 
                    position: 'relative',
                    border: '1px solid var(--border-color)' 
                  }}>
                    {item.is_3d ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '1.4rem' }}>👑</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--accent)' }}>3D MESH</span>
                      </div>
                    ) : item.image_data ? (
                      <img 
                        src={item.image_data} 
                        alt={item.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '1.25rem' }}>👕</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                          {item.fabric}
                        </span>
                      </div>
                    )}
                    
                    <span style={{ position: 'absolute', top: '6px', right: '6px' }}>
                      {item.is_clean ? (
                        <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 5px', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>Clean</span>
                      ) : (
                        <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 5px', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>Wash</span>
                      )}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '6px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{item.name}</h4>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                        title="Delete item"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: 'auto' }}>
                      <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>{item.category === 'footwear' ? 'shoes' : item.category}</span>
                      <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>{item.color}</span>
                      <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>{item.formality}</span>
                      <span className="chip" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>{item.style_tag}</span>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
