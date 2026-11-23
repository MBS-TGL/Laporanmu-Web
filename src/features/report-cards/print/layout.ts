export interface LayoutConfig {
  arMainFontSize: number
  arSecFontSize: number
  arScaleFontSize: number
  arValueFontSize: number
  scoreColWidth: number
  gradeColWidth: number
  numColWidth: number
  subjectArWidth: number
  subjectIdWidth: number
  showCapaianHafalan: boolean
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  arMainFontSize: 15.5,
  arSecFontSize: 13.5,
  arScaleFontSize: 13.5,
  arValueFontSize: 13.5,
  scoreColWidth: 10,
  gradeColWidth: 15,
  numColWidth: 6,
  subjectArWidth: 34.5,
  subjectIdWidth: 34.5,
  showCapaianHafalan: true,
}

const STORAGE_KEY = 'raport_layout_config'

export function loadLayoutConfig(): LayoutConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LAYOUT_CONFIG }
    return { ...DEFAULT_LAYOUT_CONFIG, ...(JSON.parse(raw) as Partial<LayoutConfig>) }
  } catch {
    return { ...DEFAULT_LAYOUT_CONFIG }
  }
}

export function saveLayoutConfig(config: LayoutConfig) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // localStorage bisa diblokir; layout tetap dipakai di sesi ini.
  }
}
