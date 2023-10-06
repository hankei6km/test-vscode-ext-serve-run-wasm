import { argsForRun, blankArgsForRun } from './args'

// parse route and query from a url string
export function getRouteAndArgs(url: string) {
  const p = (() => {
    const p = url.split('?', 2)
    return p.length > 1 ? p : [p[0], '']
  })()
  const parsed = new URLSearchParams(p[1])
  const args: string[] = (() => {
    const argsStr = parsed.get('args')
    if (argsStr) {
      try {
        const a = JSON.parse(argsStr)
        if (Array.isArray(a)) {
          return a.map((v) => `${v}`)
        }
      } catch (e) {}
    }
    return []
  })()
  return {
    route: p[0],
    args: args.length > 0 ? argsForRun(args) : blankArgsForRun()
  }
}
