import { cn } from "@frt/ui/styles/class-names.ts";

type ProgressProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly value: number;
};

function Progress({ className, value, ...props }: ProgressProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      data-slot="progress"
      role="progressbar"
      {...props}
    >
      <div
        className="h-full w-(--progress) rounded-full bg-primary transition-[width]"
        style={{ "--progress": `${percent}%` } as React.CSSProperties}
      />
    </div>
  );
}

export { Progress };
