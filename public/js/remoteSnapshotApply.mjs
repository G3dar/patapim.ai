/**
 * Remote snapshot application — the ONE implementation of how a remote
 * terminal client applies a live viewport snapshot from the host.
 *
 * Consumed by BOTH remote clients:
 *   - patapim /desktop renderer (terminalManager, via esbuild bundling)
 *   - patapim.ai/remote-mobile (browser ESM import of the served copy)
 *
 * ⚠ A BYTE-IDENTICAL copy lives at patapim.ai/public/js/remoteSnapshotApply.mjs.
 *   The parity unit test (src/renderer/__tests__/remoteSnapshotApply.test.js)
 *   fails the patapim suite if the two files diverge — edit both together.
 *
 * Protocol recap: the host streams `snapshot` messages (~30fps ceiling) whose
 * `data` is a serialized VIEWPORT-ONLY frame. Repainting in place would never
 * grow the client's scrollback, so newer hosts also send:
 *   scrolled  – rows that left the host viewport since THIS client's previous
 *               frame (server-side per-client accounting, capped at one
 *               viewport; repaint/reflow scrolls are already excluded)
 *   alt       – whether the host mirror is on the alternate screen buffer
 *   cols/rows – host dims, so "N lines" means the same width on both ends
 *   seq       – output watermark for staleness detection
 *
 * The client pushes its top `scrolled` rows — which ARE the previous frame's
 * dying lines — into its own scrollback (LF at the bottom row scrolls one line
 * up), then clears and repaints. Every gate below exists because pushing the
 * wrong rows DUPLICATES content the user already scrolled past:
 *   - real-dims gate: pushed rows only align when the local xterm is actually
 *     at host dims AT WRITE TIME (a follower mid-resize round-trip is not);
 *     compare against the live terminal, never a shadow copy of host messages.
 *   - alt gate: the alt buffer has no scrollback — newline-pushing there just
 *     destroys visible rows. And when the host has RETURNED to the normal
 *     buffer (alt === false) while this client is stuck on alt (the frame that
 *     entered it carried ?1049h but nothing ever exits), prefix ?1049l: it
 *     restores the saved normal screen — exactly the pre-alt frame the push
 *     feeds from.
 *   - seq gate: strictly-older frames are dropped (a re-applied frame would
 *     re-push its `scrolled`); EQUAL seq must apply — it's a repaint with no
 *     new output.
 */

/**
 * Decide how to apply one snapshot message.
 *
 * @param {{ data:string, scrolled?:number, alt?:boolean, cols?:number,
 *           rows?:number, seq?:number }} msg - wire fields of the snapshot
 * @param {{ cols:number, rows:number, bufferType:string, lastSeq?:number }} view
 *   - read off the REAL local xterm at write time:
 *     cols/rows = terminal.cols/rows, bufferType = buffer.active.type,
 *     lastSeq = last applied snapshot seq (0/undefined if none)
 * @returns {{ drop:boolean, write:string|null, pinToBottom:boolean, nextSeq:number }}
 *   drop        – stale frame, apply nothing
 *   write       – the full byte string to term.write()
 *   pinToBottom – snap a scrolled-up viewport to the live frame after the
 *                 write. Alt-screen only: there is no history to dwell in, and
 *                 a stale alt viewport renders garbage. Normal-buffer scrollback
 *                 is genuine history — never yank the reader out of it.
 *   nextSeq     – value to store as lastSeq after applying
 */
export function planSnapshotApply(msg, view) {
  const data = typeof msg.data === 'string' ? msg.data : '';
  const seq = (msg.seq | 0) || 0;
  const lastSeq = (view.lastSeq | 0) || 0;
  if (seq && lastSeq && seq < lastSeq) {
    return { drop: true, write: null, pinToBottom: false, nextSeq: lastSeq };
  }

  const rows = Math.max(1, view.rows | 0);
  const inAlt = view.bufferType === 'alternate';
  const exitAlt = msg.alt === false && inAlt;
  const dimsAgree = !msg.cols || (view.cols === msg.cols && view.rows === msg.rows);
  const scrolled = (dimsAgree && (!inAlt || exitAlt))
    ? Math.min(Math.max(0, msg.scrolled | 0), rows)
    : 0;

  const prefix = exitAlt ? '\x1b[?1049l' : '';
  const preserve = scrolled > 0 ? '\x1b[' + rows + ';1H' + '\n'.repeat(scrolled) : '';
  // ?2026 (synchronized update) wraps the repaint against tearing on renderers
  // that honor it (harmless no-op on xterm.js); SGR reset before 2J so cleared
  // cells don't inherit a stale background; no \x1b[3J ever — a viewport
  // snapshot must not wipe scrollback.
  const write = '\x1b[?2026h\x1b[?25l' + prefix + preserve
    + '\x1b[0m\x1b[2J\x1b[H' + data + '\x1b[?25h\x1b[?2026l';

  return {
    drop: false,
    write,
    pinToBottom: inAlt && !exitAlt,
    nextSeq: seq || lastSeq,
  };
}

/**
 * Accumulates snapshots that arrive before the client terminal is ready to
 * render them (e.g. the /desktop renderer before mountTerminal). Writing them
 * into an unmounted xterm and then appending the full history duplicates the
 * entire buffer — instead: keep only the LATEST frame and the SUM of the
 * `scrolled` deltas (each delta is relative to the frame before it, so the
 * sum is what sequential application would have pushed; anything beyond one
 * viewport is blank rows and gets capped at apply time by planSnapshotApply).
 */
export class PendingSnapshotAccumulator {
  constructor() {
    this._msg = null;
    this._scrolled = 0;
  }

  /** @param {object} msg - a snapshot wire message */
  add(msg) {
    this._scrolled += Math.max(0, msg.scrolled | 0);
    this._msg = { ...msg };
  }

  /** @returns {object|null} the merged snapshot message, and resets */
  take() {
    if (!this._msg) return null;
    const merged = { ...this._msg, scrolled: this._scrolled };
    this._msg = null;
    this._scrolled = 0;
    return merged;
  }

  clear() {
    this._msg = null;
    this._scrolled = 0;
  }

  get hasPending() {
    return this._msg !== null;
  }
}
