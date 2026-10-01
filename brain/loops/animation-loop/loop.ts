// Animation loop: OBSERVE -> UNDERSTAND -> RECONSTRUCT -> RENDER -> COMPARE -> FIND DIFFERENCE -> IMPROVE -> RENDER AGAIN
import { AnimationBrain } from "../../animation/api/brain";
import { optimize } from "../../animation/optimizer/loop";
import { renderAdlFrames } from "../../animation/reconstruction/engine";
import { compareFrames } from "../../animation/visual-comparator/comparator";
export async function runAnimationLoop(animation: AnimationBrain, input: string, mime?: string, targetSimilarity = 85) {
  const understanding = animation.analyze(input, mime);
  const original = renderAdlFrames(understanding.adl);
  const result = optimize(original, understanding.adl, { targetSimilarity });
  const recreated = renderAdlFrames(result.finalAdl);
  const report = compareFrames(original, recreated);
  return { understanding, optimized: result, report };
}
