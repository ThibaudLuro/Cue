import { useEffect } from 'react'
import { Link } from 'react-router'
import { UsbIcon } from '../components/icons'
import { Logo } from '../components/ui'
import { Sidebar } from '../tool/Sidebar'
import { ToolHeader } from '../tool/ToolHeader'
import { TrackEditor } from '../tool/TrackEditor'
import { TrackList } from '../tool/TrackList'
import { useKeyPrep } from '../tool/useKeyPrep'
import { useUsbKey, type UsbKey } from '../tool/useUsbKey'

export function Tool() {
  const key = useUsbKey()

  useEffect(() => {
    document.title = 'Cue — Préparer ma clé'
    // Coming from the landing, the browser would keep its scroll position.
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // Once read, the key stays on screen when unplugged so the DJ's edits are not lost.
  if (key.files && key.files.length > 0) return <Workspace usbKey={key} />
  return <ConnectKey usbKey={key} />
}

function Workspace({ usbKey }: { usbKey: UsbKey }) {
  const prep = useKeyPrep(usbKey)

  // From md up, the page fits the window: the sidebar and the tracks scroll on their own.
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-sm leading-[1.45] text-fg md:h-screen">
      <ToolHeader prep={prep} />
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <Sidebar prep={prep} />
        {/* Like a deck above a browser: the selected track stays on top, the list scrolls below. */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-6 pt-5 pb-6 md:min-h-0">
          <TrackEditor prep={prep} />
          <TrackList prep={prep} />
        </main>
      </div>
    </div>
  )
}

function connectCopy(key: UsbKey) {
  if (key.phase === 'unsupported')
    return {
      title: 'Navigateur non compatible',
      text: 'Cue lit votre clé directement depuis le navigateur : ouvrez cette page dans Chrome, Edge ou Opera, sur ordinateur.',
    }
  if (key.phase === 'checking' || key.scanning)
    return { title: 'Lecture de la clé…', text: 'Cue cherche les morceaux sur votre clé.' }
  if (key.phase === 'reconnect')
    return {
      title: `Reprendre ${key.name}`,
      text: 'Le navigateur demande votre accord avant que Cue relise la clé utilisée la dernière fois.',
      action: 'Autoriser l’accès',
    }
  if (key.phase === 'unplugged')
    return {
      title: `Rebranchez ${key.name}`,
      text: 'Cue la détectera dès qu’elle sera branchée. Vous pouvez aussi choisir une autre clé.',
      action: 'Choisir une autre clé',
    }
  if (key.files?.length === 0)
    return {
      title: 'Aucun morceau sur cette clé',
      text: `Cue n’a trouvé aucun fichier MP3, WAV, FLAC ou AIFF dans ${key.name}. Vérifiez que vous avez choisi la bonne clé.`,
      action: 'Choisir une autre clé',
    }
  return {
    title: 'Branchez votre clé USB',
    text: 'Puis choisissez-la dans la fenêtre du navigateur : sélectionnez la clé elle-même, pas un dossier à l’intérieur. Vos morceaux ne quittent pas la clé.',
    action: 'Connecter ma clé',
  }
}

function ConnectKey({ usbKey }: { usbKey: UsbKey }) {
  const copy = connectCopy(usbKey)
  const busy = usbKey.phase === 'checking' || usbKey.scanning

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-sm leading-[1.45] text-fg">
      <header className="flex min-h-[60px] items-center border-b border-line px-5 py-2.5">
        <Link to="/" aria-label="Cue, accueil" className="flex items-center gap-2 text-fg">
          <Logo size="md" />
          <span className="text-base font-semibold tracking-[-0.02em]">Cue</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[440px] flex-col items-center rounded-2xl border border-line-strong bg-surface p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-xl bg-line text-fg">
            <UsbIcon className={busy ? 'motion-safe:animate-pulse' : ''} />
          </span>
          <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">{copy.title}</h1>
          <p className="mt-2 text-[15px] leading-[1.6] text-muted">{copy.text}</p>
          {copy.action && (
            <button
              type="button"
              onClick={usbKey.phase === 'reconnect' ? usbKey.reconnect : usbKey.connect}
              className="mt-6 flex h-11 cursor-pointer items-center rounded-lg bg-gradient-brand px-5.5 text-[15px] font-semibold text-canvas transition hover:opacity-90 active:scale-[0.98]"
            >
              {copy.action}
            </button>
          )}
          {usbKey.phase === 'reconnect' && (
            <button
              type="button"
              onClick={usbKey.connect}
              className="mt-3 h-9 cursor-pointer rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-fg"
            >
              Choisir une autre clé
            </button>
          )}
          {usbKey.error && (
            <p role="alert" className="mt-4 text-[13px] text-accent">
              {usbKey.error}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
