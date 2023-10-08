import { Wasm, Stdio, ProcessOptions, WasmProcess } from '@vscode/wasm-wasi'
import { Readable as NodeReadable, Writable as NodeWritable } from 'node:stream'
import { IpcHandler } from './ipcServer'
import { ArgsForRun, memoryDescriptor } from './args'

type PayloadRun = {
  cwd: string
  wasmBits: Uint8Array
  args: ArgsForRun
  pipIn?: NodeReadable
  pipeOut?: NodeWritable
  pipeErr?: NodeWritable
}

export type RespRunOut = {
  kind: 'out'
  data: string
}

export type RespRunErr = {
  kind: 'err'
  data: number[]
}

export type RespStatus = {
  kind: 'status'
  code: number[]
}

export function getPassHandler(
  kind: 'out' | 'err',
  pipe?: NodeWritable
): (data: Uint8Array | number[]) => void {
  if (pipe === undefined) {
    return (_data: Uint8Array | number[]) => {}
  }
  return (data: Uint8Array | number[]) => {
    pipe.write(`${JSON.stringify({ kind, data: Array.from(data) })}\n`)
  }
}

export class HandleRun implements IpcHandler {
  private wasm: Wasm
  constructor(wasm: Wasm) {
    this.wasm = wasm
  }
  async handle(request: PayloadRun): Promise<any> {
    // run wasm
    //const pty = wasm.createPseudoterminal()
    //const terminal = window.createTerminal({
    //  name,
    //  pty,
    //  isTransient: true
    //})
    //terminal.show(true)
    //const pipeIn = wasm.createWritable()
    // pty の扱いどうする？
    // (そもそも wasi で pty ってどうなってるの？)
    const handleToOut = getPassHandler('out', request.pipeOut)
    const handleToErr = getPassHandler('err', request.pipeErr)
    const pipeOut = this.wasm.createReadable()
    const pipeErr = this.wasm.createReadable()
    pipeOut.onData(handleToOut)
    pipeErr.onData(handleToErr)
    const stdio: Stdio = {
      out: { kind: 'pipeOut', pipe: pipeOut },
      err: { kind: 'pipeOut', pipe: pipeErr }
    }
    const options: ProcessOptions = {
      stdio,
      // /workspace のみがされたマウントされた状態になっている
      // オプションなどで任意のディレクトリをマウントすることも考える？
      mountPoints: [{ kind: 'workspaceFolder' }],
      args: request.args.cmdArgs,
      trace: true
    }
    try {
      const module = await WebAssembly.compile(request.wasmBits)
      const memory = memoryDescriptor(request.args.runArgs)
      let process: WasmProcess | undefined

      if (memory !== undefined) {
        process = await this.wasm.createProcess(
          request.args.cmdName,
          module,
          memory,
          options
        )
      } else {
        process = await this.wasm.createProcess(
          request.args.cmdName,
          module,
          options
        )
      }
      const started = Date.now()
      await process.run()
      if (request.args.runArgs['print-elapsed-time']) {
        handleToOut(Array.from(Buffer.from(`${Date.now() - started}\n`)))
      }
      request.pipeOut?.end()
      request.pipeErr?.end()
      // TODO: pipe 用のストリームを開放(おそらく開放されない)
    } catch (err: any) {
      //void pty.write(`Launching python failed: ${err.toString()}`)
    }
  }
}
