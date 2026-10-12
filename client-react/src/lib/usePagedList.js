import { useCallback, useEffect, useState } from 'react'

export function usePagedList(fetcher, key, { limit = 10 } = {}) {
  const [page, setPageState] = useState(1)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)

  const setPage = (nextPage) => {
    setLoading(true)
    setError(null)
    setPageState(nextPage)
  }

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    let active = true

    fetcher(page, limit)
      .then((data) => {
        if (active) setRows(data[key] || [])
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
          setRows([])
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [fetcher, key, page, limit, version])

  return { page, setPage, rows, loading, error, limit, reload }
}
