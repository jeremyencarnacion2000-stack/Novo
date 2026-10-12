import { usePlayerStore } from "@/lib/player-store"

describe("player preference persistence", () => {
  beforeEach(() => {
    usePlayerStore.getState().setVolume(0.5)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("does not write localStorage for transient playback progress", () => {
    const writes = jest.spyOn(Storage.prototype, "setItem")

    usePlayerStore.getState().setProgress(1000)
    usePlayerStore.getState().setProgress(2000)

    expect(writes.mock.calls.filter(([key]) => key === "novo-player-v2")).toHaveLength(0)
  })

  it("still saves a changed preference", () => {
    const writes = jest.spyOn(Storage.prototype, "setItem")

    usePlayerStore.getState().setVolume(0.6)

    expect(writes.mock.calls.filter(([key]) => key === "novo-player-v2")).toHaveLength(1)
  })
})
