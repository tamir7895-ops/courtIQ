import React, { useRef, useState, useEffect, useCallback } from 'react';
import { loadModel, runInference, releaseModel } from '../inference.js';

export default function VideoPlayer({ videoUrl, modelPath, isRunning, setIsRunning, onDetections, onMetricsUpdate, onReset }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const offscreenCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const frameIdxRef = useRef(0);
  const fpsHistoryRef = useRef([]);
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confThreshold, setConfThreshold] = useState(0.25);
  const [currentDetections, setCurrentDetections] = useState([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);

  // Load model when path changes
  useEffect(() => {
    if (!modelPath) return;
    setModelLoading(true);
    setError(null);
    loadModel(modelPath)
      .then(() => { setModelLoaded(true); setModelLoading(false); })
      .catch((err) => { setError(err.message); setModelLoading(false); });
    
    return () => releaseModel();
  }, [modelPath]);

  // Initialize offscreen canvas for preprocessing
  useEffect(() => {
    offscreenRef.current = document.createElement('canvas');
    offscreenCtxRef.current = offscreenRef.current.getContext('2d');
  }, []);

  const drawDetections = useCallback((detections) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (const det of detections) {
      const { x1, y1, x2, y2, confidence, className, color } = det;
      const w = x2 - x1;
      const h = y2 - y1;
      
      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, w, h);
      
      // Draw label
      const label = `${className} ${(confidence * 100).toFixed(1)}%`;
      ctx.font = 'bold 14px monospace';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - 22, textWidth + 8, 22);
      
      ctx.fillStyle = 'white';
      ctx.fillText(label, x1 + 4, y1 - 6);
    }
  }, []);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || !modelLoaded) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const { detections, inferenceTime } = await runInference(
        video,
        offscreenRef.current,
        offscreenCtxRef.current,
        confThreshold
      );

      setCurrentDetections(detections);
      drawDetections(detections);
      
      const frameIdx = frameIdxRef.current++;
      onDetections(detections, frameIdx);
      setProcessedFrames(frameIdx + 1);
      
      // Calculate FPS
      const currentFps = 1000 / inferenceTime;
      fpsHistoryRef.current.push(currentFps);
      if (fpsHistoryRef.current.length > 30) fpsHistoryRef.current.shift();
      const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
      setFps(avgFps);

      // Update metrics
      onMetricsUpdate({
        fps: avgFps,
        inferenceTime,
        totalFrames: frameIdx + 1,
        lastDetections: detections
      });
    } catch (err) {
      console.error('[VideoPlayer] Inference error:', err);
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [modelLoaded, confThreshold, drawDetections, onDetections, onMetricsUpdate]);

  const handlePlay = () => {
    if (!modelLoaded) return;
    setIsRunning(true);
    frameIdxRef.current = 0;
    fpsHistoryRef.current = [];
    videoRef.current?.play();
    animFrameRef.current = requestAnimationFrame(processFrame);
  };

  const handleStop = () => {
    setIsRunning(false);
    videoRef.current?.pause();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Video container */}
      <div style={{ position: 'relative', background: '#000' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          style={{ width: '100%', display: 'block' }}
          muted
          onEnded={handleStop}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none'
          }}
        />
        
        {/* FPS overlay */}
        {isRunning && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,0.7)', padding: '4px 10px',
            borderRadius: 6, fontSize: '0.8rem', fontFamily: 'monospace'
          }}>
            {fps.toFixed(1)} FPS | Frame #{processedFrames}
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>❌ {error}</p>
        )}
        {modelLoading && (
          <p style={{ color: 'var(--info)', fontSize: '0.85rem' }}>⏳ טוען מודל...</p>
        )}
        
        {/* Confidence slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            סף ביטחון: {(confThreshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0.05" max="0.95" step="0.05"
            value={confThreshold}
            onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isRunning ? (
            <button className="btn-primary" onClick={handlePlay} disabled={!modelLoaded}>
              ▶ הפעל זיהוי
            </button>
          ) : (
            <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={handleStop}>
              ⏹ עצור
            </button>
          )}
          <button
            style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}
            onClick={onReset}
          >
            🔄 החלף וידאו
          </button>
        </div>
      </div>
    </div>
  );
}
