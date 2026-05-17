import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Settings2, Plus, Trash2, X } from 'lucide-react'
import { useWorkflowSteps, WorkflowStep } from '../../hooks/useWorkflowSteps'

interface Props {
  clientId: number
  workflowStage: string | null
  onStageChange: (stepId: string | null) => void
}

export function ClientWorkflow({ workflowStage, onStageChange }: Props) {
  const { t } = useTranslation()
  const { steps, updateSteps } = useWorkflowSteps()
  const [configMode, setConfigMode] = useState(false)
  const [editLabels, setEditLabels] = useState<WorkflowStep[]>([])

  const currentIdx = steps.findIndex(s => s.id === workflowStage)
  const isFinished = currentIdx === steps.length - 1 && workflowStage !== null

  function selectStep(stepId: string) {
    onStageChange(stepId === workflowStage ? null : stepId)
  }

  function openConfig() {
    setEditLabels(steps.map(s => ({ ...s })))
    setConfigMode(true)
  }

  function saveConfig() {
    const valid = editLabels.filter(s => s.label.trim())
    updateSteps(valid)
    if (workflowStage && !valid.find(s => s.id === workflowStage)) {
      onStageChange(null)
    }
    setConfigMode(false)
  }

  function addStep() {
    setEditLabels(prev => [...prev, { id: Date.now().toString(), label: t('workflow.newStep') }])
  }

  function removeStep(id: string) {
    setEditLabels(prev => prev.filter(s => s.id !== id))
  }

  function updateLabel(id: string, label: string) {
    setEditLabels(prev => prev.map(s => s.id === id ? { ...s, label } : s))
  }

  // ── Config mode ──────────────────────────────────────────────────────────────
  if (configMode) {
    return (
      <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-surface-800">{t('workflow.configure')}</h3>
          <button onClick={() => setConfigMode(false)} className="text-surface-400 hover:text-surface-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {editLabels.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <span className="text-xs font-medium text-surface-400 w-5 text-center">{idx + 1}</span>
              <input
                value={step.label}
                onChange={e => updateLabel(step.id, e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-surface-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder={t('workflow.stepName')}
              />
              <button
                onClick={() => removeStep(step.id)}
                disabled={editLabels.length <= 1}
                className="text-surface-300 hover:text-red-500 disabled:opacity-30 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addStep}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-surface-600
                       border border-dashed border-surface-300 rounded-lg
                       hover:border-brand-400 hover:text-brand-500 transition-colors"
          >
            <Plus size={14} /> {t('workflow.addStep')}
          </button>
          <button
            onClick={saveConfig}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-brand-500 text-white
                       rounded-lg hover:bg-brand-400 transition-colors ml-auto"
          >
            <Check size={14} /> {t('workflow.save')}
          </button>
        </div>
      </div>
    )
  }

  // ── Normal mode ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-surface-800">{t('workflow.title')}</h3>
          {isFinished && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {t('workflow.completed')}
            </span>
          )}
        </div>
        <button
          onClick={openConfig}
          className="text-surface-300 hover:text-brand-500 transition-colors"
          title={t('workflow.configure')}
        >
          <Settings2 size={15} />
        </button>
      </div>

      <div className="flex items-start">
        {steps.map((step, idx) => {
          const done    = currentIdx >= 0 && idx < currentIdx
          const current = step.id === workflowStage
          const isLast  = idx === steps.length - 1

          return (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center w-full">
                <button
                  onClick={() => selectStep(step.id)}
                  title={t('workflow.mark', { label: step.label })}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200
                    ${current
                      ? 'bg-brand-500 border-brand-500 text-white shadow-[0_0_0_4px_theme(colors.brand.100)] scale-110'
                      : done
                        ? 'bg-brand-100 border-brand-400 text-brand-600 hover:bg-brand-200'
                        : 'bg-white border-surface-200 text-surface-400 hover:border-brand-300 hover:text-brand-400'
                    }`}
                >
                  {done
                    ? <Check size={14} strokeWidth={2.5} />
                    : <span className="text-xs font-semibold">{idx + 1}</span>
                  }
                </button>
                <span
                  className={`text-xs mt-2 text-center leading-tight px-0.5 line-clamp-2
                    ${current ? 'text-brand-600 font-semibold' : done ? 'text-brand-500' : 'text-surface-400'}`}
                  style={{ maxWidth: '72px' }}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div className={`flex-1 h-0.5 mt-[17px] mx-0.5 shrink-0 transition-colors duration-300
                  ${idx < currentIdx ? 'bg-brand-400' : 'bg-surface-200'}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {!workflowStage && (
        <p className="text-xs text-surface-400 text-center mt-4">
          {t('workflow.hint')}
        </p>
      )}
    </div>
  )
}
