import {
  Wasm,
  Readable,
  Writable,
  Stdio,
  ProcessOptions
} from '@vscode/wasm-wasi'
import { IpcHandler } from './ipcServer'

type Payload = {
  cwd: string
  wasmBits: Uint8Array
  name: string
  args: string[]
  pipIn?: Writable
  pipeOut?: Readable
  pipeErr?: Readable
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
      args: request.args,
      trace: true
    }
    try {
      const module = await WebAssembly.compile(request.wasmBits)
      const process = await this.wasm.createProcess('test1', module, options)
      await process.run()
      // TODO: pipe 用のストリームを開放(おそらく開放されない)
    } catch (err: any) {
      //void pty.write(`Launching python failed: ${err.toString()}`)
    }
  }
}
