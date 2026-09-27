import { useMutation } from "@tanstack/react-query";
import * as E from "effect/Effect";
import { FolderOpenIcon, XCircleIcon } from "lucide-react";

import { Button } from "@frt/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frt/ui/card.tsx";

import * as diagnosticsClient from "@/renderer/api/electron-ipc/diagnostics/diagnostics-client.ts";
import { useMetaSuspense } from "@/renderer/api/meta/meta-queries.ts";

export function DiagnosticsSettings() {
  const meta = useMetaSuspense();

  const openLogsFolderMutation = useMutation({
    mutationFn: () => {
      return E.runPromise(diagnosticsClient.openLogsFolder());
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostics</CardTitle>
        <CardDescription>
          Logs help diagnose problems. They're stored on this computer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Version {meta.appVersion}
        </p>
        <div>
          <Button
            disabled={openLogsFolderMutation.isPending}
            onClick={() => {
              openLogsFolderMutation.mutate();
            }}
            type="button"
            variant="outline"
          >
            <FolderOpenIcon />
            Open logs folder
          </Button>
        </div>
        {openLogsFolderMutation.isError ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <XCircleIcon className="size-3.5" />
            Couldn't open the logs folder.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
