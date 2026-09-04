/**
 * View — pretty. Not the argument.
 *
 * What: buttons, captions, the 4-pane WebGL canvas, click sounds.
 * Why it lives apart from the Model: a critic who wants to audit gravity
 * should not have to read React. A critic who wants to audit the chrome
 * should not have to read Eurocode 3.
 *
 * The View constructs a `LabViewModel`. It never constructs `SimEngine`.
 */
export { LabApp } from "./lab-app.tsx";
export { TowerCanvas } from "./tower-canvas.tsx";
