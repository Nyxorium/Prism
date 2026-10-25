import type {ComponentType} from 'react'
import {ClientDetail, ClientSummary} from './ClientSetting'
import {ThemeDetail, ThemeSummary} from './ThemeSetting'

export interface SettingDef {
  id: string
  label: string
  /** Current value, rendered on the list row. */
  Summary: ComponentType
  /** The drill-in view. */
  Detail: ComponentType
}

// To add a setting: write its Summary/Detail components and add one line here.
export const SETTINGS: SettingDef[] = [
  {id: 'theme', label: 'Theme', Summary: ThemeSummary, Detail: ThemeDetail},
  {
    id: 'client',
    label: 'Open links in',
    Summary: ClientSummary,
    Detail: ClientDetail,
  },
]
