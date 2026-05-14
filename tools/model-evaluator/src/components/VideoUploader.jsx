import React, { useRef, useState } from 'react';

export default function VideoUploader({ onVideoSelect }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onVideoSelect(file);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) onVideoSelect(file);
  };

  return (
    <div
      className="card"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        minHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: dragOver ? '2px dashed var(--accent)' : '1px solid var(--border)',
        transition: 'border 0.2s'
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎬</div>
      <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
        גרור וידאו לכאן או לחץ לבחירה
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        MP4, MOV, WebM — ללא הגבלת גודל (הכל רץ מקומית)
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={handleFileInput}
      />
    </div>
  );
}
