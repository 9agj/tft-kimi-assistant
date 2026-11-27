import type { EnhancedCompData } from '@/utils/compRating'
import { getApiErrorRecord } from 'logger'
import { withErrorBoundary } from 'react-helper'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from 'ui'
import { ErrorState } from '@/components'
import { useConfigStore } from '@/store/configStore'
import { CompDetailContent } from './content'
import { ArrowLeft, PanelsTopLeft } from 'lucide-react'
import { openCompOverlay } from '@/native'

interface CompDetailPageProps {
  comp: EnhancedCompData | null
  onClose: () => void
}

const CompDetailContentWithErrorBoundary = withErrorBoundary(CompDetailContent, {
  errorBoundaryName: 'comp_details_content',
  FallbackComponent: ({ resetErrorBoundary, error }) => {
    const { httpStatus } = getApiErrorRecord(error)

    if (httpStatus === '404') {
      return (
        <ErrorState
          message="该阵容详情不存在"
          description="正在紧锣密鼓建设中..."
        />
      )
    }

    return (
      <ErrorState
        message="加载阵容详情失败"
        onReload={() => {
          resetErrorBoundary()
        }}
      />
    )
  },
})

export default function CompDetailPage({ comp, onClose }: CompDetailPageProps) {
  const { windowMode } = useConfigStore()

  // 在悬浮球模式下，隐藏遮罩层并禁用点击事件
  const overlayClassName = windowMode === 'floating'
    ? `rounded-2xl !z-10 bg-transparent pointer-events-none`
    : `rounded-2xl z-50`
  // 在悬浮球模式下，隐藏 DrawerContent
  const drawerContentClassName = windowMode === 'floating'
    ? `min-h-screen min-w-[90vw] bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 border-none rounded-2xl !z-10 opacity-0 pointer-events-none`
    : `min-h-screen min-w-[90vw] bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 border-none rounded-2xl z-50`

  return (
    <Drawer
      open={!!comp}
      direction="right"
      handleOnly={true}
      onOpenChange={(open) => {
        // 在悬浮球模式下，阻止通过点击遮罩关闭 Drawer
        if (!open && windowMode === 'floating') {
          return
        }
        if (!open)
          onClose()
      }}
    >
      <DrawerContent
        className={drawerContentClassName}
        overlayClassName={overlayClassName}
      >
        <div className="kimi-detail-toolbar">
          <button onClick={onClose} aria-label="返回阵容"><ArrowLeft size={18} />返回</button>
          <span>阵容详情 · S19</span>
          <button className="kimi-overlay-button" onClick={() => comp?.compId && openCompOverlay(comp.compId, 'S19 阵容')}><PanelsTopLeft size={16} />悬浮查看</button>
        </div>
        <DrawerTitle className="sr-only">阵容详情</DrawerTitle>
        <DrawerDescription className="sr-only">
          查看阵容站位和配置信息
        </DrawerDescription>

        <CompDetailContentWithErrorBoundary comp={comp} />
      </DrawerContent>
    </Drawer>
  )
}
