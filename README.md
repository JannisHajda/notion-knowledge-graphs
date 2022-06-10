# notion-knowledge-graphs

Notion vs. Obsidian? Combine the best out of the two worlds by, adding knowledge graphs to Notion using the REST-API and react-force-graphs!  

### Features

- Generate graph data (still missing rate limit support!)

### Built with

- [notion-sdk-js](https://github.com/makenotion/notion-sdk-js)
- [react-force-graph](https://github.com/vasturiano/react-force-graph) 

## Getting started

### Prerequisites

Create a [notion integration](https://www.notion.so/my-integrations) and add the internal integration token to your environment variables. Make sure to share the pages you want to query with the integration!
### Install

```
yarn install
```

### Usage

```
yarn start
```

### To-do

- [ ] Implement functionality into Chrome extension
- [ ] Update graph data
- [ ] Add support for rate limits
- [x] Get graph data
