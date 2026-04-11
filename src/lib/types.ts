export interface AuthConfig {
  pat: string
  org: string
  project: string
}

export interface UserProfile {
  id: string
  displayName: string
  emailAddress?: string
  uniqueName?: string
}

export interface WorkItem {
  id: number
  title: string
  type: string
  state: string
  assignedTo?: string
  children?: WorkItem[]
  fields?: Record<string, unknown>
  // Custom fields for linea
  horasLineaProyecto?: number
  tipoHora?: string
  fechaLinea?: string
  cliente?: string
  // Task fields
  estimatedHours?: number
  completedHours?: number
  dueDate?: string
  // Relation ids for parent
  parentId?: number
}

export interface BacklogItem extends WorkItem {
  weekTasks: WeekTask[]
  clienteName?: string
  country?: string
}

export interface WeekTask extends WorkItem {
  tasks: TaskItem[]
}

export interface TaskItem extends WorkItem {
  lineas: LineaItem[]
}

export interface LineaItem extends WorkItem {
  horasLineaProyecto: number
  tipoHora: string
  fechaLinea: string
  cliente: string
}

export interface LineaFormData {
  horas: number
  tipoHora: string
  fecha: string
  cliente: string
}
