import type { KeyTrack } from './useKeyPrep'

// Where the cues shown come from, in a word.
export function cueOrigin(track: KeyTrack) {
  if (track.cueSource === 'rekordbox') return 'from rekordbox'
  if (track.cueSource === 'xml') return 'from the XML export'
  if (track.cueSource === 'edit') return 'edited in Cue'
  return 'auto placement'
}

export function resetLabel(track: KeyTrack) {
  if (track.cueSource !== 'edit') return 'Auto placement'
  if (track.keyCues === 'rekordbox') return 'Back to rekordbox'
  if (track.keyCues === 'xml') return 'Back to the export'
  return 'Reset to auto'
}
