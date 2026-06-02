import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  onFile, accept, label,
}: {
  onFile: (file: File) => void;
  accept?: string;
  label: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback((files: FileList | null) => {
    if (files && files[0]) onFile(files[0]);
  }, [onFile]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      className={cn(
        "group cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all",
        drag
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/60 hover:bg-muted/40"
      )}
    >
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => handle(e.target.files)} />
      <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
      <p className="mt-4 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">Drag and drop or click to browse</p>
    </div>
  );
}
