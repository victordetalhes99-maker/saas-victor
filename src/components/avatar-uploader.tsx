import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, User as UserIcon, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  /** Current stored avatar reference — either a storage path (bucket key) or a full URL. */
  value: string | null | undefined;
  /** Called after DB is updated with the new path (or "" when removed). */
  onChange?: (newValue: string) => void;
  /** Fallback initials to render when there is no photo. */
  initials?: string;
  className?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

function isHttp(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

export function AvatarUploader({ userId, value, onChange, initials, className = "" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve stored path/URL into a viewable URL (signed for private bucket).
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
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(value, 60 * 60);
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
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (up.error) throw up.error;
        const { error: dbErr } = await supabase
          .from("profiles")
          .update({ avatar_url: path })
          .eq("id", userId);
        if (dbErr) throw dbErr;
        // Instant preview from local file while signed URL resolves.
        const reader = new FileReader();
        reader.onload = () => setDisplayUrl(String(reader.result));
        reader.readAsDataURL(file);
        onChange?.(path);
        toast.success("Foto atualizada.");
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
      if (!isHttp(value)) {
        await supabase.storage
          .from("avatars")
          .remove([value])
          .catch(() => {});
      }
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
    <div
      className={`flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 transition ${
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
        const file = e.dataTransfer.files?.[0] ?? null;
        void handleFile(file);
      }}
    >
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        className="group relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.12] bg-primary/10 text-primary transition hover:border-primary/40"
        aria-label="Selecionar foto"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Foto do perfil"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : initials ? (
          <span className="text-sm font-semibold">{initials}</span>
        ) : (
          <UserIcon className="h-6 w-6" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </span>
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-black/60">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {uploading ? "Enviando foto..." : displayUrl ? "Foto atual" : "Adicione uma foto"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Clique ou arraste. JPG, PNG ou WEBP, até 5 MB.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
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
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <XIcon className="hidden" />
    </div>
  );
}

export default AvatarUploader;
