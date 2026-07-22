import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

// iOS number-pad / decimal-pad keyboards have no return or "Done" key, so a
// focused reps/weight field can't be dismissed from the keyboard itself — and
// the keyboard covers the primary action button. This bar sits directly above
// the keyboard with a Done button that closes it. Wire a numeric TextInput to
// it with `inputAccessoryViewID={NUMERIC_ACCESSORY_ID}` and render one of these
// inside the same screen.
//
// iOS only: Android numeric keyboards dismiss via the system back gesture, and
// InputAccessoryView is an iOS-only component.
export const NUMERIC_ACCESSORY_ID = 'rukr-numeric-done';

export function NumericDoneAccessory() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10} style={styles.btn}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btn: { paddingHorizontal: 16, paddingVertical: 6 },
  done: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});
