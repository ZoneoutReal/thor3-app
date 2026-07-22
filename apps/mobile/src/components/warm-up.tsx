import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DYNAMIC_WARMUP } from '@/lib/program-data';
import { colors } from '@/lib/theme';

// The dynamic warm-up performed before every workout. Reference-only by default
// (a dot list); pass isChecked/onToggle to make each movement a checkable item.
// The day logger uses the checkable mode, keyed per day, so a user can tick each
// movement off; the strength sheet uses the plain reference list.
export function WarmUp({
  isChecked,
  onToggle,
}: {
  isChecked?: (i: number) => boolean;
  onToggle?: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const checkable = !!isChecked && !!onToggle;
  const doneCount = checkable ? DYNAMIC_WARMUP.filter((_, i) => isChecked!(i)).length : 0;
  const allDone = checkable && doneCount === DYNAMIC_WARMUP.length;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.head}>
        <Text style={styles.title}>
          Dynamic Warm-Up <Text style={styles.sub}>before every session</Text>
        </Text>
        {checkable ? (
          <Text style={[styles.count, allDone && { color: colors.success }]}>
            {doneCount}/{DYNAMIC_WARMUP.length}
          </Text>
        ) : null}
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.note}>Perform each movement over 10-15 yards.</Text>
          <View style={{ gap: 2, marginTop: 8 }}>
            {DYNAMIC_WARMUP.map((m, i) => {
              const checked = checkable && isChecked!(i);
              const inner = (
                <>
                  {checkable ? (
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                  ) : (
                    <View style={styles.dot} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, checked && styles.nameDone]}>{m.name}</Text>
                    {m.note ? <Text style={styles.moveNote}>{m.note}</Text> : null}
                  </View>
                </>
              );
              return checkable ? (
                <Pressable key={m.name} onPress={() => onToggle!(i)} style={styles.item}>
                  {inner}
                </Pressable>
              ) : (
                <View key={m.name} style={styles.item}>
                  {inner}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  title: { flex: 1, color: colors.foreground, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  count: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 14 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  note: { color: colors.muted, fontSize: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: '#000', fontSize: 13, fontWeight: '800' },
  name: { color: colors.foreground, fontSize: 14 },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  moveNote: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
