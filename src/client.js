import { Client as NotionClient } from "@notionhq/client";

class Client extends NotionClient {
  constructor(options) {
    super(options);
    this.page_size = 100;
  }

  errorHandling(error) {
    if (error.name == "APIResponseError")
      switch (error.code) {
        case "object_not_found":
          console.error(error);
          return null;
          break;
      }
    console.error(error);
    throw error;
  }

  async retrieveBlockChildren(blockId) {
    const result = [];

    try {
      let response = await this.blocks.children.list({
        block_id: blockId,
        page_size: this.page_size,
      });

      response.results.map((block) => result.push(block));

      while (response.next_cursor) {
        response = await this.blocks.children.list({
          block_id: blockId,
          page_size: this.page_size,
          start_cursor: response.next_cursor,
        });

        response.results.map((block) => result.push(block));
      }

      return result;
    } catch (error) {
      this.errorHandling(error);
    }
  }

  async retrievePageBlocks(pageId) {
    try {
      let blocks = [];
      let queue = [pageId];

      while (queue.length > 0) {
        let promise = queue.map((blockId) =>
          this.retrieveBlockChildren(blockId)
        );
        let results = await Promise.all(promise);
        results = results.filter((result) => result != null);

        queue = [];

        results.forEach((result) => {
          result.forEach((block) => {
            blocks.push(block);

            if (block.has_children && block.type !== "child_page") {
              queue.push(block.id);
            }
          });
        });
      }

      return blocks;
    } catch (error) {
      this.errorHandling(error);
    }
  }

  async retrievePage(pageId) {
    try {
      const response = await this.pages.retrieve({ page_id: pageId });
      return response;
    } catch (error) {
      this.errorHandling(error);
    }
  }

  async retrieveDatabase(databaseId) {
    try {
      const response = await this.databases.retrieve({
        database_id: databaseId,
      });
      return response;
    } catch (error) {
      this.errorHandling(error);
    }
  }

  async retrieveDatabasePages(databaseId) {
    try {
      let pages = [];
      let response = await this.databases.query({
        database_id: databaseId,
      });

      response.results.map((page) => pages.push(page.id));

      while (response.next_cursor) {
        response = await this.databases.query({
          database_id: databaseId,
          start_cursor: response.next_cursor,
        });

        response.results.map((page) => pages.push(page.id));
      }

      return pages;
    } catch (error) {
      this.errorHandling(error);
    }
  }

  async searchAccessable() {
    try {
      let objects = [];
      let response = await this.search();

      response.results.map((result) =>
        objects.push({ id: result.id, type: result.object })
      );

      while (response.next_cursor) {
        response = await this.search({
          start_cursor: response.next_cursor,
        });

        response.results.map((result) =>
          objects.push({ id: result.id, type: result.object })
        );
      }

      return objects;
    } catch (error) {
      this.errorHandling(error);
    }
  }

  findLinksInBlocks(blocks) {
    let linked_pages = [];
    let databases = [];
    let users = [];
    let child_pages = [];

    blocks.forEach((block) => {
      if (block.type === "child_page") child_pages.push(block.id);

      if ("paragraph" in block && "rich_text" in block.paragraph) {
        let rich_text = block.paragraph.rich_text;
        rich_text
          .filter((text) => text.type === "mention")
          .forEach((mention) => {
            switch (mention.mention.type) {
              case "page":
                linked_pages.push(mention.mention.page.id);
                break;
              case "user":
                users.push(mention.mention.user.id);
                break;
              case "database":
                databases.push(mention.mention.database.id);
                break;
            }
          });
      }
    });

    return { linked_pages, databases, users, child_pages };
  }
}

export default Client;
