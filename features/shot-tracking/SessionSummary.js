/**
 * SessionSummary.js — Post-Session Results Screen
 *
 * Shows after the tracking session ends:
 *  - Shot chart (dots on half-court diagram)
 *  - Made %, total shots, session duration
 *  - XP earned breakdown
 *  - Streak + zone stats
 *  - "Save to CourtIQ" button → writes to Supabase
 *
 * Uses react-native-svg for the court diagram and shot chart.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  Line,
  Ellipse,
  G,
} from 'react-native-svg';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

import {
  generateShotChartData,
  getCourtPaths,
  getShotDistribution,
} from './utils/heatmapGenerator';
import { saveSession, saveShots, grantXP } from './supabase/shotService';
import {
  saveZoneSnapshot,
  generateSmartAlerts,
  getZoneStatsForPeriod,
} from './utils/zoneHistory';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_PADDING = 20;
const CHART_WIDTH = SCREEN_W - CHART_PADDING * 2;

export default function SessionSummary({ route, navigation }) {
  const { summary } = route.params;
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [smartAlerts, setSmartAlerts] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);

  // Save zone history + generate alerts on mount
  React.useEffect(() => {
    (async () => {
      try {
        const zones = summary.shotsByZone || {};
        await saveZoneSnapshot(summary.sessionId, zones);
        const alerts = await generateSmartAlerts(zones);
        setSmartAlerts(alerts);
        const weekly = await getZoneStatsForPeriod('week');
        setWeeklyStats(weekly);
      } catch (e) {
        // Non-critical
      }
    })();
  }, [summary]);

  // Generate shot chart data
  const chartDots = useMemo(
    () => generateShotChartData(summary.shots),
    [summary.shots]
  );
  const courtPaths = useMemo(() => getCourtPaths(), []);
  const distribution = useMemo(
    () => getShotDistribution(summary.shots),
    [summary.shots]
  );

  // Chart aspect ratio
  const chartHeight = (CHART_WIDTH / courtPaths.width) * courtPaths.height;

  /**
   * Save session to Supabase and grant XP.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      // Save session + shots
      await saveSession({
        id: summary.sessionId,
        user_id: summary.userId,
        session_date: summary.startTime,
        session_type: 'ai_tracking',
        duration_ms: summary.durationMs,
        total_attempts: summary.totalAttempts,
        total_made: summary.totalMade,
        accuracy: summary.accuracy,
        max_streak: summary.maxStreak,
        xp_earned: summary.xpEarned,
        fg_made: summary.shotsByZone?.midrange?.made ?? 0,
        fg_missed: summary.shotsByZone?.midrange?.missed ?? 0,
        three_made: summary.shotsByZone?.threePoint?.made ?? 0,
        three_missed: summary.shotsByZone?.threePoint?.missed ?? 0,
        ft_made: (summary.shotsByZone?.paint?.made ?? 0) + (summary.shotsByZone?.freeThrow?.made ?? 0),
        ft_missed: (summary.shotsByZone?.paint?.missed ?? 0) + (summary.shotsByZone?.freeThrow?.missed ?? 0),
      });

      await saveShots(summary.shots);

      // Grant XP
      await grantXP(
        summary.userId,
        summary.xpEarned,
        `AI Shot Session: ${summary.totalMade}/${summary.totalAttempts}`
      );

      setIsSaved(true);
      Alert.alert('Saved!', 'Session data and XP have been saved to CourtIQ.');
    } catch (err) {
      Alert.alert('Save Failed', 'Could not save to server. Try again later.');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [summary]);

  const handleDone = useCallback(() => {
    // Navigate back to the main app / shot tracker tab
    navigation.popToTop();
  }, [navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── HEADER ── */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
        <Text style={styles.title}>Session Complete</Text>
        <Text style={styles.duration}>{summary.durationFormatted}</Text>
      </Animated.View>

      {/* ── BIG STATS ── */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.bigStatsRow}>
        <View style={styles.bigStat}>
          <Text style={[styles.bigStatValue, { color: getAccuracyColor(summary.accuracy) }]}>
            {summary.accuracy}%
          </Text>
          <Text style={styles.bigStatLabel}>Accuracy</Text>
        </View>
        <View style={styles.bigStatDivider} />
        <View style={styles.bigStat}>
          <Text style={styles.bigStatValue}>{summary.totalMade}</Text>
          <Text style={styles.bigStatLabel}>Made</Text>
        </View>
        <View style={styles.bigStatDivider} />
        <View style={styles.bigStat}>
          <Text style={styles.bigStatValue}>{summary.totalAttempts}</Text>
          <Text style={styles.bigStatLabel}>Attempts</Text>
        </View>
      </Animated.View>

      {/* ── SMART ALERTS ── */}
      {smartAlerts.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250)} style={styles.alertSection}>
          <Text style={styles.sectionTitle}>Insights</Text>
          {smartAlerts.map((alert, i) => (
            <View
              key={i}
              style={[
                styles.alertCard,
                alert.type === 'improvement' && styles.alertCardGreen,
                alert.type === 'perfect' && styles.alertCardGreen,
                alert.type === 'decline' && styles.alertCardRed,
              ]}
            >
              <Text style={styles.alertText}>{alert.text}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* ── WEEKLY ZONE STATS ── */}
      {weeklyStats && (
        <Animated.View entering={FadeInDown.delay(280)} style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weeklyRow}>
            {['paint', 'midrange', 'threePoint', 'freeThrow'].map((zone) => {
              const data = weeklyStats[zone];
              if (!data || data.total === 0) return null;
              return (
                <View key={zone} style={styles.weeklyItem}>
                  <Text style={styles.weeklyPct}>{data.pct}%</Text>
                  <Text style={styles.weeklyLabel}>
                    {zone === 'paint' ? 'Paint' : zone === 'midrange' ? 'Mid' : zone === 'threePoint' ? '3PT' : 'FT'}
                  </Text>
                  <Text style={styles.weeklyCount}>{data.made}/{data.total}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* ── SHOT CHART ── */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Shot Chart</Text>
        <View style={styles.chartWrapper}>
          <Svg
            width={CHART_WIDTH}
            height={chartHeight}
            viewBox={courtPaths.viewBox}
          >
            {/* Court background */}
            <Rect
              x="0"
              y="0"
              width={courtPaths.width}
              height={courtPaths.height}
              fill="#1a1a2e"
              rx="8"
            />

            {/* Court lines */}
            <G stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none">
              {/* Boundary */}
              <Rect
                x="5"
                y="5"
                width={courtPaths.width - 10}
                height={courtPaths.height - 10}
                rx="4"
              />

              {/* Three-point arc */}
              <Path d={courtPaths.threePointArc} />

              {/* Paint */}
              <Path d={courtPaths.paint} />

              {/* Free throw circle */}
              <Circle
                cx={courtPaths.ftCircle.cx}
                cy={courtPaths.ftCircle.cy}
                r={courtPaths.ftCircle.r}
              />

              {/* Backboard */}
              <Path d={courtPaths.backboard} strokeWidth="3" />
            </G>

            {/* Rim */}
            <Circle
              cx={courtPaths.rim.cx}
              cy={courtPaths.rim.cy}
              r={courtPaths.rim.r}
              stroke="#ff6b00"
              strokeWidth="2"
              fill="rgba(255, 107, 0, 0.2)"
            />

            {/* Shot dots — misses first (under made) */}
            {chartDots
              .filter((d) => d.result === 'missed')
              .map((dot, i) => (
                <Circle
                  key={`miss-${i}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.radius}
                  fill={dot.color}
                  opacity={dot.opacity}
                />
              ))}

            {/* Made shots on top */}
            {chartDots
              .filter((d) => d.result === 'made')
              .map((dot, i) => (
                <Circle
                  key={`made-${i}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.radius}
                  fill={dot.color}
                  opacity={dot.opacity}
                  stroke="#fff"
                  strokeWidth="1"
                />
              ))}
          </Svg>

          {/* Legend — zone colors */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ff4444' }]} />
              <Text style={styles.legendText}>Paint</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ffaa00' }]} />
              <Text style={styles.legendText}>Mid</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4da6ff' }]} />
              <Text style={styles.legendText}>3PT</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ba68c8' }]} />
              <Text style={styles.legendText}>FT</Text>
            </View>
          </View>
          <View style={styles.legendSubRow}>
            <Text style={styles.legendSubText}>Bright = Made | Dim = Missed</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── ZONE BREAKDOWN (interactive) ── */}
      <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Zone Breakdown</Text>
        {Object.entries(distribution.zones).map(([key, zone]) => {
          const pct = zone.total > 0 ? Math.round((zone.made / zone.total) * 100) : 0;
          const isSelected = selectedZone === key;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.7}
              onPress={() => setSelectedZone(isSelected ? null : key)}
            >
              <View style={[styles.zoneRow, isSelected && styles.zoneRowSelected]}>
                <View style={[styles.zoneColorDot, { backgroundColor: zone.color || '#888' }]} />
                <Text style={styles.zoneLabel}>{zone.label}</Text>
                <View style={styles.zoneBarBg}>
                  <View
                    style={[
                      styles.zoneBarFill,
                      {
                        width: zone.total > 0 ? `${pct}%` : '0%',
                        backgroundColor: zone.color || '#ff6b00',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.zoneValue}>
                  {zone.total > 0 ? `${pct}%` : '--'}
                </Text>
                <Text style={styles.zoneCount}>
                  {zone.made}/{zone.total}
                </Text>
              </View>
              {isSelected && zone.total > 0 && (
                <View style={styles.zoneDetail}>
                  <Text style={styles.zoneDetailText}>
                    Made: {zone.made} | Missed: {zone.total - zone.made} | Accuracy: {pct}%
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {distribution.hotZone && (
          <Text style={styles.zoneInsight}>
            Hot zone: {distribution.hotZone} | Cold zone: {distribution.coldZone}
          </Text>
        )}
      </Animated.View>

      {/* ── STREAK & EXTRAS ── */}
      <Animated.View entering={FadeInDown.delay(450)} style={styles.extraStats}>
        <View style={styles.extraStatItem}>
          <Text style={styles.extraStatValue}>{summary.maxStreak}</Text>
          <Text style={styles.extraStatLabel}>Best Streak</Text>
        </View>
        <View style={styles.extraStatItem}>
          <Text style={styles.extraStatValue}>{summary.totalMissed}</Text>
          <Text style={styles.extraStatLabel}>Missed</Text>
        </View>
      </Animated.View>

      {/* ── XP EARNED ── */}
      <Animated.View entering={FadeInUp.delay(500)} style={styles.xpSection}>
        <Text style={styles.xpTitle}>XP Earned</Text>
        <Text style={styles.xpTotal}>+{summary.xpEarned} XP</Text>
        {summary.xpBreakdown.map((item, i) => (
          <View key={i} style={styles.xpRow}>
            <Text style={styles.xpReason}>{item.reason}</Text>
            <Text style={styles.xpAmount}>+{item.amount}</Text>
          </View>
        ))}
      </Animated.View>

      {/* ── ACTIONS ── */}
      <Animated.View entering={FadeInUp.delay(600)} style={styles.actions}>
        {!isSaved ? (
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save to CourtIQ</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.savedBadge}>
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}

        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function getAccuracyColor(pct) {
  if (pct >= 65) return '#00ff88';
  if (pct >= 50) return '#ffaa00';
  return '#ff4444';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: CHART_PADDING,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  duration: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },

  // Big stats row
  bigStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 24,
  },
  bigStat: {
    flex: 1,
    alignItems: 'center',
  },
  bigStatValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  bigStatLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  bigStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Shot chart
  chartContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  chartWrapper: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    color: '#888',
    fontSize: 12,
  },
  legendSubRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  legendSubText: {
    color: '#555',
    fontSize: 10,
    fontStyle: 'italic',
  },

  // Zone breakdown
  section: {
    marginBottom: 24,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  zoneRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  zoneColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  zoneLabel: {
    color: '#aaa',
    fontSize: 13,
    width: 80,
  },
  zoneDetail: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    marginLeft: 14,
  },
  zoneDetailText: {
    color: '#999',
    fontSize: 12,
  },
  zoneBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  zoneBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  zoneValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  zoneCount: {
    color: '#666',
    fontSize: 11,
    width: 35,
    textAlign: 'right',
  },
  zoneInsight: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Alert section
  alertSection: {
    marginBottom: 24,
  },
  alertCard: {
    backgroundColor: 'rgba(77, 166, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(77, 166, 255, 0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  alertCardGreen: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  alertCardRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  alertText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },

  // Weekly stats row
  weeklyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 14,
  },
  weeklyItem: {
    alignItems: 'center',
  },
  weeklyPct: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  weeklyLabel: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  weeklyCount: {
    color: '#555',
    fontSize: 10,
    marginTop: 1,
  },

  // Extra stats
  extraStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 16,
  },
  extraStatItem: {
    alignItems: 'center',
  },
  extraStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  extraStatLabel: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // XP section
  xpSection: {
    backgroundColor: 'rgba(255, 107, 0, 0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.2)',
  },
  xpTitle: {
    color: '#ff6b00',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  xpTotal: {
    color: '#ff6b00',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 12,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  xpReason: {
    color: '#aaa',
    fontSize: 13,
  },
  xpAmount: {
    color: '#ff6b00',
    fontSize: 13,
    fontWeight: '700',
  },

  // Actions
  actions: {
    alignItems: 'center',
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#ff6b00',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  savedBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  savedText: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: '700',
  },
  doneButton: {
    paddingVertical: 12,
  },
  doneButtonText: {
    color: '#888',
    fontSize: 16,
  },
});
