import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { exec } from 'kernelsu-alt'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import { useDialogAnimation } from '../hooks/useDialogAnimation'
import { useHistory } from '../hooks/useHistory'
import type { MdFilledTextField } from '@material/web/all'

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
}

interface FileSelectorProps {
  open: boolean
  fileType: string
  mode?: 'path' | 'content'
  folder?: boolean
  onSelect: (value: string | null) => void
  root?: string
}

const dir = (p: string) => p.replace(/\/+$/, '') + '/'

export default function FileSelector({ open, fileType, mode: rawMode = 'path', folder = false, onSelect, root = '/storage/emulated/0/' }: FileSelectorProps) {
  const mode = folder ? 'path' : rawMode
  const dialogRef = useRef<MdDialog>(null)
  const pathFieldRef = useRef<HTMLElement>(null)
  const [currentPath, setCurrentPath] = useState(root)
  const [inputValue, setInputValue] = useState(root)
  const { push, consume } = useHistory()

  const [files, setFiles] = useState<FileItem[]>([])
  const [switching, setSwitching] = useState(false)

  const listFiles = useCallback(async (path: string, skipAnimation = false) => {
    if (!skipAnimation) {
      setSwitching(true)
      await new Promise(r => setTimeout(r, 150))
    }

    const dirPath = dir(path)
    const fileFilter = fileType === 'any' ? 'echo "f|$f"' : `[[ "$f" == *.${fileType} ]] && echo "f|$f"`
    const result = await exec(`
      cd "${path}"
      for f in *; do
        [ -d "$f" ] && echo "d|$f" || { ${fileFilter}; }
      done | sort
    `)

    const items: FileItem[] = []
    if (result.errno === 0) {
      if (dirPath !== root) {
        items.push({ name: '..', path: dir(dirPath.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || root), isDirectory: true })
      }
      const parsed = result.stdout.split('\n')
        .filter(Boolean)
        .map(line => ({
          name: line.slice(2),
          path: `${dirPath}${line.slice(2)}`.replace(/\/+/g, '/'),
          isDirectory: line[0] === 'd',
        }))
      items.push(...parsed)
    }

    setFiles(items)
    if (!skipAnimation) setSwitching(false)
  }, [fileType, root])

  useLayoutEffect(() => {
    const scroller = dialogRef.current?.shadowRoot?.querySelector('.scroller') as HTMLElement | null
    scroller?.scrollTo(0, 0)
  }, [files])

  useEffect(() => {
    if (!dialogRef.current) return
    useDialogAnimation(dialogRef.current)
    if (open) {
      setCurrentPath(root)
      setInputValue(root)
      setFiles([])
      dialogRef.current.show()
      requestAnimationFrame(() => listFiles(root, true))
      push('file-selector', () => dialogRef.current?.close())
    } else {
      dialogRef.current.close()
    }
  }, [open, push, root, listFiles])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const onClosed = () => {
      consume('file-selector')
      onSelect(null)
    }

    el.addEventListener('closed', onClosed)

    return () => {
      el.removeEventListener('closed', onClosed)
    }
  }, [onSelect, consume])

  useEffect(() => {
    setInputValue(currentPath)
    setTimeout(() => {
      const el = pathFieldRef.current?.shadowRoot?.querySelector('.input') as HTMLInputElement | null
      if (el) {
        el.style.overflowX = 'auto'
        el.scrollLeft = el.scrollWidth
      }
    }, 0)
  }, [currentPath])

  const navigateBack = useCallback(() => {
    const cur = dir(currentPath)
    if (cur === root) return
    const parent = dir(cur.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || root)
    setCurrentPath(parent)
    listFiles(parent)
  }, [currentPath, listFiles, root])

  const handlePathKeyDown = useCallback(async (e: React.KeyboardEvent<MdFilledTextField>) => {
    if (e.key === 'Enter') {
      const value = inputValue.trim()
      if (value === currentPath) {
        e.currentTarget.blur()
        return
      }
      if (value.startsWith(root)) {
        const result = await exec(`[ -f "${value}" ] && echo file || ([ -d "${value}" ] && echo dir || echo none)`)
        const entryType = result.stdout?.trim()
        if (entryType === 'file') {
          const name = value.split('/').filter(Boolean).pop() || ''
          const pDir = dir(value.split('/').slice(0, -1).join('/') || root)
          const grandParent = dir(pDir.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || root)
          const items: FileItem[] = []
          if (pDir !== root) {
            items.push({ name: '..', path: grandParent, isDirectory: true })
          }
          items.push({ name, path: value, isDirectory: false })
          setFiles(items)
          setCurrentPath(pDir)
        } else {
          setCurrentPath(dir(value))
          listFiles(value)
        }
        e.currentTarget.blur()
      }
    }
  }, [inputValue, currentPath, root, listFiles])

  const handleItemClick = useCallback(async (item: FileItem) => {
    if (item.isDirectory) {
      if (item.name === '..') {
        navigateBack()
      } else {
        const dirPath = dir(item.path)
        setCurrentPath(dirPath)
        listFiles(dirPath)
      }
    } else {
      if (mode === 'content') {
        const result = await exec(`cat "${item.path}"`)
        onSelect(result.errno === 0 ? result.stdout : null)
      } else {
        onSelect(item.path)
      }
    }
  }, [mode, onSelect, navigateBack, listFiles])

  const openSystemFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = fileType === 'any' ? '*/*' : `.${fileType}`
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (fileType !== 'any' && !file.name.endsWith(`.${fileType}`)) return
      if (mode === 'content') {
        const reader = new FileReader()
        reader.onload = () => onSelect(reader.result as string)
        reader.readAsText(file)
      } else {
        onSelect(file.name)
      }
    }
    input.click()
  }, [fileType, mode, onSelect])

  const close = useCallback(() => {
    onSelect(null)
  }, [onSelect])

  const dialog = (
    <md-dialog
      ref={dialogRef}
      class="file-selector-dialog"
      style={{
        width: 'min(560px, 100% - 48px)',
        height: 'min(560px, 100% - 48px)',
      }}
    >
      <div slot="headline" className="flex items-center gap-2">
        <md-icon-button onClick={navigateBack}>
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <md-filled-text-field
          ref={pathFieldRef as React.RefObject<HTMLElement>}
          className="flex-1"
          value={inputValue}
          onInput={(e: React.InputEvent<MdFilledTextField>) => {
            const value = e.currentTarget.value
            if (value.startsWith(root) || value === '') {
              setInputValue(value)
            } else {
              e.currentTarget.value = inputValue
            }
          }}
          onKeyDown={handlePathKeyDown}
          style={{
            '--md-filled-text-field-container-color': 'var(--md-sys-color-surface-container-high)',
            '--_leading-space': '0',
            '--_trailing-space': '0',
            '--_top-space': '4px',
            '--_bottom-space': '4px'
          } as React.CSSProperties}
        />
      </div>
      <div slot="content" className={`transition-opacity duration-230 ease-out ${switching ? 'opacity-0' : 'opacity-100'}`} >
        {files.map((item) => (
          <div
            key={item.path}
            onClick={() => handleItemClick(item)}
            className="flex items-center px-3 py-2.5 rounded-lg relative overflow-hidden select-none active:bg-surface-container-high text-on-surface"
          >
            <md-icon class="mr-2.5 text-on-surface-variant">
              {item.isDirectory ? 'folder' : 'description'}
            </md-icon>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {item.name}
            </span>
          </div>
        ))}
      </div>
      <div slot="actions" className="flex items-center gap-2">
        {mode === 'content' && (
          <md-icon-button onClick={openSystemFile}>
            <md-icon>folder_open</md-icon>
          </md-icon-button>
        )}
        {folder && (
          <md-text-button onClick={() => onSelect(currentPath)}>Select Folder</md-text-button>
        )}
        <div className="flex-1" />
        <md-text-button onClick={close}>Cancel</md-text-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
