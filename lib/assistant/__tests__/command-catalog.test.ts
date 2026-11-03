import {matchAssistantCommand} from '../command-catalog'

describe('deterministic assistant command catalog',()=>{
  it.each([
    ['Crea tarea: revisar el contrato', {type:'task.create',title:'revisar el contrato'}],
    ['agrega una tarea comprar leche', {type:'task.create',title:'comprar leche'}],
    ['lista mis pendientes', {type:'task.list'}],
    ['qué tareas tengo?', {type:'task.list'}],
    ['cómo está mi estado cognitivo?', {type:'twin.status'}],
  ])('matches supported request %s', (input,expected)=>expect(matchAssistantCommand(input)).toEqual(expected))

  it.each(['ayúdame a crear una tarea para mañana','crea una tarea','¿qué debería hacer hoy?','abre Chrome'])('leaves ambiguous or unsupported request to chat: %s',input=>expect(matchAssistantCommand(input)).toBeNull())
})
