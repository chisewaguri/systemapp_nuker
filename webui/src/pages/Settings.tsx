import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import Config from '../components/Config'
import SegmentedList, { type SegmentedListItem } from '../components/SegmentedList'
import ConfigLib from '../lib/Config'
import { NukeConfig } from '../lib/NukeConfig'
import { useAppList } from '../lib/AppListContext'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import FileSelector from '../lib/FileSelector'
import { Cli } from '../lib/Cli'
import { REPO, TELEGRAM, LOCAL_STORAGE_KEY } from '../constant'
import TelegramIcon from '../assets/telegram.svg?react'
import WhiteoutIcon from '../assets/folder_off.svg?react'
import { runMutation } from '../lib/mutationLock'
import LoadError from '../components/LoadError'
import CreditsDialog from '../components/dialog/CreditsDialog'
import { updateUad, uadReady, uadSource, type UadSource } from '../lib/uad'

export default function Settings() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appListManager = useAppList()
  const [config, setConfig] = useState<ConfigLib | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [items, setItems] = useState<ConfigLib['config']>([])
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uad, setUad] = useState<UadSource>(uadSource)
  const [uadUpdating, setUadUpdating] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [whiteoutEnabled, setWhiteoutEnabled] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY + 'use-whiteout') === 'true'
  })

  const handleWhiteoutToggle = () => {
    const newValue = !whiteoutEnabled
    setWhiteoutEnabled(newValue)
    localStorage.setItem(LOCAL_STORAGE_KEY + 'use-whiteout', newValue ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('whiteout-toggled', { detail: newValue }))
  }

  useEffect(() => {
    uadReady().then(setUad)
  }, [])

  useEffect(() => {
    const cfg = new ConfigLib()
    cfg.read().then(() => {
      setConfig(cfg)
      setItems(cfg.config)
    }).catch(() => setLoadFailed(true))
  }, [])

  const handleSave = async (key: string, value: string | boolean | number) => {
    if (!config) return
    const started = await runMutation(async () => {
      setSaving(true)
      const updated = new ConfigLib()
      updated.config = config.config.map(item =>
        item.key === key ? { ...item, value } : item
      )

      try {
        await updated.write()
        setConfig(updated)
        setItems(updated.config)
      } catch {
        setItems([...config.config])
        snackBar.show(t('global.write_error'), false)
      } finally {
        setSaving(false)
      }
    })
    if (!started) {
      setItems([...config.config])
      snackBar.show(t('global.processing'), true, 3000)
    }
  }

  const handleUadUpdate = async () => {
    if (uadUpdating) return
    const started = await runMutation(async () => {
      setUadUpdating(true)
      snackBar.show(t('settings.uad_updating'), true, 60000)
      // starting the root shell can hold the page for a moment, so let the spinner paint first
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)))
      try {
        const source = await updateUad()
        setUad(source)
        snackBar.show(t('settings.uad_updated', { count: source.count }))
      } catch (error) {
        snackBar.show(t('settings.uad_update_error', { error: error instanceof Error ? error.message : String(error) }), false)
      } finally {
        setUadUpdating(false)
      }
    })
    if (!started) snackBar.show(t('global.processing'), true, 3000)
  }

  const closeCredits = useCallback(() => setCreditsOpen(false), [])

  const uadSubtitle = uad.kind === 'downloaded'
    ? t('settings.uad_source_downloaded', { date: uad.date ?? '?', count: uad.count })
    : uad.kind === 'bundled'
      ? t('settings.uad_source_bundled', { count: uad.count })
      : t('settings.uad_source_none')

  const handleImport = async (content: string | null) => {
    setFileSelectorOpen(false)
    await NukeConfig.handleImport(content, appListManager, snackBar.show)
  }

  const handleExport = () => {
    NukeConfig.export(appListManager, snackBar.show)
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        {loadFailed
          ? <LoadError />
          : <md-circular-progress indeterminate />}
      </div>
    )
  }

  const backupItems: SegmentedListItem[] = [
    {
      key: 'import',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">download</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.import_config')}</span>
          <span className="text-outline text-xs">{t('settings.import_config_desc')}</span>
        </>
      ),
      onClick: () => setFileSelectorOpen(true),
    },
    {
      key: 'export',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">upload</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.export_config')}</span>
          <span className="text-outline text-xs">{t('settings.export_config_desc')}</span>
        </>
      ),
      onClick: handleExport,
    },
  ]

  const aboutItems: SegmentedListItem[] = [
    {
      key: 'github_issues',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">bug_report</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.report_bug')}</span>
          <span className="text-outline text-xs">{t('settings.report_bug_desc')}</span>
        </>
      ),
      onClick: () => Cli.openLink(`https://www.github.com/${REPO}/issues`),
    },
    {
      key: 'source_code',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">code</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.source_code')}</span>
          <span className="text-outline text-xs">{t('settings.source_code_desc')}</span>
        </>
      ),
      onClick: () => Cli.openLink(`https://www.github.com/${REPO}`),
    },
    {
      key: 'telegram',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant"><TelegramIcon /></md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.telegram')}</span>
          <span className="text-outline text-xs">{t('settings.telegram_desc')}</span>
        </>
      ),
      onClick: () => Cli.openLink(TELEGRAM),
    },
    {
      key: 'credits',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">favorite</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.credits')}</span>
          <span className="text-outline text-xs">{t('settings.credits_desc')}</span>
        </>
      ),
      onClick: () => setCreditsOpen(true),
    },
  ]

  return (
    <>
      <Header title={t('settings.title')} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.config')}
      </div>
      <Config items={items} onSave={handleSave} disabled={saving} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.advanced')}
      </div>
      <SegmentedList items={[
        {
          key: 'use-whiteout',
          className: '!p-4 !justify-between',
          leadingContent: <md-icon class="text-on-surface-variant"><WhiteoutIcon /></md-icon>,
          content: (
            <>
              <span className="text-on-surface">{t('settings.whiteout_toggle')}</span>
              <span className="text-outline text-xs">{t('settings.whiteout_toggle_desc')}</span>
            </>
          ),
          trailingContent: (
            <md-switch
              aria-label={t('settings.whiteout_toggle')}
              icons
              selected={whiteoutEnabled}
              onChange={handleWhiteoutToggle}
            />
          ),
        },
        {
          key: 'uad-update',
          className: '!p-4',
          leadingContent: <md-icon class="text-on-surface-variant">sync</md-icon>,
          content: (
            <>
              <span className="text-on-surface">{t('settings.uad_update')}</span>
              <span className="text-outline text-xs">{uadSubtitle}</span>
            </>
          ),
          trailingContent: uadUpdating ? <md-circular-progress indeterminate style={{ '--md-circular-progress-size': '24px' } as React.CSSProperties} /> : undefined,
          onClick: uadUpdating ? undefined : handleUadUpdate,
        },
      ]} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.backup_restore')}
      </div>
      <SegmentedList items={backupItems} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.about')}
      </div>
      <SegmentedList items={aboutItems} />
      <CreditsDialog open={creditsOpen} onClose={closeCredits} />
      <FileSelector open={fileSelectorOpen} fileType="json" mode="content" onSelect={handleImport} />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} fabVisible={false} />
    </>
  )
}
