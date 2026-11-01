import { defineStore } from 'pinia'
import { readJson, writeJson } from '@/utils/storage'

export interface DiagnosticSettings {
  limit: number
  screenLimit: number
  confirm: 2 | 3 | 5
}

interface StoredSettings extends Partial<DiagnosticSettings> {
  [key: string]: unknown
}

const STORAGE_KEY = 'cnmDiagnose.settings.v2'
export const TARGET_LIMIT_MIN = 8
export const TARGET_LIMIT_MAX = 30
export const SCREEN_LIMIT_MIN = 20
export const SCREEN_LIMIT_MAX = 60
export const CONFIRM_CHOICES = [2, 3, 5] as const
export const DEFAULT_TARGET_LIMIT = 16
export const DEFAULT_SCREEN_LIMIT = 40
export const DEFAULT_CONFIRM = 3

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function normalize(raw: Partial<DiagnosticSettings>): DiagnosticSettings {
  return {
    limit: clamp(Number(raw.limit), TARGET_LIMIT_MIN, TARGET_LIMIT_MAX, DEFAULT_TARGET_LIMIT),
    screenLimit: clamp(Number(raw.screenLimit), SCREEN_LIMIT_MIN, SCREEN_LIMIT_MAX, DEFAULT_SCREEN_LIMIT),
    confirm: CONFIRM_CHOICES.includes(raw.confirm as 2 | 3 | 5)
      ? (raw.confirm as 2 | 3 | 5)
      : DEFAULT_CONFIRM,
  }
}

function isStoredSettings(value: unknown): value is StoredSettings {
  return typeof value === 'object' && value !== null
}

export const useDiagnosticSettingsStore = defineStore('diagnostic-settings', () => {
  function read(): DiagnosticSettings {
    return normalize(readJson(STORAGE_KEY, isStoredSettings) ?? {})
  }

  function save(next: Partial<DiagnosticSettings>): DiagnosticSettings {
    const merged = normalize({ ...read(), ...next })
    writeJson(STORAGE_KEY, merged)
    return merged
  }

  return {
    defaultTargetLimit: DEFAULT_TARGET_LIMIT,
    defaultScreenLimit: DEFAULT_SCREEN_LIMIT,
    defaultConfirm: DEFAULT_CONFIRM,
    targetLimitMin: TARGET_LIMIT_MIN,
    targetLimitMax: TARGET_LIMIT_MAX,
    screenLimitMin: SCREEN_LIMIT_MIN,
    screenLimitMax: SCREEN_LIMIT_MAX,
    confirmChoices: CONFIRM_CHOICES,
    read,
    save,
  }
})
