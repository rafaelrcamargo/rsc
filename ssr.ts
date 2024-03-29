import http from "http"
import { resolve } from "path"

import { createElement, use } from "react"
import { renderToPipeableStream } from "react-dom/server.node"
import { createFromNodeStream } from "react-server-dom-esm/client.node"
import express from "express"

import { logger } from "./utils"

const moduleBaseURL = "/build/"
const port = 3000

console.log(`----------------- Listening on http://localhost:${port}`)

express()
  .use(logger)
  .use("/build", express.static("build"))
  .use("/node_modules", express.static("node_modules"))
  .get("/*", async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)

    if (url.pathname.includes("favicon.ico")) return res.end() // Ignore favicon requests

    url.port = "3001" // Forward to the SSR API server
    url.searchParams.set("__RSC", "true") // Let's re-use the url and forward to the API

    return http.get(url.toString(), async rsc => {
      let Root = () => use(createFromNodeStream(rsc, resolve("build/") + "/", moduleBaseURL)) // Create a root component from the RSC result
      const Layout = (await import(resolve("build/_layout"))).default // Load a HTML shell layout

      renderToPipeableStream(createElement(Layout, { children: createElement(Root) }), {
        bootstrapModules: ["/build/_client.js"],
        importMap: {
          imports: {
            "react/jsx-dev-runtime": "https://esm.sh/react@canary/jsx-dev-runtime.js",
            react: "https://esm.sh/react@canary",
            "react-dom": "https://esm.sh/react-dom@canary",
            "react-dom/": "https://esm.sh/react-dom@canary/",
            "react-server-dom-esm/client":
              "/node_modules/react-server-dom-esm/esm/react-server-dom-esm-client.browser.development.js"
          }
        }
      }).pipe(res) // Render the the element as html and send it to the client
    })
  })
  .listen(port)
