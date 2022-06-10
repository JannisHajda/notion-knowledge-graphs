import GraphManager from "./graphManager.js";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  let graphManager = new GraphManager(process.env.TOKEN);
  let graph = await graphManager.build();
  console.log(graph);
})();
