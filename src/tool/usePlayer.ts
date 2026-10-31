import { useEffect, useRef, useState } from 'react'
import { aiffToWav, isAiff } from './audio'
import type { KeyFile } from './usbKey'

export type Player = ReturnType<typeof usePlayer>

// Each value remembers which file it belongs to, so a new selection starts from zero.
type ForFile<T> = { path: string; value: T }

// Plays the selected track straight from the key. The file is only read on the first play
// or seek, so browsing the list stays instant.
export function usePlayer(file: KeyFile | undefined) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const loaded = useRef<{ path: string; url: string } | null>(null)
  const [playing, setPlaying] = useState<ForFile<boolean> | null>(null)
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState<ForFile<number> | null>(null)
  const [duration, setDuration] = useState<ForFile<number> | null>(null)
  const [error, setError] = useState<ForFile<string> | null>(null)

  const path = file?.path ?? ''
  const current = <T,>(state: ForFile<T> | null) => (state && state.path === path ? state.value : null)
  const isPlaying = current(playing) ?? false

  function element() {
    if (audio.current) return audio.current
    const created = new Audio()
    const at = () => loaded.current?.path ?? ''
    created.onplay = () => setPlaying({ path: at(), value: true })
    created.onpause = () => setPlaying({ path: at(), value: false })
    created.ondurationchange = () =>
      setDuration({ path: at(), value: Number.isFinite(created.duration) ? created.duration : 0 })
    created.ontimeupdate = () => setTime({ path: at(), value: created.currentTime })
    audio.current = created
    return created
  }

  async function load() {
    if (!file) return null
    const player = element()
    if (loaded.current?.path === file.path) return player
    setLoading(true)
    try {
      const data = await file.handle.getFile()
      const blob = isAiff(file.name) ? aiffToWav(await data.arrayBuffer()) : data
      if (loaded.current) URL.revokeObjectURL(loaded.current.url)
      loaded.current = { path: file.path, url: URL.createObjectURL(blob) }
      player.src = loaded.current.url
      return player
    } catch {
      setError({ path: file.path, value: 'Lecture impossible : la clé est-elle toujours branchée ?' })
      return null
    } finally {
      setLoading(false)
    }
  }

  // Another track: stop and release the previous one.
  useEffect(() => {
    const player = audio.current
    if (player) {
      player.pause()
      player.removeAttribute('src')
      player.load()
    }
    if (loaded.current) URL.revokeObjectURL(loaded.current.url)
    loaded.current = null
  }, [path])

  // Smooth playhead: timeupdate only fires about 4 times a second.
  useEffect(() => {
    if (!isPlaying) return
    let frame = requestAnimationFrame(function tick() {
      const player = audio.current
      if (player && loaded.current) setTime({ path: loaded.current.path, value: player.currentTime })
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  useEffect(
    () => () => {
      audio.current?.pause()
      if (loaded.current) URL.revokeObjectURL(loaded.current.url)
    },
    [],
  )

  async function toggle() {
    const player = await load()
    if (!player) return
    if (player.paused) {
      player.play().catch(() => setError({ path, value: 'Le navigateur ne sait pas lire ce fichier.' }))
    } else {
      player.pause()
    }
  }

  // position: 0 (start) to 1 (end).
  async function seek(position: number) {
    const player = await load()
    if (!player) return
    const apply = () => {
      player.currentTime = position * player.duration
      setTime({ path, value: player.currentTime })
    }
    if (Number.isFinite(player.duration)) apply()
    else player.addEventListener('loadedmetadata', apply, { once: true })
  }

  // Space bar plays and pauses, unless the DJ is typing or on a control that uses it.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, button, [contenteditable="true"]')) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const seconds = current(time) ?? 0
  const total = current(duration) ?? 0

  return {
    playing: isPlaying,
    loading,
    time: seconds,
    duration: total,
    position: total ? seconds / total : 0,
    error: current(error),
    toggle,
    seek,
  }
}
