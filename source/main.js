import Player from "./player/Player.js";
import MovieLoader from "./runtime/MovieLoader.js";
import Stage from "./flash/display/Stage.js";

// Browser boot: point the loader at a SWF and everything else — fetching,
// parsing, AVM2 -> JS transpilation and evaluation — happens at runtime. The
// loaded movie then loads its own title/game SWFs through the same loader, so
// only the entry URL is needed here.
const movieUrl = "/game/gamefiles/Loader3.swf?ver=a";

const canvas = document.createElement("canvas");
canvas.width = 960;
canvas.height = 550;
document.body.appendChild(canvas);

const stage = new Stage();
const loader = new MovieLoader(stage);

// No GPU -> this throws right here.
const player = new Player(stage, canvas);
const { root } = await loader.loadRoot(movieUrl, player);
player.start();

globalThis.runtime = { stage, loader, player, root };
console.log("[boot] movie running", root);
