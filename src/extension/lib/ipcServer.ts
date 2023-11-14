import { Disposable, ExtensionContext, Uri, window, workspace } from 'vscode'
import {
  Wasm
  // ProcessOptions,
  // RootFileSystem,
  // Stdio
  // WasmProcess
} from '@vscode/wasm-wasi'
import * as http from 'node:http'
import * as fs from 'node:fs'
import { PassThrough } from 'node:stream'

import { IpcHandlePath } from './ipcHandlePath.js'
import { HandleRun } from './handleRun.js'
import { getRouteAndArgs } from './query.js'

// https://stackoverflow.com/questions/70449525/get-vscode-instance-id-from-embedded-terminal
// https://github.com/microsoft/vscode/blob/8635a5effdfeea74fc92b6b9cda71168adf75726/extensions/git/src/ipc/ipcServer.ts

export interface IpcHandler {
  handle(request: any): Promise<any>
}

export async function getWasmBits(
  workspaceFoler: Uri,
  filename: string
): Promise<Uint8Array> {
  return await workspace.fs.readFile(Uri.joinPath(workspaceFoler, filename))
}

export class IpcServer implements Disposable {
  private server: http.Server
  private _handler: http.RequestListener
  private context: ExtensionContext
  private ipcHandlePath: IpcHandlePath
  private wasm: Wasm
  private handlers: Map<string, IpcHandler> = new Map()
  constructor(
    context: ExtensionContext,
    ipcHandlePath: IpcHandlePath,
    wasm: Wasm
  ) {
    this.context = context
    this.ipcHandlePath = ipcHandlePath
    this.wasm = wasm
    this.handlers.set('/run', new HandleRun(this.wasm))

    this.server = http.createServer()
    this.server.listen(this.ipcHandlePath.path)
    this._handler = this.handler.bind(this)
    this.server.on('request', this._handler)
  }
  async handler(req: http.IncomingMessage, res: http.ServerResponse) {
    const name = 'test1'
    const channel = window.createOutputChannel('Test1 Trace', {
      log: true
    })
    channel.info(`Running ${name}...`)

    //const pipeIn = new PassThrough()
    //req.pipe(pipeIn)
    //req.on('data', (c) => {
    //  pipeIn.write(c)
    //  console.log(c)
    //})
    const pipeOutErrHandler = (data: any) => {
      res.write(data)
    }
    const pipeOut = new PassThrough()
    pipeOut.on('data', pipeOutErrHandler)
    pipeOut.once('end', () => {
      pipeOut.off('data', pipeOutErrHandler)
    })
    const pipeErr = new PassThrough()
    pipeErr.on('data', pipeOutErrHandler)
    pipeErr.once('end', () => {
      pipeErr.off('data', pipeOutErrHandler)
    })
    const { route, args } = getRouteAndArgs(req.url || '')
    const bits = await getWasmBits(this.context.extensionUri, args.cmdPath)

    const handler = this.handlers.get(route)
    if (!handler) {
      console.warn(`IPC handler for ${req.url} not found`)
      return
    }
    const ret = await handler.handle({
      cwd: workspace.workspaceFolders?.[0].uri.fsPath ?? '',
      wasmBits: bits,
      args,
      pipeIn: req,
      pipeOut,
      pipeErr
    })
    pipeOut.end()
    pipeErr.end()
    res.write(`${JSON.stringify(ret)}\n`)
    res.end()
  }
  dispose() {
    this.server.off('request', this._handler)
    this.server.close()
    if (this.ipcHandlePath && process.platform !== 'win32') {
      fs.unlinkSync(this.ipcHandlePath.path)
    }
  }
}
