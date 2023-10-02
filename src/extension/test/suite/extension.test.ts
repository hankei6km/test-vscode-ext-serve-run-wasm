import * as assert from 'assert'
//import { before } from 'mocha'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode'
// import * as myExtension from '../extension';

suite('environment vriables in teminal', () => {
  vscode.window.showInformationMessage('Start all tests.')

  // suite('environment variables', async () => { // これは動かない(テストの対象にならない)
  test('environment variables', async () => {
    // capture new text document is opened.
    const documentOpenedPromise = new Promise<vscode.TextDocument>(
      (resolve) => {
        const disposable = vscode.workspace.onDidOpenTextDocument(
          (document) => {
            resolve(document)
            disposable.dispose()
          }
        )
      }
    )
    // wait new terminal is opened
    const terminalOpenedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidChangeActiveTerminal(
          (terminal) => {
            if (terminal === undefined) return
            resolve(terminal)
            disposable.dispose()
          }
        )
      }
    )

    // open terminal
    await vscode.commands.executeCommand('workbench.action.terminal.new')
    await terminalOpenedPromise
    // await new Promise((resolve) => setTimeout(resolve, 1000))

    // execute "terminal.showEnvironmentContributions"
    await vscode.commands.executeCommand(
      'workbench.action.terminal.showEnvironmentContributions'
    )

    // get the text of the opened document
    const document = await documentOpenedPromise
    const envText = document.getText()

    // wait terminal is closed
    const terminalClosedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidCloseTerminal((terminal) => {
          resolve(terminal)
          disposable.dispose()
        })
      }
    )
    // close terminal.
    await vscode.commands.executeCommand('workbench.action.terminal.kill')
    await terminalClosedPromise

    assert.ok(envText.includes('TEST_VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH'))
  })
})

suite('http servr for run wasm', () => {
  test('run wasm via http server', async () => {
    // wait new terminal is opened
    const terminalOpenedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidChangeActiveTerminal(
          (terminal) => {
            if (terminal === undefined) return
            resolve(terminal)
            disposable.dispose()
          }
        )
      }
    )

    // open terminal
    await vscode.commands.executeCommand('workbench.action.terminal.new')
    const terminal = await terminalOpenedPromise
    // await new Promise((resolve) => setTimeout(resolve, 1000))

    // wait terminal is closed
    const terminalClosedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidCloseTerminal((terminal) => {
          resolve(terminal)
          disposable.dispose()
        })
      }
    )

    // input "curl --unix-socket "${TEST_VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH}"  http://localhost/ > test_out/run_out.txt && exit" to terminal
    if (terminal === undefined) return
    terminal.sendText(
      'curl --unix-socket "${TEST_VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH}"  http://localhost/ > test_out/run_out.txt && exit'
    )

    // wait terminal is closed
    await terminalClosedPromise

    // read test_out/run_out.txt and check the content
    const filename = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders![0].uri,
      'test_out',
      'run_out.txt'
    )
    assert.equal(
      (await vscode.workspace.fs.readFile(filename)).toString(),
      'test 123 \n'
    )
  })
})