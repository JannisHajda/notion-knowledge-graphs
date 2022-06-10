import Client from "./client.js";

class GraphManager {
  constructor(token) {
    this.client = new Client({
      auth: token,
    });

    this.graph = {};
  }

  parseGraph() {
    let output = {
      nodes: [],
      links: [],
    };

    Object.keys(this.graph).forEach((id) => {
      output.nodes.push({
        id: id,
        name: graph[id].title ? graph[id].title : "",
        val: 10,
      });

      let type = this.graph[id].type;
      let links = this.graph[id].links;

      if (links.parent.id != null)
        output.links.push({
          source: id,
          target: links.parent.id,
        });

      if (type === "page") {
        links.child_pages.forEach((targetId) => {
          if (targetId != null)
            output.links.push({
              source: id,
              target: targetId,
            });
        });
        links.linked_pages.forEach((targetId) => {
          if (targetId != null)
            output.links.push({
              source: id,
              target: targetId,
            });
        });

        links.databases.forEach((targetId) => {
          if (targetId != null)
            output.links.push({
              source: id,
              target: targetId,
            });
        });
      } else if (type === "database") {
        links.pages.forEach((targetId) => {
          if (targetId != null)
            output.links.push({
              source: id,
              target: targetId,
            });
        });
      }
    });

    return output;
  }

  async update() {
    if (!this.graph) console.error("No graph to update!");

    let pages = Object.keys(this.graph);
    let pagePromise = pages.map((pageId) => retrievePage(pageId));

    pages = await Promise.all(pagePromise);
    pages = pages.filter((page) => page != null);

    let toUpdate = pages.filter(
      (page) =>
        page.id in graph &&
        Date.parse(page.last_edited_time) >
          Date.parse(this.graph[page.id].last_edited_time)
    );

    return true;
  }

  needsToBeProcessed(queue, objectId) {
    return (
      !(objectId in this.graph) &&
      !queue.find((object) => object.id === objectId)
    );
  }

  async build() {
    try {
      let graph = {};
      // get all page/database ids that the client has access to
      let queue = await this.client.searchAccessable();

      while (queue.length > 0) {
        let databases = queue.filter((object) => object.type === "database");
        let pages = queue.filter((object) => object.type === "page");

        // get databases/pages from the id
        [databases, pages] = await Promise.all([
          await Promise.all(
            databases.map((database) =>
              this.client.retrieveDatabase(database.id)
            )
          ),
          await Promise.all(
            pages.map((page) => this.client.retrievePage(page.id))
          ),
        ]);

        // filter out databases/pages that the client doesn't have access to
        databases = databases.filter((database) => database != null);
        pages = pages.filter((page) => page != null);

        let databasesPages, pagesBlocks;
        // for each database: get all linked pages
        // for each page: get all blocks
        [databasesPages, pagesBlocks] = await Promise.all([
          await Promise.all(
            databases.map((database) =>
              this.client.retrieveDatabasePages(database.id)
            )
          ),
          await Promise.all(
            pages.map((page) => this.client.retrievePageBlocks(page.id))
          ),
        ]);

        let pageLinks = [];
        let databaseLinks = [];

        pages.forEach((page, i) => {
          let blocks = pagesBlocks[i];
          // filter out links
          let links = this.client.findLinksInBlocks(blocks);

          let parentType, parentId;
          switch (page.parent.type) {
            case "page_id":
              parentType = "page";
              parentId = page.parent.page_id;
              break;
            case "database_id":
              parentType = "database";
              parentId = page.parent.database_id;
              break;
            case "workspace":
              parentType = "workspace";
              break;
          }

          links.parent = {
            type: parentType,
            id: parentId ? parentId : null,
          };

          pageLinks.push(links);

          let title = "";
          if (
            "Name" in page.properties &&
            page.properties.Name.type === "title"
          ) {
            title = page.properties.Name.title
              .map((title) => title.plain_text.trim())
              .join(" ");
          } else if ("title" in page.properties) {
            title = page.properties.title.title
              .map((title) => title.plain_text.trim())
              .join(" ");
          }

          // add page to graph
          graph[page.id] = {
            title,
            type: "page",
            created_time: page.created_time,
            last_edited_time: page.last_edited_time,
            blocks,
            links,
          };
        });

        databases.forEach((database, i) => {
          let pages = databasesPages[i];
          let links = {
            pages,
          };

          let parentType, parentId;
          switch (database.parent.type) {
            case "page_id":
              parentType = "page";
              parentId = database.parent.page_id;
              break;
            case "database_id":
              parentType = "database";
              parentId = database.parent.database_id;
              break;
            case "workspace":
              parentType = "workspace";
              break;
          }

          links.parent = {
            type: parentType,
            id: parentId ? parentId : null,
          };

          databaseLinks.push(links);

          let title = database.title
            .map((title) => title.plain_text.trim())
            .join(" ");

          // add database to graph
          graph[database.id] = {
            title,
            type: "database",
            created_time: database.created_time,
            last_edited_time: database.last_edited_time,
            links,
          };
        });

        // all elements in the queue get processed in the same iteration
        // -> queue needs to be reset
        queue = [];

        pageLinks.forEach((links) => {
          links.child_pages.forEach((pageId) => {
            this.needsToBeProcessed(queue, pageId)
              ? queue.push({ id: pageId, type: "page" })
              : null;
          });

          links.linked_pages.forEach((pageId) =>
            this.needsToBeProcessed(queue, pageId)
              ? queue.push({ id: pageId, type: "page" })
              : null
          );

          links.databases.forEach((databaseId) => {
            this.needsToBeProcessed(queue, databaseId)
              ? queue.push({ id: databaseId, type: "database" })
              : null;
          });

          this.needsToBeProcessed(queue, links.parent.id) &&
          links.parent.type !== "workspace"
            ? queue.push({ id: links.parent.id, type: links.parent.type })
            : null;
        });

        databaseLinks.forEach((links) => {
          links.pages.forEach((pageId) => {
            this.needsToBeProcessed(queue, pageId)
              ? queue.push({ id: pageId, type: "page" })
              : null;
          });

          this.needsToBeProcessed(queue, links.parent.id) &&
          links.parent.type !== "workspace"
            ? queue.push({ id: links.parent.id, type: links.parent.type })
            : null;
        });
      }

      // update internal graph
      this.graph = graph;
      return graph;
    } catch (error) {
      console.error(error);
    }
  }
}

export default GraphManager;
