'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Flame,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react'
import { api, type Completion, type Difficulty, type Me, type Quest } from '../lib/api'

const difficultyMeta = {
  easy: { label: 'Easy', xp: 10 },
  medium: { label: 'Medium', xp: 25 },
  hard: { label: 'Hard', xp: 50 },
} satisfies Record<Difficulty, { label: string; xp: number }>

function todayIn(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts()
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
}

function ProgressCard({ me, levelUp }: { me: Me; levelUp: boolean }) {
  const total = me.xp_into_level + me.xp_to_next_level
  const percent = total === 0 ? 0 : Math.min(100, (me.xp_into_level / total) * 100)
  return (
    <section className="progress-card" aria-labelledby="progress-heading">
      <div className="progress-copy">
        <span className="eyebrow"><Sparkles size={14} /> Your progress</span>
        <div className="level-row">
          <div className={`level-orb ${levelUp ? 'level-up' : ''}`}>
            <span>LEVEL</span><strong>{me.level}</strong>
          </div>
          <div>
            <h1 id="progress-heading">Keep your momentum.</h1>
            <p><strong>{me.xp.toLocaleString()} XP</strong> earned across your quest journey</p>
          </div>
        </div>
        <div className="bar-label">
          <span>{me.xp_into_level} XP into level {me.level}</span>
          <span>{me.xp_to_next_level} XP to go</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={me.xp_into_level}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="streak-card">
        <div className="streak-icon"><Flame size={25} /></div>
        <div><strong>{me.streak}</strong><span>day streak</span></div>
        <p>{me.streak ? 'Your consistency is paying off.' : 'Complete a quest to start your streak.'}</p>
      </div>
    </section>
  )
}

function QuestForm({ timezone, onCreated }: { timezone: string; onCreated: (quest: Quest) => void }) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [mode, setMode] = useState<'once' | 'daily'>('once')
  const [dueDate, setDueDate] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const earliestDueDate = todayIn(timezone)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if ([...title].length < 1 || [...title].length > 100) {
      setError('Title must be between 1 and 100 characters.')
      return
    }
    if (mode === 'once' && dueDate && dueDate < earliestDueDate) {
      setError(`Due date must be ${earliestDueDate} or later.`)
      return
    }
    setPending(true)
    setError('')
    try {
      const quest = await api.createQuest({
        title,
        difficulty,
        ...(mode === 'daily' ? { recurrence: 'daily' as const } : dueDate ? { due_date: dueDate } : {}),
      })
      onCreated(quest)
      setTitle('')
      setDifficulty('medium')
      setMode('once')
      setDueDate('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this quest.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="panel create-panel" aria-labelledby="create-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Build momentum</span><h2 id="create-heading">Create a new quest</h2></div>
        <span className="heading-icon"><Plus size={20} /></span>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="quest-title">Quest title</label>
        <input id="quest-title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)}
          aria-describedby="title-count form-error" placeholder="What do you want to accomplish?" required />
        <div id="title-count" className="count">{[...title].length}/100</div>
        <fieldset>
          <legend>Difficulty</legend>
          <div className="difficulty-options">
            {(Object.keys(difficultyMeta) as Difficulty[]).map((value) => (
              <label key={value} className={difficulty === value ? 'selected' : ''}>
                <input type="radio" name="difficulty" value={value} checked={difficulty === value}
                  onChange={() => setDifficulty(value)} />
                <span>{difficultyMeta[value].label}<small>+{difficultyMeta[value].xp} XP</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Schedule</legend>
          <div className="mode-options">
            <label className={mode === 'once' ? 'selected' : ''}><input type="radio" name="mode" checked={mode === 'once'} onChange={() => setMode('once')} /><Target size={17} /> One-off</label>
            <label className={mode === 'daily' ? 'selected' : ''}><input type="radio" name="mode" checked={mode === 'daily'} onChange={() => { setMode('daily'); setDueDate('') }} /><RefreshCw size={16} /> Daily</label>
          </div>
        </fieldset>
        {mode === 'once' && <div className="date-field">
          <label htmlFor="due-date">Due date <span>Optional</span></label>
          <input id="due-date" type="date" min={earliestDueDate} value={dueDate}
            onChange={(event) => setDueDate(event.target.value)} aria-describedby="due-date-help form-error" />
          <p id="due-date-help" className="field-help">Choose today or later in {timezone}.</p>
        </div>}
        {error && <p id="form-error" className="inline-error" role="alert"><CircleAlert size={16} />{error}</p>}
        <button className="primary-button" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={18} />Creating…</> : <>Create quest <ArrowRight size={18} /></>}</button>
      </form>
    </section>
  )
}

function TimezoneSettings({ current, onUpdated }: { current: string; onUpdated: (me: Me) => Promise<void> }) {
  const [timezone, setTimezone] = useState(current)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const timezones = useMemo(() => {
    const supportedValuesOf = (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[]
    }).supportedValuesOf
    const supported = supportedValuesOf?.('timeZone') ?? [
      'Africa/Cairo',
      'America/Chicago',
      'America/Los_Angeles',
      'America/New_York',
      'Asia/Dubai',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Europe/Berlin',
      'Europe/Bucharest',
      'Europe/London',
      'Europe/Paris',
      'UTC',
    ]
    return supported.includes(current) ? supported : [current, ...supported]
  }, [current])

  useEffect(() => setTimezone(current), [current])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const me = await api.updateTimezone(timezone)
      await onUpdated(me)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the timezone.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="panel timezone-panel" aria-labelledby="timezone-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Local time</span><h2 id="timezone-heading">Timezone</h2></div>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="timezone">IANA timezone</label>
        <select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}
          required aria-describedby="timezone-help timezone-error">
          {timezones.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <p id="timezone-help" className="field-help">Choose from supported IANA timezones. The server uses this for streaks, daily quests, and due dates.</p>
        {error && <p id="timezone-error" className="inline-error" role="alert"><CircleAlert size={16} />{error}</p>}
        <button className="secondary-button" disabled={pending}>
          {pending ? <><LoaderCircle className="spin" size={16} />Saving…</> : 'Save timezone'}
        </button>
      </form>
    </section>
  )
}

function QuestList({ quests, timezone, pendingId, onComplete }: {
  quests: Quest[]; timezone: string; pendingId: string; onComplete: (quest: Quest) => void
}) {
  const today = todayIn(timezone)
  return (
    <section className="panel quests-panel" aria-labelledby="quests-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Today’s focus</span><h2 id="quests-heading">Your quests</h2></div>
        <span className="item-count">{quests.filter((quest) => !quest.done).length} active</span>
      </div>
      {!quests.length ? <div className="empty"><Target size={28} /><h3>Your quest log is ready</h3><p>Create your first quest to begin earning XP.</p></div> :
        <div className="quest-list">{quests.map((quest) => {
          const overdue = !quest.recurrence && !quest.done && !!quest.due_date && quest.due_date < today
          return <article className={`quest ${quest.done ? 'done' : ''}`} key={quest.id}>
            <div className={`quest-check ${quest.done ? 'checked' : ''}`}>{quest.done && <Check size={16} />}</div>
            <div className="quest-body">
              <div className="quest-title-row"><h3>{quest.title}</h3><span className={`difficulty ${quest.difficulty}`}>{difficultyMeta[quest.difficulty].label} · {difficultyMeta[quest.difficulty].xp} XP</span></div>
              <div className="quest-meta">
                {quest.recurrence ? <span><RefreshCw size={14} /> Repeats daily</span> :
                  quest.due_date ? <span className={overdue ? 'overdue' : ''}><CalendarDays size={14} />{overdue ? 'Overdue · ' : 'Due '}{quest.due_date}</span> :
                    <span><Target size={14} /> One-off quest</span>}
                {quest.done && <span className="complete-label"><Check size={14} /> Complete</span>}
              </div>
            </div>
            <button className="complete-button" onClick={() => onComplete(quest)} disabled={quest.done || pendingId === quest.id}>
              {pendingId === quest.id ? <><LoaderCircle className="spin" size={16} /> Saving</> : quest.done ? 'Done' : 'Complete'}
            </button>
          </article>
        })}</div>}
    </section>
  )
}

function History({ completions, quests, pendingId, onUndo }: {
  completions: Completion[]; quests: Quest[]; pendingId: string; onUndo: (completion: Completion) => void
}) {
  const titles = useMemo(() => new Map(quests.map((quest) => [quest.id, quest.title])), [quests])
  return (
    <section className="panel history-panel" aria-labelledby="history-heading">
      <div className="section-heading"><div><span className="eyebrow">Latest wins</span><h2 id="history-heading">Recent completions</h2></div></div>
      {!completions.length ? <div className="empty compact"><Check size={24} /><p>Completed quests will appear here.</p></div> :
        <div className="history-list">{completions.slice(0, 8).map((completion) =>
          <article className="history-item" key={completion.id}>
            <span className="history-check"><Check size={15} /></span>
            <div><h3>{titles.get(completion.quest_id) ?? 'Archived quest'}</h3><p>{completion.day} · <strong>{completion.base_xp} Base XP</strong></p></div>
            <button className="undo-button" aria-label={`Undo completion of ${titles.get(completion.quest_id) ?? 'quest'}`}
              disabled={pendingId === completion.id} onClick={() => onUndo(completion)}>
              {pendingId === completion.id ? <LoaderCircle className="spin" size={16} /> : <RotateCcw size={16} />}<span>Undo</span>
            </button>
          </article>
        )}</div>}
    </section>
  )
}

export default function App() {
  const [data, setData] = useState<{ me: Me; quests: Quest[]; completions: Completion[] } | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [pendingQuest, setPendingQuest] = useState('')
  const [pendingUndo, setPendingUndo] = useState('')
  const [levelUp, setLevelUp] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [me, quests, completions] = await Promise.all([api.getMe(), api.getQuests(), api.getCompletions()])
      setData({ me, quests, completions })
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your quests.')
      return false
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function complete(quest: Quest) {
    setPendingQuest(quest.id); setError('')
    const previousLevel = data?.me.level ?? 0
    try {
      const result = await api.completeQuest(quest.id)
      setData((current) => current && ({
        me: result.data.me,
        quests: current.quests.map((item) => item.id === quest.id ? { ...item, done: true } : item),
        completions: result.status === 201
          ? [result.data.completion, ...current.completions.filter((item) => item.id !== result.data.completion.id)]
          : current.completions,
      }))
      if (result.status === 201) {
        setLevelUp(result.data.me.level > previousLevel)
        setStatus(result.data.me.level > previousLevel ? `Level up! You reached level ${result.data.me.level}.` : `${quest.title} completed. Progress saved.`)
        window.setTimeout(() => setLevelUp(false), 1200)
      } else {
        setStatus('This quest was already complete. Your progress is unchanged.')
      }
      if (!(await load())) {
        setError('The completion was confirmed, but the latest quest list could not be refreshed. Use Try again to reconcile it.')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this quest.') }
    finally { setPendingQuest('') }
  }

  async function undo(completion: Completion) {
    setPendingUndo(completion.id); setError('')
    try {
      await api.undoCompletion(completion.id)
      setData(null)
      if (await load()) {
        setStatus('Completion undone. Your progress has been recalculated by the server.')
      } else {
        setError('Undo was confirmed, but recalculated progress could not be loaded. Try again to refresh it.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not undo this completion.')
      await load()
    } finally { setPendingUndo('') }
  }

  function created(quest: Quest) {
    setData((current) => current && ({ ...current, quests: [quest, ...current.quests] }))
    setStatus('Quest created and added to your journey.')
    void load().then((loaded) => {
      if (!loaded) setError('The quest was created, but the latest data could not be refreshed. Use Try again to reconcile it.')
    })
  }

  async function timezoneUpdated(me: Me) {
    setData(null)
    setStatus('')
    if (await load()) {
      setStatus(`Timezone updated to ${me.timezone}. Server-calculated daily state has been refreshed.`)
    } else {
      setError(`Timezone was updated to ${me.timezone}, but the latest daily state could not be loaded. Try again.`)
    }
  }

  return (
    <main>
      <header className="app-header"><a href="/" className="brand"><span><Target size={21} /></span>Questly</a><p>Small steps. Meaningful progress.</p></header>
      <div className="shell">
        {!data && !error ? <div className="loading-state"><LoaderCircle className="spin" size={28} /><h1>Preparing your quests</h1><p>Loading your latest progress…</p></div> :
          !data ? <div className="error-state"><CircleAlert size={30} /><h1>We couldn’t load your journey</h1><p>{error}</p><button className="primary-button" onClick={() => void load()}><RefreshCw size={17} /> Try again</button></div> :
          <>
            <ProgressCard me={data.me} levelUp={levelUp} />
            {(error || status) && <div className={`notice ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error ? <CircleAlert size={17} /> : <Check size={17} />}{error || status}</div>}
            <div className="content-grid">
              <div className="main-column">
                <QuestList quests={data.quests} timezone={data.me.timezone} pendingId={pendingQuest} onComplete={(quest) => void complete(quest)} />
              </div>
              <aside className="side-column">
                <QuestForm timezone={data.me.timezone} onCreated={created} />
                <TimezoneSettings current={data.me.timezone} onUpdated={timezoneUpdated} />
                <History completions={data.completions} quests={data.quests} pendingId={pendingUndo} onUndo={(completion) => void undo(completion)} />
              </aside>
            </div>
          </>}
      </div>
    </main>
  )
}
