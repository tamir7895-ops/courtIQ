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
    const modelUrls = {
      v71: '/models/basketball_yolox_tiny_v71.onnx',
      v7:  '/models/basketball_yolox_tiny_v7.onnx',
      v6:  '/models/basketball_yolox_tiny_v6.onnx',
      v4:  '/models/basketball_yolox_tiny.onnx',
    };
    onModelSelect(modelUrls[version] || modelUrls.v6);
  };

  // Order matters: v71 before v7 so substring match doesn't pick v7 first.
  const labelFor = (url) => {
    if (!url) return 'Custom';
    if (url.includes('v71')) return 'YOLOX v7.1';
    if (url.includes('v7'))  return 'YOLOX v7';
    if (url.includes('v6'))  return 'YOLOX v6';
    if (url.includes('basketball_yolox_tiny.onnx')) return 'YOLOX v4';
    return 'Custom';
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>📦 בחירת מודל</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => useBuiltIn('v71')}>
          YOLOX v7.1 (NEW — phone-tuned)
        </button>
        <button className="btn-primary" style={{ background: '#10b981' }} onClick={() => useBuiltIn('v7')}>
          YOLOX v7 (640x640)
        </button>
        <button className="btn-primary" onClick={() => useBuiltIn('v6')}>
          YOLOX v6 (640x640)
        </button>
        <button
          className="btn-primary"
          style={{ background: 'var(--info)' }}
          onClick={() => useBuiltIn('v4')}
        >
          YOLOX v4 (640x640)
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
          ✓ מודל נטען: {labelFor(selectedModel)}
        </p>
      )}
    </div>
  );
}
