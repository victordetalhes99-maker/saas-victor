import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  /** Current stored value — either a full URL or a storage path in the avatars bucket. */
  value: string | null | undefined;
  /** Initials shown when there's no photo yet. */
  fallbackInitials: string;
  /** Called after the DB is updated with the new URL (or "" when removed). */
  onChange?: (newValue: string) => void;
  size?: number;
};

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "avatars";

function isHttp(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

async function compressImage(file: File, maxDim = 640, quality = 0.88): Promise<File> {
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

export function AvatarUploader({ userId, value, fallbackInitials, onChange, size = 88 }: Props) {
  const [uploading, setUploading] = useState(false);
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
        toast.error("A imagem deve ter no máximo 5 MB.");
        return;
      }
      setUploading(true);
      try {
        const compressed = await compressImage(file);
        const path = `${userId}/avatar-${Date.now()}.jpg`;
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
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", userId);
        if (dbErr) throw dbErr;
        setDisplayUrl(publicUrl);
        onChange?.(publicUrl);
        toast.success("Foto de perfil atualizada.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChange, userId],
  );

  const handleRemove = useCallback(async () => {
    if (!value) return;
    setUploading(true);
    try {
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      setDisplayUrl(null);
      onChange?.("");
      toast.success("Foto removida.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover a foto.");
    } finally {
      setUploading(false);
    }
  }, [onChange, userId, value]);

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        aria-label={displayUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
        className="group relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 transition hover:ring-primary/40"
        style={{ width: size, height: size }}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-primary/10 text-lg font-semibold text-primary">
            {fallbackInitials}
          </div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </span>
      </button>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition hover:bg-primary/20 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          {displayUrl ? "Trocar foto" : "Adicionar foto"}
        </button>
        {displayUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="ml-2 inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">JPG, PNG ou WEBP até 5 MB.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export default AvatarUploader;
