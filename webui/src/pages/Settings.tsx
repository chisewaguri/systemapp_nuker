import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import Config from '../components/Config'
import SegmentedList, { type SegmentedListItem } from '../components/SegmentedList'
import ConfigLib from '../lib/Config'
import { NukeConfig, type ImportPreview } from '../lib/NukeConfig'
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
import { isDev } from '../lib/utils'
import { updateUad, uadReady, uadSource, UAD_REPO, type UadSource } from '../lib/uad'
import AppReviewDialog from '../components/dialog/AppReviewDialog'
import { useMutationBusy } from '../hooks/useMutationBusy'
import { refreshLists } from '../lib/refreshLists'
import ReviewDialog from '../components/dialog/ReviewDialog'
import { whiteoutManager } from '../lib/Whiteout'

let expandedSections: string[] = []

export default function Settings() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appListManager = useAppList()
  const [config, setConfig] = useState<ConfigLib | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [items, setItems] = useState<ConfigLib['config']>([])
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lateLoaded, setLateLoaded] = useState<boolean | null>(null)
  const [applyReviewOpen, setApplyReviewOpen] = useState(false)
  const [applyScope, setApplyScope] = useState<{apps: typeof appListManager.nukingAppList, paths: string[]} | 'loading' | 'error'>('loading')
  const [uad, setUad] = useState<UadSource>(uadSource)
  const [uadUpdating, setUadUpdating] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importSelected, setImportSelected] = useState<string[]>([])
  const busy = useMutationBusy()
  const [sections, setSections] = useState(() => expandedSections)
  useEffect(() => { expandedSections = sections }, [sections])
  const toggleSection = (section: string, open: boolean) => {
    setSections(previous => open
      ? previous.includes(section) ? previous : [...previous, section]
      : previous.filter(value => value !== section))
  }
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

  const handleChange = (key: string, value: string | boolean | number) => {
    setItems(previous => previous.map(item => item.key === key ? {...item, value} : item))
  }

  useEffect(() => {
    if (isDev()) setLateLoaded(false)
    else Cli.isLateLoaded().then(setLateLoaded).catch(() => setLateLoaded(null))
  }, [])

  useEffect(() => {
    if (!applyReviewOpen || busy) return
    let active = true
    setApplyScope('loading')
    Promise.all([appListManager.waitForReady(), whiteoutManager.waitForReady()]).then(() => {
      if (active) setApplyScope({
        apps: [...new Map(appListManager.nukingAppList.map(app => [app.packageName, {...app}])).values()],
        paths: [...new Set(whiteoutManager.whiteouts)],
      })
    }).catch(() => { if (active) setApplyScope('error') })
    return () => { active = false }
  }, [applyReviewOpen, appListManager, busy])

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
    if (!content) return
    try {
      await appListManager.waitForReady()
      const preview = NukeConfig.previewImport(content, appListManager)
      setImportPreview(preview)
      setImportSelected(preview.apps.map(app => app.packageName))
    } catch (error) {
      snackBar.show(error instanceof Error ? error.message : t('nuke_config.import_invalid'), false)
    }
  }

  const handleExport = async () => {
    try {
      await appListManager.waitForReady()
      await NukeConfig.export(appListManager, snackBar.show)
    } catch { snackBar.show(t('global.read_error'), false) }
  }

  const applySettings = async () => {
    if (!config || typeof applyScope !== 'object') return
    const started = await runMutation(async () => {
      setSaving(true)
      setApplyReviewOpen(false)
      try {
        const updated = new ConfigLib()
        updated.config = items.map(item => ({...item}))
        try {
          await updated.write()
        } catch {
          snackBar.show(t('global.write_error'), false)
          return
        }
        setConfig(updated)
        await Cli.nuke(snackBar.show)
        await refreshLists(appListManager).catch(() => snackBar.show(t('global.read_error'), false))
      } finally {
        setSaving(false)
      }
    })
    if (!started) snackBar.show(t('global.processing'), true, 3000)
  }

  const backupItems: SegmentedListItem[] = [
    {
      key: 'operation-log',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">receipt_long</md-icon>,
      content: <span>{t('diagnostics.title')}</span>,
      onClick: () => Cli.openOperationLog(),
    },
    {
      key: 'recovery',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">history</md-icon>,
      content: <span>{t('settings.check_recovery')}</span>,
      onClick: () => window.dispatchEvent(new Event('san-recovery')),
    },
    {
      key: 'import',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">download</md-icon>,
      content: <span className="text-on-surface">{t('settings.import_config')}</span>,
      onClick: busy ? undefined : () => setFileSelectorOpen(true),
    },
    {
      key: 'export',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">upload</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.export_config')}</span>
          <span className="text-on-surface-variant text-sm">{t('settings.export_config_desc')}</span>
        </>
      ),
      onClick: handleExport,
    },
  ]

  const aboutItems: SegmentedListItem[] = [
    {
      key: 'removal-ratings',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">info</md-icon>,
      content: <span className="text-on-surface">{t('removal.guide')}</span>,
      onClick: () => Cli.openLink(`${UAD_REPO}/wiki/Debloat-Lists`),
    },
    {
      key: 'github_issues',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">bug_report</md-icon>,
      content: <span className="text-on-surface">{t('settings.report_bug')}</span>,
      onClick: () => Cli.openLink(`https://www.github.com/${REPO}/issues`),
    },
    {
      key: 'source_code',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">code</md-icon>,
      content: <span className="text-on-surface">{t('settings.source_code')}</span>,
      onClick: () => Cli.openLink(`https://www.github.com/${REPO}`),
    },
    {
      key: 'telegram',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant"><TelegramIcon /></md-icon>,
      content: <span className="text-on-surface">{t('settings.telegram')}</span>,
      onClick: () => Cli.openLink(TELEGRAM),
    },
    {
      key: 'credits',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">favorite</md-icon>,
      content: <span className="text-on-surface">{t('settings.credits')}</span>,
      onClick: () => setCreditsOpen(true),
    },
  ]

  const hasMetamodule = items.some(item => item.key === 'mounting_mode' && item.value === 2)
  const openApplyReview = () => { setApplyScope('loading'); setApplyReviewOpen(true) }

  return (
    <>
      <Header title={t('settings.title')} />
      <div className="ps-8 pe-4 pb-2 flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-normal text-primary">{t('settings.config')}</h2>
      </div>
      {lateLoaded !== false && <p className="px-8 pb-3 text-sm text-on-surface-variant">{t(lateLoaded === null ? 'config.late_load_unknown' : 'config.late_load_warning')}</p>}
      {lateLoaded === true && !hasMetamodule && <p className="px-8 pb-3 text-sm text-on-surface-variant">{t('config.mounting_notice')}</p>}
      {config ? <Config items={items.filter(item => item.key !== 'mounting_mode')} onSave={handleChange} disabled={saving || busy} /> : <div data-page-loading={loadFailed ? undefined : ''} className="px-4 pb-4">
        {loadFailed ? <LoadError message={t('settings.config_error')} /> : <md-circular-progress indeterminate aria-label={t('global.loading')} />}
      </div>}
      {items.some(item => item.key === 'nuke_mode' && item.value === 'whiteout_only') && <p className="px-8 pb-3 text-sm text-on-surface-variant">{t('config.whiteout_notice')}</p>}
      <details className="mb-4" open={sections.includes('advanced')} onToggle={event => toggleSection('advanced', event.currentTarget.open)}>
        <summary className="mx-6 min-h-12 py-3 box-border cursor-pointer text-sm text-primary">
          <h2 className="inline text-sm font-normal">{t('settings.advanced')}</h2>
        </summary>
        {config && <Config items={items.filter(item => item.key === 'mounting_mode')} onSave={handleChange} disabled={saving || busy} />}
        <SegmentedList items={[
          {
            key: 'use-whiteout',
            className: '!p-4 !justify-between',
            leadingContent: <md-icon class="text-on-surface-variant"><WhiteoutIcon /></md-icon>,
            content: <span className="text-on-surface">{t('settings.whiteout_toggle')}</span>,
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
                <span className="text-on-surface-variant text-sm">{uadSubtitle}</span>
              </>
            ),
            trailingContent: uadUpdating ? <md-circular-progress indeterminate style={{ '--md-circular-progress-size': '24px' } as React.CSSProperties} /> : undefined,
            onClick: uadUpdating ? undefined : handleUadUpdate,
          },
        ]} />
      </details>
      {config && <div className="px-4 pb-4 flex justify-end">
        <md-filled-button disabled={saving || busy} onClick={openApplyReview}>{t('settings.save_apply')}</md-filled-button>
      </div>}
      <SegmentedList items={backupItems.filter(item => item.key === 'operation-log')} />
      <details className="mb-4" open={sections.includes('recovery')} onToggle={event => toggleSection('recovery', event.currentTarget.open)}>
        <summary className="mx-6 min-h-12 py-3 box-border cursor-pointer text-sm text-primary">
          <h2 className="inline text-sm font-normal">{t('settings.backup_restore')}</h2>
        </summary>
        <SegmentedList items={backupItems.filter(item => item.key !== 'operation-log')} />
      </details>
      <details className="mb-4" open={sections.includes('about')} onToggle={event => toggleSection('about', event.currentTarget.open)}>
        <summary className="mx-6 min-h-12 py-3 box-border cursor-pointer text-sm text-primary">
          <h2 className="inline text-sm font-normal">{t('settings.about')}</h2>
        </summary>
        <SegmentedList items={aboutItems} />
      </details>
      <CreditsDialog open={creditsOpen} onClose={closeCredits} />
      <ReviewDialog open={applyReviewOpen} title={t('settings.apply_title')} onClose={() => setApplyReviewOpen(false)} actions={<>
        <md-text-button onClick={() => setApplyReviewOpen(false)}>{t('whiteout.cancel')}</md-text-button>
        <md-filled-button disabled={saving || busy || typeof applyScope !== 'object'} onClick={applySettings}>{t('settings.save_apply')}</md-filled-button>
      </>}>
        {typeof applyScope === 'object' ? <p className="mt-0 font-medium">{t('settings.apply_scope', {
          apps: t('settings.scope_apps', {count: applyScope.apps.length}),
          paths: t('settings.scope_paths', {count: applyScope.paths.length}),
        })}</p> : applyScope === 'error' ? <LoadError message={t('settings.scope_error')} /> : <p role="status">{t('global.loading')}</p>}
        {config && <p className="mt-0 font-medium">{t(items.find(item => item.key === 'nuke_mode')?.value === 'whiteout_only' ? 'review.mode_whiteout_summary' : items.find(item => item.key === 'nuke_mode')?.value === 'uninstall_only' ? 'review.mode_uninstall_summary' : 'review.mode_hide_summary')}</p>}
        {lateLoaded !== false && items.some(item => item.key === 'nuke_mode' && item.value !== 'whiteout_only') && <p className="mt-0 text-error">{t(lateLoaded === null ? 'config.late_load_unknown' : 'config.late_load_warning')}</p>}
        {typeof applyScope === 'object' && <ul className="my-4 list-none p-0 flex flex-col gap-3">
          {applyScope.apps.map(app => <li key={app.packageName} className="flex flex-col">
            <span>{app.appLabel || app.packageName}</span>
            {app.appLabel && app.appLabel !== app.packageName && <span className="text-sm text-on-surface-variant break-all">{app.packageName}</span>}
          </li>)}
          {applyScope.paths.map(path => <li key={path} className="font-mono text-sm break-all">{path}</li>)}
        </ul>}
      </ReviewDialog>
      <FileSelector open={fileSelectorOpen} title={t('settings.import_config')} fileType="json" mode="content" onSelect={handleImport} />
      <AppReviewDialog open={importPreview !== null} apps={importPreview?.apps ?? []} operation="remove"
        selectedPackages={importSelected}
        onToggle={pkg => setImportSelected(previous => previous.includes(pkg) ? previous.filter(value => value !== pkg) : [...previous, pkg])}
        note={importPreview ? t('nuke_config.preview_summary', {already: importPreview.alreadyListed, missing: importPreview.unavailable.length}) + (importPreview.unavailable.length ? ` ${importPreview.unavailable.join(', ')}` : '') : undefined}
        onClose={() => setImportPreview(null)}
        onConfirm={() => {
          const packages = [...importSelected]
          setImportPreview(null)
          NukeConfig.applyImport(packages, appListManager, snackBar.show)
        }} />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} fabVisible={false} />
    </>
  )
}
