import { Wasm, Stdio, ProcessOptions, WasmProcess } from '@vscode/wasm-wasi'
import { Readable as NodeReadable, Writable as NodeWritable } from 'node:stream'
import { IpcHandler } from './ipcServer'
import { ArgsForRun, memoryDescriptor } from './args'

type PayloadRun = {
  cwd: string
  wasmBits: Uint8Array
  args: ArgsForRun
  pipeIn?: NodeReadable
  pipeOut?: NodeWritable
  pipeErr?: NodeWritable
  pipeStatus?: NodeWritable
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
    let exitStatus: number = 1 // エラーに設定しておく(成功すれば 0 に上書きされる)
    let process: WasmProcess | undefined
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
    const pipeIn = this.wasm.createWritable()
    const handleToOut = getPassHandler('out', request.pipeOut)
    const handleToErr = getPassHandler('err', request.pipeErr)
    const pipeOut = this.wasm.createReadable()
    const pipeErr = this.wasm.createReadable()
    pipeOut.onData(handleToOut)
    pipeErr.onData(handleToErr)
    const stdio: Stdio = {
      in: { kind: 'pipeIn', pipe: pipeIn },
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
      if (
        typeof request.args.runArgs[
          'force_exit_after_n_seconds_stdin_is_closed'
        ] === 'number' &&
        request.args.runArgs['force_exit_after_n_seconds_stdin_is_closed'] > 0
      ) {
        ;(async () => {
          for await (const data of request.pipeIn!) {
            // await pipeIn.write(data) // await が返ってこない.
            pipeIn.write(data)
            if (process === undefined) break
          }
          // https://github.com/microsoft/vscode-wasm/issues/143
          // この辺の暫定的な対応にしたかったが stdio 周りはまだ安定していないようなのであきらめる
          if (process !== undefined) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * 5))
            process?.terminate()
          }
        })()
      }
      const started = Date.now()
      exitStatus = await process.run()

      // process.run が完了しても stdio のデータは完全に消費されていない.
      // 以下は undocumented なので将来的には変更される可能性がある.
      while (
        (pipeOut as any).chunks.length > 0 ||
        (pipeErr as any).chunks.length > 0
      ) {
        console.log('waiting for pipe to be empty')
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      new Promise((resolve) => request.pipeOut?.end(resolve))
      new Promise((resolve) => request.pipeErr?.end(resolve))
      if (request.args.runArgs['print-elapsed-time']) {
        handleToOut(Array.from(Buffer.from(`${Date.now() - started}\n`)))
      }
      // TODO: pipe 用のストリームを開放(おそらく開放されない)
    } catch (err: any) {
      //void pty.write(`Launching python failed: ${err.toString()}`)
    }
    return { kind: 'status', data: [exitStatus] }
  }
}
