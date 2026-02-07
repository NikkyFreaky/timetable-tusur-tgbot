export interface FacultyOption {
  slug: string
  name: string
  imageUrl: string | null
}

export interface GroupOption {
  slug: string
  name: string
}

export interface CourseOption {
  number: number
  name: string
  groups: GroupOption[]
}
