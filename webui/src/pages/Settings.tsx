import { useState, useEffect } from 'react'
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
import { getModuleInfo } from '../lib/ModuleInfo'
import TelegramIcon from '../assets/telegram.svg?react'
import WhiteoutIcon from '../assets/folder_off.svg?react'

export default function Settings() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appListManager = useAppList()
  const [config, setConfig] = useState<ConfigLib | null>(null)
  const [items, setItems] = useState<ConfigLib['config']>([])
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [whiteoutEnabled, setWhiteoutEnabled] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY + 'use-whiteout') === 'true'
  })
  const [version, setVersion] = useState('')

  useEffect(() => {
    getModuleInfo().then(info => {
      if (info) setVersion(info.version)
    })
  }, [])

  const handleWhiteoutToggle = () => {
    const newValue = !whiteoutEnabled
    setWhiteoutEnabled(newValue)
    localStorage.setItem(LOCAL_STORAGE_KEY + 'use-whiteout', newValue ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('whiteout-toggled', { detail: newValue }))
  }

  useEffect(() => {
    const cfg = new ConfigLib()
    cfg.read().then(() => {
      setConfig(cfg)
      setItems(cfg.config)
    })
  }, [])

  const handleSave = async (key: string, value: string | boolean | number) => {
    if (!config) return
    config.config = config.config.map(item =>
      item.key === key ? { ...item, value } : item
    )
    setItems(config.config)
    await config.write().catch(() => {
      snackBar.show(t('global.write_error'), false)
    })
  }

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
        <md-circular-progress indeterminate />
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
      key: 'version',
      className: '!p-4',
      leadingContent: <md-icon class="text-on-surface-variant">info</md-icon>,
      content: (
        <>
          <span className="text-on-surface">{t('settings.version')}</span>
          <span className="text-outline text-xs">{version || '...'}</span>
        </>
      ),
    },
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
    }
  ]

  return (
    <>
      <Header title={t('settings.title')} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.config')}
      </div>
      <Config items={items} onSave={handleSave} />
      <div className="text-sm text-primary ps-8 pb-2">
        Advanced
      </div>
      <SegmentedList items={[
        {
          key: 'use-whiteout',
          className: '!p-4 !justify-between',
          leadingContent: <md-icon class="text-on-surface-variant"><WhiteoutIcon /></md-icon>,
          content: (
            <>
              <span className="text-on-surface">Use whiteout feature</span>
              <span className="text-outline text-xs">Enable raw whiteout configuration page in WebUI</span>
            </>
          ),
          trailingContent: (
            <md-switch
              icons
              selected={whiteoutEnabled}
              onChange={handleWhiteoutToggle}
            />
          ),
        }
      ]} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.backup_restore')}
      </div>
      <SegmentedList items={backupItems} />
      <div className="text-sm text-primary ps-8 pb-2">
        {t('settings.about')}
      </div>
      <SegmentedList items={aboutItems} />
      <FileSelector open={fileSelectorOpen} fileType="json" mode="content" onSelect={handleImport} />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} fabVisible={false} />
    </>
  )
}
