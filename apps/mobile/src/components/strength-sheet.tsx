import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutMode } from '@/components/workout-mode';
import {
  DYNAMIC_WARMUP,
  getStrengthBlockForWeek,
  strengthBlocks,
  type StrengthBlock,
  type StrengthDay,
} from '@/lib/program-data';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';

const COLW = 74;
const NAMEW = 150;
const RESTW = 54;

function DayHeader({ day }: { day: StrengthDay }) {
  return (
    <View style={styles.dayHead}>
      <View style={styles.dayBadge}>
        <Text style={styles.dayBadgeText}>{day.label}</Text>
      </View>
      {day.title ? <Text style={styles.dayTitle}>{day.title}</Text> : null}
    </View>
  );
}

function TableDay({ day, block, highlightWeek }: { day: StrengthDay; block: StrengthBlock; highlightWeek?: number }) {
  const rows = day.rows ?? [];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableWrap}>
      <View>
        <View style={[styles.trow, styles.thead]}>
          <View style={[styles.cell, { width: NAMEW, alignItems: 'flex-start' }]}>
            <Text style={styles.th}>Exercise</Text>
          </View>
          {block.weekLabels.map((wl, i) => (
            <View key={wl} style={[styles.cell, { width: COLW }]}>
              <Text style={[styles.th, block.weeks[i] === highlightWeek && { color: colors.accent }]}>{wl}</Text>
            </View>
          ))}
          <View style={[styles.cell, { width: RESTW }]}>
            <Text style={styles.th}>Rest</Text>
          </View>
        </View>
        {rows.map((row) => {
          const uniform = typeof row.prescription === 'string';
          return (
            <View key={row.name} style={styles.trow}>
              <View style={[styles.cell, { width: NAMEW, alignItems: 'flex-start' }]}>
                <Text style={styles.tdName}>
                  {row.group ? `${row.group}  ` : ''}
                  {row.name}
                </Text>
              </View>
              {uniform ? (
                <View style={[styles.cell, { width: COLW * block.weekLabels.length }]}>
                  <Text style={styles.td}>{row.prescription as string}</Text>
                </View>
              ) : (
                (row.prescription as string[]).map((val, i) => {
                  const hi = block.weeks[i] === highlightWeek;
                  return (
                    <View key={i} style={[styles.cell, { width: COLW }, hi && { backgroundColor: colors.accent + '12' }]}>
                      <Text style={[styles.td, hi && { color: colors.accent, fontWeight: '700' }]}>{val}</Text>
                    </View>
                  );
                })
              )}
              <View style={[styles.cell, { width: RESTW }]}>
                <Text style={styles.tdMuted}>{row.rest ?? ''}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function LadderDay({ day, block, highlightWeek }: { day: StrengthDay; block: StrengthBlock; highlightWeek?: number }) {
  const steps = day.ladder ?? [];
  return (
    <View>
      {day.note ? <Text style={styles.noteText}>{day.note}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableWrap}>
        <View>
          <View style={[styles.trow, styles.thead]}>
            <View style={[styles.cell, { width: 54, alignItems: 'flex-start' }]}>
              <Text style={styles.th}>Set</Text>
            </View>
            {block.weekLabels.map((wl, i) => (
              <View key={wl} style={[styles.cell, { width: 108 }]}>
                <Text style={[styles.th, block.weeks[i] === highlightWeek && { color: colors.accent }]}>{wl}</Text>
              </View>
            ))}
          </View>
          {steps.map((step, si) => (
            <View key={si} style={styles.trow}>
              <View style={[styles.cell, { width: 54, alignItems: 'flex-start' }]}>
                <Text style={styles.tdMuted}>{si + 1}</Text>
              </View>
              {step.map((val, i) => {
                const hi = block.weeks[i] === highlightWeek;
                return (
                  <View key={i} style={[styles.cell, { width: 108 }, hi && { backgroundColor: colors.accent + '12' }]}>
                    <Text style={[styles.td, hi && { color: colors.accent, fontWeight: '700' }]}>{val}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function CircuitDay({ day }: { day: StrengthDay }) {
  const rows = day.rows ?? [];
  return (
    <View style={styles.circuitWrap}>
      <View style={styles.circuitHead}>
        {day.rounds ? (
          <View style={styles.roundsBadge}>
            <Text style={styles.roundsText}>{day.rounds}</Text>
          </View>
        ) : null}
        {day.note ? <Text style={styles.noteText}>{day.note}</Text> : null}
      </View>
      {rows.map((row) => (
        <View key={row.name} style={styles.circuitRow}>
          <Text style={styles.circuitName}>{row.name}</Text>
          <Text style={styles.circuitRx}>{row.prescription as string}</Text>
        </View>
      ))}
    </View>
  );
}

function WarmUp() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.warmCard}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.warmHead}>
        <Text style={styles.warmTitle}>
          Dynamic Warm-Up <Text style={styles.warmSub}>before every session</Text>
        </Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.warmBody}>
          <Text style={styles.noteText}>Perform each movement over 10-15 yards.</Text>
          <View style={{ gap: 4, marginTop: 8 }}>
            {DYNAMIC_WARMUP.map((m) => (
              <View key={m.name} style={styles.warmItem}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warmName}>{m.name}</Text>
                  {m.note ? <Text style={styles.warmNote}>{m.note}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function StrengthSheet({
  onClose,
  initialWeek,
  programId = '10week',
  serverLogs,
  serverSets,
}: {
  onClose: () => void;
  initialWeek?: number;
  programId?: string;
  serverLogs?: Record<string, LoggedValue>;
  serverSets?: string[];
}) {
  const insets = useSafeAreaInsets();
  const initialBlock = initialWeek != null ? getStrengthBlockForWeek(initialWeek) : undefined;
  const [activeTitle, setActiveTitle] = useState(initialBlock?.title ?? strengthBlocks[0].title);
  const [mode, setMode] = useState<'workout' | 'reference'>('workout');
  const block = strengthBlocks.find((b) => b.title === activeTitle) ?? strengthBlocks[0];
  const highlightWeek = block.weeks.includes(initialWeek ?? -1) ? initialWeek : undefined;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hTitle}>Strength Sheet</Text>
            <Text style={styles.hSub}>SFAS Strength</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
        </View>

        {/* Block selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blockBarWrap} contentContainerStyle={styles.blockBar}>
          {strengthBlocks.map((b) => (
            <Pressable
              key={b.title}
              onPress={() => setActiveTitle(b.title)}
              style={[styles.blockPill, b.title === activeTitle ? styles.blockPillActive : styles.blockPillIdle]}>
              <Text style={[styles.blockPillText, { color: b.title === activeTitle ? colors.accent : colors.muted }]}>{b.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Mode toggle */}
        <View style={styles.modeWrap}>
          <View style={styles.modeToggle}>
            {(['workout', 'reference'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeBtn, mode === m && styles.modeBtnActive]}>
                <Text style={[styles.modeBtnText, { color: mode === m ? '#000' : colors.muted }]}>{m}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
          <WarmUp />
          {mode === 'workout' ? (
            <WorkoutMode block={block} programId={programId} initialWeek={initialWeek} serverLogs={serverLogs} serverSets={serverSets} />
          ) : (
            <>
              {block.days.map((day) => (
                <View key={day.label}>
                  <DayHeader day={day} />
                  {day.kind === 'table' ? <TableDay day={day} block={block} highlightWeek={highlightWeek} /> : null}
                  {day.kind === 'ladder' ? <LadderDay day={day} block={block} highlightWeek={highlightWeek} /> : null}
                  {day.kind === 'circuit' ? <CircuitDay day={day} /> : null}
                </View>
              ))}
              <Text style={styles.footNote}>Strength days rotate through the days above. Reps periodize across the block.</Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  hSub: { color: colors.muted, fontSize: 12 },
  closeBtn: { height: 36, width: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  closeX: { color: colors.muted, fontSize: 16 },

  blockBarWrap: { maxHeight: 44 },
  blockBar: { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  blockPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  blockPillActive: { backgroundColor: colors.accent + '30', borderColor: colors.accent + '50' },
  blockPillIdle: { backgroundColor: colors.card, borderColor: 'transparent' },
  blockPillText: { fontSize: 12, fontWeight: '700' },

  modeWrap: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modeToggle: { flexDirection: 'row', gap: 4, backgroundColor: colors.card, borderRadius: 10, padding: 4 },
  modeBtn: { flex: 1, borderRadius: 7, paddingVertical: 7, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.accent },
  modeBtnText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  body: { padding: 16, gap: 20 },

  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayBadge: { backgroundColor: colors.accent + '22', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  dayBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  dayTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  noteText: { color: colors.muted, fontSize: 12, marginBottom: 8 },

  tableWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  trow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  thead: { backgroundColor: colors.card, borderTopWidth: 0 },
  cell: { minHeight: 36, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  th: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  td: { color: colors.foreground, fontSize: 12, textAlign: 'center' },
  tdName: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  tdMuted: { color: colors.muted, fontSize: 12 },

  circuitWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  circuitHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexWrap: 'wrap' },
  roundsBadge: { backgroundColor: colors.success + '20', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  roundsText: { color: colors.success, fontSize: 12, fontWeight: '800' },
  circuitRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  circuitName: { flex: 1, color: colors.foreground, fontSize: 14, fontWeight: '600' },
  circuitRx: { color: colors.foreground, fontSize: 14, fontWeight: '700' },

  warmCard: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  warmHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  warmTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  warmSub: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  chevron: { color: colors.muted, fontSize: 14 },
  warmBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  warmItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { marginTop: 7, height: 4, width: 4, borderRadius: 2, backgroundColor: colors.accent },
  warmName: { color: colors.foreground, fontSize: 14 },
  warmNote: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },

  footNote: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingTop: 4 },
});
