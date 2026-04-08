# AzuHours

Herramienta para cargar horas en Azure DevOps sin navegar por toda la jerarquía. Muestra en una sola pantalla todos tus tickets, semanas y tareas, y te permite crear, editar y eliminar líneas de horas directamente.

## Cómo usar

### 1. Login

Al entrar a la app verás un formulario con tres campos:

- **Organización**: nombre de tu org en Azure DevOps (ej: `IsbelSA`)
- **Proyecto**: nombre del proyecto (ej: `Proyectos`)
- **Personal Access Token (PAT)**: tu token de Azure DevOps

Para generar un PAT: Azure DevOps → tu perfil → *Personal Access Tokens* → *New Token*. El PAT necesita permisos de **Work Items (Read & Write)**. Se guarda solo en la sesión del navegador y se borra al cerrar la pestaña.

---

### 2. Pestaña "Por semana"

Ingresá el nombre exacto de la tarea semanal tal como aparece en Azure DevOps (ej: `6/4 - 10/4`) y hacé clic en **Buscar**.

La app carga todos tus backlog items que tienen esa semana asignada, con su jerarquía completa:

```
Backlog Item (ticket/proyecto)
  └─ Tarea semanal (ej: "6/4 - 10/4")
       └─ Tarea específica (ej: "Desarrollo módulo de pagos")
            └─ Líneas de horas cargadas
```

**Acciones disponibles:**
- Expandir/colapsar cada nivel haciendo clic en la fila
- **Agregar horas**: botón al pie de cada tarea específica. Abre un formulario con campos: Horas, Tipo (Estandar / Extra / Feriado / Guardia), Fecha y Cliente
- **Editar** o **eliminar** una línea existente con los íconos a la derecha de cada línea

La barra de progreso en la parte superior muestra el total de horas cargadas sobre la meta de 40h semanales.

Podés filtrar los resultados por nombre usando el campo **Filtrar por nombre** — busca tanto en el título del ticket como en el título de las tareas, sin hacer ninguna request adicional.

---

### 3. Pestaña "Totales"

Muestra el total de horas cargadas agrupadas por proyecto/cliente.

- Opcionalmente podés filtrar por rango de fechas (**Desde** / **Hasta**)
- Los resultados se ordenan por horas de mayor a menor
- Podés expandir cada cliente para ver el detalle línea por línea

---

## Desarrollo local

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).
