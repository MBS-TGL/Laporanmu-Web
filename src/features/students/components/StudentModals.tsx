import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import type { useShortcuts } from '../../../shared/hooks/useShortcuts'
import { StudentForm } from './StudentForm'
import { ImportModal } from './ImportModal'
const DetailDrawer = lazy(() =>
  import('./DetailDrawer').then((m) => ({ default: m.DetailDrawer })),
)
import { ExportModal } from './ExportModal'
import { MoveModal } from './MoveModal'
import { GraduateModal } from './GraduateModal'
import { BroadcastModal } from './BroadcastModal'
import { GatewayModal } from './GatewayModal'
import { CardModal } from './CardModal'
import { CardsModal } from './CardsModal'
import { ResetModal } from './ResetModal'
import { PhotoModal } from './PhotoModal'
import { ScanModal } from './ScanModal'
import type { ClassBrief } from '../hooks'
import type { Student, StudentFilters, StudentFormValues } from '../types'

interface StudentModalsProps {
  // StudentForm
  formOpen: boolean
  setFormOpen: Dispatch<SetStateAction<boolean>>
  editing: Student | null
  submitting: boolean
  onSubmit: (values: StudentFormValues) => void
  // ImportModal
  importOpen: boolean
  setImportOpen: Dispatch<SetStateAction<boolean>>
  // ExportModal
  exportOpen: boolean
  setExportOpen: Dispatch<SetStateAction<boolean>>
  exportFilters: Omit<StudentFilters, 'page' | 'pageSize'>
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  exportScope: 'filtered' | 'selected'
  filteredCount: number
  // MoveModal / GraduateModal / BroadcastModal
  moveOpen: boolean
  setMoveOpen: Dispatch<SetStateAction<boolean>>
  graduateOpen: boolean
  setGraduateOpen: Dispatch<SetStateAction<boolean>>
  waOpen: boolean
  setWaOpen: Dispatch<SetStateAction<boolean>>
  selectedStudents: Student[]
  classes: ClassBrief[]
  // GatewayModal
  waSettingsOpen: boolean
  setWaSettingsOpen: Dispatch<SetStateAction<boolean>>
  // CardModal
  cardStudents: Student[] | null
  setCardStudents: Dispatch<SetStateAction<Student[] | null>>
  // CardsModal
  bulkCardOpen: boolean
  setBulkCardOpen: Dispatch<SetStateAction<boolean>>
  allStudents: Student[]
  rows: Student[]
  // ResetModal / PhotoModal / ScanModal
  resetOpen: boolean
  setResetOpen: Dispatch<SetStateAction<boolean>>
  classId: string | undefined
  bulkPhotoOpen: boolean
  setBulkPhotoOpen: Dispatch<SetStateAction<boolean>>
  scanOpen: boolean
  setScanOpen: Dispatch<SetStateAction<boolean>>
  openDetail: (student: Student) => void
  // DetailDrawer
  detail: Student | null
  privacy: boolean
  closeDetail: () => void
  openEdit: (student: Student) => void
  // ShortcutsModal
  shortcuts: ReturnType<typeof useShortcuts>
}

/** Cluster modal & drawer tab Santri Aktif — state & handler tetap di StudentsPage */
export function StudentModals({
  formOpen,
  setFormOpen,
  editing,
  submitting,
  onSubmit,
  importOpen,
  setImportOpen,
  exportOpen,
  setExportOpen,
  exportFilters,
  selectedIds,
  setSelectedIds,
  exportScope,
  filteredCount,
  moveOpen,
  setMoveOpen,
  graduateOpen,
  setGraduateOpen,
  waOpen,
  setWaOpen,
  selectedStudents,
  classes,
  waSettingsOpen,
  setWaSettingsOpen,
  cardStudents,
  setCardStudents,
  bulkCardOpen,
  setBulkCardOpen,
  allStudents,
  rows,
  resetOpen,
  setResetOpen,
  classId,
  bulkPhotoOpen,
  setBulkPhotoOpen,
  scanOpen,
  setScanOpen,
  openDetail,
  detail,
  privacy,
  closeDetail,
  openEdit,
  shortcuts,
}: StudentModalsProps) {
  return (
    <>
      <StudentForm
        open={formOpen}
        student={editing}
        submitting={submitting}
        onCancel={() => setFormOpen(false)}
        onSubmit={onSubmit}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={exportFilters}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={filteredCount}
      />

      <MoveModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        students={selectedStudents}
        classes={classes}
        onMoved={() => setSelectedIds([])}
      />

      <GraduateModal
        open={graduateOpen}
        onClose={() => setGraduateOpen(false)}
        students={selectedStudents}
        onGraduated={() => setSelectedIds([])}
      />

      <BroadcastModal open={waOpen} onClose={() => setWaOpen(false)} students={selectedStudents} />

      <GatewayModal open={waSettingsOpen} onClose={() => setWaSettingsOpen(false)} />

      <CardModal
        open={cardStudents !== null}
        onClose={() => setCardStudents(null)}
        students={cardStudents ?? []}
      />

      <CardsModal
        open={bulkCardOpen}
        onClose={() => setBulkCardOpen(false)}
        allStudents={allStudents}
        filteredRows={rows}
        classes={classes}
        onSubmit={(list) => {
          setBulkCardOpen(false)
          setCardStudents(list)
        }}
      />

      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} defaultClassId={classId} />

      <PhotoModal open={bulkPhotoOpen} onClose={() => setBulkPhotoOpen(false)} />

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        allStudents={allStudents}
        onSelectStudent={openDetail}
      />

      {detail !== null && (
        <Suspense fallback={null}>
          <DetailDrawer
            open={!!detail}
            student={detail}
            isPrivacyMode={privacy}
            onClose={closeDetail}
            onEdit={(s) => {
              closeDetail()
              openEdit(s)
            }}
          />
        </Suspense>
      )}

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </>
  )
}
