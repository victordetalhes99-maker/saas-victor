import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, Car as CarIcon, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  vehicleId: string;
  /** Current stored value — either a full URL or a storage path in the vehicle-art bucket. */
  value: string | null | undefined;
  /** Called after DB is updated with the new URL (or "" when removed). */
  onChange?: (newValue: string) => void;
  /** Alternate trigger: render children as the click target instead of the default tile. */
  children?: React.ReactNode;
  className?: string;
};

const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET = "vehicle-art";

function isHttp(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function VehicleUploader({
  userId,
  vehicleId,
  value,
  onChange,
  children,
  className = "",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!value) {
        setDisplayUrl(null);
        return;
      }
      if (isHttp(value)) {
        setDisplayUrl(value);
        return;
      }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60);
      if (!cancelled) setDisplayUrl(error ? null : (data?.signedUrl ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Envie um arquivo de imagem (JPG, PNG, WEBP).");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("A imagem deve ter no máximo 8 MB.");
        return;
      }
      setUploading(true);
      try {
        const compressed = await compressImage(file);
        const ext = compressed.type === "image/png" ? "png" : "jpg";
        const path = `${userId}/photo-${vehicleId}-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from(BUCKET)
          .upload(path, compressed, { upsert: true, contentType: compressed.type });
        if (up.error) throw up.error;
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const publicUrl =
          signed?.signedUrl ?? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const { error: dbErr } = await supabase
          .from("vehicles")
          .update({ image_url: publicUrl, image_status: "user_upload" })
          .eq("id", vehicleId);
        if (dbErr) throw dbErr;
        const reader = new FileReader();
        reader.onload = () => setDisplayUrl(String(reader.result));
        reader.readAsDataURL(compressed);
        onChange?.(publicUrl);
        toast.success("Foto do veículo atualizada.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChange, userId, vehicleId],
  );

  const handleRemove = useCallback(async () => {
    if (!value) return;
    setUploading(true);
    try {
      const { error: dbErr } = await supabase
        .from("vehicles")
        .update({ image_url: null, image_status: "pending" })
        .eq("id", vehicleId);
      if (dbErr) throw dbErr;
      setDisplayUrl(null);
      onChange?.("");
      toast.success("Foto removida.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover a foto.");
    } finally {
      setUploading(false);
    }
  }, [onChange, vehicleId, value]);

  const openPicker = () => inputRef.current?.click();

  // Compact "trigger" mode — the parent decides the click target.
  if (children) {
    return (
      <>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          aria-label="Alterar foto do veículo"
          className={`group relative block w-full text-left ${className}`}
        >
          {children}
          {uploading && (
            <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </>
    );
  }

  // Default tile UI (dropzone card).
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 transition ${
        dragOver ? "border-primary/50 bg-primary/[0.06]" : ""
      } ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/30 transition hover:border-primary/40 hover:bg-primary/5"
        aria-label="Enviar foto do veículo"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Foto do veículo"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <CarIcon className="h-8 w-8 opacity-60" />
            <span className="text-[11px] uppercase tracking-[0.25em]">Toque para enviar foto</span>
          </div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </span>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          JPG, PNG ou WEBP até 8 MB. Compressão automática.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition hover:bg-primary/20 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {value ? "Trocar foto" : "Selecionar foto"}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export default VehicleUploader;
