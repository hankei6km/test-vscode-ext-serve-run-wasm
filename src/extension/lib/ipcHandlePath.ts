import type { Disposable, ExtensionContext } from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as crypto from 'node:crypto'

import { extensionId } from './config'

// https://stackoverflow.com/questions/70449525/get-vscode-instance-id-from-embedded-terminal
// https://github.com/microsoft/vscode/blob/8635a5effdfeea74fc92b6b9cda71168adf75726/extensions/git/src/ipc/ipcServer.ts

let extensionInstance = 0

export class IpcHandlePath implements Disposable {
  private _path!: string
  private _makSubFolder: boolean
  constructor(context: ExtensionContext) {
    this._makSubFolder = false
    this.makeIpcHandlePath(context)
  }
  private makeIpcHandlePath(context: ExtensionContext) {
    const hash = crypto.createHash('sha1')
    hash.update(`${context.storageUri}${++extensionInstance}${process.pid}`)
    const id = hash.digest('hex').slice(0, 10)

    if (process.platform === 'win32') {
      this._path = `\\\\.\\pipe\\${extensionId}_ipc_${id}`
      return
    }
    if (process.platform !== 'darwin' && process.env['XDG_RUNTIME_DIR']) {
      this._path = path.join(
        process.env['XDG_RUNTIME_DIR'],
        `${extensionId}_ipc_${id}.sock`
      )
      return
    }

    // '/tmp' に誰でもアクセスできる .sock が出来る可能性がある(linux の場合).
    // this._path = path.join(os.tmpdir(), `${extensionId}_ipc_${id}.sock`)
    this._makSubFolder = true
    const osTempDir = os.tmpdir()
    // make temp dir(read writ prmision ower only) as unique name in tmpdir
    const tempDir = fs.mkdtempSync(path.join(osTempDir, `${extensionId}_ipc_`))
    this._path = path.join(tempDir, `${extensionId}_ipc_${id}.sock`)
  }
  // get ipc handle path
  get path(): string {
    // if (this._path === '') {
    // }
    return this._path
  }
  dispose() {
    if (this._path && process.platform !== 'win32') {
      if (this._makSubFolder) {
        fs.rmdirSync(path.dirname(this._path), { recursive: true })
        return
      }
    }
  }
}
