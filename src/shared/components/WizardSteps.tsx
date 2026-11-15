import { Fragment } from 'react'
import { Grid } from 'antd'
import { CheckOutlined } from '@ant-design/icons'

export interface WizardStepItem {
  title: string
  description?: string
}

interface WizardStepsProps {
  current: number
  items: WizardStepItem[]
}

/**
 * Stepper seragam untuk semua wizard impor/proses massal — lingkaran bernomor
 * + garis penghubung yang menyala mengikuti progres (gaya referensi wizard
 * impor). Gaya di src/index.css (.wizard-step*). Jangan pakai `<Steps>` mentah
 * di dalam modal.
 * Struktur flat [step, line, step, line, ...]: garis adalah anak langsung
 * container flex sehingga tumbuh merata (step content-width).
 * Di mobile (<768px) deskripsi disembunyikan agar tidak memakan tinggi layar.
 */
export function WizardSteps({ current, items }: WizardStepsProps) {
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false

  return (
    <div className="wizard-steps" role="list" style={{ margin: '8px 0 20px' }}>
      {items.map((item, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <Fragment key={item.title}>
            {i > 0 && <span className="wizard-step-line" data-done={i <= current} aria-hidden="true" />}
            <div className="wizard-step" role="listitem" data-state={state}>
              <span className="wizard-step-dot" aria-hidden="true">
                {i < current ? <CheckOutlined style={{ fontSize: 11 }} /> : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="wizard-step-title">{item.title}</div>
                {!isMobile && item.description && <div className="wizard-step-desc">{item.description}</div>}
              </div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
