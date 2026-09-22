import * as E from "effect/Effect";
import type * as React from "react";
import { useRef } from "react";

import { cn } from "@frt/ui/class-names.ts";
import { Input } from "@frt/ui/input.tsx";
import {
  controlFrameStyles,
  controlSizeStyles,
  textControlStyles,
} from "@frt/ui/primitive-styles.ts";

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
        className={cn(
          controlFrameStyles,
          controlSizeStyles.default,
          textControlStyles,
          "group grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden text-left",
        )}
        onClick={chooseDirectory}
        type="button"
      >
        <span className="min-w-0 self-center truncate px-2.5">
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
