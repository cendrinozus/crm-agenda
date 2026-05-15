import { useState } from 'react'

export interface WorkflowStep {
  id: string
  label: string
}

export const DEFAULT_STEPS: WorkflowStep[] = [
  { id: '1', label: 'Contact initial' },
  { id: '2', label: 'Qualification' },
  { id: '3', label: 'Proposition' },
  { id: '4', label: 'Négociation' },
  { id: '5', label: 'Signé' },
]

const STEPS_KEY = 'wc_workflow_steps'

export function loadSteps(): WorkflowStep[] {
  try {
    const raw = localStorage.getItem(STEPS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_STEPS
  } catch { return DEFAULT_STEPS }
}

export function saveSteps(steps: WorkflowStep[]) {
  localStorage.setItem(STEPS_KEY, JSON.stringify(steps))
}

export function getStepProgress(steps: WorkflowStep[], stageId: string | null | undefined): number {
  if (!stageId) return 0
  const idx = steps.findIndex(s => s.id === stageId)
  if (idx < 0) return 0
  return Math.round(((idx + 1) / steps.length) * 100)
}

export function getStepLabel(steps: WorkflowStep[], stageId: string | null | undefined): string | null {
  if (!stageId) return null
  return steps.find(s => s.id === stageId)?.label ?? null
}

export function useWorkflowSteps() {
  const [steps, setSteps] = useState<WorkflowStep[]>(loadSteps)

  function updateSteps(newSteps: WorkflowStep[]) {
    setSteps(newSteps)
    saveSteps(newSteps)
  }

  return { steps, updateSteps }
}
