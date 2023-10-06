import {
  Wasm,
  Readable,
  Writable,
  Stdio,
  ProcessOptions,
  WasmProcess
} from '@vscode/wasm-wasi'
import { IpcHandler } from './ipcServer'
import { ArgsForRun, memoryDescriptor } from './args'

type Payload = {
  cwd: string
  wasmBits: Uint8Array
  args: ArgsForRun
  pipIn?: Writable
  pipeOut?: Readable
  pipeErr?: Readable
  log: (msg: string) => void
}
export class HandleRun implements IpcHandler {
  private wasm: Wasm
  constructor(wasm: Wasm) {
    this.wasm = wasm
  }
  async handle(request: Payload): Promise<any> {
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
    const stdio: Stdio = {
      out: { kind: 'pipeOut', pipe: request.pipeOut }
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
        request.log(`${Date.now() - started}\n`)
      }
      // TODO: pipe 用のストリームを開放(おそらく開放されない)
    } catch (err: any) {
      //void pty.write(`Launching python failed: ${err.toString()}`)
    }
  }
}
