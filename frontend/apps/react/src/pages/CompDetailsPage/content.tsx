import type { FinalCompTabProps, GuideTabProps, HeroesTabProps, ItemsTabProps, OverviewTabProps, TransitionTabProps } from './components'
import type { EnhancedCompData } from '@/utils/compRating'
import { getCompDetails, getDatatft } from 'api-client'
import { useMemo, useState } from 'react'
import { useRequest } from 'react-helper'
import {
  AppTabs,
  EmptyState,
  FormationBoardSkeleton,
  ItemsGridSkeleton,
} from '@/components'
import { useConfigStore } from '@/store/configStore'
import { FinalCompTab, GuideTab, HeroesTab, ItemsTab, LazyTabContent, OverviewTab, TransitionTab } from './components'

interface CompDetailContentProps {
  comp: EnhancedCompData | null
}

function getSkeletonTabs(traitsCount?: number) {
  return [
    { value: 'overview', label: '概览', content: <FormationBoardSkeleton traitsCount={traitsCount} /> },
    { value: 'heroes', label: '英雄', content: <ItemsGridSkeleton /> },
    { value: 'items', label: '装备', content: <ItemsGridSkeleton /> },
    { value: 'transition', label: '过渡', content: <ItemsGridSkeleton /> },
    { value: 'final', label: '变阵', content: <ItemsGridSkeleton /> },
  ]
}

export function CompDetailContent({ comp }: CompDetailContentProps) {
  const isDatatftOnly = comp?.source === 'datatft'
  const [activeTab, setActiveTab] = useState(isDatatftOnly ? 'guide' : 'overview')
  const { windowMode } = useConfigStore()
  const [activatedTabs, setActivatedTabs] = useState<Set<string>>(
    () => new Set(isDatatftOnly ? ['guide'] : ['overview']),
  )

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setActivatedTabs((prev) => {
      if (prev.has(tab))
        return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }

  const { data: compDetails, loading } = useRequest(
    async () => {
      if (!comp?.compId)
        return null
      return await getCompDetails(comp.compId)
    },
    {
      cacheKey: comp?.compId,
      staleTime: 1000 * 60 * 5,
      ready: !!comp?.compId,
    },
  )

  // dataTFT 攻略：与 GuideTab 共用 cacheKey，未命中时不渲染「攻略」页签
  // 攻略是可选增强：接口 404 / 网络异常都不应打断详情页，故关闭抛错
  const { data: datatft } = useRequest(async () => {
    try {
      return await getDatatft()
    }
    catch {
      return null
    }
  }, {
    cacheKey: 'datatft-guides',
    staleTime: 1000 * 60 * 30,
    throwOnError: false,
  })

  const guide = comp?.compId ? datatft?.guides?.[comp.compId] : undefined

  const tabs = useMemo(() => {
    if (!compDetails?.data)
      return []

    const data = compDetails.data

    // dataTFT 独有阵容：有站位就展示棋盘，有装备就展示装备页；过渡/变阵 dataTFT 不提供，不给页签
    if (data.datatftOnly) {
      const hasBoard = (data.positioning?.length ?? 0) > 0
      const hasItems = (data.item?.length ?? 0) > 0
      const dtTabs = []
      if (hasBoard) {
        dtTabs.push({
          value: 'overview',
          label: '概览',
          content: (
            <LazyTabContent<OverviewTabProps>
              shouldRender
              component={OverviewTab}
              props={{ data, builds: data.datatftOnly && data.builds?.length ? data.builds : comp?.builds, traits: comp?.traits, units: comp?.units }}
              fallback={<FormationBoardSkeleton traitsCount={comp?.traits?.length} />}
            />
          ),
        })
      }
      if (hasItems) {
        dtTabs.push({
          value: 'heroes',
          label: '英雄',
          content: (
            <LazyTabContent<HeroesTabProps>
              shouldRender
              component={HeroesTab}
              props={{ items: data.item ?? [] }}
              fallback={<ItemsGridSkeleton />}
            />
          ),
        })
        dtTabs.push({
          value: 'items',
          label: '装备',
          content: (
            <LazyTabContent<ItemsTabProps>
              shouldRender
              component={ItemsTab}
              props={{ items: data.item ?? [] }}
              fallback={<ItemsGridSkeleton />}
            />
          ),
        })
      }
      // dataTFT 不提供过渡/变阵数据，但仍给页签，用明确说明代替缺失，保证页签结构与 MetaTFT 阵容一致
      dtTabs.push({
        value: 'transition',
        label: '过渡',
        content: <EmptyState message="dataTFT 未提供过渡数据" />,
      })
      dtTabs.push({
        value: 'final',
        label: '变阵',
        content: <EmptyState message="dataTFT 未提供变阵数据" />,
      })
      // 攻略还没加载到（或抓取时该阵容没有攻略）时给个明确说明，不能返回空数组变成白屏
      dtTabs.push(guide
        ? {
            value: 'guide',
            label: '攻略',
            content: (
              <LazyTabContent<GuideTabProps>
                shouldRender
                component={GuideTab}
                props={{ compId: comp?.compId ?? '' }}
                fallback={<ItemsGridSkeleton />}
              />
            ),
          }
        : {
            value: 'guide',
            label: '攻略',
            content: <EmptyState message="该阵容暂无攻略数据，请稍后同步重试" />,
          })
      return dtTabs
    }

    return [
      {
        value: 'overview',
        label: '概览',
        content: data
          ? (
              <LazyTabContent<OverviewTabProps>
                shouldRender={activatedTabs.has('overview')}
                component={OverviewTab}
                props={{ data, builds: data.datatftOnly && data.builds?.length ? data.builds : comp?.builds, traits: comp?.traits, units: comp?.units }}
                fallback={<FormationBoardSkeleton traitsCount={comp?.traits?.length} />}
              />
            )
          : <EmptyState message="暂无阵容信息" />,
      },
      {
        value: 'heroes',
        label: '英雄',
        content: data.item && data.item.length > 0
          ? (
              <LazyTabContent<HeroesTabProps>
                shouldRender={activatedTabs.has('heroes')}
                component={HeroesTab}
                props={{ items: data.item }}
                fallback={<ItemsGridSkeleton />}
              />
            )
          : <EmptyState message="暂无英雄装备数据" />,
      },
      {
        value: 'items',
        label: '装备',
        content: data.item && data.item.length > 0
          ? (
              <LazyTabContent<ItemsTabProps>
                shouldRender={activatedTabs.has('items')}
                component={ItemsTab}
                props={{ items: data.item }}
                fallback={<ItemsGridSkeleton />}
              />
            )
          : <EmptyState message="暂无装备信息" />,
      },
      {
        value: 'transition',
        label: '过渡',
        content: (
          <LazyTabContent<TransitionTabProps>
            shouldRender={activatedTabs.has('transition')}
            component={TransitionTab}
            props={{ earlyOptions: data.early_options, options: data.options }}
            fallback={<ItemsGridSkeleton />}
          />
        ),
      },
      ...(guide
        ? [{
            value: 'guide',
            label: '攻略',
            content: (
              <LazyTabContent<GuideTabProps>
                shouldRender={activatedTabs.has('guide')}
                component={GuideTab}
                props={{ compId: comp?.compId ?? '' }}
                fallback={<ItemsGridSkeleton />}
              />
            ),
          }]
        : []),
      {
        value: 'final',
        label: '变阵',
        content: (
          <LazyTabContent<FinalCompTabProps>
            shouldRender={activatedTabs.has('final')}
            component={FinalCompTab}
            props={{ options: data.options }}
            fallback={<ItemsGridSkeleton />}
          />
        ),
      },
    ]
  }, [compDetails, comp, activatedTabs, guide])

  const skeletonTabs = useMemo(() => getSkeletonTabs(comp?.traits?.length), [comp?.traits?.length])

  return (
    <div className={`flex-1 overflow-hidden ${windowMode === 'floating' ? 'pointer-events-none' : ''}`}>
      {loading && comp && (
        <div className="flex flex-col h-full p-2">
          <AppTabs value={activeTab} onValueChange={handleTabChange} tabs={skeletonTabs} enableAnimation />
        </div>
      )}

      {!loading && comp && tabs.length > 0 && (
        <div className="flex flex-col h-full p-2">
          <AppTabs value={activeTab} onValueChange={handleTabChange} tabs={tabs} enableAnimation />
        </div>
      )}
    </div>
  )
}
