export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`leading-tight ${className}`}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Clube
      </div>
      <div className="text-base font-bold tracking-wide text-foreground">DETAIL</div>
    </div>
  );
}
