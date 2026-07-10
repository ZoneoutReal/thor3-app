import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

// The iOS Live Activity for the running timer (Lock Screen banner + Dynamic
// Island). The elapsed time ticks on-device via SwiftUI's Text(timerInterval:)
// with countsDown=false, so the app never pushes per-second updates — it counts
// up from the workout's wall-clock start timestamp, exactly the Strava behavior.
// This component is compiled into the widget extension by the '/widget/'
// directive; it is never rendered in the app's own React tree.

export type RunActivityProps = {
  startedAt: number; // epoch ms of the workout timer start (the wall-clock anchor)
  label: string; //     e.g. "Week 3 · Run"
};

// ActivityKit caps a Live Activity at ~8h; the timer text counts up toward this
// upper bound. A run left paused past the cap ends gracefully server-agnostic.
const CAP_MS = 8 * 60 * 60 * 1000;
const ACCENT = '#d97706';
const MUTED = '#9b9ba3';

const RunActivity = (props: RunActivityProps, _env: LiveActivityEnvironment) => {
  'widget';
  const range = { lower: new Date(props.startedAt), upper: new Date(props.startedAt + CAP_MS) };
  return {
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(MUTED)]}>{props.label}</Text>
        <Text timerInterval={range} countsDown={false} modifiers={[font({ size: 36, weight: 'bold' }), foregroundStyle(ACCENT)]} />
      </VStack>
    ),
    compactLeading: <Image systemName="figure.run" color={ACCENT} />,
    compactTrailing: <Text timerInterval={range} countsDown={false} modifiers={[foregroundStyle(ACCENT)]} />,
    minimal: <Image systemName="figure.run" color={ACCENT} />,
    expandedLeading: <Image systemName="figure.run" color={ACCENT} />,
    expandedCenter: <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle(MUTED)]}>{props.label}</Text>,
    expandedBottom: (
      <Text timerInterval={range} countsDown={false} modifiers={[font({ size: 44, weight: 'bold' }), foregroundStyle(ACCENT)]} />
    ),
  };
};

export default createLiveActivity<RunActivityProps>('RunTimer', RunActivity);
