import type { ReactNode } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import { Upload } from 'antd'
import type { UploadFile } from 'antd'

interface UploadDropzoneProps {
  accept?: string
  multiple?: boolean
  maxCount?: number
  /** Diberikan → render daftar file terpilih ala antd. */
  fileList?: UploadFile[]
  icon?: ReactNode
  title: string
  hint?: ReactNode
  disabled?: boolean
  /** Kembalikan `false` di onBefore untuk mencegah upload otomatis (pola aplikasi).
   *  antd memberikan RcFile (subclass File) saat callback dipanggil. */
  beforeUpload: (file: File) => boolean | Promise<boolean>
  onRemove?: (file: UploadFile) => void
}

/**
 * Dropzone seragam untuk semua modal impor/unggah — satu markup (.import-dragger
 * + .import-dropzone, gaya di index.css) menggantikan dua pola yang berbeda
 * (markup shared ImportWizard vs ant-upload-* default antd di PhotoModal).
 */
export function UploadDropzone({
  accept,
  multiple,
  maxCount,
  fileList,
  icon,
  title,
  hint,
  disabled,
  beforeUpload,
  onRemove,
}: UploadDropzoneProps) {
  return (
    <Upload.Dragger
      className="import-dragger"
      accept={accept}
      multiple={multiple}
      maxCount={maxCount}
      fileList={fileList}
      showUploadList={fileList !== undefined}
      disabled={disabled}
      beforeUpload={beforeUpload}
      onRemove={onRemove}
    >
      <div className="import-dropzone">
        <span className="import-dropzone-icon" aria-hidden="true">
          {icon ?? <InboxOutlined />}
        </span>
        <span className="import-dropzone-text">{title}</span>
        {hint && <span className="import-dropzone-hint">{hint}</span>}
      </div>
    </Upload.Dragger>
  )
}
