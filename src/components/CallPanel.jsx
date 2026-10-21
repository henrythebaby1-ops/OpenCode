import { useEffect, useRef, useState } from 'react';
import LatticeLoader from '../effects/LatticeLoader/LatticeLoader';
import { onVoicesChanged } from '../lib/speech';
import { KOKORO_VOICES, kokoroStatus, niceSystemVoices, onKokoroStatus } from '../lib/voice';

const LABELS = {
  connecting: 'Starting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  muted: 'Muted',
  error: 'Problem'
};

export default function CallPanel({ call, model, voiceName, rate, settings, update, onVoice, onRate, onMute, onInterrupt, onEnd }) {
  const [voiceList, setVoiceList] = useState(niceSystemVoices);
  const [kokoro, setKokoro] = useState(kokoroStatus);
  useEffect(() => onKokoroStatus(setKokoro), []);
  const turnsRef = useRef(null);

  useEffect(() => onVoicesChanged(() => setVoiceList(niceSystemVoices())), []);
  useEffect(() => {
    turnsRef.current?.scrollTo({ top: turnsRef.current.scrollHeight, behavior: 'smooth' });
  }, [call.turns.length, call.interim]);

  const state = call.muted ? 'muted' : call.state;

  return (
    <section className={`call-panel state-${state}`} role="dialog" aria-label="Voice call">
      <header className="call-head">
        <span className="call-dot" aria-hidden="true" />
        <strong>call</strong>
        <span className="dim">· {model}</span>
        <span className="spacer" />
        <span className={`call-badge ${call.recognition === 'on-device' ? 'ok' : 'warn'}`} title={call.recognition === 'on-device' ? 'Speech is recognised on this device' : 'Your browser may send audio to its speech service (e.g. Google in Chrome) to turn it into text. Replies are spoken by your system voices on this device.'}>
          {call.recognition === 'on-device' ? 'speech: on-device' : 'speech: browser service'}
        </span>
      </header>

      <div className="call-stage">
        <LatticeLoader
          status={state === 'error' ? 'error' : 'working'}
          label={LABELS[state] || 'Listening'}
          errorLabel="Problem"
          showTimer={false}
          grid={4}
          pattern={state === 'speaking' ? 'pulse' : state === 'thinking' ? 'spin' : state === 'muted' ? 'rain' : 'orbit'}
          step={state === 'listening' ? 120 : 80}
          cellSize={10}
          gap={3}
          fontSize={18}
          color="var(--accent)"
          errorColor="var(--err)"
          glow
        />
        <p className="call-live" aria-live="polite">
          {state === 'error'
            ? call.error
            : call.interim || (state === 'listening' ? 'Go ahead — I’m listening.' : state === 'muted' ? 'Microphone paused.' : state === 'thinking' ? '…' : '')}
        </p>
      </div>

      {call.turns.length > 0 && (
        <ol className="call-turns" ref={turnsRef}>
          {call.turns.slice(-8).map((t, i) => (
            <li key={i} className={t.who}>
              <span className="who">{t.who === 'you' ? 'you' : 'AI'}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="call-settings">
        <label>
          <span className="dim">engine</span>
          <select value={settings.voiceProvider} onChange={e => update({ voiceProvider: e.target.value })}>
            <option value="kokoro">Kokoro — natural, on this Mac</option>
            <option value="system">System voices</option>
          </select>
        </label>
        {settings.voiceProvider === 'kokoro' ? (
          <label>
            <span className="dim">voice</span>
            <select value={settings.kokoroVoice} onChange={e => update({ kokoroVoice: e.target.value })}>
              {KOKORO_VOICES.map(([id, name, desc]) => (
                <option key={id} value={id}>
                  {name} — {desc}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span className="dim">voice</span>
            <select value={voiceName} onChange={e => onVoice(e.target.value)}>
              <option value="">best available</option>
              {voiceList.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="dim">speed</span>
          <input type="range" min={0.7} max={1.6} step={0.05} value={rate} onChange={e => onRate(Number(e.target.value))} />
          <output>{rate.toFixed(2)}×</output>
        </label>
        {settings.voiceProvider === 'kokoro' && kokoro.status === 'loading' && (
          <div className="voice-progress" title="One-time download of the Kokoro voice model from Hugging Face; cached afterwards">
            <span className="dim">downloading voice model (one time)</span>
            <span className="progress">
              <i style={{ width: `${Math.round(kokoro.progress * 100)}%` }} />
            </span>
            <output>{Math.round(kokoro.progress * 100)}%</output>
          </div>
        )}
        {settings.voiceProvider === 'kokoro' && kokoro.status === 'error' && (
          <p className="err voice-error">Kokoro couldn’t load ({kokoro.error}). Switch the engine to System voices.</p>
        )}
        {call.voiceError && <p className="err voice-error">Voice error: {call.voiceError}</p>}
      </div>

      <footer className="call-controls">
        <button type="button" className={`btn ${call.muted ? 'primary' : ''}`} onClick={onMute}>
          {call.muted ? '🎙 unmute' : '🔇 mute'}
        </button>
        <button type="button" className="btn" onClick={onInterrupt} disabled={call.state !== 'speaking' && call.state !== 'thinking'}>
          ✋ interrupt
        </button>
        <span className="spacer" />
        <button type="button" className="btn end-call" onClick={onEnd}>
          ✕ end call
        </button>
      </footer>
    </section>
  );
}
