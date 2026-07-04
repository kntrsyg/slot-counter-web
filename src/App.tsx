import { FormEvent, useEffect, useMemo, useState } from 'react'
import { sampleMachine } from './data/sample'
import { searchMachineInfo } from './services/machineSearch'
import { storage } from './services/storage'
import type { CountItemType, PlaySession, SlotMachine } from './types'
import { nearestSetting, probability, probabilityText } from './utils/probability'

type Route =
  | { page: 'home' }
  | { page: 'picker' }
  | { page: 'search' }
  | { page: 'register' }
  | { page: 'counter'; id: string }
  | { page: 'history' }
  | { page: 'historyDetail'; id: string }

const uid = () => crypto.randomUUID()

function parseRoute(): Route {
  const value = location.hash.replace(/^#\/?/, '')
  if (!value) return { page: 'home' }
  const [page, id] = value.split('/')
  if (page === 'counter' && id) return { page: 'counter', id }
  if (page === 'history' && id) return { page: 'historyDetail', id }
  if (page === 'picker' || page === 'search' || page === 'register' || page === 'history') return { page }
  return { page: 'home' }
}

function go(path = '') {
  location.hash = path ? `#/${path}` : '#/'
}

function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  const [machines, setMachines] = useState<SlotMachine[]>(storage.getMachines)
  const [sessions, setSessions] = useState<PlaySession[]>(storage.getSessions)

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute())
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [])

  const saveMachine = (machine: SlotMachine) => {
    const next = [machine, ...machines]
    setMachines(next)
    storage.saveMachines(next)
  }

  const saveSession = (session: PlaySession) => {
    const next = [session, ...sessions]
    setSessions(next)
    storage.saveSessions(next)
    storage.clearActiveSession()
    go('history')
  }

  let content
  if (route.page === 'picker') content = <MachinePicker machines={machines} />
  else if (route.page === 'search') content = <SearchScreen machines={machines} />
  else if (route.page === 'register') content = <RegisterScreen onSave={saveMachine} />
  else if (route.page === 'counter') {
    const machine = machines.find((item) => item.id === route.id) ?? sampleMachine
    content = <CounterScreen key={machine.id} machine={machine} onSave={saveSession} />
  } else if (route.page === 'history') content = <HistoryScreen sessions={sessions} />
  else if (route.page === 'historyDetail') {
    const session = sessions.find((item) => item.id === route.id)
    content = session ? <HistoryDetail session={session} /> : <NotFound />
  } else content = <HomeScreen active={storage.getActiveSession()} />

  return (
    <div className="app-shell">
      {content}
      <BottomNav active={route.page} />
    </div>
  )
}

function Header({ title, eyebrow, back = true }: { title: string; eyebrow?: string; back?: boolean }) {
  return (
    <header className="screen-header">
      {back && <button className="icon-button" onClick={() => history.back()} aria-label="戻る">←</button>}
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
    </header>
  )
}

function HomeScreen({ active }: { active: PlaySession | null }) {
  return (
    <main className="screen home-screen">
      <Header title="小役カウンター" eyebrow="SLOT COUNTER" back={false} />
      <section className="hero-card">
        <div>
          <span className="status-dot" /> READY TO COUNT
        </div>
        <p>実戦値をすばやく記録し、登録した設定参考値と見比べられます。</p>
        <button className="primary-button start-button" onClick={() => go('picker')}>
          <span>新規カウント開始</span><strong>→</strong>
        </button>
        {active && (
          <button className="resume-button" onClick={() => go(`counter/${active.machineId}`)}>
            <span><small>保存中の実戦</small>{active.machineName}</span>
            <strong>{active.totalGames.toLocaleString()}G 続ける</strong>
          </button>
        )}
      </section>

      <section className="menu-grid" aria-label="メニュー">
        <MenuCard icon="⌕" title="機種検索" subtitle="登録済みデータから探す" path="search" />
        <MenuCard icon="＋" title="機種データ登録" subtitle="参考確率を手動入力" path="register" />
        <MenuCard icon="◷" title="実戦履歴" subtitle="過去のカウントを確認" path="history" wide />
      </section>

      <p className="disclaimer">本ツールは実戦値と参考値の比較用です。設定や遊技結果、勝利を保証するものではありません。</p>
    </main>
  )
}

function MenuCard({ icon, title, subtitle, path, wide }: { icon: string; title: string; subtitle: string; path: string; wide?: boolean }) {
  return (
    <button className={`menu-card ${wide ? 'wide' : ''}`} onClick={() => go(path)}>
      <span className="menu-icon">{icon}</span>
      <span><strong>{title}</strong><small>{subtitle}</small></span>
      <span className="chevron">›</span>
    </button>
  )
}

function MachinePicker({ machines }: { machines: SlotMachine[] }) {
  return (
    <main className="screen">
      <Header title="機種を選択" eyebrow="NEW SESSION" />
      <p className="lead">カウントを開始する機種を選んでください。</p>
      <div className="stack">
        {machines.map((machine) => (
          <button className="machine-card" key={machine.id} onClick={() => go(`counter/${machine.id}`)}>
            <span><small>{machine.countItems.length} COUNT ITEMS</small><strong>{machine.name}</strong></span>
            <span className="round-arrow">→</span>
          </button>
        ))}
      </div>
      <button className="outline-button" onClick={() => go('register')}>＋ 新しい機種を登録</button>
    </main>
  )
}

function SearchScreen({ machines }: { machines: SlotMachine[] }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [searching, setSearching] = useState(false)
  const results = machines.filter((machine) => machine.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setQuery(input.trim())
    setSearching(true)
    await searchMachineInfo(input.trim())
    setSearching(false)
  }

  const registerFromUrl = () => {
    sessionStorage.setItem('slot-counter:pending-url', sourceUrl)
    go('register')
  }

  return (
    <main className="screen">
      <Header title="機種検索" eyebrow="MACHINE SEARCH" />
      <form className="search-form" onSubmit={submit}>
        <label>機種名</label>
        <div className="input-action"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="例：マイジャグラー" /><button>検索</button></div>
      </form>
      <section className="section-block">
        <div className="section-title"><h2>検索結果</h2><span>{results.length}件</span></div>
        {searching && <p className="muted">検索しています…</p>}
        {!searching && !results.length && <div className="empty-card">登録済みの機種に該当がありません。<br />手動登録をご利用ください。</div>}
        {results.map((machine) => (
          <article className="result-card" key={machine.id}>
            <div><small>登録済みデータ</small><h3>{machine.name}</h3><p>{machine.countItems.map((item) => item.name).join('・')}</p></div>
            <button onClick={() => go(`counter/${machine.id}`)}>開始 →</button>
          </article>
        ))}
      </section>
      <section className="section-block url-panel">
        <div className="eyebrow">SOURCE URL</div><h2>情報元URLから登録</h2>
        <p>自動取得は準備中です。MVPではURLを控えて、参考数値を手動入力できます。</p>
        <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/machine" />
        <button className="outline-button" onClick={registerFromUrl}>手動登録へ進む</button>
      </section>
    </main>
  )
}

interface ItemDraft { id: string; name: string; type: CountItemType; probabilities: string[] }
const newItem = (): ItemDraft => ({ id: uid(), name: '', type: 'smallRole', probabilities: Array(6).fill('') })

function RegisterScreen({ onSave }: { onSave: (machine: SlotMachine) => void }) {
  const [name, setName] = useState('')
  const [memo, setMemo] = useState('')
  const [sourceUrl, setSourceUrl] = useState(() => sessionStorage.getItem('slot-counter:pending-url') ?? '')
  const [items, setItems] = useState<ItemDraft[]>([newItem()])
  const [error, setError] = useState('')

  useEffect(() => () => sessionStorage.removeItem('slot-counter:pending-url'), [])

  const updateItem = (index: number, patch: Partial<ItemDraft>) => setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  const updateProbability = (itemIndex: number, settingIndex: number, value: string) => {
    const probabilities = [...items[itemIndex].probabilities]
    probabilities[settingIndex] = value
    updateItem(itemIndex, { probabilities })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validItems = items.filter((item) => item.name.trim())
    const names = validItems.map((item) => item.name.trim())
    if (!name.trim()) return setError('機種名を入力してください。')
    if (!validItems.length) return setError('カウント項目を1つ以上入力してください。')
    if (new Set(names).size !== names.length) return setError('同じ名前の項目は登録できません。')

    const machine: SlotMachine = {
      id: uid(), name: name.trim(), memo: memo.trim(), sourceUrl: sourceUrl.trim(), createdAt: new Date().toISOString(),
      countItems: validItems.map((item) => ({ id: item.id, name: item.name.trim(), type: item.type })),
      settingValues: validItems.flatMap((item) => item.probabilities.flatMap((raw, index) => {
        const value = Number(raw.replace(',', '.'))
        return value > 0 ? [{ id: uid(), itemName: item.name.trim(), settingNumber: index + 1, probability: value }] : []
      })),
    }
    onSave(machine)
    go('picker')
  }

  return (
    <main className="screen">
      <Header title="機種データ登録" eyebrow="MANUAL ENTRY" />
      <form onSubmit={submit} className="register-form">
        <section className="form-card">
          <h2>基本情報</h2>
          <label>機種名 <em>必須</em><input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：サンプルジャグラー" /></label>
          <label>情報元URL<input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com" /></label>
          <label>メモ<textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="参考情報や注意点" rows={3} /></label>
        </section>

        {items.map((item, itemIndex) => (
          <section className="form-card item-editor" key={item.id}>
            <div className="section-title"><h2>カウント項目 {itemIndex + 1}</h2>{items.length > 1 && <button type="button" className="text-danger" onClick={() => setItems(items.filter((_, i) => i !== itemIndex))}>削除</button>}</div>
            <label>項目名<input value={item.name} onChange={(e) => updateItem(itemIndex, { name: e.target.value })} placeholder="例：REG、ブドウ" /></label>
            <label>種類<select value={item.type} onChange={(e) => updateItem(itemIndex, { type: e.target.value as CountItemType })}><option value="bonus">ボーナス</option><option value="smallRole">小役</option><option value="rareRole">レア役</option><option value="custom">カスタム</option></select></label>
            <div className="setting-inputs">
              {item.probabilities.map((value, settingIndex) => (
                <label key={settingIndex}><span>設定{settingIndex + 1}</span><span className="fraction-input">1/<input inputMode="decimal" value={value} onChange={(e) => updateProbability(itemIndex, settingIndex, e.target.value)} placeholder="-" /></span></label>
              ))}
            </div>
          </section>
        ))}
        <button type="button" className="outline-button" onClick={() => setItems([...items, newItem()])}>＋ カウント項目を追加</button>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button save-machine">機種データを保存</button>
      </form>
    </main>
  )
}

function CounterScreen({ machine, onSave }: { machine: SlotMachine; onSave: (session: PlaySession) => void }) {
  const existing = storage.getActiveSession()
  const initial = existing?.machineId === machine.id ? existing : {
    id: uid(), machineId: machine.id, machineName: machine.name, totalGames: 0,
    counts: Object.fromEntries(machine.countItems.map((item) => [item.name, 0])), memo: '',
    startedAt: new Date().toISOString(), savedAt: new Date().toISOString(),
  }
  const [session, setSession] = useState<PlaySession>(initial)

  useEffect(() => { storage.saveActiveSession(session) }, [session])
  const changeGames = (amount: number) => setSession((current) => ({ ...current, totalGames: Math.max(0, current.totalGames + amount) }))
  const changeCount = (name: string, amount: number) => setSession((current) => ({ ...current, counts: { ...current.counts, [name]: Math.max(0, (current.counts[name] ?? 0) + amount) } }))
  const reset = () => {
    if (!confirm('総ゲーム数、全カウント、メモをリセットしますか？')) return
    setSession({ ...session, totalGames: 0, counts: Object.fromEntries(machine.countItems.map((item) => [item.name, 0])), memo: '', startedAt: new Date().toISOString() })
  }
  const combined = probability(session.totalGames, (session.counts.BIG ?? 0) + (session.counts.REG ?? 0))

  return (
    <main className="screen counter-screen">
      <Header title={machine.name} eyebrow="LIVE SESSION" />
      <section className="games-card">
        <div className="card-label">TOTAL GAMES</div>
        <div className="games-number">{session.totalGames.toLocaleString()}<span>G</span></div>
        <div className="game-buttons">{[1, 10, 50, 100].map((value) => <button key={value} onClick={() => changeGames(value)}>+{value}</button>)}</div>
        <button className="game-minus" onClick={() => changeGames(-1)}>−1 ゲーム戻す</button>
      </section>

      <section className="session-summary"><span>BIG <strong>{session.counts.BIG ?? 0}</strong></span><span>REG <strong>{session.counts.REG ?? 0}</strong></span><span>合算 <strong>{probabilityText(combined)}</strong></span></section>

      <div className="count-stack">
        {machine.countItems.map((item) => {
          const count = session.counts[item.name] ?? 0
          const current = probability(session.totalGames, count)
          const references = machine.settingValues.filter((value) => value.itemName === item.name).sort((a, b) => a.settingNumber - b.settingNumber)
          const nearest = nearestSetting(current, references)
          return (
            <article className="count-card" key={item.id}>
              <div className="count-card-head"><div><small>{typeLabel(item.type)}</small><h2>{item.name}</h2></div><div className="current-rate"><small>現在確率</small><strong>{probabilityText(current)}</strong></div></div>
              <div className="count-control">
                <button className="minus-button" onClick={() => changeCount(item.name, -1)} aria-label={`${item.name}を1減らす`}>−</button>
                <div><strong>{count}</strong><span>回</span></div>
                <button className="plus-button" onClick={() => changeCount(item.name, 1)} aria-label={`${item.name}を1増やす`}>＋</button>
              </div>
              {references.length > 0 && (
                <div className="comparison">
                  <div className="comparison-title"><span>参考値比較</span><strong>{nearest ? `参考値では設定${nearest}付近` : 'カウント後に比較'}</strong></div>
                  <div className="setting-strip">{references.map((value) => <span className={value.settingNumber === nearest ? 'nearest' : ''} key={value.id}><small>設定{value.settingNumber}</small><b>1/{value.probability}</b></span>)}</div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <section className="memo-card"><label>実戦メモ<textarea value={session.memo} onChange={(e) => setSession({ ...session, memo: e.target.value })} rows={3} placeholder="気づいたことを入力" /></label></section>
      <p className="disclaimer">{session.totalGames < 100 ? '試行回数が少ないため、比較結果は参考程度に確認してください。' : '比較結果は登録した参考値との近さであり、実際の設定を断定するものではありません。'}</p>
      <div className="session-actions"><button className="reset-button" onClick={reset}>リセット</button><button className="primary-button" onClick={() => onSave({ ...session, savedAt: new Date().toISOString() })}>実戦を保存</button></div>
    </main>
  )
}

function HistoryScreen({ sessions }: { sessions: PlaySession[] }) {
  return (
    <main className="screen">
      <Header title="実戦履歴" eyebrow="SESSION HISTORY" />
      {!sessions.length && <div className="empty-card large">まだ履歴がありません。<br />実戦カウントを保存すると、ここに表示されます。</div>}
      <div className="stack">
        {sessions.map((session) => {
          const combined = probability(session.totalGames, (session.counts.BIG ?? 0) + (session.counts.REG ?? 0))
          return (
            <button className="history-card" key={session.id} onClick={() => go(`history/${session.id}`)}>
              <div className="history-head"><strong>{session.machineName}</strong><time>{dateText(session.savedAt)}</time></div>
              <div className="history-stats"><span><small>ゲーム</small><b>{session.totalGames.toLocaleString()}G</b></span><span><small>BIG</small><b>{session.counts.BIG ?? 0}</b></span><span><small>REG</small><b>{session.counts.REG ?? 0}</b></span><span><small>合算</small><b>{probabilityText(combined)}</b></span></div>
              {session.memo && <p>{session.memo}</p>}
            </button>
          )
        })}
      </div>
    </main>
  )
}

function HistoryDetail({ session }: { session: PlaySession }) {
  const combined = probability(session.totalGames, (session.counts.BIG ?? 0) + (session.counts.REG ?? 0))
  return (
    <main className="screen">
      <Header title={session.machineName} eyebrow="SESSION DETAIL" />
      <section className="detail-hero"><time>{dateText(session.savedAt)}</time><strong>{session.totalGames.toLocaleString()}<span>G</span></strong><p>ボーナス合算 {probabilityText(combined)}</p></section>
      <section className="detail-list">{Object.entries(session.counts).map(([name, count]) => <div key={name}><span><strong>{name}</strong><small>{probabilityText(probability(session.totalGames, count))}</small></span><b>{count}<small>回</small></b></div>)}</section>
      {session.memo && <section className="memo-card"><label>実戦メモ<p>{session.memo}</p></label></section>}
    </main>
  )
}

function BottomNav({ active }: { active: Route['page'] }) {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      <button className={active === 'home' ? 'active' : ''} onClick={() => go()}><span>⌂</span>ホーム</button>
      <button className={active === 'picker' || active === 'counter' ? 'active' : ''} onClick={() => go('picker')}><span>＋</span>カウント</button>
      <button className={active === 'search' || active === 'register' ? 'active' : ''} onClick={() => go('search')}><span>⌕</span>機種</button>
      <button className={active === 'history' || active === 'historyDetail' ? 'active' : ''} onClick={() => go('history')}><span>◷</span>履歴</button>
    </nav>
  )
}

function NotFound() { return <main className="screen"><Header title="データがありません" /><div className="empty-card large">対象の履歴を確認できませんでした。</div></main> }
function typeLabel(type: CountItemType) { return ({ bonus: 'BONUS', smallRole: 'SMALL ROLE', rareRole: 'RARE ROLE', custom: 'CUSTOM' })[type] }
function dateText(value: string) { return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export default App
