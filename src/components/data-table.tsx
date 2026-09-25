"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table"
import {
  IconAlertTriangleFilled,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconCopy,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconRefresh,
} from "@tabler/icons-react"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AdminDashboardRow } from "@/lib/admin/dashboard"

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

export const schema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["Sync run", "System check", "Runner"]),
  status: z.string(),
  observedAt: z.string(),
  duration: z.string(),
  volume: z.string(),
  documents: z.string(),
  detail: z.string(),
  reference: z.string(),
  metrics: z.object({
    fetched: z.number(),
    tenders: z.number(),
    documents: z.number(),
  }),
})

type DashboardRow = z.infer<typeof schema>
type DashboardView = "all" | "sync-runs" | "system-checks" | "runner"

const columnHelper = createColumnHelper<typeof features, DashboardRow>()

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <IconGripVertical data-icon="inline-start" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("name", {
    header: "Activity",
    cell: ({ row }) => <TableCellViewer item={row.original} />,
    enableHiding: false,
  }),
  columnHelper.accessor("category", {
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.category}
      </Badge>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  }),
  columnHelper.accessor("observedAt", {
    header: "Observed",
    cell: ({ row }) => (
      <div className="min-w-44 text-muted-foreground">
        {row.original.observedAt}
      </div>
    ),
  }),
  columnHelper.accessor("duration", {
    header: "Duration",
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.original.duration}</div>
    ),
  }),
  columnHelper.accessor("volume", {
    header: "Volume",
    cell: ({ row }) => <div className="min-w-36">{row.original.volume}</div>,
  }),
  columnHelper.accessor("documents", {
    header: () => <div className="w-full text-right">Documents</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.documents}</div>
    ),
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
            size="icon"
          >
            <IconDotsVertical data-icon="inline-start" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => copyReference(row.original.reference)}
            >
              <IconCopy />
              Copy reference
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
])

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const isAttention = ["attention", "failed", "offline"].includes(normalized)
  const isRunning = ["running", "syncing"].includes(normalized)
  const isHealthy = ["ok", "completed", "operational", "idle"].includes(
    normalized
  )

  return (
    <Badge
      variant={isAttention ? "destructive" : isRunning ? "secondary" : "outline"}
      className={
        isAttention
          ? "bg-red-50 px-1.5 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "px-1.5"
      }
    >
      {isAttention ? (
        <IconAlertTriangleFilled />
      ) : isRunning ? (
        <IconLoader className="animate-spin" />
      ) : isHealthy ? (
        <IconCircleCheckFilled className="fill-primary" />
      ) : null}
      {status}
    </Badge>
  )
}

function DraggableRow({
  row,
}: {
  row: Row<typeof features, DashboardRow>
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({ data: initialData }: { data: AdminDashboardRow[] }) {
  const [data, setData] = React.useState<DashboardRow[]>(() => initialData)
  const [activeView, setActiveView] = React.useState<DashboardView>("all")
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const filteredData = React.useMemo(
    () =>
      data.filter((row) => {
        if (activeView === "sync-runs") return row.category === "Sync run"
        if (activeView === "system-checks") return row.category === "System check"
        if (activeView === "runner") return row.category === "Runner"
        return true
      }),
    [activeView, data]
  )
  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => filteredData.map(({ id }) => id),
    [filteredData]
  )

  const table = useTable({
    features,
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  function handleViewChange(value: string) {
    setActiveView(value as DashboardView)
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setRowSelection({})
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((rows) => {
        const oldIndex = rows.findIndex((row) => row.id === active.id)
        const newIndex = rows.findIndex((row) => row.id === over.id)
        return arrayMove(rows, oldIndex, newIndex)
      })
    }
  }

  const counts = {
    syncRuns: data.filter((row) => row.category === "Sync run").length,
    systemChecks: data.filter((row) => row.category === "System check").length,
    runner: data.filter((row) => row.category === "Runner").length,
  }

  return (
    <Tabs
      value={activeView}
      onValueChange={handleViewChange}
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select value={activeView} onValueChange={handleViewChange}>
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All operations</SelectItem>
              <SelectItem value="sync-runs">Sync runs</SelectItem>
              <SelectItem value="system-checks">System checks</SelectItem>
              <SelectItem value="runner">Runner</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="all">All operations</TabsTrigger>
          <TabsTrigger value="sync-runs">
            Sync runs <Badge variant="secondary">{counts.syncRuns}</Badge>
          </TabsTrigger>
          <TabsTrigger value="system-checks">
            System checks <Badge variant="secondary">{counts.systemChecks}</Badge>
          </TabsTrigger>
          <TabsTrigger value="runner">
            Runner <Badge variant="secondary">{counts.runner}</Badge>
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns data-icon="inline-start" />
                Columns
                <IconChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuGroup>
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" &&
                      column.getCanHide()
                  )
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id.replace(/([A-Z])/g, " $1")}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin" aria-label="Refresh data">
              <IconRefresh data-icon="inline-start" />
              <span className="hidden lg:inline">Refresh data</span>
            </Link>
          </Button>
        </div>
      </div>
      <TabsContent
        value={activeView}
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : (
                          <FlexRender header={header} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No operational data is available for this view.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={String(table.state.pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={String(pageSize)}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.state.pagination.pageIndex + 1} of{" "}
              {Math.max(1, table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                size="icon"
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft data-icon="inline-start" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft data-icon="inline-start" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight data-icon="inline-start" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight data-icon="inline-start" />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

const detailChartConfig = {
  value: {
    label: "Count",
    color: "#7c3aed",
  },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: DashboardRow }) {
  const isMobile = useIsMobile()
  const chartData = [
    { metric: "Fetched", value: item.metrics.fetched },
    { metric: "Tenders", value: item.metrics.tenders },
    { metric: "Documents", value: item.metrics.documents },
  ]
  const hasChartData = chartData.some((entry) => entry.value > 0)

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {item.name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.name}</DrawerTitle>
          <DrawerDescription>
            {item.category} · {item.status}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && hasChartData ? (
            <>
              <ChartContainer config={detailChartConfig}>
                <AreaChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="metric"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="value"
                    type="natural"
                    isAnimationActive={false}
                    fill="var(--color-value)"
                    fillOpacity={0.45}
                    stroke="var(--color-value)"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
            </>
          ) : null}
          <dl className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Observed</dt>
              <dd className="font-medium">{item.observedAt}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-medium">{item.duration}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Volume</dt>
              <dd className="font-medium">{item.volume}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Documents</dt>
              <dd className="font-medium">{item.documents}</dd>
            </div>
          </dl>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="font-medium">Details</p>
            <p className="text-muted-foreground">{item.detail}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">Reference</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {item.reference}
            </p>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function copyReference(reference: string) {
  void navigator.clipboard
    .writeText(reference)
    .then(() => toast.success("Reference copied"))
    .catch(() => toast.error("Could not copy the reference"))
}
