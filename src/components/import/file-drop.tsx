'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onFile: (file: File) => void;
}

export function FileDrop({ onFile }: Props) {
  const t = useTranslations('Import');
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.match(/\.(csv|txt)$/i)) return;
      setSelectedFile(file);
      onFile(file);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border/60 hover:border-primary/50 hover:bg-muted/30',
        )}
      >
        <input
          type="file"
          accept=".csv,.txt"
          className="sr-only"
          onChange={onInputChange}
        />
        <motion.div
          animate={dragging ? { scale: 1.1 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
        >
          <Upload className="h-7 w-7 text-primary" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold">{t('dropTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('dropHint')}</p>
        </div>
      </label>

      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
        >
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedFile.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {(selectedFile.size / 1024).toFixed(0)} KB
          </span>
          <button
            onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
