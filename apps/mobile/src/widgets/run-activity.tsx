import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, multilineTextAlignment, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

// The iOS Live Activity for a workout session (Lock Screen banner + Dynamic
// Island). A live set/rest companion: a big timer counts UP while you're working
// (running time) and shows a COUNTDOWN while resting, the current exercise is
// named above it, and the total workout time is minimized on the right. Timers
// tick on-device via SwiftUI's Text(timerInterval:), so nothing is pushed per
// second. Compiled into the widget extension by the '/widget/' directive; never
// rendered in the app's own React tree.

export type RunActivityProps = {
  startedAt: number; //      epoch ms of the whole-workout start (drives TOTAL time, counts up)
  label: string; //          e.g. "Week 3 · Run" — shown when there's no active exercise
  phase?: 'active' | 'rest'; // current phase; defaults to 'active'
  exercise?: string; //      current/active exercise name (e.g. "Back Squat")
  phaseStartedAt?: number; // epoch ms the current work phase began (drives running time); defaults to startedAt
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

  // Decide the phase HERE, from the clock, not just the reported phase: the app's
  // rest countdown pauses while backgrounded (locked phone), so it can't be
  // trusted to send the "back to work" update. If the rest end has passed, we're
  // working again and the running timer starts from restEndsAt.
  const now = Date.now();
  const restEndsAt = props.restEndsAt || 0;
  const resting = props.phase === 'rest' && restEndsAt > now;
  const workStart = props.phase === 'rest' && restEndsAt ? restEndsAt : props.phaseStartedAt || props.startedAt;

  const accent = resting ? REST : WORK;
  const leftLabel = resting ? (props.exercise ? 'REST · ' + props.exercise : 'REST') : props.exercise || props.label;
  // Show TOTAL on the right whenever there's real workout structure (an exercise,
  // a rest, or a work phase that started after the session did). Pure run days
  // stay a single running clock.
  const showTotal = resting || !!props.exercise || workStart !== props.startedAt;

  const totalRange = { lower: new Date(props.startedAt), upper: new Date(props.startedAt + CAP_MS) };
  const workRange = { lower: new Date(workStart), upper: new Date(workStart + CAP_MS) };
  const restRange = { lower: new Date(now), upper: new Date(restEndsAt || now) };

  const primaryTimer = resting ? (
    <Text timerInterval={restRange} countsDown={true} modifiers={[font({ size: 33, weight: 'bold' }), foregroundStyle(accent)]} />
  ) : (
    <Text timerInterval={workRange} countsDown={false} modifiers={[font({ size: 33, weight: 'bold' }), foregroundStyle(accent)]} />
  );

  return {
    banner: (
      <HStack alignment="firstTextBaseline" spacing={12} modifiers={[padding({ all: 15 }), frame({ maxWidth: 500, alignment: 'leading' })]}>
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(MUTED)]}>{leftLabel}</Text>
          {primaryTimer}
        </VStack>
        <Spacer />
        {showTotal ? (
          <VStack alignment="trailing" spacing={1}>
            <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(MUTED)]}>TOTAL</Text>
            <Text timerInterval={totalRange} countsDown={false} modifiers={[font({ size: 22, weight: 'semibold' }), foregroundStyle(FG), multilineTextAlignment('trailing')]} />
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
      <Text timerInterval={workRange} countsDown={false} modifiers={[foregroundStyle(accent)]} />
    ),
    minimal: <Image systemName={resting ? 'pause.fill' : 'figure.run'} color={accent} />,
    expandedLeading: <Image systemName={resting ? 'pause.fill' : 'figure.run'} color={accent} />,
    expandedCenter: <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle(MUTED)]}>{leftLabel}</Text>,
    expandedBottom: (
      <HStack alignment="firstTextBaseline" spacing={12} modifiers={[frame({ maxWidth: 500, alignment: 'leading' })]}>
        {resting ? (
          <Text timerInterval={restRange} countsDown={true} modifiers={[font({ size: 42, weight: 'bold' }), foregroundStyle(accent)]} />
        ) : (
          <Text timerInterval={workRange} countsDown={false} modifiers={[font({ size: 42, weight: 'bold' }), foregroundStyle(accent)]} />
        )}
        <Spacer />
        {showTotal ? (
          <VStack alignment="trailing" spacing={1}>
            <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(MUTED)]}>TOTAL</Text>
            <Text timerInterval={totalRange} countsDown={false} modifiers={[font({ size: 22, weight: 'semibold' }), foregroundStyle(FG), multilineTextAlignment('trailing')]} />
          </VStack>
        ) : (
          <Spacer />
        )}
      </HStack>
    ),
  };
};

export default createLiveActivity<RunActivityProps>('RunTimer', RunActivity);
