import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AppModal, MODAL_SIZE, type AppModalProps, type ModalSize } from './AppModal'
import { WizardSteps, type WizardStepItem } from './WizardSteps'
import { swapTransition, swapVariants } from '../motion'

interface WizardModalProps extends Omit<AppModalProps, 'footer' | 'children' | 'width' | 'size'> {
  /** Daftar langkah — dirender WizardSteps di atas konten. */
  steps: WizardStepItem[]
  /** Langkah aktif — dikontrol penuh oleh pemanggil (setStep milik feature). */
  current: number
  /** Footer per langkah; bila tidak diberikan (atau mengembalikan undefined) pakai footer AppModal. */
  footerByStep?: (step: number) => ReactNode
  /** Lebar eksplisit menang di atas size. */
  width?: number
  /** Ukuran per langkah — angka token atau fungsi dari index langkah. */
  size?: ModalSize | ((step: number) => ModalSize)
  /** Konten langkah aktif — pemanggil merender kondisional; transisi antar langkah otomatis. */
  children: ReactNode
}

/**
 * Modal wizard seragam = "type wizard" di atas AppModal: WizardSteps + transisi
 * antar langkah (fade-up swap, MOTION 2) + footer per langkah. Mobile tetap
 * bottom sheet via AppModal.
 * Untuk impor kompleks (mapping kolom, multi-sumber, langkah kustom) yang
 * melebihi ImportWizard — lihat SKILLS.md §Skill 3. Murni komposisi tanpa
 * state: gate validasi & alur langkah tetap milik feature.
 */
export function WizardModal({
  steps,
  current,
  footerByStep,
  width,
  size,
  children,
  ...appModalProps
}: WizardModalProps) {
  const resolvedSize = typeof size === 'function' ? size(current) : size
  const resolvedWidth = width ?? MODAL_SIZE[resolvedSize ?? 'md']
  const footer = footerByStep ? footerByStep(current) : undefined

  return (
    <AppModal {...appModalProps} width={resolvedWidth} footer={footer}>
      <WizardSteps current={current} items={steps} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          variants={swapVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={swapTransition}
          style={{ marginTop: 8 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </AppModal>
  )
}
