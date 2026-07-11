import type { LiveActivityFactory } from 'expo-widgets';
import { Platform } from 'react-native';

import type { RunActivityProps } from '@/widgets/run-activity';

// iOS-only Live Activity control for the running timer. No-ops on web / Android,
// and pre-iOS-16.1 ActivityKit throws are swallowed, so the rest of the app is
// unaffected. The @expo/ui/swift-ui component is lazy-required only inside these
// iOS branches, so the web verification bundle never evaluates the SwiftUI shims.

// Live Activities render a BLANK banner on SDK 56 (a known expo-widgets bug:
// the widget JS runtime bundle doesn't reach the extension — expo/expo#43646,
// partially addressed by #44065 which is already in 56.0.22 yet still broken for
// our build). Disabled so we don't show an empty Lock Screen box; flip to true
// to re-enable once expo-widgets ships a working bundle (likely on SDK 57).
const LIVE_ACTIVITY_ENABLED = false;

function factory(): LiveActivityFactory<RunActivityProps> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../widgets/run-activity').default;
}

function endAll() {
  try {
    for (const a of factory().getInstances()) void a.end('immediate');
  } catch {
    /* best-effort */
  }
}

// Start (or restart) the Lock Screen / Dynamic Island run timer. Ends any live
// instance first so a fresh start or a restart never stacks activities.
export function startRunActivity(props: RunActivityProps) {
  if (!LIVE_ACTIVITY_ENABLED || Platform.OS !== 'ios') return;
  try {
    endAll();
    factory().start(props);
  } catch {
    /* best-effort: e.g. the user disabled Live Activities in Settings */
  }
}

export function endRunActivity() {
  if (Platform.OS !== 'ios') return;
  endAll();
}
