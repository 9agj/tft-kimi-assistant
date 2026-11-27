import { BookOpen, Cat, Check, Layers3, RefreshCw, Settings2, Shield, Sparkles, Swords, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DataManifest } from './native'
import { getDataManifest } from './native'
import { routes } from '@/routes'
import { useGlobalStore } from '@/store/globalStore'
import { TraitsPage } from './pages/TraitsPage'
import { AugmentMaterialDefs } from './components/game/AugmentMaterialDefs'
import './kimi.css'

const icons = [Layers3, Shield, Swords, Sparkles, BookOpen]
const tabs = [...routes, { value: 'traits', label: '羁绊', content: <TraitsPage /> }]

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('kimi-tab')
    return tabs.some(tab => tab.value === saved) ? saved! : 'comps'
  })
  const [visited, setVisited] = useState(() => new Set([activeTab]))
  const [settings, setSettings] = useState(false)
  const [manifest, setManifest] = useState<DataManifest>({})
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const loading = useGlobalStore(s => s.loading)

  useEffect(() => {
    getDataManifest().then(setManifest).catch(() => {})
    const onSync = (event: Event) => {
      const result = (event as CustomEvent).detail
      setRefreshing(false)
      if (result?.changed) window.location.reload()
      else setMessage(result?.message || '当前已是最新的 S19 数据')
    }
    window.addEventListener('kimi-sync-finished', onSync)
    return () => window.removeEventListener('kimi-sync-finished', onSync)
  }, [])

  const choose = (value: string) => {
    setActiveTab(value)
    localStorage.setItem('kimi-tab', value)
    setVisited(previous => new Set([...previous, value]))
  }
  const refresh = () => {
    setRefreshing(true)
    setMessage('')
    if (window.Kimi) window.Kimi.syncData()
    else window.location.reload()
  }
  const time = manifest.sourceUpdatedAt
    ? new Date(manifest.sourceUpdatedAt).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '读取中'

  return (
    <div className="kimi-app">
      <AugmentMaterialDefs />
      <div className="kimi-wallpaper" aria-hidden="true" style={{ backgroundImage: `linear-gradient(135deg,#111722f5,#152030f7),url(${new URL('./art/hachimi-background.webp', document.baseURI).href})` }} />
      <header className="kimi-header">
        <div className="kimi-brand">
          <img src="./art/hachimi.webp" alt="哈基米" className="kimi-avatar" />
          <div><h1>tft基米助手</h1><p>为每一局，备好答案。</p></div>
        </div>
        <button className="kimi-icon-button" onClick={() => setSettings(true)} aria-label="设置与数据更新"><Settings2 size={20} /></button>
      </header>
      <div className="kimi-status-strip">
        <span className="kimi-season"><i /> S19 · PBE</span>
        <span>{manifest.counts?.comps ?? '—'} 套阵容</span>
        <span className="kimi-updated">{loading ? '载入本地数据…' : `${time} 更新`}</span>
      </div>
      <main className="kimi-main">
        {tabs.map(tab => visited.has(tab.value) && (
          <section key={tab.value} className="kimi-page" style={{ display: activeTab === tab.value ? 'flex' : 'none' }} inert={activeTab !== tab.value}>
            {tab.content}
          </section>
        ))}
      </main>
      <nav className="kimi-nav" aria-label="主要功能">
        {tabs.map((tab, index) => {
          const Icon = icons[index]!
          return <button key={tab.value} aria-current={activeTab === tab.value ? 'page' : undefined} onClick={() => choose(tab.value)}>
            <Icon size={20} strokeWidth={activeTab === tab.value ? 2.2 : 1.6} /><span>{tab.label}</span>
          </button>
        })}
      </nav>
      {settings && <div className="kimi-modal-backdrop" onClick={() => setSettings(false)}>
        <div className="kimi-settings" role="dialog" aria-label="设置" aria-modal="true" onClick={e => e.stopPropagation()}>
          <div className="kimi-sheet-heading"><h2>你的基米助手</h2><button className="kimi-icon-button" onClick={() => setSettings(false)} aria-label="关闭设置"><X size={20} /></button></div>
          <p className="kimi-settings-copy">深蓝灰高对比界面，清楚显示每一项数据。只收录云顶之弈 S19，内置数据支持离线查看。</p>
          <div className="kimi-data-card"><span>数据版本</span><strong>{manifest.version || '内置快照'}</strong><span>来源</span><strong>MetaTFT · S19 测试服</strong><span>源更新时间</span><strong>{time}</strong><span>云端抓取</span><strong>每 4 小时一次</strong><span>北京时间</span><strong>00:05 / 04:05 / 08:05<br />12:05 / 16:05 / 20:05</strong></div>
          <button className="kimi-primary" disabled={refreshing} onClick={refresh}><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />{refreshing ? '校验并同步中…' : '检查并同步数据'}</button>
          {message && <p className="kimi-sync-message"><Check size={15} />{message}</p>}
          <div className="kimi-help-card"><Cat size={22} /><div><strong>阵容悬浮窗</strong><p>打开阵容详情 → 点「悬浮查看」。首次使用开启「显示在其他应用上层」，支持拖动、缩放、透明度和猫咪悬浮球。</p></div></div>
          <div className="kimi-update-card">
            <div>
              <strong>版本与更新</strong>
              <p>当前版本 {window.Kimi?.getVersion?.() || '1.2.6'}。启动时会自动检查一次，也可以手动点右侧按钮。</p>
            </div>
            <button type="button" className="kimi-update-btn" onClick={() => window.Kimi?.checkUpdate?.()}>检查更新</button>
          </div>
          <div className="kimi-feedback-card">
            <strong>问题反馈与建议</strong>
            <p>遇到 bug、数据错误，或想要新功能，都可以在 GitHub 上提交，作者会在这里统一跟进。</p>
            <div className="kimi-feedback-links">
              <a href="https://github.com/9agj/tft-kimi-assistant/issues/new?template=bug_report.yml" target="_blank" rel="noreferrer">提交 Bug</a>
              <a href="https://github.com/9agj/tft-kimi-assistant/issues/new?template=feature_request.yml" target="_blank" rel="noreferrer">功能建议</a>
              <a href="https://github.com/9agj/tft-kimi-assistant/issues" target="_blank" rel="noreferrer">全部反馈</a>
            </div>
          </div>
          <p className="kimi-footnote">银色／金色／棱彩阶位来自 MetaTFT 的 S19 数据。符文按官网 SABCD 分级，组内按阶位和名称排序，支持阶段筛选；暂用榜来源会在符文页注明。缺失站位或过渡数据会明确标记。App {window.Kimi?.getVersion() || '1.2.6'}</p>
        </div>
      </div>}
    </div>
  )
}
