import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

// The iOS Live Activity for a workout session (Lock Screen banner + Dynamic
// Island). It is a live set/rest companion: the big timer counts UP while you're
// working (running time) and flips to a COUNTDOWN while resting, the current
// exercise is named above it, and the total workout time is minimized on the
// right. All timers tick on-device via SwiftUI's Text(timerInterval:), so the app
// never pushes per-second updates — it only update()s the activity when the phase
// or exercise changes. Compiled into the widget extension by the '/widget/'
// directive; never rendered in the app's own React tree.

export type RunActivityProps = {
  startedAt: number; //      epoch ms of the whole-workout start (drives TOTAL time, counts up)
  label: string; //          e.g. "Week 3 · Run" — shown when there's no active exercise
  phase?: 'active' | 'rest'; // current phase; defaults to 'active'
  exercise?: string; //      current/active exercise name (e.g. "Back Squat"); '' falls back to label
  phaseStartedAt?: number; // epoch ms the current active phase began (drives running time); defaults to startedAt
  restEndsAt?: number; //    epoch ms the current rest ends (drives the countdown); 0/absent = not resting
};

// IMPORTANT: every constant and helper the layout needs MUST be declared INSIDE
// this function. The babel widgets-plugin stringifies it in isolation and the
// widget extension evals that string with ONLY the @expo/ui component + modifier
// globals in scope (see expo-widgets/bundle/index.ts) — any module-level
// reference would be undefined there and silently blank the banner.
const RunActivity = (props: RunActivityProps, _env: LiveActivityEnvironment) => {
  'widget';
  const CAP_MS = 8 * 60 * 60 * 1000; // ActivityKit caps a Live Activity at ~8h; count-up timers bound to this
  const WORK = '#d97706'; //  amber — working / running
  const REST = '#3b82f6'; //  blue — resting
  const MUTED = '#9b9ba3';
  const FG = '#f5f5f7';

  const resting = props.phase === 'rest' && !!props.restEndsAt;
  const runStart = props.phaseStartedAt || props.startedAt;
  const accent = resting ? REST : WORK;
  const title = resting ? (props.exercise ? 'REST · ' + props.exercise : 'REST') : props.exercise || props.label;
  // Only show the separate TOTAL on the right once it diverges from the primary
  // timer (i.e. resting, or a work phase that started after the workout did).
  const showTotal = resting || runStart !== props.startedAt;

  const totalRange = { lower: new Date(props.startedAt), upper: new Date(props.startedAt + CAP_MS) };
  const runRange = { lower: new Date(runStart), upper: new Date(runStart + CAP_MS) };
  const restRange = { lower: new Date(), upper: new Date(props.restEndsAt || Date.now()) };

  const primaryTimer = resting ? (
    <Text timerInterval={restRange} countsDown={true} modifiers={[font({ size: 34, weight: 'bold' }), foregroundStyle(accent)]} />
  ) : (
    <Text timerInterval={runRange} countsDown={false} modifiers={[font({ size: 34, weight: 'bold' }), foregroundStyle(accent)]} />
  );

  return {
    banner: (
      <HStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 500, alignment: 'leading' })]}>
        <VStack modifiers={[frame({ alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(MUTED)]}>{title}</Text>
          {primaryTimer}
        </VStack>
        <Spacer />
        {showTotal ? (
          <VStack modifiers={[frame({ alignment: 'trailing' })]}>
            <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(MUTED)]}>TOTAL</Text>
            <Text timerInterval={totalRange} countsDown={false} modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(FG)]} />
          </VStack>
        ) : (
          <Spacer />
        )}
      </HStack>
    ),
    compactLeading: <Image systemName={resting ? 'pause.fill' : 'figure.run'} color={accent} />,
    compactTrailing: resting ? (
      <Text timerInterval={restRange} countsDown={true} modifiers={[foregroundStyle(accent)]} />
    ) : (
      <Text timerInterval={runRange} countsDown={false} modifiers={[foregroundStyle(accent)]} />
    ),
    minimal: <Image systemName={resting ? 'pause.fill' : 'figure.run'} color={accent} />,
    expandedLeading: <Image systemName={resting ? 'pause.fill' : 'figure.run'} color={accent} />,
    expandedCenter: <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle(MUTED)]}>{title}</Text>,
    expandedBottom: (
      <HStack modifiers={[frame({ maxWidth: 500, alignment: 'leading' })]}>
        {resting ? (
          <Text timerInterval={restRange} countsDown={true} modifiers={[font({ size: 44, weight: 'bold' }), foregroundStyle(accent)]} />
        ) : (
          <Text timerInterval={runRange} countsDown={false} modifiers={[font({ size: 44, weight: 'bold' }), foregroundStyle(accent)]} />
        )}
        <Spacer />
        {showTotal ? (
          <VStack modifiers={[frame({ alignment: 'trailing' })]}>
            <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(MUTED)]}>TOTAL</Text>
            <Text timerInterval={totalRange} countsDown={false} modifiers={[font({ size: 20, weight: 'semibold' }), foregroundStyle(FG)]} />
          </VStack>
        ) : (
          <Spacer />
        )}
      </HStack>
    ),
  };
};

export default createLiveActivity<RunActivityProps>('RunTimer', RunActivity);
