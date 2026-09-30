import { useTranslation } from 'react-i18next'

export default function LoadError() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full px-6 text-center">
      <span className="text-error">{t('global.read_error')}</span>
      <md-filled-button onClick={() => location.reload()}>
        {t('global.retry')}
      </md-filled-button>
    </div>
  )
}
