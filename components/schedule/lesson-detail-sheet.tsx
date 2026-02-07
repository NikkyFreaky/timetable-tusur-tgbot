"use client"

import React from "react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Lesson, ResourceLink } from "@/lib/schedule-types"
import { LESSON_TYPES } from "@/lib/schedule-types"
import { cn } from "@/lib/utils"
import { Calendar, Clock, MapPin, User, Users, ExternalLink, Info } from "lucide-react"
import { useTelegram } from "@/lib/telegram-context"
import { BUILDING_STYLES, parseRoom } from "@/lib/buildings"

interface LessonDetailSheetProps {
  lesson: Lesson | null
  dayName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LessonDetailSheet({ lesson, dayName, open, onOpenChange }: LessonDetailSheetProps) {
  const { hapticFeedback } = useTelegram()

  if (!lesson) return null

  const lessonType = LESSON_TYPES[lesson.type]
  const isTypeWhite = lessonType.color.toUpperCase() === "#FFFFFF"
  const roomLinks = lesson.roomLinks ?? []
  const instructorLinks = lesson.instructorLinks ?? []
  const roomSectionLabel = roomLinks.length > 1 ? "Места проведения" : "Место проведения"
  const instructorLabel = instructorLinks.length > 1 ? "Преподаватели" : "Преподаватель"
  const noteLabel = lesson.notes && lesson.notes.length > 1 ? "Примечания" : "Примечание"
  const { building, roomLabel } = parseRoom(lesson.room)
  const buildingStyle = building ? BUILDING_STYLES[building] : null
  const trimmedRoomLabel = roomLabel.trim()
  const roomSuffix =
    buildingStyle &&
    trimmedRoomLabel &&
    trimmedRoomLabel.toLowerCase() !== building &&
    trimmedRoomLabel !== lesson.room
      ? ` ${trimmedRoomLabel}`
      : ""
  const locationLabel = buildingStyle ? `${buildingStyle.label}${roomSuffix}` : lesson.room
  const locationDetails = buildingStyle?.address
    ? buildingStyle.name !== buildingStyle.label
      ? `${buildingStyle.name}, ${buildingStyle.address}`
      : buildingStyle.address
    : undefined

  const handleLinkClick = (url: string) => {
    hapticFeedback("light")
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-8 max-h-[85vh] overflow-auto">
        <SheetHeader className="px-5 pb-4 border-b border-border">
          <div className="flex items-center justify-center mb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <SheetTitle className="text-left text-lg font-semibold leading-tight pr-4">
            {lesson.subject}
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pt-5 space-y-4">
          {/* Lesson Type */}
          <DetailRow 
            icon={
              <div
                className={cn("w-3 h-3 rounded-full", isTypeWhite && "border border-border")}
                style={{ backgroundColor: lessonType.color }}
              />
            }
            label="Вид занятия"
            value={
              <div className="flex items-center gap-2">
                <span>{lessonType.label}</span>
                {lesson.notes && lesson.notes.length > 0 && (
                  <NotePopover notes={lesson.notes} />
                )}
              </div>
            }
          />

          {/* Notes */}
          {lesson.notes && lesson.notes.length > 0 && (
            <DetailRow 
              icon={<Info className="w-5 h-5 text-muted-foreground" />}
              label={noteLabel}
              value={lesson.notes.join("\n")}
              valueClassName="whitespace-pre-line"
            />
          )}

          {/* Date */}
          {lesson.date && (
            <DetailRow 
              icon={<Calendar className="w-5 h-5 text-muted-foreground" />}
              label="Дата проведения"
              value={lesson.date}
            />
          )}

          {/* If no specific date, show day name */}
          {!lesson.date && dayName && (
            <DetailRow 
              icon={<Calendar className="w-5 h-5 text-muted-foreground" />}
              label="День недели"
              value={dayName}
            />
          )}

          {/* Time */}
          <DetailRow 
            icon={<Clock className="w-5 h-5 text-muted-foreground" />}
            label="Время проведения"
            value={`${lesson.time}-${lesson.timeEnd}`}
          />

          {/* Location */}
          {roomLinks.length === 1 ? (
            <DetailRow 
              icon={<MapPin className="w-5 h-5 text-muted-foreground" />}
              label={roomSectionLabel}
              value={locationLabel}
              secondaryValue={locationDetails}
              linkUrl={roomLinks[0].url}
              onLinkClick={handleLinkClick}
            />
          ) : roomLinks.length > 1 ? (
            <LinkListRow
              icon={<MapPin className="w-5 h-5 text-muted-foreground" />}
              label={roomSectionLabel}
              links={roomLinks}
              onLinkClick={handleLinkClick}
            />
          ) : (
            <DetailRow 
              icon={<MapPin className="w-5 h-5 text-muted-foreground" />}
              label={roomSectionLabel}
              value={locationLabel}
              secondaryValue={locationDetails}
            />
          )}

          {/* Instructor */}
          {instructorLinks.length === 1 ? (
            <DetailRow 
              icon={<User className="w-5 h-5 text-muted-foreground" />}
              label={instructorLabel}
              value={lesson.instructor}
              linkUrl={instructorLinks[0].url}
              onLinkClick={handleLinkClick}
            />
          ) : instructorLinks.length > 1 ? (
            <LinkListRow
              icon={<User className="w-5 h-5 text-muted-foreground" />}
              label={instructorLabel}
              links={instructorLinks}
              onLinkClick={handleLinkClick}
            />
          ) : (
            <DetailRow 
              icon={<User className="w-5 h-5 text-muted-foreground" />}
              label={instructorLabel}
              value={lesson.instructor}
            />
          )}

          {/* Group Links */}
          {lesson.groupLinks && lesson.groupLinks.length > 0 && (
            <LinkListRow
              icon={<Users className="w-5 h-5 text-muted-foreground" />}
              label={lesson.groupLinks.length > 1 ? "Группы" : "Группа"}
              links={lesson.groupLinks}
              onLinkClick={handleLinkClick}
            />
          )}

          {/* Joint Groups */}
          {lesson.jointGroupLinks && lesson.jointGroupLinks.length > 0 ? (
            <LinkListRow
              icon={<Users className="w-5 h-5 text-muted-foreground" />}
              label="Совместно с группами"
              links={lesson.jointGroupLinks}
              onLinkClick={handleLinkClick}
            />
          ) : (
            lesson.jointGroups &&
            lesson.jointGroups.length > 0 && (
              <DetailRow 
                icon={<Users className="w-5 h-5 text-muted-foreground" />}
                label="Совместно с группами"
                value={lesson.jointGroups.join(", ")}
              />
            )
          )}

          {/* Resource Links */}
          {lesson.resourceLinks && lesson.resourceLinks.length > 0 && (
            <LinkListRow
              icon={<ExternalLink className="w-5 h-5 text-muted-foreground" />}
              label="Ссылка на электронный ресурс"
              links={lesson.resourceLinks}
              onLinkClick={handleLinkClick}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface DetailRowProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  secondaryValue?: string
  linkUrl?: string
  onLinkClick?: (url: string) => void
  valueClassName?: string
}

function DetailRow({
  icon,
  label,
  value,
  secondaryValue,
  linkUrl,
  onLinkClick,
  valueClassName,
}: DetailRowProps) {
  const canLink = Boolean(linkUrl && onLinkClick)
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-muted-foreground block">{label}</span>
        {canLink ? (
          <button
            type="button"
            onClick={() => onLinkClick?.(linkUrl as string)}
            className={cn(
              "text-base text-primary font-medium hover:underline underline-offset-4 text-left",
              valueClassName
            )}
          >
            {value}
          </button>
        ) : (
          <span className={cn("text-base text-foreground font-medium block", valueClassName)}>
            {value}
          </span>
        )}
        {secondaryValue && (
          <span className="text-xs text-muted-foreground block">{secondaryValue}</span>
        )}
      </div>
    </div>
  )
}

interface LinkListRowProps {
  icon: React.ReactNode
  label: string
  links: ResourceLink[]
  onLinkClick: (url: string) => void
}

function LinkListRow({ icon, label, links, onLinkClick }: LinkListRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <span className="text-sm text-muted-foreground block mb-2">{label}</span>
        <div className="flex flex-wrap gap-2">
          {links.map((link, index) => (
            <button
              key={`${link.url}-${index}`}
              onClick={() => onLinkClick(link.url)}
              className={cn(
                "px-3 py-2 rounded-xl text-sm font-medium",
                "bg-primary/10 text-primary",
                "active:scale-[0.98] transition-transform"
              )}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotePopover({ notes }: { notes: string[] }) {
  const [open, setOpen] = React.useState(false)
  const noteText = notes.join("\n")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Показать примечание"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") {
              setOpen(true)
            }
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") {
              setOpen(false)
            }
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 whitespace-pre-line text-xs text-muted-foreground"
      >
        {noteText}
      </PopoverContent>
    </Popover>
  )
}
