import { describe, expect, it } from "vitest"
import {
  READ_BLOCK,
  READ_BLOCK_LEAN,
  WRITE_BLOCK,
  WRITE_BLOCK_LEAN,
  WRITE_BLOCK_PUSH,
  blockSizes,
  nextBlock,
} from "@/lib/blocks"
import type { ExerciseBlock } from "@/lib/types"

describe("nextBlock", () => {
  it("starts the first run on the requested type, at full size", () => {
    expect(nextBlock(null, "read")).toEqual({
      exercise: "read",
      left: READ_BLOCK - 1,
    })
    expect(nextBlock(null, "write")).toEqual({
      exercise: "write",
      left: WRITE_BLOCK - 1,
    })
  })

  it("continues a run that still has prompts left", () => {
    expect(nextBlock({ exercise: "write", left: 2 }, "read")).toEqual({
      exercise: "write",
      left: 1,
    })
  })

  it("switches to a full run of the other type when the run is spent", () => {
    expect(nextBlock({ exercise: "read", left: 0 }, "read")).toEqual({
      exercise: "write",
      left: WRITE_BLOCK - 1,
    })
    expect(nextBlock({ exercise: "write", left: 0 }, "write")).toEqual({
      exercise: "read",
      left: READ_BLOCK - 1,
    })
  })

  it("alternates read and write runs of their own sizes over a session", () => {
    let block: ExerciseBlock | null = null
    const served: Array<string> = []
    for (let i = 0; i < READ_BLOCK + WRITE_BLOCK + 1; i++) {
      block = nextBlock(block, "read")
      served.push(block.exercise)
    }
    expect(served).toEqual([
      ...Array.from({ length: READ_BLOCK }, () => "read"),
      ...Array.from({ length: WRITE_BLOCK }, () => "write"),
      "read",
    ])
  })

  it("honours the sizes it is given", () => {
    expect(nextBlock(null, "write", { read: 3, write: 6 })).toEqual({
      exercise: "write",
      left: 5,
    })
    expect(nextBlock({ exercise: "write", left: 0 }, "write", {
      read: 3,
      write: 6,
    })).toEqual({ exercise: "read", left: 2 })
  })
})

describe("blockSizes", () => {
  it("leaves the mix alone when both exercises are still pending", () => {
    expect(blockSizes({ read: true, write: true })).toEqual({
      read: READ_BLOCK,
      write: WRITE_BLOCK,
    })
  })

  it("leaves the mix alone when the lesson owes nothing", () => {
    expect(blockSizes({ read: false, write: false })).toEqual({
      read: READ_BLOCK,
      write: WRITE_BLOCK,
    })
  })

  it("favours writing when writing is the only thing left", () => {
    const sizes = blockSizes({ read: false, write: true })
    expect(sizes).toEqual({ read: READ_BLOCK_LEAN, write: WRITE_BLOCK_PUSH })
    // Favoured, not exclusive: reading has to keep turning over.
    expect(sizes.read).toBeGreaterThan(0)
    expect(sizes.write / (sizes.read + sizes.write)).toBeGreaterThan(0.5)
  })

  it("favours reading when reading is the only thing left", () => {
    const sizes = blockSizes({ read: true, write: false })
    expect(sizes).toEqual({ read: READ_BLOCK, write: WRITE_BLOCK_LEAN })
    expect(sizes.write).toBeGreaterThan(0)
    expect(sizes.read / (sizes.read + sizes.write)).toBeGreaterThan(0.5)
  })

  it("shifts writing from a third of the prompts to two thirds", () => {
    const before = blockSizes({ read: true, write: true })
    const after = blockSizes({ read: false, write: true })
    const share = (s: { read: number; write: number }) =>
      s.write / (s.read + s.write)
    expect(share(before)).toBeCloseTo(1 / 3, 2)
    expect(share(after)).toBeCloseTo(2 / 3, 2)
  })
})
