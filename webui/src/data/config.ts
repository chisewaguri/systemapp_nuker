export interface ConfigItem {
    key: string
    value: string | boolean | number
    readonly?: boolean
    options?: Array<string | number>
    label?: string
    description?: string
}

export const configItem: ConfigItem[] = [
    {
        key: 'uninstall_only_mode',
        value: false,
        label: 'config.uninstall_only_mode',
        description: 'config.uninstall_only_mode_desc',
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
