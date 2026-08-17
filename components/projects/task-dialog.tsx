"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { parseDate, type CalendarDate } from "@internationalized/date"
import { CalendarDays, Check, Flag, X } from "lucide-react"
import {
  Calendar as HeroCalendar,
  DateField as HeroDateField,
  DatePicker as HeroDatePicker,
  I18nProvider as HeroI18nProvider,
  Label as HeroLabel,
  ListBox as HeroListBox,
  Select as HeroSelect,
} from "@heroui/react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Task } from "@/types/project"
import { useNotifications } from "@/lib/notification-context"
import { useModalFlip } from "@/hooks/use-modal-flip"
import { useTranslation } from "@/lib/i18n"

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  onSave: (task: Omit<Task, "id" | "createdAt">) => void
  task?: Task
}

const STATUS_VALUES: Task["status"][] = ["todo", "in-progress", "done"]
const PRIORITY_VALUES: Task["priority"][] = ["low", "medium", "high"]

export function TaskDialog({ open, onClose, onSave, task }: TaskDialogProps) {
  const { showNotification, settings: notificationSettings } = useNotifications()
  const { t, language } = useTranslation()
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<Task["status"]>("todo")
  const [priority, setPriority] = useState<Task["priority"]>("medium")
  const [dueDate, setDueDate] = useState("")

  const flipKey = task ? `task-${task.id}` : "btn-new-task"
  const closeFlip = useModalFlip(flipKey, open)
  const handleClose = () => closeFlip(onClose)
  const selectedDate: CalendarDate | null = dueDate ? parseDate(dueDate) : null

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setStatus(task.status)
      setPriority(task.priority)
      setDueDate(task.dueDate || "")
    } else {
      setTitle("")
      setStatus("todo")
      setPriority("medium")
      setDueDate("")
    }
  }, [task, open])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const isNewTask = !task

    onSave({
      title,
      status,
      priority,
      dueDate: dueDate || undefined,
      tags: [],
      projectId: undefined,
    })

    if (isNewTask && notificationSettings.taskNotifications) {
      showNotification(t("taskDialog.notification.title"), {
        body: t("taskDialog.notification.body"),
        tag: "new-task",
      })
    }

    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent
        data-flip-to={flipKey}
        showCloseButton={false}
        className="max-w-[min(25rem,calc(100%-1.5rem))] overflow-visible rounded-[28px] border-white/20 bg-background/95 p-4 shadow-[0_28px_80px_-28px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5"
      >
        {/* The FLIP system treats these three groups as the dialog's content
            stack, so the form materializes in a quiet header → fields →
            actions sequence rather than popping in as one opaque block. */}
        <form onSubmit={handleSubmit} data-modal-content className="space-y-4">
          <DialogHeader className="space-y-0 text-left">
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("taskDialog.close")}
              className="-ml-1 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-[background,color,transform] duration-150 hover:bg-foreground/[0.07] hover:text-foreground active:scale-[0.97]"
            >
              <X className="size-3.5" strokeWidth={1.6} />
            </button>
            <DialogTitle className="mt-3 text-[1.45rem] font-medium tracking-[-0.035em] text-foreground">
              {task ? t("taskDialog.edit") : t("taskDialog.create")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="sr-only">{t("taskDialog.titlePlaceholder")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("taskDialog.titlePlaceholder")}
                required
                className="h-11 rounded-xl border-border/60 bg-muted/25 px-3.5 text-sm shadow-none transition-[border-color,background,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-foreground/25 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="status" className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("taskDialog.status")}</Label>
                <HeroSelect
                  value={status}
                  onChange={(value) => value != null && setStatus(String(value) as Task["status"])}
                  className="w-full"
                >
                  <HeroSelect.Trigger id="status" className="h-10 w-full rounded-xl border-border/60 bg-muted/25 px-3 text-xs shadow-none transition-[background,transform] duration-150 active:scale-[0.98]">
                    <HeroSelect.Value />
                    <HeroSelect.Indicator />
                  </HeroSelect.Trigger>
                  <HeroSelect.Popover data-task-submenu="status" className="min-w-[var(--trigger-width)] rounded-2xl border-border/70 bg-background/95 p-1.5 shadow-[0_18px_48px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <HeroListBox>
                      {STATUS_VALUES.map((value) => {
                        const label = t(`taskDialog.status.${value === "in-progress" ? "inProgress" : value}`)
                        return (
                          <HeroListBox.Item data-task-submenu-item key={value} id={value} textValue={label} className="rounded-xl py-2 text-xs">
                            {label}
                            <HeroListBox.ItemIndicator />
                          </HeroListBox.Item>
                        )
                      })}
                    </HeroListBox>
                  </HeroSelect.Popover>
                </HeroSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("taskDialog.priority")}</Label>
                <HeroSelect
                  value={priority}
                  onChange={(value) => value != null && setPriority(String(value) as Task["priority"])}
                  className="w-full"
                >
                  <HeroSelect.Trigger id="priority" className="h-10 w-full rounded-xl border-border/60 bg-muted/25 px-3 text-xs shadow-none transition-[background,transform] duration-150 active:scale-[0.98]">
                    <Flag className="size-3 text-muted-foreground" strokeWidth={1.5} />
                    <HeroSelect.Value />
                    <HeroSelect.Indicator />
                  </HeroSelect.Trigger>
                  <HeroSelect.Popover data-task-submenu="priority" className="min-w-[var(--trigger-width)] rounded-2xl border-border/70 bg-background/95 p-1.5 shadow-[0_18px_48px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <HeroListBox>
                      {PRIORITY_VALUES.map((value) => {
                        const label = t(`taskDialog.priority.${value}`)
                        return (
                          <HeroListBox.Item data-task-submenu-item key={value} id={value} textValue={label} className="rounded-xl py-2 text-xs">
                            {label}
                            <HeroListBox.ItemIndicator />
                          </HeroListBox.Item>
                        )
                      })}
                    </HeroListBox>
                  </HeroSelect.Popover>
                </HeroSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("taskDialog.dueDate")}</Label>
              <HeroI18nProvider locale={language}>
                <HeroDatePicker
                  value={selectedDate}
                  onChange={(date) => setDueDate(date ? date.toString() : "")}
                  granularity="day"
                  className="w-full"
                >
                <HeroLabel className="sr-only">{t("taskDialog.dueDate")}</HeroLabel>
                <HeroDateField.Group className="h-10 w-full rounded-xl border-border/60 bg-muted/25 px-3 text-xs shadow-none transition-[background,border-color,transform] duration-150 hover:bg-muted/40 focus-within:ring-2 focus-within:ring-foreground/10">
                  <HeroDateField.Input className="flex min-w-0 flex-1 items-center gap-0.5">
                    {(segment) => <HeroDateField.Segment segment={segment} className="text-xs text-foreground/85 outline-none" />}
                  </HeroDateField.Input>
                  <HeroDateField.Suffix>
                    <HeroDatePicker.Trigger className="rounded-lg p-1 text-muted-foreground transition-[background,transform] duration-150 hover:bg-foreground/[0.07] active:scale-[0.92]">
                      <HeroDatePicker.TriggerIndicator>
                        <CalendarDays className="size-3.5" strokeWidth={1.5} />
                      </HeroDatePicker.TriggerIndicator>
                    </HeroDatePicker.Trigger>
                  </HeroDateField.Suffix>
                </HeroDateField.Group>
                <HeroDatePicker.Popover data-task-date-picker className="w-auto rounded-[22px] border-border/70 bg-background/95 p-2 shadow-[0_22px_55px_-24px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  <HeroCalendar aria-label={t("taskDialog.dueDate")} className="bg-transparent p-1">
                    <HeroCalendar.Header>
                      <HeroCalendar.Heading className="text-xs font-semibold text-foreground/88" />
                      <HeroCalendar.NavButton slot="previous" />
                      <HeroCalendar.NavButton slot="next" />
                    </HeroCalendar.Header>
                    <HeroCalendar.Grid>
                      <HeroCalendar.GridHeader>
                        {(day) => <HeroCalendar.HeaderCell className="text-[9px] uppercase tracking-[0.09em] text-muted-foreground/65">{day}</HeroCalendar.HeaderCell>}
                      </HeroCalendar.GridHeader>
                      <HeroCalendar.GridBody>
                        {(date) => <HeroCalendar.Cell date={date} className="text-xs" />}
                      </HeroCalendar.GridBody>
                    </HeroCalendar.Grid>
                  </HeroCalendar>
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setDueDate("")}
                      className="mx-1 mb-1 flex w-[calc(100%-0.5rem)] items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] text-muted-foreground transition-[background,color,transform] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.98]"
                    >
                      <X className="size-3" /> {t("taskDialog.removeDate")}
                    </button>
                  )}
                </HeroDatePicker.Popover>
                </HeroDatePicker>
              </HeroI18nProvider>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-end gap-2 pt-1 sm:flex-row">
            <Button type="button" variant="ghost" onClick={handleClose} className="size-9 rounded-full p-0 text-muted-foreground hover:bg-foreground/[0.06] active:scale-[0.97]" aria-label={t("taskDialog.cancel")}>
              <X className="size-3.5" strokeWidth={1.5} />
            </Button>
            <Button type="submit" className="h-9 rounded-full bg-foreground px-4 text-xs font-medium text-background shadow-none transition-[background,transform] duration-150 hover:bg-foreground/85 active:scale-[0.97]">
              <Check className="mr-1.5 size-3.5" strokeWidth={1.8} />
              {task ? t("taskDialog.save") : t("taskDialog.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
