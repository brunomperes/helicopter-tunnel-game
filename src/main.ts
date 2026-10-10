import { startApp } from "./app.js";
import { createGameUi } from "./ui.js";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("#game canvas not found");

startApp(canvas, createGameUi(document));
