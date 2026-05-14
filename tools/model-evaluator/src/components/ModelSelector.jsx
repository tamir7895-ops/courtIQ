import React, { useRef } from 'react';

export default function ModelSelector({ onModelSelect, selectedModel }) {
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.onnx')) {
      const url = URL.createObjectURL(file);
      onModelSelect(url);
    }
  };

  const useBuiltIn = (version) => {
    // Served by custom Vite middleware from CourtIQ/models/
    const modelUrl = version === 'v6'
      ? '/models/basketball_yolox_tiny_v6.onnx'
      : '/models/basketball_yolox_tiny.onnx';
    onModelSelect(modelUrl);
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>📦 בחירת מודל</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => useBuiltIn('v6')}>
          YOLOX v6 (640×640)
        </button>
        <button 
          className="btn-primary" 
          style={{ background: 'var(--info)' }}
          onClick={() => useBuiltIn('v4')}
        >
          YOLOX v4 (640×640)
        </button>
        <button 
          style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}
          onClick={() => fileRef.current?.click()}
        >
          העלה מודל מותאם...
        </button>
        <input ref={fileRef} type="file" accept=".onnx" hidden onChange={handleFile} />
      </div>
      {selectedModel && (
        <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--success)' }}>
          ✓ מודל נטען: {selectedModel.includes('v6') ? 'YOLOX v6' : selectedModel.includes('v4') || selectedModel.includes('basketball_yolox_tiny.onnx') ? 'YOLOX v4' : 'Custom'}
        </p>
      )}
    </div>
  );
}
