import type { MdDialog } from '@material/web/dialog/dialog.js'

const customizedDialogs = new WeakSet<MdDialog>()

/**
 * Customize MdDialog animation
 * @param dialog MdDialog instance
 */
export function customizeDialogAnimation(dialog: MdDialog): void {
  if (customizedDialogs.has(dialog)) return
  customizedDialogs.add(dialog)

  const defaultOpenAnim = dialog.getOpenAnimation
  const defaultCloseAnim = dialog.getCloseAnimation
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300

  dialog.getOpenAnimation = () => {
    document.body.style.overflow = 'hidden'
    const defaultAnim = defaultOpenAnim.call(dialog)
    return {
      ...defaultAnim,
      dialog: [
        [
          [{ opacity: 0, transform: 'translateY(50px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration, easing: 'ease' },
        ],
      ],
      scrim: [
        [
          [{ opacity: 0 }, { opacity: 0.32 }],
          { duration, easing: 'linear' },
        ],
      ],
      container: [],
    }
  }

  dialog.getCloseAnimation = () => {
    document.body.style.overflow = ''
    const defaultAnim = defaultCloseAnim.call(dialog)
    return {
      ...defaultAnim,
      dialog: [
        [
          [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-50px)' }],
          { duration, easing: 'ease' },
        ],
      ],
      scrim: [
        [
          [{ opacity: 0.32 }, { opacity: 0 }],
          { duration, easing: 'linear' },
        ],
      ],
      container: [],
    }
  }
}
