import type { LiveActivityFactory } from 'expo-widgets';
import { Platform } from 'react-native';

import type { RunActivityProps } from '@/widgets/run-activity';

// iOS-only Live Activity control for the running timer. No-ops on web / Android,
// and pre-iOS-16.1 ActivityKit throws are swallowed, so the rest of the app is
// unaffected. The @expo/ui/swift-ui component is lazy-required only inside these
// iOS branches, so the web verification bundle never evaluates the SwiftUI shims.

// Live Activities are wired through expo-widgets' '/widget/' directive: the
// babel-preset-expo `widgets-plugin` stringifies the RunActivity layout at build
// time, createLiveActivity() stores that string in the App Group, and the widget
// extension reads + renders it. That plugin only runs when babel-preset-expo is
// applied, which requires apps/mobile/babel.config.js — a file this project was
// scaffolded without (mirrored from Rallo, which has no babel config and no
// expo-widgets). Without it Metro compiled RunActivity as a plain React
// component instead of a stringified layout, so nothing reached the extension and
// the banner rendered blank. babel.config.js now supplies the preset; enabled.
const LIVE_ACTIVITY_ENABLED = true;

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
