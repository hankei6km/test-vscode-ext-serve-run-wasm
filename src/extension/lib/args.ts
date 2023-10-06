import minimist from 'minimist'
import path from 'node:path'

export type ArgsForRun = {
  runArgs: minimist.ParsedArgs
  cmdName: string
  cmdPath: string
  cmdArgs: string[]
}

export function blankArgsForRun(): ArgsForRun {
  return {
    runArgs: { _: [] },
    cmdName: '',
    cmdPath: '',
    cmdArgs: []
  }
}

export function normalizeFullPath(cwd: string, path: string): string {
  return path.startsWith('/') ? path : `${cwd}/${path}`
}

export function argsForRun(args: string[]): ArgsForRun {
  const splitIdx = args.findIndex((arg) => arg === '--')
  const runArgs = args.slice(0, splitIdx + 1)
  const cmdPath = args[splitIdx + 1]
  const cmdName = path.basename(cmdPath)
  const cmdArgs = args.slice(splitIdx + 2)
  return {
    runArgs: minimist(runArgs),
    cmdName,
    cmdPath,
    cmdArgs: cmdArgs
  }
}

export function memoryDescriptor(
  runArgs: minimist.ParsedArgs
): WebAssembly.MemoryDescriptor | undefined {
  if (typeof runArgs['memory-initial'] === 'number') {
    const ret: WebAssembly.MemoryDescriptor = {
      initial: runArgs['memory-initial'],
      shared: true
    }
    if (typeof runArgs['memory-maximum'] === 'number') {
      ret.maximum = runArgs['memory-maximum']
    }
    if (runArgs['memory-shared'] === 'false') {
      ret.shared = false
    }
    return ret
  }
  return undefined
}
