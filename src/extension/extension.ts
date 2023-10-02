import type { ExtensionContext } from 'vscode'
import { Wasm } from '@vscode/wasm-wasi'

import { IpcHandlePath } from './lib/ipcHandlePath.js'
import { IpcServer } from './lib/ipcServer.js'

import { extensionId } from './lib/config.js'

export async function activate(context: ExtensionContext) {
  const wasm: Wasm = await Wasm.load()

  // sub durectory を作る場合もある。そのため、dispose させる必要がある.
  // socket ファイルは IpcServer で作成され、削除もされる.
  // ちょっとスッキリしないので、もう少し考える.
  const ipcHandlePath = new IpcHandlePath(context)

  const ipcSever = new IpcServer(context, ipcHandlePath, wasm)
  context.environmentVariableCollection.replace(
    // build env name like `MY_EXTENSION_IPC_PATH' from extensionId.
    `${extensionId.replace(/-/g, '_').toUpperCase()}_IPC_PATH`,
    ipcHandlePath.path
  )

  context.subscriptions.push(ipcSever)
  context.subscriptions.push(ipcHandlePath)
}

export function deactivate() {
  console.log('deactivate')
}
