'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFile: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

export function UploadZone({
  onFile,
  selectedFile,
  onClear,
  disabled,
}: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        // still allow it — parser is tolerant — but warn via accept attr
      }
      onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {selectedFile ? (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
            <FileText className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">
              {selectedFile.name}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            Drop your wiring list CSV here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-primary hover:underline"
            >
              browse to upload
            </button>
          </p>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
            Expected: Terminal Number, Wire Tag, Description, Panel Reference
          </p>
        </>
      )}
    </div>
  );
}
