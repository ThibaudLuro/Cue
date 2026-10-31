import type { KeyTrack } from './useKeyPrep'

// Where the cues shown come from, in a word.
export function cueOrigin(track: KeyTrack) {
  if (track.cueSource === 'rekordbox') return 'repris de rekordbox'
  if (track.cueSource === 'xml') return 'repris de l’export XML'
  if (track.cueSource === 'edit') return 'modifiés dans Cue'
  return 'placement auto'
}

export function resetLabel(track: KeyTrack) {
  if (track.cueSource !== 'edit') return 'Placement auto'
  if (track.keyCues === 'rekordbox') return 'Revenir à rekordbox'
  if (track.keyCues === 'xml') return 'Revenir à l’export'
  return 'Replacer auto'
}
