import type { KeyTrack } from './useKeyPrep'

// Where the cues shown come from, in a word.
export function cueOrigin(track: KeyTrack) {
  if (track.cueSource === 'rekordbox') return 'from rekordbox'
  if (track.cueSource === 'xml') return 'from the XML export'
  if (track.cueSource === 'edit') return 'edited in Cue'
  return 'auto placement'
}
