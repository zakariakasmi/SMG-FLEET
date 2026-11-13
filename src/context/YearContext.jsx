import { createContext, useContext, useEffect, useState } from 'react'
import { chargesApi } from '../services/api'

const STORAGE_KEY = 'smg-year'
const PAST_YEARS_RANGE = 5

const YearContext = createContext(null)

export function YearProvider({ children }) {
  const currentYear = new Date().getFullYear()

  const [selectedYear, setSelectedYear] = useState(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(stored) ? stored : currentYear
  })

  const [availableYears, setAvailableYears] = useState(() =>
    Array.from({ length: PAST_YEARS_RANGE }, (_, i) => currentYear - i)
  )

  useEffect(() => {
    chargesApi
      .listYears()
      .then((years) =>
        setAvailableYears((prev) =>
          [...new Set([...prev, ...(years || [])])].sort((a, b) => b - a)
        )
      )
      .catch(() => {})
  }, [])

  const setYear = (year) => {
    setSelectedYear(year)
    localStorage.setItem(STORAGE_KEY, String(year))
  }

  return (
    <YearContext.Provider value={{ selectedYear, setYear, availableYears }}>
      {children}
    </YearContext.Provider>
  )
}

export function useYear() {
  const ctx = useContext(YearContext)
  if (!ctx) throw new Error('useYear must be used within a YearProvider')
  return ctx
}