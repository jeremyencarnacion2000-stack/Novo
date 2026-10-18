import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogTrigger } from '@/components/ui/dialog'

let finish: (() => void) | undefined
jest.mock('@/lib/liquid-modal-motion', () => ({
  createLiquidModalMotion: () => ({ open: jest.fn(), close: (done: () => void) => { finish = done }, destroy: jest.fn() }),
}))

afterEach(() => { cleanup(); finish = undefined })

it('retains selected content and motion identity until the return completes', () => {
  const Example = ({ open }: { open: boolean }) => <Dialog open={open}>{open && <DialogContent><DialogTitle>Detalle conservado</DialogTitle></DialogContent>}</Dialog>
  const view = render(<Example open />)
  view.rerender(<Example open={false} />)
  expect(screen.getByText('Detalle conservado')).toBeTruthy()
  expect(finish).toBeDefined()
})

it('reports the close intent immediately while retaining the physical surface', () => {
  const changed = jest.fn()
  render(<Dialog defaultOpen onOpenChange={changed}><DialogContent><DialogTitle>Una tarea</DialogTitle><DialogClose>Cerrar tarea</DialogClose></DialogContent></Dialog>)
  fireEvent.click(screen.getByText('Cerrar tarea'))
  expect(changed).toHaveBeenCalledWith(false)
  expect(screen.getByText('Una tarea')).toBeTruthy()
})
