"use client"

import { CalendarDays, CheckCircle2, Circle, Flag, Layers3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"
import type { IntegratedTask } from "@/lib/data-integrator"
import { useModalFlip } from "@/hooks/use-modal-flip"

export function ChecklistTaskDetail({ task, onClose }: { task: IntegratedTask | null; onClose: () => void }) {
  const { t, language } = useTranslation()
  const flipKey = task ? `checklist-task-${task.id}` : ""
  const closeFlip = useModalFlip(flipKey, Boolean(task))
  const handleClose = () => closeFlip(onClose)

  const dueDate = task?.metadata?.dueDate
  const formattedDate = dueDate
    ? new Intl.DateTimeFormat(language, { dateStyle: "full" }).format(new Date(dueDate))
    : t("taskDialog.noDate")
  const priorityLabel = task ? t(`taskDialog.priority.${task.priority}`) : ""
  const statusLabel = task ? (task.completed ? t("taskDialog.status.done") : t("taskDialog.status.todo")) : ""

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent data-flip-to={flipKey} className="max-w-md overflow-hidden rounded-[28px] border-foreground/[0.08] bg-background/95 p-0 backdrop-blur-2xl">
        <div data-modal-content className="p-6 sm:p-7">
          <DialogHeader className="gap-3 pr-8 text-left">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {task?.completed ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Circle className="size-3.5" />}
              {statusLabel}
            </div>
            <DialogTitle data-shared-item="title" className="text-xl leading-tight tracking-[-0.02em]">{task?.text}</DialogTitle>
          </DialogHeader>

          {task && (
            <div className="mt-7 grid gap-2.5">
              <div className="flex items-center justify-between rounded-2xl bg-foreground/[0.035] px-4 py-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground"><Flag className="size-3.5" />{t("taskDialog.priority")}</span>
                <Badge variant="outline" className="rounded-full text-[10px]">{priorityLabel}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-foreground/[0.035] px-4 py-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{t("taskDialog.dueDate")}</span>
                <span className="max-w-[62%] text-right text-xs font-medium text-foreground/80">{formattedDate}</span>
              </div>
              {(task.metadata?.projectName || task.metadata?.routineName || task.metadata?.subjectName) && (
                <div className="flex items-center justify-between rounded-2xl bg-foreground/[0.035] px-4 py-3">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Layers3 className="size-3.5" />{t("taskDialog.source")}</span>
                  <span className="max-w-[62%] truncate text-right text-xs font-medium text-foreground/80">
                    {task.metadata.projectName || task.metadata.routineName || task.metadata.subjectName}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
