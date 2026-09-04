/**
 * ViewModel barrel.
 *
 * What: re-exports the lab’s command object.
 * Why: the View should import from `@/viewmodel`, not reach into the Model
 * to `new SimEngine`. That import path is the architecture.
 */
export { LabViewModel, type LabViewModelOptions, type LabViewState } from "./LabViewModel.ts";
