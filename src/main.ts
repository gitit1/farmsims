/**
 * Run:
 * npm install
 * npm run dev
 */
import { Game } from "./core/game";
import { GameLoop } from "./core/loop";
import { loadContent } from "./content/loader";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas element with id 'game' was not found.");
}

const start = async () => {
  const content = await loadContent();
  const game = new Game(canvas, content);
  const loop = new GameLoop(game);
  loop.start();
};

start();
