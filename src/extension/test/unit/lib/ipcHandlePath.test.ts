import { mock } from 'node:test'
import * as assert from 'assert'
// import * as fs from 'node:fs'
const fs = require('node:fs')
import type * as fsType from 'node:fs'
import { IpcHandlePath } from '../../../lib/ipcHandlePath'
import { extensionId } from '../../../lib/config'

suite('IpcHandlePath', () => {
  // save XDG_RUNTIME_DIR and restore it after test
  const xdgRuntimeDir = process.env['XDG_RUNTIME_DIR']
  // https://stackoverflow.com/questions/30689349/stub-mock-process-platform-sinon
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  teardown(() => {
    process.env['XDG_RUNTIME_DIR'] = xdgRuntimeDir
    if (platform) {
      Object.defineProperty(process, 'platform', platform)
    }
    mock.restoreAll()
  })

  suite('linux & XDG_RUNTIME_DIR', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    })
    process.env['XDG_RUNTIME_DIR'] = '/tmp_runtime'
    // make mock of vscode.ExtensionContext
    const mockContext = {
      storageUri: '/tmp_storage'
    }
    const ipcHandlePath = new IpcHandlePath(mockContext as any)

    test('ipcHandlePath.path', () => {
      assert.ok(
        ipcHandlePath.path.startsWith(`/tmp_runtime/${extensionId}_ipc_`)
      )
    })

    ipcHandlePath.dispose()
  })

  suite('linux & os.tmpDir()', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    })
    process.env['XDG_RUNTIME_DIR'] = ''
    // make mock of vscode.ExtensionContext
    const mockContext = {
      storageUri: '/tmp_storage'
    }
    // reuiqre で読み込んだモジュールのメソッドなので any 扱い.
    // 別途 import type したものを利用(正しい方法かは不明)
    const mockMkdtempSync = mock.method<
      typeof fsType,
      'mkdtempSync',
      () => string
    >(fs, 'mkdtempSync', (): string => '/tmp/os_tmpdir')
    const mockRmdirSync = mock.method<
      typeof fsType,
      'rmdirSync',
      (_path: string) => void
    >(fs, 'rmdirSync', (_path: string) => {})
    const ipcHandlePath = new IpcHandlePath(mockContext as any)

    test('ipcHandlePath.path with sub folder', () => {
      assert.ok(
        ipcHandlePath.path.startsWith(`/tmp/os_tmpdir/${extensionId}_ipc_`)
      )
      assert.strictEqual(mockMkdtempSync.mock.callCount(), 1)
    })

    ipcHandlePath.dispose()

    test('remove sub folder', () => {
      assert.strictEqual(mockRmdirSync.mock.callCount(), 1)
      assert.deepEqual(mockRmdirSync.mock.calls[0].arguments, [
        '/tmp/os_tmpdir',
        {
          recursive: true
        }
      ])
    })
  })
})
