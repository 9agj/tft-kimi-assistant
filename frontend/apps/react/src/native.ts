export interface DataManifest {
  version?: string
  set?: string
  queue?: string
  sourceUpdatedAt?: string
  fetchedAt?: string
  refreshHours?: number
  counts?: Record<string, number>
  detailCoverage?: Record<string, number>
  augmentRankingAvailable?: boolean
}

declare global {
  interface Window {
    Kimi?: {
      openOverlay: (compId: string, title: string) => void
      closeOverlay: () => void
      hasOverlayPermission: () => boolean
      requestOverlayPermission: () => void
      syncData: () => void
      getDataStatus: () => string
      getVersion: () => string
      copyText: (text: string) => void
      minimize: () => void
      exit: () => void
      openExternal: (url: string) => void
      checkUpdate: () => void
    }
  }
}

export function openCompOverlay(compId: string, title: string) {
  if (window.Kimi) window.Kimi.openOverlay(compId, title)
  else window.open(`./overlay.html?comp=${encodeURIComponent(compId)}`, '_blank')
}

export async function getDataManifest(): Promise<DataManifest> {
  if (window.Kimi) return JSON.parse(window.Kimi.getDataStatus())
  return await fetch('./api/manifest.json', { cache: 'no-store' }).then(r => r.json())
}
