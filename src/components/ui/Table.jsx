import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Skeleton from './Skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '../ui-shadcn/pagination'

function getPageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set()
  for (let p = 1; p <= 3; p++) pages.add(p)
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  for (let p = total - 2; p <= total; p++) pages.add(p)

  const sorted = [...pages].sort((a, b) => a - b)
  const items = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) items.push('…')
    items.push(p)
    prev = p
  }
  return items
}

export default function Table({
  columns,
  data,
  loading = false,
  emptyMessage,
  onRowClick,
  pagination = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  selectedRowKey,
  getRowKey = (row) => row.id,
  skeletonRows = 6,
  sortColumn,
  sortDirection,
  onSortChange,
}) {
  const { t } = useTranslation()
  const [localSortColumn, setLocalSortColumn] = useState(null)
  const [localSortDirection, setLocalSortDirection] = useState('asc')

  const isControlled = typeof onSortChange === 'function'
  const activeSortColumn = isControlled ? sortColumn : localSortColumn
  const activeSortDirection = isControlled ? sortDirection : localSortDirection

  const displayEmpty = emptyMessage || t('ui.noData')

  const handleSort = (columnKey) => {
    if (!columns.find((c) => c.key === columnKey)?.sortable) return

    if (isControlled) {
      onSortChange(columnKey)
      return
    }

    if (localSortColumn === columnKey) {
      setLocalSortDirection(localSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setLocalSortColumn(columnKey)
      setLocalSortDirection('asc')
    }
  }

  const sortedData = isControlled
    ? data
    : activeSortColumn
      ? [...data].sort((a, b) => {
          const aVal = a[activeSortColumn]
          const bVal = b[activeSortColumn]
          const modifier = activeSortDirection === 'asc' ? 1 : -1
          return aVal > bVal ? modifier : aVal < bVal ? -modifier : 0
        })
      : data

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-muted/60">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-foreground"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ borderTop: '1px solid hsl(var(--border))' }}>
              {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  {columns.map((column) => (
                    <td key={column.key} className="whitespace-nowrap px-5 py-3.5">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-16 text-center text-muted-foreground">
        <p className="text-[15px] font-medium">{displayEmpty}</p>
      </div>
    )
  }

  const pageItems = getPageItems(currentPage, totalPages)
  let pageKey = 0

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-foreground ${
                    column.sortable ? 'cursor-pointer select-none' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {column.label}
                    {column.sortable && activeSortColumn === column.key && (
                      <span className="text-primary">{activeSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ borderTop: '1px solid hsl(var(--border))' }}>
            {sortedData.map((row, rowIndex) => {
              const rowKey = getRowKey(row)
              const isSelected = selectedRowKey != null && rowKey === selectedRowKey
              return (
              <tr
                key={rowKey ?? rowIndex}
                className={`${onRowClick ? 'cursor-pointer transition-colors' : 'transition-colors'} ${
                  isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                }`}
                style={{ borderBottom: '1px solid hsl(var(--border))' }}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`whitespace-nowrap px-5 py-3.5 text-[14px] ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div
          className="flex items-center justify-between border-t px-5 py-3 text-foreground"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <div className="text-[13px] font-medium text-foreground">
            {t('ui.pageOf', { current: currentPage, total: totalPages })}
          </div>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text=""
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
                  onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                />
              </PaginationItem>
              {pageItems.map((item, index) => {
                if (item === '…') {
                  pageKey += 1
                  return (
                    <PaginationItem key={`ellipsis-${pageKey}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )
                }
                pageKey += 1
                const isActive = item === currentPage
                return (
                  <PaginationItem key={`${item}-${pageKey}`}>
                    <PaginationLink
                      isActive={isActive}
                      onClick={() => !isActive && onPageChange(item)}
                      className={!isActive ? 'cursor-pointer' : undefined}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  text=""
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : undefined}
                  onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}