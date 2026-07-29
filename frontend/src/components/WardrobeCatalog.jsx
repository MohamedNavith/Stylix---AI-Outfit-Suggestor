import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Sparkles, Filter, Plus, Search } from 'lucide-react';

export default function WardrobeCatalog({ apiHost, username, onStatsChange }) {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
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

  const filteredItems = items.filter(item => {
    const categoryMatch = filterCategory === 'all' || item.category === filterCategory;
    const cleanMatch = filterClean === 'all' || 
                       (filterClean === 'clean' && item.is_clean) || 
                       (filterClean === 'dirty' && !item.is_clean);
    const searchMatch = searchQuery === '' || 
                       item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       item.color.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       item.style_tag.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && cleanMatch && searchMatch;
  });

  return (
    <div className="animate-fade-up" style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF' }}>Wardrobe Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Catalog clothing photos & auto-tag details via Gemini Vision
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(19, 17, 28, 0.95)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add Garment
          </h3>
          
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
                    {item.image_data ? (
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
