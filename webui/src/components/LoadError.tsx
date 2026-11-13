import { useTranslation } from 'react-i18next'

export default function LoadError({ message }: { message?: string } = {}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full px-6 text-center">
      <span className="text-error" role="alert">{message ?? t('global.read_error')}</span>
      <p className="m-0 max-w-prose text-sm text-on-surface-variant">{t('global.load_guidance')}</p>
      <md-filled-button onClick={() => location.reload()}>
        {t('global.reload')}
      </md-filled-button>
    </div>
  )
}
