import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseDesktopCommand } from '../src/core/desktop-command.ts'

describe('local desktop command catalog',()=>{
  for (const [input,expected] of [
    ['abre Chrome',{appId:'chrome',action:'open'}],
    ['enfoca la ventana de Microsoft Edge',{appId:'edge',action:'focus'}],
    ['minimiza VS Code',{appId:'vscode',action:'minimize'}],
    ['maximiza Bloc de notas',{appId:'notepad',action:'maximize'}],
    ['restaura el explorador de archivos',{appId:'explorer',action:'restore'}],
  ]) it(`matches complete supported utterance: ${input}`,()=>assert.deepEqual(parseDesktopCommand(input),expected))

  for (const input of ['abre Chrome y busca vuelos','abre la terminal','minimiza la ventana','abre Google Calendar'])
    it(`does not guess unsupported command: ${input}`,()=>assert.equal(parseDesktopCommand(input),null))
})
