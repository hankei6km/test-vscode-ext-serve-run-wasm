import { Disposable, ExtensionContext, Uri, window, workspace } from 'vscode'
import {
  Wasm,
  ProcessOptions,
  // RootFileSystem,
  Stdio
  // WasmProcess
} from '@vscode/wasm-wasi'
import * as http from 'node:http'
import * as fs from 'node:fs'

import { IpcHandlePath } from './ipcHandlePath.js'

// https://stackoverflow.com/questions/70449525/get-vscode-instance-id-from-embedded-terminal
// https://github.com/microsoft/vscode/blob/8635a5effdfeea74fc92b6b9cda71168adf75726/extensions/git/src/ipc/ipcServer.ts

export class IpcServer implements Disposable {
  private server: http.Server
  private _ipcHandlePath: IpcHandlePath
  constructor(
    context: ExtensionContext,
    ipcHandlePath: IpcHandlePath,
    wasm: Wasm
  ) {
    this._ipcHandlePath = ipcHandlePath
    this.server = http.createServer()
    this.server.listen(this._ipcHandlePath.path)
    this.server.on('request', async (_req, res) => {
      // run wasm
      const name = 'test1'
      //const pty = wasm.createPseudoterminal()
      //const terminal = window.createTerminal({
      //  name,
      //  pty,
      //  isTransient: true
      //})
      //terminal.show(true)
      const channel = window.createOutputChannel('Test1 Trace', {
        log: true
      })
      channel.info(`Running ${name}...`)
      //const pipeIn = wasm.createWritable()
      const pipeOut = wasm.createReadable()
      pipeOut.onData((data) => {
        console.log(data.toString())
        res.write(data)
      })
      // pty の扱いどうする？
      // (そもそも wasi で pty ってどうなってるの？)
      const stdio: Stdio = {
        out: { kind: 'pipeOut', pipe: pipeOut }
      }
      const options: ProcessOptions = {
        stdio,
        // /workspace のみがされたマウントされた状態になっている
        // オプションなどで任意のディレクトリをマウントすることも考える？
        mountPoints: [{ kind: 'workspaceFolder' }],
        args: ['echo', 'test', '123'],
        //args: ['err', 'abc', '123'],
        trace: true
      }
      try {
        // 任意のファイル名を渡す応報はどうする？
        // workspace のディレクトリを取得する方法はあったはずだが、複数 workspace のときは？
        // workspace の外側のファイルの場合は？
        // とりあえず、固定の .wasm ファイルを読み込むようにしておく。
        // ソース: https://codesandbox.io/p/sandbox/test-vscode-ext-ipc-check-6kkgc4
        const filename = Uri.joinPath(
          context.extensionUri,
          'wasm',
          'bin',
          'workspace.wasm'
        )
        const bits = await workspace.fs.readFile(filename)
        const module = await WebAssembly.compile(bits)
        const process = await wasm.createProcess('test1', module, options)
        await process.run()
        // TODO: pipe 用のストリームを開放(おそらく開放されない)
      } catch (err: any) {
        //void pty.write(`Launching python failed: ${err.toString()}`)
      }
      res.end()
    })
  }
  dispose() {
    this.server.close()
    if (this._ipcHandlePath && process.platform !== 'win32') {
      fs.unlinkSync(this._ipcHandlePath.path)
    }
  }
}
