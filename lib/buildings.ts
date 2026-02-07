export type BuildingCode = "гк" | "ф" | "мк" | "рк" | "улк"

export type BuildingInfo = {
  label: string
  name: string
  address?: string
  badgeClass: string
  iconClass: string
}

export const BUILDING_STYLES: Record<BuildingCode, BuildingInfo> = {
  гк: {
    label: "Главный корпус",
    name: "Главный корпус",
    address: "проспект Ленина, 40",
    badgeClass: "bg-sky-500/15 text-sky-700 border border-sky-500/30",
    iconClass: "text-sky-600",
  },
  ф: {
    label: "ФЭТ",
    name: "Корпус ФЭТ",
    address: "ул. Вершинина, 74",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
    iconClass: "text-emerald-600",
  },
  мк: {
    label: "МК",
    name: "МК",
    badgeClass: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
    iconClass: "text-amber-600",
  },
  рк: {
    label: "РК",
    name: "Радиотехнический корпус",
    address: "ул. Вершинина, 47",
    badgeClass: "bg-rose-500/15 text-rose-700 border border-rose-500/30",
    iconClass: "text-rose-600",
  },
  улк: {
    label: "УЛК",
    name: "Учебно-лабораторный корпус",
    address: "ул. Красноармейская, 146",
    badgeClass: "bg-indigo-500/15 text-indigo-700 border border-indigo-500/30",
    iconClass: "text-indigo-600",
  },
}

export function parseRoom(room: string): {
  building: BuildingCode | null
  roomLabel: string
} {
  const normalized = room.trim()
  const match = normalized.match(/^(гк|ф|мк|рк|улк)[\s\-.,:]*(.*)$/i)

  if (!match) {
    return { building: null, roomLabel: normalized }
  }

  const building = match[1].toLowerCase() as BuildingCode
  const rest = match[2].trim()

  return {
    building,
    roomLabel: rest || normalized,
  }
}
