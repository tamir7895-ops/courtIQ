import React, { useMemo } from 'react';

export default function MetricsDashboard({ metrics, frameDetections }) {
  const stats = useMemo(() => {
    if (!frameDetections || frameDetections.length === 0) return null;
    
    const allDetections = frameDetections.filter(Boolean).flat();
    if (allDetections.length === 0) return null;
    
    const ballDetections = allDetections.filter(d => d.classId === 0);
    const hoopDetections = allDetections.filter(d => d.classId === 1);
    
    const framesWithBall = frameDetections.filter(f => f && f.some(d => d.classId === 0)).length;
    const framesWithHoop = frameDetections.filter(f => f && f.some(d => d.classId === 1)).length;
    const totalFrames = frameDetections.filter(Boolean).length;
    
    const avgBallConf = ballDetections.length > 0
      ? ballDetections.reduce((s, d) => s + d.confidence, 0) / ballDetections.length
      : 0;
    const avgHoopConf = hoopDetections.length > 0
      ? hoopDetections.reduce((s, d) => s + d.confidence, 0) / hoopDetections.length
      : 0;
    
    // Confidence distribution buckets
    const confBuckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
    allDetections.forEach(d => {
      const bucket = Math.min(4, Math.floor(d.confidence * 5));
      confBuckets[bucket]++;
    });
    
    // Max confidence seen
    const maxBallConf = ballDetections.length > 0 ? Math.max(...ballDetections.map(d => d.confidence)) : 0;
    const maxHoopConf = hoopDetections.length > 0 ? Math.max(...hoopDetections.map(d => d.confidence)) : 0;
    
    return {
      totalDetections: allDetections.length,
      ballDetections: ballDetections.length,
      hoopDetections: hoopDetections.length,
      framesWithBall,
      framesWithHoop,
      totalFrames,
      avgBallConf,
      avgHoopConf,
      maxBallConf,
      maxHoopConf,
      confBuckets,
      ballDetectionRate: totalFrames > 0 ? (framesWithBall / totalFrames) * 100 : 0,
      hoopDetectionRate: totalFrames > 0 ? (framesWithHoop / totalFrames) * 100 : 0,
    };
  }, [frameDetections]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Live stats */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>📊 סטטיסטיקות חיות</h3>
        {metrics ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatBox label="FPS" value={metrics.fps?.toFixed(1)} color="var(--success)" />
            <StatBox label="זמן inference" value={`${metrics.inferenceTime?.toFixed(0)}ms`} color="var(--info)" />
            <StatBox label="פריימים" value={metrics.totalFrames} color="var(--text)" />
            <StatBox label="זיהויים כעת" value={metrics.lastDetections?.length || 0} color="var(--accent)" />
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            הפעל זיהוי על וידאו כדי לראות סטטיסטיקות
          </p>
        )}
      </div>

      {/* Aggregated stats */}
      {stats && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>🏀 זיהוי כדור</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MetricRow label="שיעור זיהוי" value={`${stats.ballDetectionRate.toFixed(1)}%`} />
              <ProgressBar value={stats.ballDetectionRate} color="var(--accent)" />
              <MetricRow label="ביטחון ממוצע" value={`${(stats.avgBallConf * 100).toFixed(1)}%`} />
              <MetricRow label="ביטחון מקסימלי" value={`${(stats.maxBallConf * 100).toFixed(1)}%`} />
              <MetricRow label="סה״כ זיהויים" value={stats.ballDetections} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>🏁 זיהוי סל</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MetricRow label="שיעור זיהוי" value={`${stats.hoopDetectionRate.toFixed(1)}%`} />
              <ProgressBar value={stats.hoopDetectionRate} color="var(--info)" />
              <MetricRow label="ביטחון ממוצע" value={`${(stats.avgHoopConf * 100).toFixed(1)}%`} />
              <MetricRow label="ביטחון מקסימלי" value={`${(stats.maxHoopConf * 100).toFixed(1)}%`} />
              <MetricRow label="סה״כ זיהויים" value={stats.hoopDetections} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>📈 התפלגות ביטחון</h3>
            <ConfidenceChart buckets={stats.confBuckets} />
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function ProgressBar({ value, color }) {
  return (
    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  );
}

function ConfidenceChart({ buckets }) {
  const max = Math.max(...buckets, 1);
  const labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
  
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {buckets.map((count, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{count}</span>
          <div style={{
            width: '100%',
            height: `${(count / max) * 60}px`,
            background: `hsl(${i * 30 + 10}, 80%, 55%)`,
            borderRadius: 4,
            minHeight: 2
          }} />
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
