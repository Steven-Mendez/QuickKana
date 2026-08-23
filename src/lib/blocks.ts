import type { ExerciseBlock, ExerciseType } from "@/lib/types"

/**
 * Reading prompts per block. A reading answer takes a few seconds, so the run
 * can be longer and still feel like a short stretch.
 */
export const READ_BLOCK = 8

/**
 * Writing prompts per block. Tracing a character takes several times what a
 * reading answer does, so fewer prompts make a comparable stretch of time.
 */
export const WRITE_BLOCK = 4

const blockSize = (exercise: ExerciseType): number =>
  exercise === "read" ? READ_BLOCK : WRITE_BLOCK

/**
 * Advances the block state by one prompt: continues the current run while it
 * has prompts left, otherwise starts a full run of the other type. With no
 * block yet (session start, or a disabled type just re-enabled), the first
 * run is of `first`.
 */
export function nextBlock(
  block: ExerciseBlock | null,
  first: ExerciseType
): ExerciseBlock {
  if (block !== null && block.left > 0) {
    return { exercise: block.exercise, left: block.left - 1 }
  }
  const exercise =
    block === null ? first : block.exercise === "read" ? "write" : "read"
  return { exercise, left: blockSize(exercise) - 1 }
}
