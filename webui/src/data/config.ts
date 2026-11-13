export interface ConfigItem {
    key: string
    value: string | boolean | number
    readonly?: boolean
    options?: Array<string | number | boolean>
    optionDescriptions?: Record<string, string>
    label?: string
    description?: string
}

export const configItem: ConfigItem[] = [
    {
        key: 'nuke_mode',
        value: 'whiteout_uninstall',
        options: ['whiteout_only', 'whiteout_uninstall', 'uninstall_only'],
        optionDescriptions: {
            whiteout_only: 'config.nuke_mode_whiteout_only_desc',
            uninstall_only: 'config.nuke_mode_uninstall_only_desc',
        },
        label: 'config.nuke_mode',
    },
    {
        key: 'mounting_mode',
        value: 0,
        options: [0, 1, 2],
        label: 'config.mounting_mode',
        description: 'config.mounting_mode_desc',
    },
    {
        key: 'magic_mount',
        value: true,
        readonly: true,
    },
    {
        key: 'current_manager',
        value: 'MAGISK',
        readonly: true,
    }
]
