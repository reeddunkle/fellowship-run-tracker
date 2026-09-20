import * as E from "effect/Effect";
import type * as React from "react";
import { useRef } from "react";

import { Input } from "@/electron/renderer/components/ui/input.tsx";
import { cn } from "@/util/class-names.ts";

type DirectoryInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "disabled" | "onChange" | "readOnly" | "type"
> & {
  readonly getPathForFile: (file: File) => Promise<string>;
  readonly onPathChange?: (path: string) => void;
};

export function DirectoryInput({
  className,
  getPathForFile,
  onPathChange,
  value,
  ...props
}: DirectoryInputProps) {
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const chooseDirectory = () => {
    directoryInputRef.current?.click();
  };

  const handleDirectoryChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (file === undefined) {
      return;
    }

    E.gen(function* () {
      const path = yield* E.promise(() => {
        return getPathForFile(file);
      });

      if (path === "") {
        return;
      }

      yield* E.sync(() => {
        onPathChange?.(path);
        input.value = "";
      });
    }).pipe(E.runFork);
  };

  return (
    <div className={cn("w-full min-w-0", className)}>
      <button
        className="group grid h-10 w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-lg border border-input bg-transparent text-left text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        onClick={chooseDirectory}
        type="button"
      >
        <span className="min-w-0 truncate px-2.5 py-1.5">
          {String(value ?? "")}
        </span>
        <span className="flex shrink-0 items-center border-l border-input px-3 font-medium transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
          Choose&hellip;
        </span>
      </button>
      <input {...props} type="hidden" value={value} />
      <Input
        className="hidden"
        onChange={handleDirectoryChange}
        ref={directoryInputRef}
        type="file"
        webkitdirectory=""
      />
    </div>
  );
}
