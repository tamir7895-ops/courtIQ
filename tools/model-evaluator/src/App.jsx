import React, { useState, useCallback } from 'react';
import VideoUploader from './components/VideoUploader.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';
import MetricsDashboard from './components/MetricsDashboard.jsx';
import ModelSelector from './components/ModelSelector.jsx';

export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [modelPath, setModelPath] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [frameDetections, setFrameDetections] = useState([]);

  const handleVideoSelect = useCallback((file) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setMetrics(null);
    setFrameDetections([]);
  }, [videoUrl]);

  const handleModelSelect = useCallback((path) => {
    setModelPath(path);
  }, []);

  const handleDetections = useCallback((detections, frameIdx) => {
    setFrameDetections(prev => {
      const updated = [...prev];
      updated[frameIdx] = detections;
      return updated;
    });
  }, []);

  const handleMetricsUpdate = useCallback((newMetrics) => {
    setMetrics(newMetrics);
  }, []);

  return (
    <div className="app">
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🏀</div>
        <div>
          <h1>CourtIQ Model Evaluator</h1>
          <h2>בדיקת איכות מודל YOLOX על וידאו כדורסל</h2>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ModelSelector onModelSelect={handleModelSelect} selectedModel={modelPath} />
          
          {!videoUrl ? (
            <VideoUploader onVideoSelect={handleVideoSelect} />
          ) : (
            <VideoPlayer
              videoUrl={videoUrl}
              modelPath={modelPath}
              isRunning={isRunning}
              setIsRunning={setIsRunning}
              onDetections={handleDetections}
              onMetricsUpdate={handleMetricsUpdate}
              onReset={() => { 
                setVideoUrl(null); 
                setVideoFile(null); 
                setMetrics(null); 
                setFrameDetections([]); 
              }}
            />
          )}
        </div>

        <MetricsDashboard metrics={metrics} frameDetections={frameDetections} />
      </div>
    </div>
  );
}
