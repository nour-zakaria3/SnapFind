export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface ImageRow {
  id: string;
  storage_path: string;
  folder_id: string | null;
  ocr_text: string;
  status: 'indexed' | 'pending';
  trashed_at: string | null;
  created_at: string;
}
