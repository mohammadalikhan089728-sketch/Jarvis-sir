import React from 'react';
import type { VoiceEngineState } from '../services/voiceService';

interface JarvisCoreVisualProps {
  voiceState: VoiceEngineState;
  isThinking: boolean;
  audioLevel: number;
  compact?: boolean;
}

export const JarvisCoreVisual: React.FC<JarvisCoreVisualProps> = ({
  voiceState,
  isThinking,
  audioLevel,
  compact = false,
}) => {
  const active = voiceState === 'listening' || voiceState === 'speaking' || isThinking;
  const sizeClass = compact ? 'w-32 h-32' : 'w-44 h-44 sm:w-52 sm:h-52';
  const scale = active ? 1 + audioLevel * 0.14 : 1;

  const ringColor =
    voiceState === 'listening'
      ? '#22D3EE'
      : voiceState === 'speaking'
        ? '#3B82F6'
        : isThinking
          ? '#38BDF8'
          : '#1D4ED8';

  const bars = 24;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        className={`relative ${sizeClass} flex items-center justify-center transition-transform duration-150`}
        style={{ transform: `scale(${scale.toFixed(3)})` }}
      >
        <div
          className="absolute inset-0 rounded-full opacity-35 blur-2xl transition-colors duration-200"
          style={{
            background: `radial-gradient(circle, ${ringColor} 0%, rgba(10,17,32,0) 70%)`,
          }}
        />
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="jarvisRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            stroke="rgba(56, 189, 248, 0.16)"
            strokeWidth="1.5"
          />
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke="url(#jarvisRingGrad)"
            strokeWidth="2.5"
            strokeDasharray="16 8 4 8"
            className={active ? 'origin-center animate-[spin_9s_linear_infinite]' : 'origin-center animate-[spin_24s_linear_infinite]'}
          />
          <circle
            cx="100"
            cy="100"
            r="52"
            fill="rgba(10, 17, 32, 0.85)"
            stroke={ringColor}
            strokeWidth="2.5"
          />
          <circle
            cx="100"
            cy="100"
            r="34"
            fill="none"
            stroke="rgba(34, 211, 238, 0.35)"
            strokeWidth="1"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="font-display text-sm tracking-[0.22em] text-sky-200 font-semibold">
            JARVIS
          </span>
          <span className="text-[11px] text-sky-400/80 mt-0.5">
            {isThinking
              ? 'Reasoning'
              : voiceState === 'listening'
                ? 'Listening'
                : voiceState === 'speaking'
                  ? 'Speaking'
                  : voiceState === 'wake_standby'
                    ? 'Wake Ready'
                    : 'Standby'}
          </span>
        </div>
      </div>

      {/* Audio waveform */}
      <div className="flex items-center justify-center gap-1 h-7" aria-hidden="true">
        {Array.from({ length: bars }).map((_, idx) => {
          const wave = Math.abs(Math.sin((idx + 1) * 0.65));
          const heightPct = active
            ? Math.max(18, Math.min(100, Math.round(22 + wave * (35 + audioLevel * 55))))
            : 16;
          return (
            <span
              key={idx}
              className="w-1 rounded-full transition-all duration-150"
              style={{
                height: `${heightPct}%`,
                backgroundColor: active ? '#22D3EE' : 'rgba(56, 189, 248, 0.25)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
